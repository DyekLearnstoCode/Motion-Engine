/*==========================================================
    Motion Engine
    Core Module
==========================================================*/

const MotionEngine = {
  /*=========================================
      CONFIG
    =========================================*/

  config: {
    heroSelector: ".hero-scrub",

    canvasID: "heroCanvas",

    frameCount: 151,

    imagePath: "https://dyeklearnstocode.github.io/Img-Scrub/images/download_",

    extension: ".jpg",

    scrollLength: 9000,

    scrub: 0.35,

    pin: true,

    preloadFirst: 5,

    loader: true,

    debug: false,
  },

  /*=========================================
   VARIABLES
 =========================================*/

  hero: null,

  heroInner: null,

  canvas: null,

  ctx: null,

  images: [],

  currentFrame: 0,

  loadedFrames: 0,

  initialized: false,

  scrollTween: null,

  scrollTrigger: null,

  /*=========================================
      INITIALIZE
    =========================================*/

  init() {
    if (this.initialized) return;

    this.waitForHero();
  },

  /*=========================================
      WAIT FOR GHL
    =========================================*/

  waitForHero() {
    const hero = document.querySelector(this.config.heroSelector);

    if (!hero) {
      setTimeout(() => {
        this.waitForHero();
      }, 100);

      return;
    }

    this.hero = hero;

    this.heroInner = hero.querySelector(".inner");

    this.initialized = true;

    this.log("Hero Found");

    this.createCanvas();
  },

  /*=========================================
      DEBUG
    =========================================*/

  log(message) {
    if (!this.config.debug) return;

    console.log("[Motion Engine]", message);
  },

  /*=========================================
  CREATE CANVAS
=========================================*/

  createCanvas() {
    let canvas = document.getElementById(this.config.canvasID);

    if (!canvas) {
      canvas = document.createElement("canvas");

      canvas.id = this.config.canvasID;

      this.heroInner.prepend(canvas);
    }

    this.canvas = canvas;

    this.ctx = canvas.getContext("2d", {
      alpha: false,

      desynchronized: true,
    });
    this.resize();

    this.loadImages();

    window.addEventListener(
      "resize",

      () => this.resize(),
    );
  },

  /*=========================================
      RESIZE
    =========================================*/

  resize() {
    if (!this.canvas) return;

    const dpr = window.devicePixelRatio || 1;

    const width = this.hero.offsetWidth;

    const height = this.hero.offsetHeight;

    this.canvas.width = width * dpr;

    this.canvas.height = height * dpr;

    this.canvas.style.width = width + "px";

    this.canvas.style.height = height + "px";

    this.ctx.setTransform(
      dpr,

      0,

      0,

      dpr,

      0,

      0,
    );

    this.render();

    if (this.scrollTween) {
      ScrollTrigger.refresh();
    }
  },

  /*=========================================
  REFRESH
=========================================*/

  refresh() {
    this.resize();

    ScrollTrigger.refresh();
  },

  /*=========================================
  DESTROY
=========================================*/

  destroy() {
    if (this.scrollTween) {
      this.scrollTween.kill();
    }

    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());

    if (this.canvas) {
      this.canvas.remove();
    }

    this.canvas = null;

    this.ctx = null;

    this.images = [];

    this.loadedFrames = 0;

    this.currentFrame = 0;
  },

  /*=========================================
      LOAD IMAGES
    =========================================*/

  loadImages() {
    for (let i = 0; i < this.config.frameCount; i++) {
      const image = new Image();

      image.onload = () => {
        this.images[i] = image;

        this.loadedFrames++;

        if (i === 0) {
          this.renderFrame(0);
        }

        if (this.loadedFrames === this.config.frameCount) {
          this.startScroll();
        }
      };

      if (this.loadedFrames === this.config.frameCount) {
        this.log("All Frames Loaded");

        this.startScroll();
      }
    }
  },

  /*=========================================
      DRAW FRAME
    =========================================*/

  renderFrame(index) {
    const image = this.images[index];

    if (!image) return;

    this.currentFrame = index;

    const width = this.hero.offsetWidth;

    const height = this.hero.offsetHeight;

    const imageRatio = image.width / image.height;

    const canvasRatio = width / height;

    let drawWidth;

    let drawHeight;

    if (canvasRatio > imageRatio) {
      drawWidth = width;

      drawHeight = width / imageRatio;
    } else {
      drawHeight = height;

      drawWidth = height * imageRatio;
    }

    const drawX = (width - drawWidth) * 0.5;

    const drawY = (height - drawHeight) * 0.5;

    this.ctx.clearRect(
      0,

      0,

      width,

      height,
    );

    this.ctx.drawImage(
      image,

      drawX,

      drawY,

      drawWidth,

      drawHeight,
    );
  },

  /*=========================================
      RENDER
    =========================================*/

  render() {
    this.renderFrame(this.currentFrame);
  },

  /*=========================================
      START SCROLL
    =========================================*/

  /*=========================================
  START SCROLL
=========================================*/

  startScroll() {
    if (this.scrollTween) {
      this.scrollTween.kill();
    }

    const playhead = {
      frame: 0,
    };

    this.scrollTween = gsap.to(
      playhead,

      {
        frame: this.config.frameCount - 1,

        ease: "none",

        onUpdate: () => {
          this.renderFrame(Math.round(playhead.frame));
        },

        scrollTrigger: {
          trigger: this.hero,

          start: "top top",

          end: "+=" + this.config.scrollLength,

          pin: this.config.pin,

          scrub: this.config.scrub,

          anticipatePin: 1,

          invalidateOnRefresh: true,
        },
      },
    );

    ScrollTrigger.refresh();
  },
};

MotionEngine.init();
