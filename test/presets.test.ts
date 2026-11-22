import { describe, expect, it } from 'vitest';
import { configure, Sequence, Tween } from '../src';
import * as P from '../src/presets';
import { advance, transformOf } from './clock';

const el = (text = ''): HTMLDivElement => {
  const d = document.createElement('div');
  d.textContent = text;
  document.body.append(d);
  return d;
};
const get = (t: Element, p: 'x' | 'y' | 'scaleX' | 'scaleY' | 'rotation'): number => transformOf(t)[p];

describe('presets', () => {
  it('popIn grows from 0 with overshoot and fades in; popOut reverses it', () => {
    const d = el();
    const s = P.popIn(d);
    expect(s).toBeInstanceOf(Sequence);
    expect(get(d, 'scaleX')).toBe(0);
    let peak = 0;
    for (let i = 0; i < 30; i++) {
      advance(1 / 60, 1);
      peak = Math.max(peak, get(d, 'scaleX'));
    }
    expect(peak).toBeGreaterThan(1.02);
    expect(get(d, 'scaleX')).toBe(1);
    expect(d.style.opacity).toBe('1');
    P.popOut(d);
    advance(0.3);
    expect(get(d, 'scaleX')).toBe(0);
    expect(d.style.opacity).toBe('0');
  });

  it('fadeIn and fadeOut', () => {
    const o = { alpha: 0.5 };
    P.fadeIn(o);
    expect(o.alpha).toBe(0);
    advance(0.3);
    expect(o.alpha).toBe(1);
    P.fadeOut(o, { duration: 0.1 });
    advance(0.15);
    expect(o.alpha).toBe(0);
  });

  it('slideIn comes from a side to 0,0; slideOut leaves to a side', () => {
    const o = { x: 0, y: 0, alpha: 1 };
    P.slideIn(o, { from: 'left', distance: 50 });
    expect(o.x).toBe(-50);
    advance(0.45);
    expect(o).toEqual({ x: 0, y: 0, alpha: 1 });
    P.slideOut(o, { to: { x: 0, y: 30 } });
    advance(0.35);
    expect(o).toEqual({ x: 0, y: 30, alpha: 0 });
  });

  it('staggerIn starts each target `each` seconds apart', () => {
    const items = [{ alpha: 0 }, { alpha: 0 }, { alpha: 0 }];
    P.staggerIn(items, { each: 0.1, animate: (t) => P.fadeIn(t, { duration: 0.05 }) });
    advance(0.09);
    expect(items.map((i) => i.alpha)).toEqual([1, 0, 0]);
    advance(0.2);
    expect(items.map((i) => i.alpha)).toEqual([1, 1, 1]);
  });

  it('staggerIn defaults to a short slide', () => {
    const items = [{ x: 0, y: 0, alpha: 1 }, { x: 0, y: 0, alpha: 1 }];
    const s = P.staggerIn(items);
    expect(items[1]!.y).toBe(16);
    expect(s.duration).toBeCloseTo(0.4);
  });

  it('dropIn falls then squashes and settles', () => {
    const o = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
    P.dropIn(o, { height: 40 });
    expect(o.y).toBe(-40);
    advance(0.13, 8);
    expect(o.y).toBe(0);
    expect(o.scaleX).toBeGreaterThan(1);
    advance(0.3);
    expect(o).toEqual({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
  });

  it('punchScale, wiggle and squashStretch settle back', () => {
    const o = { scaleX: 1, scaleY: 1, rotation: 0 };
    P.punchScale(o);
    P.wiggle(o, { angle: 12 });
    advance(0.05);
    expect(o.scaleX).not.toBe(1);
    expect(o.rotation).not.toBe(0);
    advance(0.5);
    expect(o).toEqual({ scaleX: 1, scaleY: 1, rotation: 0 });
    P.squashStretch(o);
    advance(0.03, 1);
    expect(o.scaleX).toBeGreaterThan(1);
    expect(o.scaleY).toBeLessThan(1);
  });

  it('punchWave reaches each target `step` seconds later', () => {
    const row = [{ scaleX: 1, scaleY: 1 }, { scaleX: 1, scaleY: 1 }];
    P.punchWave(row, { step: 0.1, duration: 0.1 });
    advance(0.05, 1);
    expect(row[0]!.scaleX).toBeGreaterThan(1);
    expect(row[1]!.scaleX).toBe(1);
    advance(0.1, 1);
    expect(row[1]!.scaleX).toBeGreaterThan(1);
  });

  it('shake and traumaShake scale with trauma and settle', () => {
    const a = { x: 0, y: 0, rotation: 0 };
    const b = { x: 0, y: 0, rotation: 0 };
    P.shake(a, { strength: 5 });
    const s = P.traumaShake(b, { trauma: 0.5, decay: 2 });
    expect(s.duration).toBeCloseTo(0.25);
    let max = 0;
    for (let i = 0; i < 15; i++) {
      advance(1 / 60, 1);
      max = Math.max(max, Math.abs(b.x), Math.abs(b.y));
    }
    expect(max).toBeGreaterThan(0);
    expect(max).toBeLessThanOrEqual(14 * 0.25);
    advance(0.5);
    expect(a).toEqual({ x: 0, y: 0, rotation: 0 });
    expect(b).toEqual({ x: 0, y: 0, rotation: 0 });
  });

  it('bob and pulse loop forever until stopped', () => {
    const o = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
    const b = P.bob(o, { distance: 10, duration: 1 });
    const p = P.pulse(o, { scale: 1.2, duration: 1 });
    advance(1);
    expect(o.y).toBeCloseTo(-10);
    expect(o.scaleX).toBeCloseTo(1.2);
    advance(1);
    expect(o.y).toBeCloseTo(0);
    expect([b.isAlive, p.isAlive]).toEqual([true, true]);
    P.pulse(o, { cycles: 2, duration: 0.1 });
    advance(0.25);
    expect(o.scaleX).toBe(1);
  });

  it('flash brightens then returns to normal', () => {
    const d = el();
    P.flash(d, { brightness: 3 });
    expect(d.style.filter).toBe('brightness(3)');
    advance(0.3);
    expect(d.style.filter).toBe('brightness(1)');
  });

  it('impact punches, shakes and flashes, with an optional hit stop', () => {
    const d = el();
    const s = P.impact(d, { strength: 1, hitStop: 0.05 });
    advance(0.04);
    expect(get(d, 'scaleX')).toBe(1); // frozen by the hit stop
    advance(0.1);
    expect(get(d, 'scaleX')).not.toBe(1);
    advance(1);
    expect(s.isAlive).toBe(false);
    expect(get(d, 'x')).toBeCloseTo(0);
    expect(get(d, 'scaleX')).toBeCloseTo(1);
    expect(getComputedStyle(d).filter).toBe('brightness(1)');
  });

  it('countUp formats while counting and lands on the exact value', () => {
    const d = el('10');
    P.countUp(d, { to: 1234.5, decimals: 1, locale: 'en-US', duration: 1 });
    advance(0.5);
    expect(d.textContent).toMatch(/^[\d,]+\.\d$/);
    advance(0.6);
    expect(d.textContent).toBe('1,234.5');
    P.countUp(d, { from: 0, to: 3, format: (v) => `${Math.round(v)} pts` });
    advance(1.1);
    expect(d.textContent).toBe('3 pts');
  });

  it('meterFill scales a bar to its value from its start', () => {
    const d = el();
    P.meterFill(d, { value: 0.5 });
    expect(d.style.transformOrigin).toMatch(/^left center/); // Firefox adds ' 0px'
    let peak = 0;
    for (let i = 0; i < 40; i++) {
      advance(1 / 60, 1);
      peak = Math.max(peak, get(d, 'scaleX'));
    }
    expect(peak).toBeGreaterThan(0.5);
    expect(get(d, 'scaleX')).toBe(0.5);
    P.meterFill(d, { value: 2, vertical: true, duration: 0.1 });
    advance(0.2);
    expect(get(d, 'scaleY')).toBe(1);
  });

  it('typewriter types the text, using the element text by default', () => {
    const d = el('héllo 👋');
    P.typewriter(d, { speed: 10 });
    expect(d.textContent).toBe('');
    advance(0.35);
    expect(d.textContent).toBe('hél');
    advance(0.5);
    expect(d.textContent).toBe('héllo 👋');
  });

  it('under reduced motion: effects skip, moves jump, numbers still count', () => {
    configure({ reducedMotion: 'always' });
    const d = el('0');
    const o = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
    P.shake(o);
    P.punchScale(o);
    P.popIn(o);
    P.countUp(d, { to: 100, duration: 1, ease: 'linear' });
    advance(1 / 60, 1);
    expect(o).toMatchObject({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
    advance(0.5 - 1 / 60);
    expect(d.textContent).toBe('50');
    // popIn's fade was shortened to 0.15 s and is done; the count is still going
    expect(Tween.isTweening(o)).toBe(false);
    expect(Tween.isTweening(d)).toBe(false); // custom tweens have no target
  });
});
