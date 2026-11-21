import { gsap } from 'gsap';

/** A value a property can hold: a number or a string such as a colour or `'12px'`. */
export type Value = number | string;

/** Something to animate: a DOM or SVG element, or any plain object (canvas sprites, game state). */
export type TweenTarget = Element | object;

export type Setter = (value: Value) => void;

export const isElement = (target: unknown): target is Element =>
  typeof Element !== 'undefined' && target instanceof Element;

export const isSvg = (target: unknown): target is SVGElement =>
  typeof SVGElement !== 'undefined' && target instanceof SVGElement;

/**
 * Element properties set through GSAP's fast setter, with the unit GSAP's transform cache expects.
 * GSAP writes the cached value straight into the CSS (`rotate(` + value + `)`), so rotation needs
 * `deg`: a bare number would produce invalid CSS that browsers silently drop.
 */
const QUICK: Record<string, string> = {
  x: 'px',
  y: 'px',
  scaleX: '',
  scaleY: '',
  rotation: 'deg',
  opacity: '',
};

export function readValue(target: TweenTarget, prop: string): Value {
  if (isElement(target)) return gsap.getProperty(target, prop);
  const v: unknown = (target as Record<string, unknown>)[prop];
  return typeof v === 'number' || typeof v === 'string' ? v : 0;
}

export function makeSetter(target: TweenTarget, prop: string): Setter {
  if (isElement(target)) {
    const unit = QUICK[prop];
    if (unit !== undefined) return gsap.quickSetter(target, prop, unit) as unknown as Setter;
    return (value) => {
      gsap.set(target, { [prop]: value });
    };
  }
  return (value) => {
    (target as Record<string, unknown>)[prop] = value;
  };
}

/** Builds `progress -> value`. Numbers are blended directly; strings (colours, units) by GSAP. */
export function makeInterpolator(from: Value, to: Value): (progress: number) => Value {
  if (typeof from === 'number' && typeof to === 'number') return (p) => from + (to - from) * p;
  return gsap.utils.interpolate(String(from), String(to));
}

/** Smooth repeatable noise in -1..1: a sum of three sines. */
export function noise(t: number, seed: number): number {
  return (
    (Math.sin(t + seed) + Math.sin(t * 2.3 + seed * 1.9) * 0.5 + Math.sin(t * 4.1 + seed * 0.7) * 0.25) /
    1.75
  );
}
