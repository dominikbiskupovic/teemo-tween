/**
 * Game-feel presets. Each one is a small function built only from the public core API, so it is
 * also an example of how to write your own.
 *
 * @packageDocumentation
 */
import {
  eases,
  hitStop,
  Sequence,
  Tween,
  type Ease,
  type TweenTarget,
  type Vec2,
} from '../index';

/** Options most presets take. */
export interface PresetOptions {
  duration?: number;
  startDelay?: number;
  onComplete?: () => void;
}

type Side = 'left' | 'right' | 'top' | 'bottom';

const offsetFor = (from: Side | Vec2, distance: number): Vec2 => {
  if (typeof from !== 'string') return from;
  return {
    left: { x: -distance, y: 0 },
    right: { x: distance, y: 0 },
    top: { x: 0, y: -distance },
    bottom: { x: 0, y: distance },
  }[from];
};

const common = (o: PresetOptions) => ({
  ...(o.startDelay !== undefined ? { startDelay: o.startDelay } : {}),
  ...(o.onComplete ? { onComplete: o.onComplete } : {}),
});

// ------------------------------------------------------------------ appear and disappear

/** Grows from nothing with a little overshoot while fading in. */
export function popIn(target: TweenTarget, o: PresetOptions & { overshoot?: number } = {}): Sequence {
  const duration = o.duration ?? 0.35;
  return Sequence.create(o.onComplete ? { onComplete: o.onComplete } : {})
    .chain(Tween.scale(target, { from: 0, to: 1, duration, ease: eases.back(o.overshoot ?? 2), startDelay: o.startDelay ?? 0 }))
    .group(Tween.alpha(target, { from: 0, to: 1, duration: duration * 0.5, startDelay: o.startDelay ?? 0 }));
}

/** Pulls back a touch, then shrinks to nothing while fading out. */
export function popOut(target: TweenTarget, o: PresetOptions = {}): Sequence {
  const duration = o.duration ?? 0.25;
  return Sequence.create(o.onComplete ? { onComplete: o.onComplete } : {})
    .chain(Tween.scale(target, { to: 0, duration, ease: 'inBack', startDelay: o.startDelay ?? 0 }))
    .group(Tween.alpha(target, { to: 0, duration, ease: 'inQuad', startDelay: o.startDelay ?? 0 }));
}

/** Fades in. */
export function fadeIn(target: TweenTarget, o: PresetOptions = {}): Tween {
  return Tween.alpha(target, { from: 0, to: 1, duration: o.duration ?? 0.25, ...common(o) });
}

/** Fades out. */
export function fadeOut(target: TweenTarget, o: PresetOptions = {}): Tween {
  return Tween.alpha(target, { to: 0, duration: o.duration ?? 0.25, ...common(o) });
}

/** Slides in from a side (or an offset) to where it belongs, fading in. Assumes a resting position of 0, 0. */
export function slideIn(
  target: TweenTarget,
  o: PresetOptions & { from?: Side | Vec2; distance?: number } = {},
): Sequence {
  const duration = o.duration ?? 0.4;
  const delay = o.startDelay ?? 0;
  return Sequence.create(o.onComplete ? { onComplete: o.onComplete } : {})
    .chain(Tween.position(target, { from: offsetFor(o.from ?? 'bottom', o.distance ?? 40), to: { x: 0, y: 0 }, duration, ease: 'outCubic', startDelay: delay }))
    .group(Tween.alpha(target, { from: 0, to: 1, duration: duration * 0.6, startDelay: delay }));
}

/** Slides out towards a side (or an offset), fading out. */
export function slideOut(
  target: TweenTarget,
  o: PresetOptions & { to?: Side | Vec2; distance?: number } = {},
): Sequence {
  const duration = o.duration ?? 0.3;
  const delay = o.startDelay ?? 0;
  return Sequence.create(o.onComplete ? { onComplete: o.onComplete } : {})
    .chain(Tween.position(target, { to: offsetFor(o.to ?? 'bottom', o.distance ?? 40), duration, ease: 'inCubic', startDelay: delay }))
    .group(Tween.alpha(target, { to: 0, duration, ease: 'inQuad', startDelay: delay }));
}

