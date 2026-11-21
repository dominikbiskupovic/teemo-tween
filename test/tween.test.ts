import { gsap } from 'gsap';
import { describe, expect, it, vi } from 'vitest';
import { configure, eases, resolveEase, Tween } from '../src';
import { advance, flush } from './clock';

const el = (): HTMLDivElement => {
  const d = document.createElement('div');
  document.body.append(d);
  return d;
};

describe('property tweens', () => {
  it('position moves x and y on an object, leaving other axes alone', () => {
    const o = { x: 0, y: 10 };
    Tween.position(o, { to: { x: 100 }, duration: 1, ease: 'linear' });
    advance(0.5);
    expect(o.x).toBeCloseTo(50);
    expect(o.y).toBe(10);
    advance(0.6);
    expect(o.x).toBe(100);
  });

  it('position uses from when given and shows it before the start delay', () => {
    const o = { x: 0, y: 0 };
    Tween.position(o, { from: { y: -20 }, to: { y: 0 }, duration: 1, startDelay: 1, ease: 'linear' });
    expect(o.y).toBe(-20);
    advance(1.5);
    expect(o.y).toBeCloseTo(-10);
  });

  it('position, scale, rotation and alpha drive GSAP transforms on elements', () => {
    const d = el();
    Tween.position(d, { to: { x: 30, y: -10 }, duration: 0.2 });
    Tween.scale(d, { to: 2, duration: 0.2 });
    Tween.rotation(d, { to: 45, duration: 0.2 });
    Tween.alpha(d, { from: 1, to: 0.5, duration: 0.2 });
    advance(0.3);
    expect(gsap.getProperty(d, 'x')).toBe(30);
    expect(gsap.getProperty(d, 'y')).toBe(-10);
    expect(gsap.getProperty(d, 'scaleX')).toBe(2);
    expect(gsap.getProperty(d, 'scaleY')).toBe(2);
    expect(gsap.getProperty(d, 'rotation')).toBe(45);
    expect(d.style.opacity).toBe('0.5');
  });

  it('scale takes separate axes and alpha uses the alpha field on objects', () => {
    const o = { scaleX: 1, scaleY: 1, alpha: 1 };
    Tween.scale(o, { to: { x: 3 }, duration: 0.1 });
    Tween.alpha(o, { to: 0, duration: 0.1 });
    advance(0.2);
    expect(o).toEqual({ scaleX: 3, scaleY: 1, alpha: 0 });
  });

  it('color blends background on elements, fill on SVG and color on objects', () => {
    const d = el();
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const o = { color: '#000000' };
    Tween.color(d, { from: '#000000', to: '#ff0000', duration: 1, ease: 'linear' });
    Tween.color(svg, { from: '#000000', to: '#00ff00', duration: 1 });
    Tween.color(o, { to: '#0000ff', duration: 1, ease: 'linear' });
    advance(0.5);
    expect(d.style.backgroundColor).toMatch(/^rgb\(12[78], 0, 0\)$/);
    expect(o.color).toMatch(/^rgba\(0,0,12[78],1\)$/);
    advance(0.6);
    expect(svg.style.fill).toBe('rgb(0, 255, 0)');
  });

  it('properties tweens CSS variables, string values and object fields', () => {
    const d = el();
    const o = { width: 0, label: '0px' };
    Tween.properties(d, { from: { '--glow': 0 }, to: { '--glow': 1 }, duration: 0.2 });
    Tween.properties(o, { to: { width: 10, label: '20px' }, duration: 0.2 });
    advance(0.3);
    expect(d.style.getPropertyValue('--glow')).toBe('1');
    expect(o).toEqual({ width: 10, label: '20px' });
  });

  it('custom hands every value to onValueChange and ends exactly at to', () => {
    const seen: number[] = [];
    Tween.custom({ from: 0, to: 100, duration: 1, ease: 'linear', onValueChange: (v) => seen.push(v) });
    advance(1.2, 12);
    expect(seen.at(-1)).toBe(100);
    expect(seen[4]).toBeCloseTo(50);
  });

  it('delay waits, then calls back and resolves', async () => {
    const cb = vi.fn();
    const t = Tween.delay(0.5, cb);
    advance(0.4);
    expect(cb).not.toHaveBeenCalled();
    advance(0.2);
    expect(cb).toHaveBeenCalledOnce();
    await expect(t.finished).resolves.toBeUndefined();
  });
});

