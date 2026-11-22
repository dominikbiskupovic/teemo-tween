/**
 * How element properties are read and written. Position, scale and rotation use the CSS
 * `translate`, `scale` and `rotate` properties (so a `transform` in your CSS still applies on top).
 * Each axis lives in its own registered custom property (`--tt-x`, ...), so an x tween and a y
 * tween can run side by side, while a tween that moves both axes animates `translate` itself,
 * which browsers can run on the GPU.
 */
import type { Value } from './value';

/** Something to animate: a DOM or SVG element, or any plain object (canvas sprites, game state). */
export type TweenTarget = Element | object;

export const isElement = (target: unknown): target is Element =>
  typeof Element !== 'undefined' && target instanceof Element;

export const isSvg = (target: unknown): target is SVGElement =>
  typeof SVGElement !== 'undefined' && target instanceof SVGElement;

type Group = 'translate' | 'scale' | 'rotate';

interface TransformChannel {
  group: Group;
  variable: string;
  unit: string;
  initial: number;
}

/** Element transform channels, by the property name tweens use. */
export const TRANSFORM: Record<string, TransformChannel> = {
  x: { group: 'translate', variable: '--tt-x', unit: 'px', initial: 0 },
  y: { group: 'translate', variable: '--tt-y', unit: 'px', initial: 0 },
  scaleX: { group: 'scale', variable: '--tt-sx', unit: '', initial: 1 },
  scaleY: { group: 'scale', variable: '--tt-sy', unit: '', initial: 1 },
  rotation: { group: 'rotate', variable: '--tt-r', unit: 'deg', initial: 0 },
};

/** The channels that make up each CSS property, in order. */
export const GROUPS: Record<Group, string[]> = {
  translate: ['x', 'y'],
  scale: ['scaleX', 'scaleY'],
  rotate: ['rotation'],
};

const VAR_FORM: Record<Group, string> = {
  translate: 'var(--tt-x) var(--tt-y)',
  scale: 'var(--tt-sx) var(--tt-sy)',
  rotate: 'var(--tt-r)',
};

/** Formats a group's CSS value from its channel values. */
export function groupValue(group: Group, values: Record<string, number>): string {
  if (group === 'translate') return `${values['x'] ?? 0}px ${values['y'] ?? 0}px`;
  if (group === 'scale') return `${values['scaleX'] ?? 1} ${values['scaleY'] ?? 1}`;
  return `${values['rotation'] ?? 0}deg`;
}

const state = new WeakMap<Element, Record<string, number>>();

/** Reads a group's current value from computed CSS, then hands it to our variables. */
function adopt(el: Element, group: Group): Record<string, number> {
  let s = state.get(el);
  if (!s) state.set(el, (s = {}));
  if (s[GROUPS[group][0] as string] !== undefined) return s;
  const style = (el as HTMLElement).style;
  const computed = typeof getComputedStyle === 'function' ? getComputedStyle(el).getPropertyValue(group) : '';
  const parts = computed && computed !== 'none' ? computed.trim().split(/\s+/) : [];
  if (group === 'translate') {
    s['x'] = parts[0]?.endsWith('px') ? parseFloat(parts[0]) : 0;
    s['y'] = parts[1]?.endsWith('px') ? parseFloat(parts[1]) : 0;
  } else if (group === 'scale') {
    s['scaleX'] = parts[0] ? parseFloat(parts[0]) : 1;
    s['scaleY'] = parts[1] ? parseFloat(parts[1]) : (s['scaleX'] as number);
  } else {
    s['rotation'] = parts.length ? angle(parts[parts.length - 1] as string) : 0;
  }
  for (const ch of GROUPS[group]) {
    const t = TRANSFORM[ch] as TransformChannel;
    style.setProperty(t.variable, `${s[ch]}${t.unit}`);
  }
  style.setProperty(group, VAR_FORM[group]);
  return s;
}

function angle(v: string): number {
  const n = parseFloat(v);
  if (v.endsWith('rad')) return (n * 180) / Math.PI;
  if (v.endsWith('grad')) return n * 0.9;
  if (v.endsWith('turn')) return n * 360;
  return n;
}

/** Properties that take plain numbers in CSS; any other number gets `px`. */
const UNITLESS = new Set([
  'opacity', 'zIndex', 'fontWeight', 'lineHeight', 'flex', 'flexGrow', 'flexShrink', 'order', 'zoom',
  'columnCount', 'orphans', 'widows', 'fillOpacity', 'strokeOpacity', 'stopOpacity', 'floodOpacity',
  'strokeMiterlimit', 'aspectRatio', 'scale',
]);

const kebab = (prop: string): string =>
  prop.startsWith('--') ? prop : prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** A value as CSS text for `prop`. */
export function cssText(prop: string, value: Value): string {
  if (typeof value === 'string') return value;
  return prop.startsWith('--') || UNITLESS.has(prop) ? String(value) : `${value}px`;
}

/** Reads an element property's current value. */
export function readElement(el: Element, prop: string): Value {
  const t = TRANSFORM[prop];
  if (t) return adopt(el, t.group)[prop] as number;
  const css = getComputedStyle(el);
  if (prop === 'opacity') return parseFloat(css.opacity) || 0;
  return css.getPropertyValue(kebab(prop)).trim() || (el as HTMLElement).style.getPropertyValue(kebab(prop));
}

/** Writes an element property right away (inline style). */
export function writeElement(el: Element, prop: string, value: Value): void {
  const style = (el as HTMLElement).style;
  const t = TRANSFORM[prop];
  if (t) {
    const s = adopt(el, t.group);
    const n = typeof value === 'number' ? value : parseFloat(value) || 0;
    s[prop] = n;
    style.setProperty(t.variable, `${n}${t.unit}`);
    // Something (commitStyles, the page) may have replaced the variable form.
    if (style.getPropertyValue(t.group) !== VAR_FORM[t.group]) style.setProperty(t.group, VAR_FORM[t.group]);
    return;
  }
  style.setProperty(kebab(prop), cssText(prop, value));
}

let waapi: boolean | undefined;
let animatableVars: boolean | undefined;

/** True when elements can be animated with the Web Animations API. */
export function canAnimate(): boolean {
  waapi ??= typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';
  return waapi;
}

/** Registers the axis variables so the browser can interpolate them. True if that worked. */
export function canAnimateAxes(): boolean {
  if (animatableVars !== undefined) return animatableVars;
  animatableVars = false;
  if (typeof CSS === 'undefined' || typeof CSS.registerProperty !== 'function') return false;
  const syntax: Record<string, [string, string]> = { px: ['<length>', '0px'], '': ['<number>', '1'], deg: ['<angle>', '0deg'] };
  animatableVars = true;
  for (const t of Object.values(TRANSFORM)) {
    const [s, initialValue] = syntax[t.unit] as [string, string];
    try {
      CSS.registerProperty({ name: t.variable, syntax: s, inherits: false, initialValue });
    } catch (e) {
      // Already registered (another copy of the library) is fine; anything else is not.
      if (!(e instanceof DOMException && e.name === 'InvalidModificationError')) animatableVars = false;
    }
  }
  return animatableVars;
}
