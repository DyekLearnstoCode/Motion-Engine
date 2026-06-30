# Motion Engine

Production image-sequence scroll engine for premium GoHighLevel hero sections.

## Public API

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
<script src="motion-engine.js"></script>
```

`motion-engine.js` auto-initializes for GoHighLevel pages, and the public API is still available:

```js
MotionEngine.init();
MotionEngine.refresh();
MotionEngine.destroy();
```

Optional config can be passed with a global before the script loads:

```html
<script>
window.MotionEngineConfig = {
  heroSelector: ".hero-scrub",
  frameCount: 241,
  imagePath: "https://dyeklearnstocode.github.io/Motion-Engine/frames/frame_",
  extension: ".jpg",
};
</script>
<script src="motion-engine.js"></script>
```

## V2 Behavior

- Desktop mode uses a full-viewport pinned hero with cover rendering.
- Mobile mode uses a 16:9 canvas above the content with contain rendering and independent canvas pinning.
- Rendering is scheduled with `requestAnimationFrame`.
- Repeated requests for the same frame and render state are skipped.
- Frames load progressively with priority loading around the active playhead.
- The image cache is bounded with LRU eviction and protects the active frame window.
- `ResizeObserver` drives canvas measurement, with a window resize fallback.
- A GSAP master timeline controls the frame sequence, progress bar, captions, navbar, and scroll indicator.

## Timeline Hooks

All timeline hooks are optional. Add any of these elements to the page when needed:

```html
<div data-motion-progress></div>
<p data-motion-caption data-start="0%" data-end="30%">Caption text</p>
<nav data-motion-navbar></nav>
<div data-motion-scroll-indicator></div>
```

Caption timing accepts timeline progress (`0.25`), percentages (`25%`), or frame numbers (`64`).