describe('options', () => {
  it('uses named eases, custom curves and the default ease', () => {
    const a = { x: 0 };
    const b = { x: 0 };
    const c = { x: 0 };
    Tween.position(a, { to: { x: 1 }, duration: 1, ease: 'inQuad' });
    Tween.position(b, { to: { x: 1 }, duration: 1, ease: (p) => (p < 0.5 ? 0 : 1) });
    configure({ defaultEase: 'linear' });
    Tween.position(c, { to: { x: 1 }, duration: 1 });
    advance(0.5, 1);
    expect(a.x).toBeCloseTo(0.25);
    expect(b.x).toBe(1);
    expect(c.x).toBeCloseTo(0.5);
  });

  it('resolves every family and builds parameterised eases', () => {
    for (const fam of ['Sine', 'Quad', 'Cubic', 'Quart', 'Quint', 'Expo', 'Circ', 'Back', 'Elastic', 'Bounce']) {
      for (const dir of ['in', 'out', 'inOut'] as const) {
        const f = resolveEase(`${dir}${fam}` as Parameters<typeof resolveEase>[0]);
        expect(f(0)).toBeCloseTo(0);
        expect(f(1)).toBeCloseTo(1);
      }
    }
    expect(() => resolveEase('outWobble' as never)).toThrow(/unknown ease/);
    expect(eases.back(3)(0.5)).toBeGreaterThan(resolveEase('outBack')(0.5));
    expect(eases.steps(4)(0.3)).toBe(0.25);
    expect(eases.elastic(1, 0.3)(1)).toBe(1);
  });

  it('uses the default duration of 0.3 s', () => {
    const o = { x: 0 };
    const t = Tween.position(o, { to: { x: 1 } });
    expect(t.duration).toBeCloseTo(0.3);
    advance(0.31);
    expect(t.isAlive).toBe(false);
  });

  it('waits startDelay and endDelay before finishing', () => {
    const o = { x: 0 };
    const done = vi.fn();
    const t = Tween.position(o, { to: { x: 1 }, duration: 0.5, startDelay: 0.2, endDelay: 0.3, onComplete: done });
    expect(t.duration).toBeCloseTo(1);
    advance(0.15);
    expect(o.x).toBe(0);
    advance(0.6);
    expect(o.x).toBe(1);
    expect(done).not.toHaveBeenCalled();
    advance(0.3);
    expect(done).toHaveBeenCalledOnce();
  });

  it('rejects a negative duration and bad cycle counts', () => {
    expect(() => Tween.position({}, { to: { x: 1 }, duration: -1 })).toThrow(/duration/);
    expect(() => Tween.position({}, { to: { x: 1 }, cycles: 0 })).toThrow(/cycles/);
    expect(() => Tween.position({}, { to: { x: 1 }, cycles: 1.5 })).toThrow(/cycles/);
  });
});

describe('cycles', () => {
  const sample = (mode: 'restart' | 'yoyo' | 'rewind' | 'incremental', times: number[]): number[] => {
    const o = { x: 0 };
    Tween.position(o, { to: { x: 10 }, duration: 1, cycles: 3, cycleMode: mode, ease: 'inQuad' });
    let at = 0;
    return times.map((t) => {
      advance(t - at, 1);
      at = t;
      return Math.round(o.x * 100) / 100;
    });
  };

  it('restart plays from the start each cycle', () => {
    expect(sample('restart', [0.5, 1.5, 2.5, 3.5])).toEqual([2.5, 2.5, 2.5, 10]);
  });

  it('yoyo mirrors the ease on the way back', () => {
    // back: 1 - inQuad(0.5) = 0.75 of the way
    expect(sample('yoyo', [0.5, 1.5, 2.5, 3.5])).toEqual([2.5, 7.5, 2.5, 10]);
  });

  it('rewind plays the forward motion backwards', () => {
    // back: inQuad(1 - 0.5) = 0.25 of the way
    expect(sample('rewind', [0.5, 1.5, 2.5, 3.5])).toEqual([2.5, 2.5, 2.5, 10]);
    expect(sample('rewind', [1.25])).toEqual([5.63]);
  });

  it('incremental continues from where the last cycle ended', () => {
    expect(sample('incremental', [0.5, 1.5, 2.5, 3.5])).toEqual([2.5, 12.5, 22.5, 30]);
  });

  it('yoyo with an even count ends at the start', () => {
    const o = { x: 0 };
    Tween.position(o, { to: { x: 10 }, duration: 0.5, cycles: 2, cycleMode: 'yoyo' });
    advance(1.1);
    expect(o.x).toBe(0);
  });

  it('endless tweens keep going until stopped', () => {
    const o = { x: 0 };
    const t = Tween.position(o, { to: { x: 10 }, duration: 0.5, cycles: -1, cycleMode: 'yoyo' });
    expect(t.duration).toBe(Infinity);
    advance(20);
    expect(t.isAlive).toBe(true);
    t.stop();
    expect(t.isAlive).toBe(false);
  });

  it('custom supports incremental cycles too', () => {
    let v = 0;
    Tween.custom({ from: 0, to: 1, duration: 1, cycles: 2, cycleMode: 'incremental', onValueChange: (n) => (v = n) });
    advance(2.1);
    expect(v).toBe(2);
  });
});

