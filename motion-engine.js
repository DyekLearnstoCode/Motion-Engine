/*==========================================================
    Motion Engine V2
    Production frame sequence engine for GoHighLevel
==========================================================*/

const MotionEngine = {
  /*=========================================
      CONFIG
    =========================================*/

  config: {
    heroSelector: ".motion-hero",
    canvasID: "heroCanvas",
    frameCount: 241,
    imagePath: "https://dyeklearnstocode.github.io/Motion-Engine/frames/frame_",
    extension: ".jpg",
    scrollLength: 14000,
    scrub: 0.35,
    pin: true,
    preloadFirst: 20,
    loader: true,
    debug: false,
    backgroundColor: "#000",
    desktopFit: "cover",
    loadConcurrency: 4,
    maxCachedFrames: 96,
    lookAheadFrames: 18,
    lookBehindFrames: 6,
    progressiveBatchSize: 4,
    retryFailedFrames: false,
  },

  /*=========================================
      STATE
    =========================================*/

  hero: null,
  heroInner: null,
  canvas: null,
  canvasWrap: null,
  ctx: null,
  images: [],
  currentFrame: 0,
  requestedFrame: 0,
  loadedFrames: 0,
  initialized: false,
  scrollTween: null,
  scrollTrigger: null,
  resizeObserver: null,
  resizeFallback: null,
  renderRAF: null,
  renderDirty: true,
  lastRenderKey: "",
  waitTimer: null,
  frameCache: new Map(),
  frameRequests: new Map(),
  failedFrames: new Set(),
  loadedFrameSet: new Set(),
  preloadFrames: new Set(),
  preloadSettledFrames: new Set(),
  loadQueue: [],
  loadingFrames: 0,
  preloadTarget: 0,
  scrollStarted: false,
  progressiveIndex: 0,
  progressiveHandle: null,

  /*=========================================
      INITIALIZE
    =========================================*/

  init(options = {}) {
    if (this.initialized) return;

    if (options && typeof options === "object") {
      this.config = {
        ...this.config,
        ...options,
      };
    }

    this.images = new Array(this.config.frameCount);
    this.resetImageState();
    this.waitForHero();
  },

  /*=========================================
      WAIT FOR GHL
    =========================================*/

  waitForHero() {
    const hero = document.querySelector(this.config.heroSelector);

    if (!hero) {
      this.waitTimer = window.setTimeout(() => this.waitForHero(), 100);
      return;
    }

    this.hero = hero;

    this.media = hero.querySelector(".motion-media");
    this.overlay = hero.querySelector(".motion-overlay");
    this.content = hero.querySelector(".motion-content");
    this.footer = hero.querySelector(".motion-footer");
    this.progress = hero.querySelector(".motion-progress span");
    this.mobileContent = hero.querySelector(".motion-mobile-content");

    if (!this.media) {
      console.error("[Motion Engine] .motion-media not found.");
      return;
    }

    this.initialized = true;

    this.log("Motion Hero Found");

    this.createCanvas();
  },

  /*=========================================
      DEBUG
    =========================================*/

  log(message, payload) {
    if (!this.config.debug) return;

    if (payload === undefined) {
      console.log("[Motion Engine]", message);
      return;
    }

    console.log("[Motion Engine]", message, payload);
  },

  /*=========================================
      DOM
    =========================================*/

  createCanvas() {
    let canvas = document.getElementById(this.config.canvasID);

    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = this.config.canvasID;
      this.media.prepend(canvas);
    }

    this.canvas = canvas;
    this.canvasWrap = this.media;

    this.ctx = canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    });

    this.applyBaseLayout();

    this.observeResize();

    this.resize();

    this.loadImages();
  },

  applyBaseLayout() {
    Object.assign(this.hero.style, {
      position: "relative",
      overflow: "hidden",
    });

    Object.assign(this.media.style, {
      position: window.innerWidth <= 768 ? "relative" : "absolute",
      inset: window.innerWidth <= 768 ? "" : "0",
      width: "100%",
      overflow: "hidden",
      zIndex: "0",
    });

    Object.assign(this.canvas.style, {
      display: "block",
      width: "100%",
      height: "100%",
    });
  },

  observeResize() {
    this.disconnectResizeObserver();

    if ("ResizeObserver" in window) {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.hero);
      this.resizeObserver.observe(this.canvasWrap);
      return;
    }

    window.addEventListener("resize", this.resizeFallback);
  },

  disconnectResizeObserver() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.resizeFallback) {
      window.removeEventListener("resize", this.resizeFallback);
    }

    this.resizeFallback = () => this.resize();
  },

  /*=========================================
      RESIZE
    =========================================*/

  resize() {
    if (!this.canvas || !this.ctx) return;

    this.applyBaseLayout();

    const dpr = window.devicePixelRatio || 1;

    const size = this.getCanvasSize();

    const width = Math.max(1, Math.round(size.width * dpr));

    const height = Math.max(1, Math.round(size.height * dpr));

    const changed =
      this.canvas.width !== width || this.canvas.height !== height;

    this.canvas.width = width;
    this.canvas.height = height;

    this.canvas.style.width = `${size.width}px`;
    this.canvas.style.height = `${size.height}px`;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (changed) {
      this.renderDirty = true;
      this.scheduleRender(this.currentFrame);
    }

    this.refreshScrollTrigger();
  },

  getCanvasSize() {
    const rect = this.media.getBoundingClientRect();

    return {
      width: Math.max(1, Math.round(rect.width)),

      height: Math.max(1, Math.round(rect.height)),
    };
  },

  refresh() {
    this.renderDirty = true;
    this.resize();
    this.refreshScrollTrigger(true);
  },

  refreshScrollTrigger(force = false) {
    if (!window.ScrollTrigger) return;
    if (!force && !this.scrollTrigger) return;

    window.ScrollTrigger.refresh();
  },

  /*=========================================
      DESTROY
    =========================================*/

  destroy() {
    if (this.waitTimer) {
      window.clearTimeout(this.waitTimer);
      this.waitTimer = null;
    }

    if (this.renderRAF) {
      window.cancelAnimationFrame(this.renderRAF);
      this.renderRAF = null;
    }

    if (this.scrollTween) {
      this.scrollTween.kill();
      this.scrollTween = null;
    }

    if (this.scrollTrigger) {
      this.scrollTrigger.kill();
      this.scrollTrigger = null;
    }

    this.disconnectResizeObserver();

    if (this.canvasWrap) {
      this.canvasWrap.remove();
    }

    this.hero = null;
    this.heroInner = null;
    this.canvas = null;
    this.canvasWrap = null;
    this.ctx = null;
    this.images = [];
    this.resetImageState();
    this.loadedFrames = 0;
    this.currentFrame = 0;
    this.requestedFrame = 0;
    this.initialized = false;
    this.renderDirty = true;
    this.lastRenderKey = "";
  },

  /*=========================================
      LOAD IMAGES
    =========================================*/

  loadImages() {
    this.images = new Array(this.config.frameCount);
    this.resetImageState();
    this.preloadTarget = Math.max(
      1,
      Math.min(this.config.preloadFirst, this.config.frameCount),
    );

    for (let index = 0; index < this.preloadTarget; index += 1) {
      this.preloadFrames.add(index);
      this.requestImage(index, {
        priority: true,
        preload: true,
      }).catch(() => {});
    }

    this.queueFrameWindow(0);
  },

  getFrameURL(index) {
    return `${this.config.imagePath}${String(index + 1).padStart(6, "0")}${this.config.extension}`;
  },

  resetImageState() {
    this.frameCache = new Map();
    this.frameRequests = new Map();
    this.failedFrames = new Set();
    this.loadedFrameSet = new Set();
    this.preloadFrames = new Set();
    this.preloadSettledFrames = new Set();
    this.loadQueue = [];
    this.loadingFrames = 0;
    this.loadedFrames = 0;
    this.preloadTarget = 0;
    this.scrollStarted = false;
    this.progressiveIndex = 0;

    if (this.progressiveHandle) {
      this.cancelIdleTask(this.progressiveHandle);
      this.progressiveHandle = null;
    }
  },

  requestImage(index, options = {}) {
    const frame = this.clampFrame(index);

    if (this.frameCache.has(frame)) {
      return Promise.resolve(this.getCachedImage(frame));
    }

    if (this.frameRequests.has(frame)) {
      return this.frameRequests.get(frame);
    }

    if (this.failedFrames.has(frame) && !this.config.retryFailedFrames) {
      return Promise.reject(new Error(`Frame ${frame + 1} previously failed`));
    }

    const promise = new Promise((resolve, reject) => {
      const task = {
        frame,
        resolve,
        reject,
        preload: Boolean(options.preload),
      };

      if (options.priority) {
        this.loadQueue.unshift(task);
      } else {
        this.loadQueue.push(task);
      }

      this.pumpLoadQueue();
    });

    this.frameRequests.set(frame, promise);

    return promise;
  },

  pumpLoadQueue() {
    const concurrency = Math.max(1, this.config.loadConcurrency);

    while (this.loadingFrames < concurrency && this.loadQueue.length) {
      const task = this.loadQueue.shift();
      this.loadFrameTask(task);
    }
  },

  loadFrameTask(task) {
    this.loadingFrames += 1;

    const image = new Image();
    image.decoding = "async";

    const finish = () => {
      this.loadingFrames -= 1;
      this.frameRequests.delete(task.frame);
      this.markPreloadSettled(task.frame);
      this.pumpLoadQueue();
    };

    const store = () => {
      this.storeFrame(task.frame, image);
      task.resolve(image);
      finish();
    };

    image.onload = () => {
      if (image.decode) {
        image.decode().then(store).catch(store);
        return;
      }

      store();
    };

    image.onerror = () => {
      this.failedFrames.add(task.frame);
      console.warn("[Motion Engine] Frame failed:", task.frame + 1);
      task.reject(new Error(`Frame ${task.frame + 1} failed`));
      finish();
    };

    image.src = this.getFrameURL(task.frame);
  },

  storeFrame(index, image) {
    const frame = this.clampFrame(index);

    this.frameCache.set(frame, {
      image,
      lastUsed: this.now(),
    });
    this.images[frame] = image;

    if (!this.loadedFrameSet.has(frame)) {
      this.loadedFrameSet.add(frame);
      this.loadedFrames = this.loadedFrameSet.size;
    }

    this.evictFrames();
    this.onFrameReady(frame);
  },

  getCachedImage(index) {
    const frame = this.clampFrame(index);
    const entry = this.frameCache.get(frame);

    if (!entry) return null;

    entry.lastUsed = this.now();
    return entry.image;
  },

  onFrameReady(index) {
    if (index === 0 || index === this.requestedFrame) {
      this.scheduleRender(index);
    }

    if (this.loadedFrames === this.config.frameCount) {
      this.log("All frames loaded");
    }
  },

  markPreloadSettled(index) {
    if (!this.preloadFrames.has(index) || this.preloadSettledFrames.has(index))
      return;

    this.preloadSettledFrames.add(index);

    if (
      !this.scrollStarted &&
      this.preloadSettledFrames.size >= this.preloadTarget
    ) {
      this.scrollStarted = true;
      this.startScroll();
      this.startProgressiveLoading();
    }
  },

  queueFrameWindow(index) {
    const frame = this.clampFrame(index);
    const start = Math.max(0, frame - this.config.lookBehindFrames);
    const end = Math.min(
      this.config.frameCount - 1,
      frame + this.config.lookAheadFrames,
    );

    this.requestImage(frame, {
      priority: true,
    }).catch(() => {});

    for (let next = frame + 1; next <= end; next += 1) {
      this.requestImage(next).catch(() => {});
    }

    for (let previous = frame - 1; previous >= start; previous -= 1) {
      this.requestImage(previous).catch(() => {});
    }
  },

  startProgressiveLoading() {
    this.progressiveIndex = Math.max(this.preloadTarget, this.progressiveIndex);
    this.scheduleProgressiveLoad();
  },

  scheduleProgressiveLoad() {
    if (
      this.progressiveHandle ||
      this.progressiveIndex >= this.config.frameCount
    )
      return;

    this.progressiveHandle = this.requestIdleTask(() => {
      this.progressiveHandle = null;
      this.loadProgressiveBatch();
    });
  },

  loadProgressiveBatch() {
    let queued = 0;
    const batchSize = Math.max(1, this.config.progressiveBatchSize);
    const maxCached = this.getMaxCachedFrames();

    while (
      queued < batchSize &&
      this.progressiveIndex < this.config.frameCount &&
      this.frameCache.size + this.frameRequests.size < maxCached
    ) {
      this.requestImage(this.progressiveIndex).catch(() => {});
      this.progressiveIndex += 1;
      queued += 1;
    }

    if (
      this.progressiveIndex < this.config.frameCount &&
      this.frameCache.size + this.frameRequests.size < maxCached
    ) {
      this.scheduleProgressiveLoad();
    }
  },

  evictFrames() {
    const maxCached = this.getMaxCachedFrames();

    if (this.frameCache.size <= maxCached) return;

    const protectedFrames = this.getProtectedFrames();
    const entries = [...this.frameCache.entries()].sort(
      (a, b) => a[1].lastUsed - b[1].lastUsed,
    );

    for (const [frame] of entries) {
      if (this.frameCache.size <= maxCached) return;
      if (protectedFrames.has(frame)) continue;

      this.frameCache.delete(frame);
      this.images[frame] = undefined;
    }

    this.scheduleProgressiveLoad();
  },

  getMaxCachedFrames() {
    return Math.max(
      this.preloadTarget || 1,
      this.config.lookAheadFrames + this.config.lookBehindFrames + 2,
      this.config.maxCachedFrames || this.config.frameCount,
    );
  },

  getProtectedFrames() {
    const protectedFrames = new Set([
      this.currentFrame,
      this.requestedFrame,
      0,
    ]);
    const start = Math.max(
      0,
      this.requestedFrame - this.config.lookBehindFrames,
    );
    const end = Math.min(
      this.config.frameCount - 1,
      this.requestedFrame + this.config.lookAheadFrames,
    );

    for (let frame = start; frame <= end; frame += 1) {
      protectedFrames.add(frame);
    }

    return protectedFrames;
  },

  requestIdleTask(callback) {
    if ("requestIdleCallback" in window) {
      return window.requestIdleCallback(callback, {
        timeout: 500,
      });
    }

    return window.setTimeout(callback, 80);
  },

  cancelIdleTask(handle) {
    if ("cancelIdleCallback" in window) {
      window.cancelIdleCallback(handle);
      return;
    }

    window.clearTimeout(handle);
  },

  now() {
    return window.performance && window.performance.now
      ? window.performance.now()
      : Date.now();
  },

  /*=========================================
      RENDER SCHEDULER
    =========================================*/

  scheduleRender(index = this.currentFrame) {
    const frame = this.clampFrame(index);

    this.requestedFrame = frame;
    this.queueFrameWindow(frame);

    if (this.renderRAF) return;

    this.renderRAF = window.requestAnimationFrame(() => {
      this.renderRAF = null;
      this.flushRender();
    });
  },

  flushRender() {
    if (!this.canvas || !this.ctx) return;

    const frame = this.clampFrame(this.requestedFrame);
    const image = this.getCachedImage(frame);

    if (!image) return;

    const renderKey = this.getRenderKey(frame);

    if (!this.renderDirty && renderKey === this.lastRenderKey) {
      return;
    }

    this.drawFrame(frame, image);
    this.currentFrame = frame;
    this.renderDirty = false;
    this.lastRenderKey = renderKey;
  },

  getRenderKey(frame) {
    return [
      frame,
      this.canvas.width,
      this.canvas.height,
      this.config.desktopFit,
    ].join(":");
  },

  drawFrame(index, image = this.images[index]) {

  if (!image || !this.ctx) return;

  const canvasWidth = this.canvas.clientWidth;
  const canvasHeight = this.canvas.clientHeight;

  const imageRatio = image.width / image.height;
  const canvasRatio = canvasWidth / canvasHeight;

  let drawWidth;
  let drawHeight;

  if (canvasRatio > imageRatio) {

    drawWidth = canvasWidth;
    drawHeight = drawWidth / imageRatio;

  } else {

    drawHeight = canvasHeight;
    drawWidth = drawHeight * imageRatio;

  }

  const drawX = (canvasWidth - drawWidth) * 0.5;
  const drawY = (canvasHeight - drawHeight) * 0.5;

  this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  this.ctx.fillStyle = this.config.backgroundColor;
  this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  this.ctx.drawImage(
    image,
    drawX,
    drawY,
    drawWidth,
    drawHeight
  );

},

  getDrawRect(image, canvasWidth, canvasHeight, fit = "cover") {
    const imageRatio = image.width / image.height;
    const canvasRatio = canvasWidth / canvasHeight;
    const shouldCover = fit === "cover";
    const useWidth = shouldCover
      ? canvasRatio > imageRatio
      : canvasRatio < imageRatio;
    const width = useWidth ? canvasWidth : canvasHeight * imageRatio;
    const height = useWidth ? canvasWidth / imageRatio : canvasHeight;

    return {
      x: (canvasWidth - width) * 0.5,
      y: (canvasHeight - height) * 0.5,
      width,
      height,
    };
  },

  renderFrame(index) {
    this.scheduleRender(index);
  },

  render() {
    this.scheduleRender(this.currentFrame);
  },

  clampFrame(index) {
    const frame = Number.isFinite(index) ? Math.round(index) : 0;

    return Math.max(0, Math.min(this.config.frameCount - 1, frame));
  },

  /*=========================================
      START SCROLL
    =========================================*/

  startScroll() {
    if (!window.gsap || !window.ScrollTrigger) {
      console.warn("[Motion Engine] GSAP and ScrollTrigger are required.");
      return;
    }

    if (this.scrollTween) {
      this.scrollTween.kill();
      this.scrollTween = null;
    }

    const playhead = {
      frame: 0,
    };

    this.scrollTween = window.gsap.to(playhead, {
      frame: this.config.frameCount - 1,
      ease: "none",
      onUpdate: () => {
        this.renderFrame(playhead.frame);
      },
      scrollTrigger: {
        trigger: this.hero,
        start: "top top",
        end: `+=${this.config.scrollLength}`,
        pin: this.config.pin,
        pinSpacing: false,
        scrub: this.config.scrub,
        anticipatePin: 1,
        fastScrollEnd: true,
        invalidateOnRefresh: true,
        onRefresh: (self) => {
          this.scrollTrigger = self;
        },
      },
    });

    this.scrollTrigger = this.scrollTween.scrollTrigger || this.scrollTrigger;
    this.refreshScrollTrigger(true);
  },
};

if (typeof window !== "undefined") {
  window.MotionEngine = MotionEngine;
  MotionEngine.init();
}