/** Plays an entrance on each element in turn, `each` seconds apart. Defaults to a short slide up. */
export function staggerIn(
  targets: Iterable<TweenTarget>,
  o: { each?: number; animate?: (target: TweenTarget) => Tween | Sequence; onComplete?: () => void } = {},
): Sequence {
  const each = o.each ?? 0.05;
  const animate = o.animate ?? ((t: TweenTarget) => slideIn(t, { distance: 16, duration: 0.35 }));
  const seq = Sequence.create(o.onComplete ? { onComplete: o.onComplete } : {});
  let i = 0;
  for (const t of targets) seq.insert(i++ * each, animate(t));
  return seq;
}

/** Falls in from above and lands with a squash, the way a block drops onto a stack. */
export function dropIn(target: TweenTarget, o: PresetOptions & { height?: number; squash?: number } = {}): Sequence {
  return Sequence.create(o.onComplete ? { onComplete: o.onComplete } : {})
    .chain(Tween.position(target, { from: { y: -(o.height ?? 46) }, to: { y: 0 }, duration: o.duration ?? 0.11, ease: 'inQuad', startDelay: o.startDelay ?? 0 }))
    .chain(squashStretch(target, { amount: o.squash ?? 0.16 }));
}

// ------------------------------------------------------------------ attention

/** A quick, springy swell of the scale. */
export function punchScale(target: TweenTarget, o: PresetOptions & { strength?: number } = {}): Tween {
  return Tween.punchScale(target, { strength: o.strength ?? 0.2, duration: o.duration ?? 0.3, ...common(o) });
}

/** A punch that travels along a row of elements, `step` seconds apart (a chain, a word, a combo meter). */
export function punchWave(
  targets: Iterable<TweenTarget>,
  o: { strength?: number; duration?: number; step?: number; onComplete?: () => void } = {},
): Sequence {
  const seq = Sequence.create(o.onComplete ? { onComplete: o.onComplete } : {});
  let i = 0;
  for (const t of targets) {
    seq.insert(i++ * (o.step ?? 0.028), Tween.punchScale(t, { strength: o.strength ?? 0.22, duration: o.duration ?? 0.15, oscillations: 1 }));
  }
  return seq;
}

/** Shakes the position: a wrong answer, a hit. */
export function shake(target: TweenTarget, o: PresetOptions & { strength?: number; frequency?: number } = {}): Tween {
  return Tween.shakePosition(target, { strength: o.strength ?? 8, frequency: o.frequency ?? 30, duration: o.duration ?? 0.4, ...common(o) });
}

/**
 * Trauma shake for a screen or a stage: position and angle driven by smooth noise, with an
 * amplitude of trauma squared, so small hits are subtle and big ones are violent.
 * `decay` is trauma lost per second, which sets the duration.
 */
export function traumaShake(
  target: TweenTarget,
  o: { trauma?: number; maxOffset?: number; maxAngle?: number; decay?: number; frequency?: number; onComplete?: () => void } = {},
): Sequence {
  const trauma = Math.min(1, Math.max(0, o.trauma ?? 0.6));
  const power = trauma * trauma;
  const duration = trauma / (o.decay ?? 2.5);
  const frequency = o.frequency ?? 34;
  return Sequence.create(o.onComplete ? { onComplete: o.onComplete } : {})
    .chain(Tween.shakePosition(target, { strength: (o.maxOffset ?? 14) * power, frequency, duration }))
    .group(Tween.shakeRotation(target, { strength: (o.maxAngle ?? 1.6) * power, frequency, duration }));
}

/** Rocks the rotation back and forth and settles: "tap me". */
export function wiggle(target: TweenTarget, o: PresetOptions & { angle?: number; wiggles?: number } = {}): Tween {
  return Tween.punchRotation(target, { strength: o.angle ?? 10, oscillations: (o.wiggles ?? 3) * 2, duration: o.duration ?? 0.5, ...common(o) });
}

/** Wide and flat on impact, then springs back: a landing or a bounce. */
export function squashStretch(target: TweenTarget, o: PresetOptions & { amount?: number } = {}): Tween {
  const a = o.amount ?? 0.16;
  return Tween.punchScale(target, { strength: { x: a, y: -a }, oscillations: 3, duration: o.duration ?? 0.24, ...common(o) });
}