describe('control', () => {
  it('can be awaited directly and through finished', async () => {
    const o = { x: 0 };
    const t = Tween.position(o, { to: { x: 1 }, duration: 0.2 });
    let done = false;
    void (async () => {
      await t;
      done = true;
    })();
    await flush();
    expect(done).toBe(false);
    advance(0.3);
    await flush();
    expect(done).toBe(true);
  });

  it('stop leaves the value where it is, skips onComplete and resolves', async () => {
    const o = { x: 0 };
    const done = vi.fn();
    const t = Tween.position(o, { to: { x: 100 }, duration: 1, ease: 'linear', onComplete: done });
    advance(0.5);
    t.stop();
    advance(1);
    expect(o.x).toBeCloseTo(50);
    expect(done).not.toHaveBeenCalled();
    expect(t.isAlive).toBe(false);
    await expect(t.finished).resolves.toBeUndefined();
  });

  it('complete jumps to the end and runs onComplete once', () => {
    const o = { x: 0 };
    const done = vi.fn();
    const t = Tween.position(o, { to: { x: 100 }, duration: 1, startDelay: 1, cycles: 3, cycleMode: 'incremental', onComplete: done });
    t.complete();
    expect(o.x).toBe(300);
    t.complete();
    advance(5);
    expect(done).toHaveBeenCalledOnce();
  });

  it('complete on endless tweens ends the cycle (restart) or returns to start (yoyo)', () => {
    const a = { x: 0 };
    const b = { x: 0 };
    const ta = Tween.position(a, { to: { x: 10 }, duration: 1, cycles: -1 });
    const tb = Tween.position(b, { to: { x: 10 }, duration: 1, cycles: -1, cycleMode: 'yoyo' });
    advance(2.5);
    ta.complete();
    tb.complete();
    expect(a.x).toBe(10);
    expect(b.x).toBe(0);
  });

  it('timeScale speeds up one tween; isPaused holds it', () => {
    const o = { x: 0 };
    const t = Tween.position(o, { to: { x: 1 }, duration: 1, ease: 'linear' });
    t.timeScale = 2;
    expect(t.timeScale).toBe(2);
    advance(0.25);
    expect(o.x).toBeCloseTo(0.5);
    t.isPaused = true;
    advance(1);
    expect(o.x).toBeCloseTo(0.5);
    expect(t.isPaused).toBe(true);
    t.isPaused = false;
    advance(0.3);
    expect(o.x).toBe(1);
  });

  it('global timeScale slows everything down', () => {
    const o = { x: 0 };
    configure({ timeScale: 0.5 });
    Tween.position(o, { to: { x: 1 }, duration: 1, ease: 'linear' });
    advance(1);
    expect(o.x).toBeCloseTo(0.5);
    expect(() => configure({ timeScale: -1 })).toThrow();
  });
});

describe('replacement rule', () => {
  it('a new tween on the same property stops the old one where it is', () => {
    const o = { x: 0, y: 0 };
    const done = vi.fn();
    const first = Tween.position(o, { to: { x: 100, y: 100 }, duration: 1, ease: 'linear', onComplete: done });
    advance(0.5);
    const second = Tween.position(o, { to: { x: 0 }, duration: 1, ease: 'linear' });
    advance(0.5);
    expect(first.isAlive).toBe(false);
    expect(done).not.toHaveBeenCalled();
    // continued from where the first one was (about 50), not from 100
    expect(o.x).toBeGreaterThan(24);
    expect(o.x).toBeLessThan(27);
    expect(second.isAlive).toBe(true);
  });

  it('different properties on the same target run side by side', () => {
    const o = { x: 0, y: 0, alpha: 1 };
    const a = Tween.position(o, { to: { x: 1 }, duration: 1 });
    const b = Tween.position(o, { to: { y: 1 }, duration: 1 });
    const c = Tween.alpha(o, { to: 0, duration: 1 });
    advance(0.5);
    expect([a.isAlive, b.isAlive, c.isAlive]).toEqual([true, true, true]);
  });

  it('a delayed tween replaces only when it starts', () => {
    const o = { x: 0 };
    const first = Tween.position(o, { to: { x: 100 }, duration: 1 });
    Tween.position(o, { to: { x: 0 }, duration: 1, startDelay: 0.5 });
    advance(0.4);
    expect(first.isAlive).toBe(true);
    advance(0.2);
    expect(first.isAlive).toBe(false);
  });

  it('replacing a shake restores its base first, so nothing drifts', () => {
    const o = { x: 10, y: 0 };
    Tween.shakePosition(o, { strength: 20, duration: 1 });
    advance(0.3);
    expect(o.x).not.toBe(10);
    Tween.position(o, { to: { x: 20 }, duration: 1, ease: 'linear' });
    advance(1 / 60, 1);
    expect(o.x).toBeGreaterThan(10);
    expect(o.x).toBeLessThan(10.5);
  });
});

