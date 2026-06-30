/*==========================================================
    Motion Engine V2
    Production frame sequence engine for GoHighLevel
==========================================================*/

const MotionEngine = {
  /*=========================================
      CONFIG
    =========================================*/

  config: {
    heroSelector: ".hero-scrub",
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
    renderMode: "auto",
    mobileBreakpoint: 767,
    mobileAspectRatio: 16 / 9,
    desktopFit: "cover",
    mobileFit: "contain",
    desktopPinSpacing: false,
    mobilePinSpacing: true,
    mobileScrollLength: null,
    progressSelector: "[data-motion-progress], .motion-progress",
    captionSelector: "[data-motion-caption], .motion-caption",
    navbarSelector: "[data-motion-navbar], .motion-navbar, .navbar",
    scrollIndicatorSelector: "[data-motion-scroll-indicator], .motion-scroll-indicator",
    captionFadeDuration: 0.08,
    libraryRetryDelay: 100,
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
  masterTimeline: null,
  scrollTween: null,
  scrollTrigger: null,
  resizeObserver: null,
  resizeFallback: null,
  mode: "desktop",
  renderRAF: null,
  renderDirty: true,
  lastRenderKey: "",
  waitTimer: null,
  libraryTimer: null,
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
    this.heroInner = hero.querySelector(".inner") || hero;
    this.initialized = true;

    this.log("Hero found");
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
    let canvasWrap = canvas ? canvas.closest("[data-motion-engine-canvas]") : null;

    if (!canvasWrap) {
      canvasWrap = document.createElement("div");
      canvasWrap.setAttribute("data-motion-engine-canvas", "");
    }

    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = this.config.canvasID;
    }

    if (canvas.parentElement !== canvasWrap) {
      canvasWrap.appendChild(canvas);
    }

    if (!canvasWrap.parentElement) {
      this.heroInner.prepend(canvasWrap);
    }

    this.canvas = canvas;
    this.canvasWrap = canvasWrap;
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
    const nextMode = this.getRenderMode();
    const modeChanged = nextMode !== this.mode;
    const heroPosition = window.getComputedStyle(this.hero).position;

    this.mode = nextMode;

    if (heroPosition === "static") {
      this.hero.style.position = "relative";
    }

    Object.assign(this.canvas.style, {
      display: "block",
      width: "100%",
      height: "100%",
    });

    if (this.mode === "mobile") {
      this.applyMobileLayout();
    } else {
      this.applyDesktopLayout();
    }

    return modeChanged;
  },

  applyDesktopLayout() {
    Object.assign(this.hero.style, {
      minHeight: "100vh",
      overflow: "hidden",
    });

    Object.assign(this.heroInner.style, {
      position: "relative",
      minHeight: "100vh",
    });

    Object.assign(this.canvasWrap.style, {
      position: "absolute",
      display: "block",
      inset: "0",
      width: "100%",
      height: "100vh",
      aspectRatio: "auto",
      overflow: "hidden",
      zIndex: "0",
    });
  },

  applyMobileLayout() {
    Object.assign(this.hero.style, {
      minHeight: "0",
      overflow: "visible",
    });

    Object.assign(this.heroInner.style, {
      position: "relative",
      minHeight: "0",
    });

    Object.assign(this.canvasWrap.style, {
      position: "relative",
      display: "block",
      inset: "auto",
      width: "100%",
      height: "auto",
      aspectRatio: this.getMobileAspectRatioCSS(),
      overflow: "hidden",
      zIndex: "0",
    });
  },

  getRenderMode() {
    if (this.config.renderMode === "desktop" || this.config.renderMode === "mobile") {
      return this.config.renderMode;
    }

    return window.innerWidth <= this.config.mobileBreakpoint ? "mobile" : "desktop";
  },

  getFitMode() {
    return this.mode === "mobile" ? this.config.mobileFit : this.config.desktopFit;
  },

  getMobileAspectRatio() {
    const ratio = this.config.mobileAspectRatio;

    if (typeof ratio === "number" && ratio > 0) {
      return ratio;
    }

    if (typeof ratio === "string" && ratio.includes("/")) {
      const [width, height] = ratio.split("/").map((part) => Number(part.trim()));

      if (width > 0 && height > 0) {
        return width / height;
      }
    }

    return 16 / 9;
  },

  getMobileAspectRatioCSS() {
    if (typeof this.config.mobileAspectRatio === "string") {
      return this.config.mobileAspectRatio;
    }

    return `${this.getMobileAspectRatio()} / 1`;
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

    const modeChanged = this.applyBaseLayout();
    const dpr = window.devicePixelRatio || 1;
    const size = this.getCanvasSize();
    const nextWidth = Math.max(1, Math.round(size.width * dpr));
    const nextHeight = Math.max(1, Math.round(size.height * dpr));
    const changed = this.canvas.width !== nextWidth || this.canvas.height !== nextHeight;

    this.canvas.width = nextWidth;
    this.canvas.height = nextHeight;
    this.canvas.style.width = `${size.width}px`;
    this.canvas.style.height = `${size.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (changed || modeChanged) {
      this.renderDirty = true;
      this.scheduleRender(this.currentFrame);
    }

    if (modeChanged && this.scrollStarted) {
      this.startScroll();
      return;
    }

    this.refreshScrollTrigger();
  },

  getCanvasSize() {
    const wrapRect = this.canvasWrap.getBoundingClientRect();
    const heroRect = this.hero.getBoundingClientRect();
    const width = wrapRect.width || heroRect.width || window.innerWidth;
    let height = wrapRect.height || heroRect.height || window.innerHeight;

    if (this.mode === "mobile") {
      height = wrapRect.height || width / this.getMobileAspectRatio();
    }

    return {
      width,
      height,
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

    if (this.libraryTimer) {
      window.clearTimeout(this.libraryTimer);
      this.libraryTimer = null;
    }

    if (this.renderRAF) {
      window.cancelAnimationFrame(this.renderRAF);
      this.renderRAF = null;
    }

    this.killTimeline();

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
    this.masterTimeline = null;
    this.scrollTween = null;
    this.scrollTrigger = null;
    this.mode = "desktop";
    this.renderDirty = true;
    this.lastRenderKey = "";
  },

  /*=========================================
      LOAD IMAGES
    =========================================*/

  loadImages() {
    this.images = new Array(this.config.frameCount);
    this.resetImageState();
    this.preloadTarget = Math.max(1, Math.min(this.config.preloadFirst, this.config.frameCount));

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
    if (!this.preloadFrames.has(index) || this.preloadSettledFrames.has(index)) return;

    this.preloadSettledFrames.add(index);

    if (!this.scrollStarted && this.preloadSettledFrames.size >= this.preloadTarget) {
      this.scrollStarted = true;
      this.startScroll();
      this.startProgressiveLoading();
    }
  },

  queueFrameWindow(index) {
    const frame = this.clampFrame(index);
    const start = Math.max(0, frame - this.config.lookBehindFrames);
    const end = Math.min(this.config.frameCount - 1, frame + this.config.lookAheadFrames);

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
    if (this.progressiveHandle || this.progressiveIndex >= this.config.frameCount) return;

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
    const entries = [...this.frameCache.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);

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
    const protectedFrames = new Set([this.currentFrame, this.requestedFrame, 0]);
    const start = Math.max(0, this.requestedFrame - this.config.lookBehindFrames);
    const end = Math.min(this.config.frameCount - 1, this.requestedFrame + this.config.lookAheadFrames);

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
    return window.performance && window.performance.now ? window.performance.now() : Date.now();
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
      this.mode,
      this.getFitMode(),
    ].join(":");
  },

  drawFrame(index, image = this.images[index]) {
    if (!image || !this.ctx) return;

    const size = this.getCanvasSize();
    const rect = this.getDrawRect(image, size.width, size.height, this.getFitMode());

    this.ctx.fillStyle = this.config.backgroundColor;
    this.ctx.fillRect(0, 0, size.width, size.height);
    this.ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  },

  getDrawRect(image, canvasWidth, canvasHeight, fit = "cover") {
    const imageRatio = image.width / image.height;
    const canvasRatio = canvasWidth / canvasHeight;
    const shouldCover = fit === "cover";
    const useWidth = shouldCover ? canvasRatio > imageRatio : canvasRatio < imageRatio;
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
    if (!this.hasMotionLibraries()) {
      this.waitForMotionLibraries();
      return;
    }

    if (window.gsap.registerPlugin) {
      window.gsap.registerPlugin(window.ScrollTrigger);
    }

    this.killTimeline();

    const playhead = {
      frame: 0,
    };

    const timeline = window.gsap.timeline({
      defaults: {
        ease: "none",
      },
      scrollTrigger: this.getScrollTriggerConfig(),
    });

    timeline.to(playhead, {
      frame: this.config.frameCount - 1,
      duration: 1,
      onUpdate: () => {
        this.renderFrame(playhead.frame);
      },
    }, 0);

    this.addProgressToTimeline(timeline);
    this.addCaptionsToTimeline(timeline);
    this.addNavbarToTimeline(timeline);
    this.addScrollIndicatorToTimeline(timeline);

    this.masterTimeline = timeline;
    this.scrollTween = timeline;
    this.scrollTrigger = timeline.scrollTrigger || this.scrollTrigger;
    this.refreshScrollTrigger(true);
  },

  hasMotionLibraries() {
    return Boolean(window.gsap && window.ScrollTrigger);
  },

  waitForMotionLibraries() {
    if (this.libraryTimer) return;

    this.libraryTimer = window.setTimeout(() => {
      this.libraryTimer = null;

      if (this.initialized) {
        this.startScroll();
      }
    }, this.config.libraryRetryDelay);
  },

  killTimeline() {
    const timeline = this.masterTimeline || this.scrollTween;

    if (timeline) {
      timeline.kill();
    } else if (this.scrollTrigger) {
      this.scrollTrigger.kill();
    }

    this.masterTimeline = null;
    this.scrollTween = null;
    this.scrollTrigger = null;
  },

  getScrollTriggerConfig() {
    return {
      trigger: this.getScrollTriggerElement(),
      start: "top top",
      end: `+=${this.getScrollLength()}`,
      pin: this.config.pin ? this.getPinElement() : false,
      pinSpacing: this.getPinSpacing(),
      scrub: this.config.scrub,
      anticipatePin: 1,
      fastScrollEnd: true,
      invalidateOnRefresh: true,
      onRefresh: (self) => {
        this.scrollTrigger = self;
      },
    };
  },

  addProgressToTimeline(timeline) {
    const progressElements = this.getElements(this.config.progressSelector);

    if (!progressElements.length) return;

    window.gsap.set(progressElements, {
      scaleX: 0,
      transformOrigin: "left center",
    });
    timeline.to(progressElements, {
      scaleX: 1,
      duration: 1,
    }, 0);
  },

  addCaptionsToTimeline(timeline) {
    const captions = this.getElements(this.config.captionSelector);

    if (!captions.length) return;

    const fade = this.clampProgress(this.config.captionFadeDuration);

    window.gsap.set(captions, {
      autoAlpha: 0,
    });

    captions.forEach((caption, index) => {
      const bounds = this.getCaptionBounds(caption, index, captions.length);
      const fadeDuration = Math.min(fade, Math.max(0.01, (bounds.end - bounds.start) * 0.5));

      timeline.to(caption, {
        autoAlpha: 1,
        duration: fadeDuration,
      }, bounds.start);

      timeline.to(caption, {
        autoAlpha: 0,
        duration: fadeDuration,
      }, Math.max(bounds.start, bounds.end - fadeDuration));
    });
  },

  addNavbarToTimeline(timeline) {
    const navbars = this.getElements(this.config.navbarSelector);

    if (!navbars.length) return;

    window.gsap.set(navbars, {
      clearProps: "transform,opacity,visibility",
      willChange: "transform, opacity",
    });

    timeline.to(navbars, {
      autoAlpha: 0,
      yPercent: -100,
      duration: 0.12,
    }, 0);

    timeline.to(navbars, {
      autoAlpha: 1,
      yPercent: 0,
      duration: 0.12,
    }, 0.88);
  },

  addScrollIndicatorToTimeline(timeline) {
    const indicators = this.getElements(this.config.scrollIndicatorSelector);

    if (!indicators.length) return;

    timeline.to(indicators, {
      autoAlpha: 0,
      y: 16,
      duration: 0.14,
    }, 0);
  },

  getCaptionBounds(caption, index, total) {
    const segment = 1 / Math.max(1, total);
    const fallbackStart = segment * index;
    const fallbackEnd = Math.min(1, fallbackStart + segment);
    const start = this.readTimelinePoint(caption, ["motionStart", "start", "frameStart"], fallbackStart);
    const end = this.readTimelinePoint(caption, ["motionEnd", "end", "frameEnd"], fallbackEnd);

    return {
      start: this.clampProgress(Math.min(start, end)),
      end: this.clampProgress(Math.max(start, end)),
    };
  },

  readTimelinePoint(element, keys, fallback) {
    for (const key of keys) {
      const value = element.dataset[key];

      if (value !== undefined) {
        return this.parseTimelinePoint(value, fallback);
      }
    }

    return fallback;
  },

  parseTimelinePoint(value, fallback) {
    if (value === null || value === undefined || value === "") return fallback;

    const text = String(value).trim();

    if (text.endsWith("%")) {
      return this.clampProgress(Number(text.slice(0, -1)) / 100);
    }

    const number = Number(text);

    if (!Number.isFinite(number)) return fallback;
    if (number > 1) return this.clampProgress(number / Math.max(1, this.config.frameCount - 1));

    return this.clampProgress(number);
  },

  clampProgress(value) {
    const progress = Number.isFinite(value) ? value : 0;

    return Math.max(0, Math.min(1, progress));
  },

  getElements(selector) {
    if (!selector) return [];

    try {
      return [...document.querySelectorAll(selector)];
    } catch (error) {
      this.log("Invalid selector skipped", selector);
      return [];
    }
  },

  getScrollTriggerElement() {
    return this.mode === "mobile" ? this.canvasWrap : this.hero;
  },

  getPinElement() {
    return this.mode === "mobile" ? this.canvasWrap : this.hero;
  },

  getPinSpacing() {
    return this.mode === "mobile" ? this.config.mobilePinSpacing : this.config.desktopPinSpacing;
  },

  getScrollLength() {
    if (this.mode === "mobile" && this.config.mobileScrollLength) {
      return this.config.mobileScrollLength;
    }

    return this.config.scrollLength;
  },
};

if (typeof window !== "undefined") {
  window.MotionEngine = MotionEngine;
  MotionEngine.init();
}