/** Floats up and down forever (assumes a resting y of 0). Stop it with `.stop()`. */
export function bob(target: TweenTarget, o: { distance?: number; duration?: number; startDelay?: number } = {}): Tween {
  return Tween.position(target, {
    from: { y: 0 },
    to: { y: -(o.distance ?? 6) },
    duration: o.duration ?? 1.2,
    ease: 'inOutSine',
    cycles: -1,
    cycleMode: 'yoyo',
    ...(o.startDelay !== undefined ? { startDelay: o.startDelay } : {}),
  });
}

/** Breathes the scale up and down. Forever by default; pass `cycles` (even numbers end at rest). */
export function pulse(target: TweenTarget, o: { scale?: number; duration?: number; cycles?: number } = {}): Tween {
  return Tween.scale(target, { from: 1, to: o.scale ?? 1.08, duration: o.duration ?? 0.6, ease: 'inOutSine', cycles: o.cycles ?? -1, cycleMode: 'yoyo' });
}

/** Flashes bright and fades back (CSS `filter: brightness`). Elements only. */
export function flash(target: Element, o: PresetOptions & { brightness?: number } = {}): Tween {
  return Tween.properties(target, {
    from: { filter: `brightness(${o.brightness ?? 2.2})` },
    to: { filter: 'brightness(1)' },
    duration: o.duration ?? 0.26,
    ease: 'outQuad',
    reducedMotion: 'shorten',
    ...common(o),
  });
}

/**
 * Punch, shake and flash in one call, with an optional hit stop: the "that hurt" moment.
 * `strength` 0..1 scales everything.
 */
export function impact(target: Element, o: { strength?: number; hitStop?: number; onComplete?: () => void } = {}): Sequence {
  const s = Math.min(1, Math.max(0, o.strength ?? 0.7));
  if (o.hitStop) void hitStop(o.hitStop);
  return Sequence.create(o.onComplete ? { onComplete: o.onComplete } : {})
    .chain(Tween.punchScale(target, { strength: 0.12 + 0.18 * s, duration: 0.3, oscillations: 2 }))
    .group(Tween.shakePosition(target, { strength: 3 + 9 * s, duration: 0.25 + 0.2 * s }))
    .group(flash(target, { brightness: 1.4 + 1.2 * s, duration: 0.3 }));
}

// ------------------------------------------------------------------ numbers and text

/** Counts a number up (or down) inside an element, formatted. */
export function countUp(
  target: Element,
  o: PresetOptions & { from?: number; to: number; decimals?: number; locale?: string; format?: (value: number) => string; ease?: Ease },
): Tween {
  const fmt = new Intl.NumberFormat(o.locale, { minimumFractionDigits: o.decimals ?? 0, maximumFractionDigits: o.decimals ?? 0 });
  const format = o.format ?? ((v: number) => fmt.format(v));
  return Tween.custom({
    from: o.from ?? (Number(target.textContent?.replace(/[^\d.-]/g, '')) || 0),
    to: o.to,
    duration: o.duration ?? 1,
    ease: o.ease ?? 'outCubic',
    onValueChange: (v) => {
      target.textContent = format(v);
    },
    ...common(o),
  });
}

/**
 * Fills a bar to `value` (0..1) by scaling it on one axis, with a springy overshoot.
 * Sets `transform-origin` so the bar grows from its start.
 */
export function meterFill(
  target: HTMLElement | SVGElement,
  o: PresetOptions & { value: number; overshoot?: number; vertical?: boolean },
): Tween {
  const v = Math.min(1, Math.max(0, o.value));
  target.style.transformOrigin = o.vertical ? 'center bottom' : 'left center';
  return Tween.scale(target, {
    to: o.vertical ? { y: v } : { x: v },
    duration: o.duration ?? 0.6,
    ease: eases.back(o.overshoot ?? 1.5),
    ...common(o),
  });
}

/** Types text into an element, `speed` characters per second. Uses the element's own text if none is given. */
export function typewriter(target: Element, o: PresetOptions & { text?: string; speed?: number } = {}): Tween {
  const text = o.text ?? target.textContent ?? '';
  const chars = Array.from(text);
  target.textContent = '';
  return Tween.custom({
    from: 0,
    to: chars.length,
    duration: o.duration ?? chars.length / (o.speed ?? 40),
    ease: 'linear',
    onValueChange: (n) => {
      target.textContent = chars.slice(0, Math.floor(n)).join('');
    },
    ...common(o),
  });
}
