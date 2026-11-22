# teemo-tween

## 0.2.0

### Minor Changes

- 35da724: Runs on the browser's own Web Animations API instead of GSAP. The API is unchanged; `gsap` is no longer a dependency (you can uninstall it).
  
  - Element tweens play as native animations: position, scale, rotation and opacity can run on the GPU, smooth even when the page's JavaScript is busy. Objects, `custom` and CSS variables still update from JS each frame.
  - Elements now move through the CSS `translate`, `scale` and `rotate` properties instead of `transform`, so a `transform` in your own CSS keeps working and composes with tweens.
  - Native animation needs Chrome/Edge 113+, Safari 17.2+ or Firefox 128+; older browsers fall back to JS updates.
  - Zero dependencies: the whole library is about 7.5 kB (brotli), down from about 4 kB plus GSAP.

## 0.1.1

### Patch Changes

- 845940c: Fix rotation on DOM and SVG elements. Rotation values were written without a `deg` unit, so browsers dropped the transform and every rotating tween (`Tween.rotation`, `shakeRotation`, `punchRotation`, `wiggle`, `traumaShake`, and sequences using them) did nothing. Tests now check the exact CSS that elements receive.

## 0.1.0

### Minor Changes

- d803c5d: First release: Tween, Sequence, game-feel presets, React helpers, a reduced-motion policy, and all 30 easings.net eases as PrimeTween-style `Ease` constants.
