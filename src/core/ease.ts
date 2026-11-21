import { gsap } from 'gsap';

/** A function from linear progress (0..1) to eased progress. It should return 0 at 0 and 1 at 1. */
export type EaseFunction = (progress: number) => number;

type EaseFamily =
  | 'Sine'
  | 'Quad'
  | 'Cubic'
  | 'Quart'
  | 'Quint'
  | 'Expo'
  | 'Circ'
  | 'Back'
  | 'Elastic'
  | 'Bounce';

/** Named eases: `'linear'` or a direction (`in`, `out`, `inOut`) followed by a family, e.g. `'outBack'`. */
export type EaseName = 'linear' | `${'in' | 'out' | 'inOut'}${EaseFamily}`;

/** A named ease or your own curve. */
export type Ease = EaseName | EaseFunction;

const FAMILY: Record<EaseFamily, string> = {
  Sine: 'sine',
  Quad: 'power1',
  Cubic: 'power2',
  Quart: 'power3',
  Quint: 'power4',
  Expo: 'expo',
  Circ: 'circ',
  Back: 'back',
  Elastic: 'elastic',
  Bounce: 'bounce',
};

const cache = new Map<string, EaseFunction>();
const linear: EaseFunction = (p) => p;

/** Turns an {@link Ease} into a function. Throws on an unknown name. */
export function resolveEase(ease: Ease): EaseFunction {
  if (typeof ease === 'function') return ease;
  if (ease === 'linear') return linear;
  const hit = cache.get(ease);
  if (hit) return hit;
  const match = /^(in|out|inOut)([A-Z][a-z]+)$/.exec(ease);
  const family = match?.[2] as EaseFamily | undefined;
  const gsapFamily = family ? FAMILY[family] : undefined;
  if (!match || !gsapFamily) throw new Error(`teemo-tween: unknown ease "${String(ease)}"`);
  const fn = gsap.parseEase(`${gsapFamily}.${match[1] ?? 'out'}`);
  cache.set(ease, fn);
  return fn;
}

type Direction = 'in' | 'out' | 'inOut';

/** Ease builders for curves that take a parameter. */
export const eases = {
  /** Back ease with a custom overshoot (default 1.70158). */
  back(overshoot = 1.70158, direction: Direction = 'out'): EaseFunction {
    return gsap.parseEase(`back.${direction}(${overshoot})`);
  },
  /** Elastic ease: `amplitude` >= 1, `period` in 0..1 (smaller wobbles faster). */
  elastic(amplitude = 1, period = 0.3, direction: Direction = 'out'): EaseFunction {
    return gsap.parseEase(`elastic.${direction}(${amplitude}, ${period})`);
  },
  /** Jumps in `count` equal steps (for pixel-art or clock-like motion). */
  steps(count: number): EaseFunction {
    const n = Math.max(1, Math.round(count));
    return (p) => (p >= 1 ? 1 : Math.floor(p * n) / n);
  },
} as const;
