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

        imagePath:
            "https://dyeklearnstocode.github.io/Img-Scrub/images/download_",

        extension: ".jpg",

        scrollLength: 9000,

        scrub: 0.35,

        pin: true,

        preloadFirst: 5,

        loader: true,

        debug: false

    },



    /*=========================================
      VARIABLES
    =========================================*/

    hero: null,

    heroInner: null,

    canvas: null,

    ctx: null,

  images: new Array(151),

imageCache: {},

currentFrame: 0,

loadedFrames: 0,,

    currentFrame: 0,

    loadedFrames: 0,

    initialized: false,



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

        const hero = document.querySelector(
            this.config.heroSelector
        );

        if (!hero) {

            setTimeout(() => {

                this.waitForHero();

            }, 100);

            return;

        }

        this.hero = hero;

        this.heroInner =
            hero.querySelector(".inner");

        this.initialized = true;

        this.log("Hero Found");

        this.createCanvas();

    },



    /*=========================================
      DEBUG
    =========================================*/

    log(message) {

        if (!this.config.debug) return;

        console.log(
            "[Motion Engine]",
            message
        );

    }

};

MotionEngine.init();

/*=========================================
  CREATE CANVAS
=========================================*/

createCanvas() {

    let canvas = document.getElementById(
        this.config.canvasID
    );

    if (!canvas) {

        canvas = document.createElement("canvas");

        canvas.id = this.config.canvasID;

        this.heroInner.prepend(canvas);

    }

    this.canvas = canvas;

    this.ctx = canvas.getContext("2d", {

        alpha: false,

        desynchronized: true

    });

    this.loadImages();

this.resize();

    window.addEventListener(
        "resize",
        () => this.resize()
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
        0
    );

    this.render();

},

/*=========================================
  RENDER PLACEHOLDER
=========================================*/

render() {

    if (!this.ctx) return;

    const width = this.hero.offsetWidth;

    const height = this.hero.offsetHeight;

    this.ctx.fillStyle = "#111";

    this.ctx.fillRect(
        0,
        0,
        width,
        height
    );

    this.ctx.fillStyle = "#ffffff";

    this.ctx.font = "bold 48px Arial";

    this.ctx.fillText(
        "Motion Engine",
        60,
        100
    );

    this.ctx.font = "22px Arial";

    this.ctx.fillText(
        "Renderer Ready",
        60,
        145
    );

},

/*=========================================
  REFRESH
=========================================*/

refresh() {

    this.resize();

},

/*=========================================
  DESTROY
=========================================*/

destroy() {

    if (this.canvas) {

        this.canvas.remove();

    }

    this.canvas = null;

    this.ctx = null;

}

/*=========================================
  LOAD FIRST FRAME
=========================================*/

loadFirstFrame() {

    this.firstFrame = new Image();

    this.firstFrame.onload = () => {

        this.render();

        this.log("Frame 1 Loaded");

    };

    this.firstFrame.src =
        this.config.imagePath +
        "000001" +
        this.config.extension;

},

/*=========================================
  LOAD IMAGES
=========================================*/

loadImages() {

    for(let i = 0; i < this.config.frameCount; i++){

        const image = new Image();

        image.onload = () => {

            this.images[i] = image;

            this.loadedFrames++;

            if(i === 0){

                this.renderFrame(0);

            }

            this.log(

                this.loadedFrames +

                " / " +

                this.config.frameCount

            );

        };

        image.src =

            this.config.imagePath +

            String(i + 1).padStart(6,"0") +

            this.config.extension;

    }

},


/*=========================================
  LOAD FIRST FRAME
=========================================*/

loadFirstFrame() {

    this.firstFrame = new Image();

    this.firstFrame.onload = () => {

        this.render();

        this.log("Frame 1 Loaded");

    };

    this.firstFrame.src =
        this.config.imagePath +
        "000001" +
        this.config.extension;

},

/*=========================================
  DRAW IMAGE (COVER)
=========================================*/

drawCover(image) {

    const width = this.hero.offsetWidth;
    const height = this.hero.offsetHeight;

    const imageRatio =
        image.width / image.height;

    const canvasRatio =
        width / height;

    let drawWidth;
    let drawHeight;

    if (canvasRatio > imageRatio) {

        drawWidth = width;
        drawHeight = width / imageRatio;

    } else {

        drawHeight = height;
        drawWidth = height * imageRatio;

    }

    const drawX =
        (width - drawWidth) * 0.5;

    const drawY =
        (height - drawHeight) * 0.5;

    this.ctx.clearRect(
        0,
        0,
        width,
        height
    );

    this.ctx.drawImage(

        image,

        drawX,

        drawY,

        drawWidth,

        drawHeight

    );

},

/*=========================================
  DRAW FRAME
=========================================*/

renderFrame(index){

    const image = this.images[index];

    if(!image) return;

    this.currentFrame = index;

    const width = this.hero.offsetWidth;

    const height = this.hero.offsetHeight;

    const imageRatio =

        image.width /

        image.height;

    const canvasRatio =

        width /

        height;

    let drawWidth;

    let drawHeight;

    if(canvasRatio > imageRatio){

        drawWidth = width;

        drawHeight =

            width /

            imageRatio;

    }

    else{

        drawHeight = height;

        drawWidth =

            height *

            imageRatio;

    }

    const drawX =

        (width - drawWidth) * .5;

    const drawY =

        (height - drawHeight) * .5;

    this.ctx.clearRect(

        0,

        0,

        width,

        height

    );

    this.ctx.drawImage(

        image,

        drawX,

        drawY,

        drawWidth,

        drawHeight

    );

},

/*=========================================
  RENDER
=========================================*/

render() {

    if (!this.firstFrame) return;

    if (!this.firstFrame.complete) return;

    this.drawCover(
        this.firstFrame
    );

},