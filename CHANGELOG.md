# teemo-tween

## 0.1.1

### Patch Changes

- 845940c: Fix rotation on DOM and SVG elements. Rotation values were written without a `deg` unit, so browsers dropped the transform and every rotating tween (`Tween.rotation`, `shakeRotation`, `punchRotation`, `wiggle`, `traumaShake`, and sequences using them) did nothing. Tests now check the exact CSS that elements receive.

## 0.1.0

### Minor Changes

- d803c5d: First release: Tween, Sequence, game-feel presets, React helpers, a reduced-motion policy, and all 30 easings.net eases as PrimeTween-style `Ease` constants.
