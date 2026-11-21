# teemo-tween

**Game feel for the web in one line.** Tweens, sequences and juicy presets (punch, shake, pop, count-up, impact) for browser games. Built on [GSAP](https://gsap.com), typed, tested, about 3.5 kB, and polite to players who prefer less motion.

**[▶ Live demo: every tween and preset, with its code](https://dominikbiskupovic.github.io/teemo-tween/)** · [API reference](https://dominikbiskupovic.github.io/teemo-tween/api/)

```bash
npm i teemo-tween gsap
```

## Three examples

```ts
import { Tween, Sequence } from 'teemo-tween';
import { popIn, impact, countUp } from 'teemo-tween/presets';

// 1. A preset: one call, sensible defaults.
popIn(card);
impact(player, { strength: 0.8, hitStop: 0.05 });
countUp(scoreEl, { to: 12840 });

// 2. A tween: awaitable, with cycles and any ease.
await Tween.position(coin, { to: { y: -24 }, duration: 0.3, ease: 'outBack', cycles: 2, cycleMode: 'yoyo' });

// 3. A sequence: chain, group, insert, delays and callbacks.
Sequence.create()
  .chain(Tween.scale(tile, { to: 1.25 }))
  .group(Tween.rotation(tile, { to: 10 }))
  .chainDelay(0.1)
  .chainCallback(() => sound.play('pop'))
  .chain(Tween.scale(tile, { to: 1, ease: 'outBack' }))
  .insert(0.15, Tween.shakePosition(tile, { strength: 5 }));
```

## Presets

All presets live in `teemo-tween/presets`. Each is a short function built only from the public API ([source](src/presets/index.ts)), so they double as examples.

| Preset | What it does |
| --- | --- |
| `popIn` / `popOut` | Grow from nothing with an overshoot and fade in; shrink away. |
| `fadeIn` / `fadeOut` | Plain fades. |
| `slideIn` / `slideOut` | Slide from or to a side (or any offset) while fading. |
| `staggerIn` | Play an entrance on a list of elements, one after another. |
| `dropIn` | Fall in from above and land with a squash. |
| `punchScale` | A quick, springy swell: "+1", a correct answer. |
| `punchWave` | A punch that travels along a row of elements. |
| `shake` | Shake the position: a wrong answer, a hit. |
| `traumaShake` | Screen shake with trauma² amplitude and noise motion. |
| `wiggle` | Rock the rotation back and forth: "tap me". |
| `squashStretch` | Wide and flat on impact, then spring back. |
| `bob` | Float up and down forever. |
| `pulse` | Breathe the scale up and down. |
| `flash` | Flash bright and fade back (`filter: brightness`). |
| `impact` | Punch, shake and flash in one call, with an optional hit stop. |
| `countUp` | Count a number in a text element, with `Intl` formatting. |
| `meterFill` | Fill a bar to a value with a springy overshoot. |
| `typewriter` | Type text into an element. |

## Core API

```ts
Tween.position(target, { to: { x, y }, from? })
Tween.scale(target, { to: 1.2 | { x, y }, from? })
Tween.rotation(target, { to: 90 })            // degrees
Tween.alpha(target, { to: 0 })
Tween.color(target, { to: '#ff0', property? })
Tween.properties(target, { to: { '--glow': 1, width: '120px' } })
Tween.custom({ from: 0, to: 100, onValueChange: (v) => draw(v) })
Tween.shakePosition / shakeRotation / shakeScale(target, { strength, frequency?, falloff? })
Tween.punchPosition / punchRotation / punchScale(target, { strength, oscillations? })
Tween.delay(0.5, () => {})
Tween.stopAll(target?)  Tween.completeAll(target?)  Tween.isTweening(target)
hitStop(0.05)           // freeze every animation for a moment
```

Every tween takes `duration`, `ease`, `startDelay`, `endDelay`, `cycles` (-1 is endless), `cycleMode` (`restart`, `yoyo`, `rewind`, `incremental`) and `onComplete`. A tween or sequence can be awaited (`await t` or `t.finished`), and has `stop()`, `complete()`, `isAlive`, `isPaused`, `timeScale` and `duration`.

**Targets.** DOM and SVG elements (GSAP transforms, opacity, colours, CSS variables) and plain objects for canvas or game state (`x`, `y`, `scaleX`, `scaleY`, `rotation`, `alpha`, `color` fields).

**Eases.** `'linear'` or `in`/`out`/`inOut` plus `Sine`, `Quad`, `Cubic`, `Quart`, `Quint`, `Expo`, `Circ`, `Back`, `Elastic`, `Bounce` (e.g. `'outBack'`). You can also pass any `(t) => number` function, or use `eases.back(overshoot)`, `eases.elastic(amplitude, period)` or `eases.steps(n)`.

**Replacement rule.** When a tween starts on a property that another tween is animating (same target, same property, such as `x` or `opacity`), the old tween stops where it is and the new one continues from there. Different properties run side by side. A shake or punch puts its target back before it is replaced, so nothing drifts. Tweens inside the same sequence never replace each other.

**Cleanup.** Call `Tween.stopAll(el)` before removing an element. In React, use the hooks below.

## Reduced motion

By default the library follows the player's `prefers-reduced-motion` setting:

| Kind | Default when reduced | Covers |
| --- | --- | --- |
| move | `jump`: go straight to the end state | position, scale, rotation, `properties` |
| fade | `shorten`: at most 0.15 s | alpha, colour, `flash` |
| effect | `skip`: do nothing | shakes and punches |
| value | `animate` | `custom`, `countUp`, `typewriter`, `delay` |
| loops | `skip` | anything with `cycles: -1` that is not `animate` |

`onComplete` callbacks and promises always run, so game logic never waits forever. So `popIn` becomes a quick fade, `impact` keeps only a short flash, and `bob` stays still. You can change all of this:

```ts
import { configure } from 'teemo-tween';

configure({ reducedMotion: 'always' });                  // an in-game "reduce motion" setting
configure({ reducedMotion: 'never' });                   // ignore the system setting
configure({ reducedMotionPolicy: { effect: 'shorten' } });
Tween.punchScale(el, { strength: 0.2, reducedMotion: 'animate' }); // per tween
```

Other settings: `configure({ defaultEase, defaultDuration, timeScale })`. `timeScale: 0.25` slows every teemo-tween animation down, which helps when tuning game feel.

## React

```tsx
import { useRef } from 'react';
import { useTween, useTweenScope } from 'teemo-tween/react';
import { popIn, countUp, punchScale } from 'teemo-tween/presets';

function Score({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useTween(ref, (el) => popIn(el), []);                     // on mount
  useTween(ref, (el) => countUp(el, { to: value }), [value]); // on change
  const tweens = useTweenScope();                            // stopped on unmount
  return <span ref={ref} onClick={(e) => tweens.add(punchScale(e.currentTarget))} />;
}
```

Both hooks clean up on unmount and work under React 19 strict mode. The core does not depend on React.

## Notes

- **GSAP** is a peer dependency, so your game controls its version. GSAP is free for commercial use under Webflow's [standard licence](https://gsap.com/standard-license). teemo-tween does not bundle or redistribute it.
- ESM only, tree-shakeable, types included. Core is about 3.5 kB brotli (excluding GSAP), and size budgets are enforced in CI.
- API inspired by PrimeTween for Unity. This is an independent library, not affiliated with it.

## Roadmap

Not in v0.1: sound and haptics hooks, physics springs, scroll-triggered animation, a visual editor. Ideas and pull requests are welcome.

## License

[MIT](LICENSE) © Dominik Biškupović
