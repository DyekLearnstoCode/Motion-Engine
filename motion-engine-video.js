const MotionEngine = {
  config: {
    hero: ".motion-hero",

    media: ".motion-media",

    canvas: "#heroCanvas",

    video: "#heroVideo",

    progress: ".motion-progress span",

    mobileBreakpoint: 768,

    desktopFit: "cover",

    mobileFit: "contain",

    scrollLength: 14000,

    scrub: 0.35,
  },

  hero: null,

  media: null,

  canvas: null,

  ctx: null,

  video: null,

  progress: null,

  resizeObserver: null,

  tween: null,

  initialized: false,

  init() {
    if (this.initialized) return;

    this.hero = document.querySelector(this.config.hero);

    if (!this.hero) {
      requestAnimationFrame(() => this.init());

      return;
    }

    this.media = this.hero.querySelector(this.config.media);

    this.canvas = this.hero.querySelector(this.config.canvas);

    this.video = this.hero.querySelector(this.config.video);

    this.progress = this.hero.querySelector(this.config.progress);

    if (!this.media || !this.canvas || !this.video) {
      requestAnimationFrame(() => this.init());

      return;
    }

    this.ctx = this.canvas.getContext("2d", {
      alpha: false,

      desynchronized: true,
    });

    this.initialized = true;

    this.bindVideo();
  },

  bindVideo() {
    this.video.pause();

    this.video.currentTime = 0;

    this.video.addEventListener(
      "loadedmetadata",

      () => {
        this.updateLayout();

        this.resize();

        this.observe();

        this.bindEvents();

        this.drawFirstFrame();

        this.startScroll();
      },

      { once: true },
    );
  },

  /*=========================================
    ADD THIS AFTER bindVideo()
=========================================*/

  bindEvents() {
    this.video.addEventListener(
      "seeked",

      () => {
        this.render();
      },
    );

    this.video.addEventListener(
      "loadeddata",

      () => {
        this.render();
      },
    );

    this.video.addEventListener(
      "canplay",

      () => {
        this.render();
      },
    );

    window.addEventListener(
      "resize",

      () => {
        this.resize();

        ScrollTrigger.refresh();
      },
    );
  },

  /*=========================================
    PLAY FIRST FRAME
=========================================*/

  drawFirstFrame() {
    this.video.currentTime = 0;

    this.render();
  },

  /*=========================================
    MOBILE LAYOUT
=========================================*/

  updateLayout() {
    if (window.innerWidth <= this.config.mobileBreakpoint) {
      this.hero.classList.add("is-mobile");

      this.hero.classList.remove("is-desktop");
    } else {
      this.hero.classList.add("is-desktop");

      this.hero.classList.remove("is-mobile");
    }
  },

  /*=========================================
    RAF RENDER
=========================================*/

  requestRender() {
    if (this.rendering) return;

    this.rendering = true;

    requestAnimationFrame(() => {
      this.rendering = false;

      this.render();
    });
  },

  observe() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.resize();

      this.render();
    });

    this.resizeObserver.observe(this.media);
  },

  resize() {
    const rect = this.media.getBoundingClientRect();

    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = Math.round(rect.width * dpr);

    this.canvas.height = Math.round(rect.height * dpr);

    this.canvas.style.width = rect.width + "px";

    this.canvas.style.height = rect.height + "px";

    this.ctx.setTransform(
      dpr,

      0,

      0,

      dpr,

      0,

      0,
    );
  },

  render() {
    if (this.video.readyState < 2) return;

    const cw = this.canvas.clientWidth;

    const ch = this.canvas.clientHeight;

    const vw = this.video.videoWidth;

    const vh = this.video.videoHeight;

    const fit =
      window.innerWidth <= this.config.mobileBreakpoint
        ? this.config.mobileFit
        : this.config.desktopFit;

    const videoRatio = vw / vh;

    const canvasRatio = cw / ch;

    let dw;

    let dh;

    if (fit === "cover" ? canvasRatio > videoRatio : canvasRatio < videoRatio) {
      dw = cw;

      dh = dw / videoRatio;
    } else {
      dh = ch;

      dw = dh * videoRatio;
    }

    const dx = (cw - dw) * 0.5;

    const dy = (ch - dh) * 0.5;

    this.ctx.clearRect(
      0,

      0,

      cw,

      ch,
    );

    this.ctx.drawImage(
      this.video,

      dx,

      dy,

      dw,

      dh,
    );
  },
  /*=========================================
    REPLACE startScroll()
=========================================*/

startScroll(){

    gsap.registerPlugin(

        ScrollTrigger

    );

    if(this.tween){

        this.tween.kill();

    }

    const playhead={

        time:0

    };

    const renderFrame=()=>{

        if("requestVideoFrameCallback" in this.video){

            this.video.requestVideoFrameCallback(()=>{

                this.render();

            });

        }

        else{

            this.requestRender();

        }

    };

    this.tween=gsap.to(

        playhead,

        {

            time:this.video.duration,

            ease:"none",

            duration:1,

            onUpdate:()=>{

                if(

                    Math.abs(

                        this.video.currentTime-playhead.time

                    )>0.001

                ){

                    this.video.currentTime=

                        playhead.time;

                }

                renderFrame();

            },

            scrollTrigger:{

                trigger:

                    window.innerWidth<=this.config.mobileBreakpoint

                        ?this.media

                        :this.hero,

                start:"top top",

                end:"+="+this.config.scrollLength,

                pin:true,

                scrub:this.config.scrub,

                anticipatePin:1,

                invalidateOnRefresh:true,

                fastScrollEnd:true,

                onUpdate:(self)=>{

                    if(this.progress){

                        this.progress.style.transform=

                            `scaleX(${self.progress})`;

                    }

                }

            }

        }

    );

},

/*=========================================
    ADD THIS FUNCTION
=========================================*/

renderLoop(){

    if(this.destroyed) return;

    this.render();

    requestAnimationFrame(

        ()=>this.renderLoop()

    );

},

  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    if (this.tween) {
      this.tween.kill();
    }

    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  },
};

window.MotionEngine = MotionEngine;

MotionEngine.init();
