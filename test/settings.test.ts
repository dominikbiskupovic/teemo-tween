import { describe, expect, it, vi } from 'vitest';
import { configure, getSettings, hitStop, isReducedMotion, resetSettings, Tween } from '../src';
import { advance } from './clock';

describe('global settings', () => {
  it('configure merges, getSettings copies, resetSettings restores defaults', () => {
    configure({ defaultDuration: 1, reducedMotionPolicy: { effect: 'animate' } });
    const s = getSettings();
    expect(s.defaultDuration).toBe(1);
    expect(s.reducedMotionPolicy).toMatchObject({ effect: 'animate', move: 'jump' });
    s.defaultDuration = 5;
    expect(getSettings().defaultDuration).toBe(1);
    expect(resetSettings().defaultDuration).toBe(0.3);
  });

  it('time scale changes keep time continuous, and 0 freezes', () => {
    advance(3);
    const o = { x: 0 };
    Tween.position(o, { to: { x: 1 }, duration: 2, ease: 'linear' });
    advance(0.5);
    configure({ timeScale: 0.5 });
    advance(1);
    configure({ timeScale: 0 });
    advance(1);
    const frozen = o.x;
    configure({ timeScale: 1 });
    advance(0.5);
    expect([frozen, o.x]).toEqual([0.5, 0.75]);
  });

  it('hitStop freezes animations for real time, overlapping calls extend it', async () => {
    vi.useFakeTimers();
    try {
      const o = { x: 0 };
      Tween.position(o, { to: { x: 1 }, duration: 1, ease: 'linear' });
      advance(0.25);
      const done = hitStop(0.1);
      void hitStop(0.05); // shorter: does not cut the first one short
      advance(0.5);
      expect(o.x).toBeCloseTo(0.25);
      vi.advanceTimersByTime(100);
      await done;
      advance(0.25);
      expect(o.x).toBeCloseTo(0.5);
      await expect(hitStop(0)).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('reduced motion', () => {
  const mockMedia = (matches: boolean): void => {
    window.matchMedia = vi.fn().mockReturnValue({ matches });
  };

  it('auto follows prefers-reduced-motion; always and never override it', async () => {
    vi.resetModules();
    mockMedia(true);
    const fresh = await import('../src/core/settings');
    expect(fresh.isReducedMotion()).toBe(true);
    fresh.configure({ reducedMotion: 'never' });
    expect(fresh.isReducedMotion()).toBe(false);
    expect(isReducedMotion()).toBe(false); // the original module has no matching query
    configure({ reducedMotion: 'always' });
    expect(isReducedMotion()).toBe(true);
  });

  it('moves jump to their end state; callbacks and promises still run', async () => {
    configure({ reducedMotion: 'always' });
    const o = { x: 0, y: 0 };
    const done = vi.fn();
    const t = Tween.position(o, { to: { x: 100 }, duration: 1, cycles: 3, cycleMode: 'yoyo', onComplete: done });
    advance(1 / 60, 1);
    expect(o.x).toBe(100);
    expect(done).toHaveBeenCalledOnce();
    await t;
  });

  it('jumps keep their start delay so staggers still read in order', () => {
    configure({ reducedMotion: 'always' });
    const o = { x: 0 };
    Tween.position(o, { to: { x: 5 }, duration: 1, startDelay: 0.5 });
    advance(0.4);
    expect(o.x).toBe(0);
    advance(0.2);
    expect(o.x).toBe(5);
  });

  it('fades are shortened to 0.15 s', () => {
    configure({ reducedMotion: 'always' });
    const o = { alpha: 0 };
    const t = Tween.alpha(o, { to: 1, duration: 2 });
    expect(t.duration).toBeCloseTo(0.15);
    advance(0.16);
    expect(o.alpha).toBe(1);
  });

  it('shakes, punches and endless loops are skipped and leave the target alone', () => {
    configure({ reducedMotion: 'always' });
    const o = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
    const shake = Tween.shakePosition(o, { strength: 10, duration: 1 });
    const punch = Tween.punchScale(o, { strength: 0.3, duration: 1 });
    const bob = Tween.position(o, { from: { y: 0 }, to: { y: -10 }, duration: 1, cycles: -1, cycleMode: 'yoyo' });
    advance(0.1);
    expect(o).toEqual({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
    expect([shake.isAlive, punch.isAlive, bob.isAlive]).toEqual([false, false, false]);
  });

  it('custom values still animate, and a skipped tween replaces nothing', () => {
    configure({ reducedMotion: 'always' });
    let v = 0;
    Tween.custom({ from: 0, to: 10, duration: 1, ease: 'linear', onValueChange: (n) => (v = n) });
    const o = { x: 0 };
    const move = Tween.position(o, { to: { x: 1 }, duration: 1, reducedMotion: 'animate' });
    Tween.shakePosition(o, { strength: 5 });
    advance(0.5);
    expect(v).toBeCloseTo(5);
    expect(move.isAlive).toBe(true);
  });

  it('the policy is configurable globally and per tween', () => {
    configure({ reducedMotion: 'always', reducedMotionPolicy: { effect: 'animate', loops: 'animate', shortenTo: 0.5 } });
    const o = { x: 0, y: 0, alpha: 0 };
    Tween.shakePosition(o, { strength: 10, duration: 1 });
    expect(Tween.alpha(o, { to: 1, duration: 2 }).duration).toBeCloseTo(0.5);
    expect(Tween.rotation({}, { to: 1, duration: 1, reducedMotion: 'skip' }).isAlive).toBe(true);
    const loop = Tween.properties({ w: 0 }, { to: { w: 1 }, cycles: -1, reducedMotion: 'shorten' });
    advance(0.2);
    expect(o.x).not.toBe(0);
    expect(loop.isAlive).toBe(true);
  });
});
