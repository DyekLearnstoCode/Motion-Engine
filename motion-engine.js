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
    desktopFit: "cover",
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
  renderRAF: null,
  renderDirty: true,
  lastRenderKey: "",
  waitTimer: null,

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
    const heroPosition = window.getComputedStyle(this.hero).position;

    if (heroPosition === "static") {
      this.hero.style.position = "relative";
    }

    this.hero.style.minHeight = "100vh";
    this.hero.style.overflow = "hidden";

    Object.assign(this.canvasWrap.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100vh",
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

    if (changed) {
      this.renderDirty = true;
      this.scheduleRender(this.currentFrame);
    }

    this.refreshScrollTrigger();
  },

  getCanvasSize() {
    const wrapRect = this.canvasWrap.getBoundingClientRect();
    const heroRect = this.hero.getBoundingClientRect();
    const width = wrapRect.width || heroRect.width || window.innerWidth;
    const height = wrapRect.height || heroRect.height || window.innerHeight;

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
    const preloadTarget = Math.max(1, Math.min(this.config.preloadFirst, this.config.frameCount));

    for (let index = 0; index < this.config.frameCount; index += 1) {
      const image = new Image();

      image.decoding = "async";

      image.onload = () => {
        this.images[index] = image;
        this.loadedFrames += 1;

        if (index === 0) {
          this.scheduleRender(0);
        }

        if (this.loadedFrames === preloadTarget) {
          this.startScroll();
        }

        if (this.loadedFrames === this.config.frameCount) {
          this.log("All frames loaded");
        }
      };

      image.onerror = () => {
        console.warn("[Motion Engine] Frame failed:", index + 1);
      };

      image.src = this.getFrameURL(index);
    }
  },

  getFrameURL(index) {
    return `${this.config.imagePath}${String(index + 1).padStart(6, "0")}${this.config.extension}`;
  },

  /*=========================================
      RENDER SCHEDULER
    =========================================*/

  scheduleRender(index = this.currentFrame) {
    const frame = this.clampFrame(index);

    this.requestedFrame = frame;

    if (this.renderRAF) return;

    this.renderRAF = window.requestAnimationFrame(() => {
      this.renderRAF = null;
      this.flushRender();
    });
  },

  flushRender() {
    if (!this.canvas || !this.ctx) return;

    const frame = this.clampFrame(this.requestedFrame);
    const image = this.images[frame];

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

    const size = this.getCanvasSize();
    const rect = this.getDrawRect(image, size.width, size.height, this.config.desktopFit);

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
