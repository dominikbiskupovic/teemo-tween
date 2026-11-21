---
"teemo-tween": patch
---

Fix rotation on DOM and SVG elements. Rotation values were written without a `deg` unit, so browsers dropped the transform and every rotating tween (`Tween.rotation`, `shakeRotation`, `punchRotation`, `wiggle`, `traumaShake`, and sequences using them) did nothing. Tests now check the exact CSS that elements receive.
