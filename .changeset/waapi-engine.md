---
"teemo-tween": minor
---

Runs on the browser's own Web Animations API instead of GSAP. The API is unchanged; `gsap` is no longer a dependency (you can uninstall it).

- Element tweens play as native animations: position, scale, rotation and opacity can run on the GPU, smooth even when the page's JavaScript is busy. Objects, `custom` and CSS variables still update from JS each frame.
- Elements now move through the CSS `translate`, `scale` and `rotate` properties instead of `transform`, so a `transform` in your own CSS keeps working and composes with tweens.
- Native animation needs Chrome/Edge 113+, Safari 17.2+ or Firefox 128+; older browsers fall back to JS updates.
- Zero dependencies: the whole library is about 7.5 kB (brotli), down from about 4 kB plus GSAP.
