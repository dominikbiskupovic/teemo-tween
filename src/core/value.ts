/** A value a property can hold: a number or a string such as a colour or `'12px'`. */
export type Value = number | string;

type Rgba = [r: number, g: number, b: number, a: number];

/** Blends between two values. `exact` is false when the strings could not be matched up. */
export interface Interpolator {
  at(progress: number): Value;
  exact: boolean;
}

const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;

/**
 * Builds `progress -> value`. Numbers blend directly; colours blend in RGBA; other strings blend
 * the numbers inside them when both have the same shape (`'0px'` → `'20px'`,
 * `'brightness(2)'` → `'brightness(1)'`), and otherwise switch at the end.
 */
export function makeInterpolator(from: Value, to: Value): Interpolator {
  if (typeof from === 'number' && typeof to === 'number') {
    return { at: (p) => from + (to - from) * p, exact: true };
  }
  const a = String(from);
  const b = String(to);
  const ca = parseColor(a);
  const cb = ca && parseColor(b);
  if (ca && cb) {
    return {
      at: (p) => formatColor(ca.map((v, i) => v + ((cb[i] as number) - v) * p) as Rgba),
      exact: true,
    };
  }
  const na = a.match(NUMBER);
  const nb = b.match(NUMBER);
  if (na && nb && na.length === nb.length && a.replace(NUMBER, '#') === b.replace(NUMBER, '#')) {
    const fa = na.map(Number);
    const fb = nb.map(Number);
    return {
      at: (p) => {
        let i = 0;
        return b.replace(NUMBER, () => {
          const v = (fa[i] as number) + ((fb[i] as number) - (fa[i] as number)) * p;
          i++;
          return String(Math.round(v * 1e4) / 1e4);
        });
      },
      exact: true,
    };
  }
  return { at: (p) => (p < 1 ? a : b), exact: false };
}

const formatColor = ([r, g, b, a]: Rgba): string =>
  `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${Math.round(Math.min(1, Math.max(0, a)) * 1000) / 1000})`;

let probe: CanvasRenderingContext2D | null | undefined;

/** Parses hex, rgb(a), hsl(a), `transparent` and (in browsers) named colours. */
export function parseColor(input: string): Rgba | null {
  const s = input.trim().toLowerCase();
  if (s === 'transparent') return [0, 0, 0, 0];
  const hex = /^#([\da-f]{3,8})$/.exec(s)?.[1];
  if (hex) {
    if (hex.length === 5 || hex.length === 7) return null;
    const full = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;
    const n = (i: number) => parseInt(full.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), full.length === 8 ? n(6) / 255 : 1];
  }
  const fn = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(s);
  if (fn) {
    const parts = (fn[2] as string).split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const alpha = parts[3] === undefined ? 1 : parseFloat(parts[3]) / (parts[3].endsWith('%') ? 100 : 1);
    if ((fn[1] as string).startsWith('rgb')) {
      const ch = (p: string) => (p.endsWith('%') ? (parseFloat(p) * 255) / 100 : parseFloat(p));
      return [ch(parts[0] as string), ch(parts[1] as string), ch(parts[2] as string), alpha];
    }
    return hsl(parseFloat(parts[0] as string), parseFloat(parts[1] as string) / 100, parseFloat(parts[2] as string) / 100, alpha);
  }
  if (!/^[a-z]+$/.test(s) || typeof document === 'undefined') return null;
  if (probe === undefined) probe = document.createElement('canvas').getContext('2d');
  if (!probe) return null;
  probe.fillStyle = '#010203';
  probe.fillStyle = s;
  const out = String(probe.fillStyle);
  return out === '#010203' ? null : parseColor(out);
}

function hsl(h: number, s: number, l: number, a: number): Rgba {
  const k = (n: number) => (n + h / 30) % 12;
  const m = s * Math.min(l, 1 - l);
  const f = (n: number) => (l - m * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))) * 255;
  return [f(0), f(8), f(4), a];
}

/** Smooth repeatable noise in -1..1: a sum of three sines. */
export function noise(t: number, seed: number): number {
  return (
    (Math.sin(t + seed) + Math.sin(t * 2.3 + seed * 1.9) * 0.5 + Math.sin(t * 4.1 + seed * 0.7) * 0.25) /
    1.75
  );
}
