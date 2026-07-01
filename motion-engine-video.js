/*==========================================================
    Motion Engine Video V1
    Phase 1A
==========================================================*/

const MotionEngine = {

    /*=========================================
        CONFIG
    =========================================*/

    config:{

        heroSelector:".motion-hero",

        canvasID:"heroCanvas",

        videoPath: "https://dyeklearnstocode.github.io/Motion-Engine/videos/frame.mp4",

        scrollLength:14000,

        scrub:0.35,

        pin:true,

        pinSpacing:true,

        mobilePinSpacing:false,

        mobileBreakpoint:768,

        desktopFit:"cover",

        mobileFit:"contain",

        backgroundColor:"#000",

        debug:false

    },

    /*=========================================
        STATE
    =========================================*/

    hero:null,

    media:null,

    overlay:null,

    content:null,

    footer:null,

    progress:null,

    canvas:null,

    ctx:null,

    video:null,

    resizeObserver:null,

    resizeFallback:null,

    scrollTween:null,

    scrollTrigger:null,

    initialized:false,

    ready:false,

    videoReady:false,

    currentTime:0,

    renderRAF:null,

    renderDirty:true,

    waitTimer:null,

    /*=========================================
        INIT
    =========================================*/

    init(options={}){

        if(this.initialized) return;

        if(typeof options==="object"){

            this.config={

                ...this.config,

                ...options

            };

        }

        this.waitForHero();

    },

    /*=========================================
        WAIT FOR HERO
    =========================================*/

    waitForHero(){

        const hero=document.querySelector(this.config.heroSelector);

        if(!hero){

            this.waitTimer=setTimeout(()=>{

                this.waitForHero();

            },100);

            return;

        }

        this.hero=hero;

        this.media=hero.querySelector(".motion-media");

        this.overlay=hero.querySelector(".motion-overlay");

        this.content=hero.querySelector(".motion-content");

        this.footer=hero.querySelector(".motion-footer");

        this.progress=hero.querySelector(".motion-progress span");

        this.canvas=hero.querySelector("#"+this.config.canvasID);

        if(!this.media){

            console.error("MotionEngine: .motion-media not found.");

            return;

        }

        if(!this.canvas){

            console.error("MotionEngine: Canvas not found.");

            return;

        }

        this.initialized=true;

        this.hero.classList.add("is-loading");

        this.createCanvas();

        this.createVideo();

    },

    /*=========================================
        CREATE CANVAS
    =========================================*/

    createCanvas(){

        this.ctx=this.canvas.getContext("2d",{

            alpha:false,

            desynchronized:true

        });

    },

    /*=========================================
        CREATE VIDEO
    =========================================*/

    createVideo(){

        const video=document.createElement("video");

        video.preload="auto";

        video.muted=true;

        video.loop=false;

        video.playsInline=true;

        video.crossOrigin="anonymous";

        video.setAttribute("playsinline","");

        video.setAttribute("webkit-playsinline","");

        video.src=this.config.videoPath;

        video.style.display="none";

        this.video=video;

        document.body.appendChild(video);

        video.addEventListener("loadedmetadata",()=>{

            this.videoReady=true;

            this.resize();

            video.currentTime=0;

        });

        video.addEventListener("seeked",()=>{

            this.draw();

        });

        video.addEventListener("canplay",()=>{

            this.observeResize();

            this.startScroll();

        });

        video.load();

    },

    /*=========================================
    RESIZE OBSERVER
=========================================*/

observeResize(){

    this.disconnectResizeObserver();

    if("ResizeObserver" in window){

        this.resizeObserver=new ResizeObserver(()=>{

            this.resize();

        });

        this.resizeObserver.observe(this.media);

        return;

    }

    this.resizeFallback=()=>{

        this.resize();

    };

    window.addEventListener("resize",this.resizeFallback);

},

disconnectResizeObserver(){

    if(this.resizeObserver){

        this.resizeObserver.disconnect();

        this.resizeObserver=null;

    }

    if(this.resizeFallback){

        window.removeEventListener("resize",this.resizeFallback);

        this.resizeFallback=null;

    }

},

/*=========================================
    RESIZE
=========================================*/

resize(){

    if(!this.canvas) return;

    if(!this.ctx) return;

    const size=this.getCanvasSize();

    const dpr=window.devicePixelRatio||1;

    this.canvas.width=Math.round(size.width*dpr);

    this.canvas.height=Math.round(size.height*dpr);

    this.canvas.style.width=size.width+"px";

    this.canvas.style.height=size.height+"px";

    this.ctx.setTransform(

        dpr,

        0,

        0,

        dpr,

        0,

        0

    );

    this.renderDirty=true;

    this.draw();

},

/*=========================================
    CANVAS SIZE
=========================================*/

getCanvasSize(){

    const rect=this.media.getBoundingClientRect();

    return{

        width:Math.max(1,Math.round(rect.width)),

        height:Math.max(1,Math.round(rect.height))

    };

},

/*=========================================
    DRAW
=========================================*/

draw(){

    if(!this.videoReady) return;

    if(this.renderRAF) return;

    this.renderRAF=requestAnimationFrame(()=>{

        this.renderRAF=null;

        this.render();

    });

},

render(){

    if(!this.video) return;

    if(this.video.readyState<2) return;

    const width=this.canvas.clientWidth;

    const height=this.canvas.clientHeight;

    const rect=this.getDrawRect(

        this.video.videoWidth,

        this.video.videoHeight,

        width,

        height,

        this.isMobile()

            ?this.config.mobileFit

            :this.config.desktopFit

    );

    this.ctx.clearRect(

        0,

        0,

        width,

        height

    );

    this.ctx.fillStyle=this.config.backgroundColor;

    this.ctx.fillRect(

        0,

        0,

        width,

        height

    );

    this.ctx.drawImage(

        this.video,

        rect.x,

        rect.y,

        rect.width,

        rect.height

    );

    this.markReady();

},

/*=========================================
    DRAW RECT
=========================================*/

getDrawRect(

    sourceWidth,

    sourceHeight,

    canvasWidth,

    canvasHeight,

    fit

){

    const imageRatio=

        sourceWidth/sourceHeight;

    const canvasRatio=

        canvasWidth/canvasHeight;

    let width;

    let height;

    if(

        fit==="cover"

            ?canvasRatio>imageRatio

            :canvasRatio<imageRatio

    ){

        width=canvasWidth;

        height=width/imageRatio;

    }

    else{

        height=canvasHeight;

        width=height*imageRatio;

    }

    return{

        x:(canvasWidth-width)/2,

        y:(canvasHeight-height)/2,

        width,

        height

    };

},

/*=========================================
    MOBILE
=========================================*/

isMobile(){

    return window.innerWidth<=this.config.mobileBreakpoint;

},

/*=========================================
    READY
=========================================*/

markReady(){

    if(this.ready) return;

    this.ready=true;

    this.hero.classList.remove("is-loading");

    this.hero.classList.add("is-ready");

},

/*=========================================
    START SCROLL
=========================================*/

startScroll(){

    if(!window.gsap){

        console.error("GSAP not found.");

        return;

    }

    if(!window.ScrollTrigger){

        console.error("ScrollTrigger not found.");

        return;

    }

    this.killScroll();

    const playhead={

        time:0

    };

    this.scrollTween=gsap.to(

        playhead,

        {

            time:this.video.duration,

            ease:"none",

            onUpdate:()=>{

                this.seek(playhead.time);

            },

            scrollTrigger:{

                trigger:this.isMobile()

                    ?this.media

                    :this.hero,

                start:"top top",

                end:"+="+this.config.scrollLength,

                pin:this.config.pin,

                pinSpacing:this.isMobile()

                    ?this.config.mobilePinSpacing

                    :this.config.pinSpacing,

                scrub:this.config.scrub,

                anticipatePin:1,

                invalidateOnRefresh:true,

                onUpdate:(self)=>{

                    this.updateProgress(

                        self.progress

                    );

                }

            }

        }

    );

    this.scrollTrigger=

        this.scrollTween.scrollTrigger;

},

/*=========================================
    SEEK
=========================================*/

seek(time){

    if(!this.videoReady) return;

    if(time===this.currentTime) return;

    this.currentTime=time;

    this.video.currentTime=time;

},

/*=========================================
    REFRESH
=========================================*/

refresh(){

    this.resize();

    if(window.ScrollTrigger){

        ScrollTrigger.refresh();

    }

},

/*=========================================
    KILL SCROLL
=========================================*/

killScroll(){

    if(this.scrollTween){

        this.scrollTween.kill();

        this.scrollTween=null;

    }

    if(this.scrollTrigger){

        this.scrollTrigger.kill();

        this.scrollTrigger=null;

    }

},

/*=========================================
    UPDATE PROGRESS
=========================================*/

updateProgress(progress){

    if(!this.progress) return;

    progress=Math.max(

        0,

        Math.min(

            1,

            progress

        )

    );

    this.progress.style.transform=

        `scaleX(${progress})`;

},

/*=========================================
    DESTROY
=========================================*/

destroy(){

    this.killScroll();

    this.disconnectResizeObserver();

    if(this.renderRAF){

        cancelAnimationFrame(

            this.renderRAF

        );

    }

    if(this.waitTimer){

        clearTimeout(

            this.waitTimer

        );

    }

    if(this.video){

        this.video.pause();

        this.video.removeAttribute(

            "src"

        );

        this.video.load();

        this.video.remove();

    }

    this.video=null;

    this.canvas=null;

    this.ctx=null;

    this.hero=null;

    this.media=null;

    this.overlay=null;

    this.content=null;

    this.footer=null;

    this.progress=null;

    this.videoReady=false;

    this.ready=false;

    this.initialized=false;

    this.currentTime=0;

},


    /*=========================================
        DEBUG
    =========================================*/

    log(...args){

        if(!this.config.debug) return;

        console.log("[MotionEngine]",...args);

    },

/*=========================================
    END OF OBJECT
=========================================*/

};

window.MotionEngine=MotionEngine;

MotionEngine.init();