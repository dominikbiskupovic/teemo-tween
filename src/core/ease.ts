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

/**
 * Named eases: `'linear'`, or a direction (`in`, `out`, `inOut`) followed by a family, e.g.
 * `'outBack'`. The curves are the standard ones shown on easings.net. `'default'` means the global
 * `defaultEase`.
 */
export type EaseName = 'linear' | 'default' | `${'in' | 'out' | 'inOut'}${EaseFamily}`;

/** A named ease or your own curve. Pass a name (`'outBack'`) or a constant (`Ease.OutBack`). */
export type Ease = EaseName | EaseFunction;

const { sin, cos, sqrt, PI } = Math;
const C1 = 1.70158;
const C2 = C1 * 1.525;
const C3 = C1 + 1;
const C4 = (2 * PI) / 3;
const C5 = (2 * PI) / 4.5;

function outBounce(x: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
}

/** The curves, written from their standard formulas (as listed on easings.net). */
const CURVES: Record<Exclude<EaseName, 'default'>, EaseFunction> = {
  linear: (x) => x,
  inSine: (x) => 1 - cos((x * PI) / 2),
  outSine: (x) => sin((x * PI) / 2),
  inOutSine: (x) => -(cos(PI * x) - 1) / 2,
  inQuad: (x) => x * x,
  outQuad: (x) => 1 - (1 - x) * (1 - x),
  inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2),
  inCubic: (x) => x ** 3,
  outCubic: (x) => 1 - (1 - x) ** 3,
  inOutCubic: (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2),
  inQuart: (x) => x ** 4,
  outQuart: (x) => 1 - (1 - x) ** 4,
  inOutQuart: (x) => (x < 0.5 ? 8 * x ** 4 : 1 - (-2 * x + 2) ** 4 / 2),
  inQuint: (x) => x ** 5,
  outQuint: (x) => 1 - (1 - x) ** 5,
  inOutQuint: (x) => (x < 0.5 ? 16 * x ** 5 : 1 - (-2 * x + 2) ** 5 / 2),
  inExpo: (x) => (x === 0 ? 0 : 2 ** (10 * x - 10)),
  outExpo: (x) => (x === 1 ? 1 : 1 - 2 ** (-10 * x)),
  inOutExpo: (x) =>
    x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2,
  inCirc: (x) => 1 - sqrt(1 - x * x),
  outCirc: (x) => sqrt(1 - (x - 1) ** 2),
  inOutCirc: (x) => (x < 0.5 ? (1 - sqrt(1 - (2 * x) ** 2)) / 2 : (sqrt(1 - (-2 * x + 2) ** 2) + 1) / 2),
  inBack: (x) => C3 * x ** 3 - C1 * x * x,
  outBack: (x) => 1 + C3 * (x - 1) ** 3 + C1 * (x - 1) ** 2,
  inOutBack: (x) =>
    x < 0.5
      ? ((2 * x) ** 2 * ((C2 + 1) * 2 * x - C2)) / 2
      : ((2 * x - 2) ** 2 * ((C2 + 1) * (x * 2 - 2) + C2) + 2) / 2,
  inElastic: (x) => (x === 0 ? 0 : x === 1 ? 1 : -(2 ** (10 * x - 10)) * sin((x * 10 - 10.75) * C4)),
  outElastic: (x) => (x === 0 ? 0 : x === 1 ? 1 : 2 ** (-10 * x) * sin((x * 10 - 0.75) * C4) + 1),
  inOutElastic: (x) =>
    x === 0
      ? 0
      : x === 1
        ? 1
        : x < 0.5
          ? -(2 ** (20 * x - 10) * sin((20 * x - 11.125) * C5)) / 2
          : (2 ** (-20 * x + 10) * sin((20 * x - 11.125) * C5)) / 2 + 1,
  inBounce: (x) => 1 - outBounce(1 - x),
  outBounce,
  inOutBounce: (x) => (x < 0.5 ? (1 - outBounce(1 - 2 * x)) / 2 : (1 + outBounce(2 * x - 1)) / 2),
};

/** Every named ease except `'default'`, in a stable order (handy for menus and demos). */
export const EASE_NAMES = Object.keys(CURVES) as Array<Exclude<EaseName, 'default'>>;

type Pascal<S extends string> = S extends `${infer F}${infer R}` ? `${Uppercase<F>}${R}` : S;

/**
 * Ease constants in PrimeTween style: `ease: Ease.OutBack`. They are the same as the string names
 * (`Ease.OutBack === 'outBack'`), so use whichever reads better. `Ease.Default` means the global
 * `defaultEase`.
 */
export const Ease = Object.freeze(
  Object.fromEntries(
    [...EASE_NAMES, 'default'].map((n) => [n[0]!.toUpperCase() + n.slice(1), n]),
  ),
) as { readonly [K in EaseName as Pascal<K>]: K };

/** Turns a named ease or function into a function. Throws on an unknown name or `'default'`. */
export function resolveEase(ease: Ease): EaseFunction {
  if (typeof ease === 'function') return ease;
  const fn = (CURVES as Record<string, EaseFunction | undefined>)[ease];
  if (!fn) {
    throw new Error(
      ease === 'default'
        ? 'teemo-tween: "default" refers to defaultEase and cannot be the default itself'
        : `teemo-tween: unknown ease "${String(ease)}"`,
    );
  }
  return fn;
}

type Direction = 'in' | 'out' | 'inOut';

/** Builds in, out and inOut variants from an "in" curve. */
function directed(easeIn: EaseFunction, direction: Direction): EaseFunction {
  if (direction === 'in') return easeIn;
  if (direction === 'out') return (x) => 1 - easeIn(1 - x);
  return (x) => (x < 0.5 ? easeIn(2 * x) / 2 : 1 - easeIn(2 - 2 * x) / 2);
}

/** Ease builders for curves that take a parameter. */
export const eases = {
  /** Back ease with a custom overshoot (default 1.70158). */
  back(overshoot = 1.70158, direction: Direction = 'out'): EaseFunction {
    return directed((x) => (overshoot + 1) * x ** 3 - overshoot * x * x, direction);
  },
  /** Elastic ease: `amplitude` >= 1, `period` in 0..1 (smaller wobbles faster). */
  elastic(amplitude = 1, period = 0.3, direction: Direction = 'out'): EaseFunction {
    const a = Math.max(1, amplitude);
    const shift = (period / (2 * PI)) * Math.asin(1 / a);
    const easeOut = (x: number) =>
      x <= 0 ? 0 : x >= 1 ? 1 : a * 2 ** (-10 * x) * sin(((x - shift) * 2 * PI) / period) + 1;
    return directed((x) => 1 - easeOut(1 - x), direction);
  },
  /** Jumps in `count` equal steps (for pixel-art or clock-like motion). */
  steps(count: number): EaseFunction {
    const n = Math.max(1, Math.round(count));
    return (p) => (p >= 1 ? 1 : Math.floor(p * n) / n);
  },
} as const;

const cssEasings = new WeakMap<EaseFunction, string>();

/**
 * The curve as a CSS easing for native animations: `linear(...)` through 64 samples, with exact
 * ends (tweens always land on their start and end values).
 */
export function cssEasing(ease: EaseFunction): string {
  if (ease === CURVES.linear) return 'linear';
  let css = cssEasings.get(ease);
  if (!css) {
    const n = 64;
    const points: number[] = [];
    for (let i = 0; i <= n; i++) points.push(i === 0 ? 0 : i === n ? 1 : Math.round(ease(i / n) * 1e4) / 1e4);
    css = `linear(${points.join(', ')})`;
    cssEasings.set(ease, css);
  }
  return css;
}
