import { describe, expect, it, vi } from 'vitest';
import { Sequence, Tween } from '../src';
import { advance, flush } from './clock';

const lin = { ease: 'linear' as const };
/** Rounds away floating-point noise from millisecond clock steps. */
const round = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 1e6) / 1e6]));

describe('Sequence', () => {
  it('chain plays one after another, group together, insert at a time', () => {
    const o = { x: 0, y: 0, alpha: 1, rotation: 0 };
    const s = Sequence.create()
      .chain(Tween.position(o, { to: { x: 10 }, duration: 1, ...lin }))
      .group(Tween.alpha(o, { to: 0, duration: 1, ...lin }))
      .chain(Tween.position(o, { to: { y: 10 }, duration: 1, ...lin }))
      .insert(0.5, Tween.rotation(o, { to: 90, duration: 1, ...lin }));
    expect(s.duration).toBe(2);
    advance(0.5);
    expect(round(o)).toMatchObject({ x: 5, alpha: 0.5, y: 0, rotation: 0 });
    advance(1);
    expect(round(o)).toMatchObject({ x: 10, alpha: 0, y: 5, rotation: 90 });
    advance(0.6);
    expect(o.y).toBe(10);
    expect(s.isAlive).toBe(false);
  });

  it('chained tweens on the same property start from where the last one ended', () => {
    const o = { x: 0 };
    Sequence.create()
      .chain(Tween.position(o, { to: { x: 10 }, duration: 0.5 }))
      .chain(Tween.position(o, { to: { x: 0 }, duration: 0.5, ...lin }));
    advance(0.75);
    expect(o.x).toBeCloseTo(5);
  });

  it('chainDelay, chainCallback and insertCallback run in order', () => {
    const log: string[] = [];
    const o = { x: 0 };
    Sequence.create()
      .chain(Tween.position(o, { to: { x: 1 }, duration: 0.5 }))
      .chainDelay(0.5)
      .chainCallback(() => log.push('after delay'))
      .insertCallback(0.25, () => log.push('early'));
    advance(0.9);
    expect(log).toEqual(['early']);
    advance(0.2);
    expect(log).toEqual(['early', 'after delay']);
  });

  it('group after chainDelay starts after the delay', () => {
    const o = { x: 0 };
    const s = Sequence.create().chainDelay(1).group(Tween.position(o, { to: { x: 1 }, duration: 1 }));
    expect(s.duration).toBe(2);
  });

  it('nests sequences and respects start delays of tweens', () => {
    const o = { x: 0, y: 0 };
    const inner = Sequence.create().chain(Tween.position(o, { to: { y: 1 }, duration: 0.5 }));
    const outer = Sequence.create()
      .chain(Tween.position(o, { to: { x: 1 }, duration: 0.5, startDelay: 0.5 }))
      .chain(inner);
    expect(outer.duration).toBe(1.5);
    advance(1.6);
    expect(o).toEqual({ x: 1, y: 1 });
    expect(inner.isAlive).toBe(false);
  });

  it('can be awaited; child promises resolve when the child is done', async () => {
    const o = { x: 0, y: 0 };
    const a = Tween.position(o, { to: { x: 1 }, duration: 0.5 });
    const s = Sequence.create().chain(a).chain(Tween.position(o, { to: { y: 1 }, duration: 0.5 }));
    let aDone = false;
    let sDone = false;
    void a.then(() => (aDone = true));
    void s.then(() => (sDone = true));
    advance(0.6);
    await flush();
    expect([aDone, sDone]).toEqual([true, false]);
    advance(0.5);
    await flush();
    expect(sDone).toBe(true);
  });

  it('cycles restart or rewind the whole sequence', () => {
    const a = { x: 0 };
    const b = { x: 0 };
    Sequence.create({ cycles: 2 }).chain(Tween.position(a, { from: { x: 0 }, to: { x: 10 }, duration: 1, ...lin }));
    Sequence.create({ cycles: 2, cycleMode: 'rewind' }).chain(Tween.position(b, { from: { x: 0 }, to: { x: 10 }, duration: 1, ...lin }));
    advance(1.25);
    expect(a.x).toBeCloseTo(2.5);
    expect(b.x).toBeCloseTo(7.5);
    advance(1);
    expect([a.x, b.x]).toEqual([10, 0]);
  });

  it('stop halts everything without onComplete; stopping a child stops its sequence', () => {
    const o = { x: 0, y: 0 };
    const done = vi.fn();
    const child = Tween.shakePosition(o, { strength: 10, duration: 1 });
    const s = Sequence.create({ onComplete: done }).chain(child).chain(Tween.delay(1));
    advance(0.3);
    child.stop();
    expect(s.isAlive).toBe(false);
    expect(child.isAlive).toBe(false);
    expect(o).toEqual({ x: 0, y: 0 }); // the shake put things back
    expect(done).not.toHaveBeenCalled();
  });

  it('complete runs the remaining tweens and callbacks to the end, once', () => {
    const o = { x: 0, y: 0 };
    const cb = vi.fn();
    const done = vi.fn();
    const s = Sequence.create({ onComplete: done })
      .chain(Tween.position(o, { to: { x: 5 }, duration: 1 }))
      .chainCallback(cb)
      .chain(Tween.position(o, { to: { y: 5 }, duration: 1 }));
    advance(0.2);
    s.complete();
    s.complete();
    expect(o).toEqual({ x: 5, y: 5 });
    expect(cb).toHaveBeenCalledOnce();
    expect(done).toHaveBeenCalledOnce();
  });

  it('complete works on an empty sequence and on endless contents', () => {
    const empty = Sequence.create();
    empty.complete();
    expect(empty.isAlive).toBe(false);
    const o = { x: 0 };
    const s = Sequence.create({ cycles: -1 }).chain(Tween.position(o, { to: { x: 2 }, duration: 1 }));
    advance(3.5);
    s.complete();
    expect(o.x).toBe(2);
    const p = { y: 0 };
    const endless = Sequence.create().chain(Tween.position(p, { to: { y: 3 }, duration: 1, cycles: -1 }));
    expect(endless.duration).toBe(Infinity);
    endless.complete();
    expect(p.y).toBe(3);
  });

  it('timeScale and isPaused control the whole sequence', () => {
    const o = { x: 0 };
    const s = Sequence.create().chain(Tween.position(o, { to: { x: 1 }, duration: 1, ...lin }));
    s.timeScale = 2;
    expect(s.timeScale).toBe(2);
    advance(0.25);
    expect(o.x).toBeCloseTo(0.5);
    s.isPaused = true;
    expect(s.isPaused).toBe(true);
    advance(1);
    expect(o.x).toBeCloseTo(0.5);
  });

  it('a standalone tween replaces a sequence child, but children in one sequence do not replace each other', () => {
    const o = { x: 0 };
    const first = Tween.position(o, { to: { x: 10 }, duration: 0.5 });
    const second = Tween.position(o, { to: { x: 0 }, duration: 0.5 });
    const s = Sequence.create({ cycles: 2 }).chain(first).chain(second);
    advance(0.75);
    expect(first.isAlive).toBe(true);
    const outsider = Tween.position(o, { to: { x: 50 }, duration: 0.2 });
    advance(0.05);
    expect(second.isAlive).toBe(false);
    expect(s.isAlive).toBe(true);
    expect(outsider.isAlive).toBe(true);
  });

  it('stopAll(target) stops the children on that target and leaves the sequence running', () => {
    const a = { x: 0 };
    const b = { x: 0 };
    const ta = Tween.position(a, { to: { x: 1 }, duration: 1 });
    const s = Sequence.create().chain(ta).group(Tween.position(b, { to: { x: 1 }, duration: 1 }));
    Tween.stopAll(a);
    advance(1.1);
    expect(ta.isAlive).toBe(false);
    expect(a.x).toBe(0);
    expect(b.x).toBe(1);
    expect(s.isAlive).toBe(false);
  });

  it('guards against misuse', () => {
    const t = Tween.delay(1);
    const s = Sequence.create().chain(t);
    expect(() => Sequence.create().chain(t)).toThrow(/already in a sequence/);
    const finished = Tween.delay(0.1);
    finished.stop();
    expect(() => Sequence.create().chain(finished)).toThrow(/finished/);
    expect(() => Sequence.create({ cycles: 0 })).toThrow(/cycles/);
    const endless = Sequence.create().chain(Tween.position({}, { to: { x: 1 }, cycles: -1 }));
    expect(() => endless.chain(Tween.delay(1))).toThrow(/endless/);
    expect(() => s.chain(Sequence.create({ cycles: -1 }))).toThrow(/endless sequence/);
    s.stop();
    expect(() => s.chain(Tween.delay(1))).toThrow(/finished/);
  });
});

describe('Sequence on elements', () => {
  it('ends every tween on its exact end values, even when frame times do not add up exactly', async () => {
    const { transformOf } = await import('./clock');
    const d = document.createElement('div');
    document.body.append(d);
    Sequence.create()
      .chain(Tween.scale(d, { to: 1.3 }))
      .group(Tween.rotation(d, { to: 15 }))
      .chainDelay(0.1)
      .chain(Tween.scale(d, { to: 1, ease: 'outBack' }))
      .group(Tween.rotation(d, { to: 0 }))
      .insert(0.15, Tween.shakePosition(d, { strength: 5 }));
    advance(1);
    expect(transformOf(d)).toMatchObject({ x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 });
    expect(d.getAnimations()).toHaveLength(0);
  });
});