describe('effects', () => {
  it('shakePosition stays within strength and settles back at its base', () => {
    const o = { x: 5, y: -5 };
    Tween.shakePosition(o, { strength: { x: 10, y: 4 }, duration: 0.5, frequency: 40 });
    let maxX = 0;
    let moved = false;
    for (let i = 0; i < 30; i++) {
      advance(1 / 60, 1);
      maxX = Math.max(maxX, Math.abs(o.x - 5));
      if (o.y !== -5) moved = true;
      expect(Math.abs(o.y + 5)).toBeLessThanOrEqual(4);
    }
    expect(moved).toBe(true);
    expect(maxX).toBeGreaterThan(0.5);
    expect(maxX).toBeLessThanOrEqual(10);
    advance(0.1);
    expect(o).toEqual({ x: 5, y: -5 });
  });

  it('shakeRotation and shakeScale return to their base', () => {
    const o = { rotation: 3, scaleX: 1, scaleY: 1 };
    Tween.shakeRotation(o, { strength: 10, duration: 0.3, falloff: false });
    Tween.shakeScale(o, { strength: 0.2, duration: 0.3 });
    advance(0.15);
    expect(o.rotation).not.toBe(3);
    advance(0.2);
    expect(o).toEqual({ rotation: 3, scaleX: 1, scaleY: 1 });
  });

  it('punchScale swells past its base and settles back', () => {
    const o = { scaleX: 1, scaleY: 1 };
    Tween.punchScale(o, { strength: 0.2, duration: 1, oscillations: 1 });
    advance(0.25, 1);
    expect(o.scaleX).toBeGreaterThan(1.1);
    expect(o.scaleY).toBe(o.scaleX);
    advance(0.8);
    expect(o.scaleX).toBe(1);
  });

  it('punchPosition and punchRotation return to their base', () => {
    const o = { x: 0, y: 0, rotation: 0 };
    Tween.punchPosition(o, { strength: { y: -10 }, duration: 0.3 });
    Tween.punchRotation(o, { strength: 15, duration: 0.3 });
    advance(0.05);
    expect(o.y).toBeLessThan(0);
    expect(o.x).toBe(0);
    advance(0.3);
    expect(o).toEqual({ x: 0, y: 0, rotation: 0 });
  });

  it('stopping an effect puts its target back', () => {
    const o = { x: 0, y: 0 };
    const t = Tween.shakePosition(o, { strength: 10, duration: 1 });
    advance(0.2);
    t.stop();
    expect(o).toEqual({ x: 0, y: 0 });
  });
});

describe('cleanup', () => {
  it('stopAll(target) stops only that target, including delayed tweens', () => {
    const a = { x: 0 };
    const b = { x: 0 };
    const ta = Tween.position(a, { to: { x: 1 }, duration: 1, startDelay: 1 });
    const tb = Tween.position(b, { to: { x: 1 }, duration: 1 });
    expect(Tween.isTweening(a)).toBe(true);
    expect(Tween.stopAll(a)).toBe(1);
    expect(ta.isAlive).toBe(false);
    expect(tb.isAlive).toBe(true);
    expect(Tween.isTweening(a)).toBe(false);
  });

  it('stopAll() stops everything; completeAll(target) jumps to the end', () => {
    const a = { x: 0 };
    const b = { x: 0 };
    Tween.position(a, { to: { x: 1 }, duration: 1 });
    const tb = Tween.position(b, { to: { x: 1 }, duration: 1 });
    expect(Tween.completeAll(a)).toBe(1);
    expect(a.x).toBe(1);
    Tween.stopAll();
    expect(tb.isAlive).toBe(false);
  });

  it('finished tweens stop counting as tweening', () => {
    const o = { x: 0 };
    Tween.position(o, { to: { x: 1 }, duration: 0.1 });
    advance(0.2);
    expect(Tween.isTweening(o)).toBe(false);
  });
});
