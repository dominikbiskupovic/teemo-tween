import { describe, expect, it } from 'vitest';
import { configure, Ease, EASE_NAMES, resolveEase, Tween } from '../src';
import { advance } from './clock';

describe('eases', () => {
  it('covers linear plus all 30 easings.net curves', () => {
    expect(EASE_NAMES).toHaveLength(31);
    for (const fam of ['Sine', 'Quad', 'Cubic', 'Quart', 'Quint', 'Expo', 'Circ', 'Back', 'Elastic', 'Bounce']) {
      for (const dir of ['in', 'out', 'inOut']) expect(EASE_NAMES).toContain(`${dir}${fam}`);
    }
  });

  it('every curve starts at 0, ends at 1 and inOut curves meet at the middle', () => {
    for (const name of EASE_NAMES) {
      const f = resolveEase(name);
      expect(f(0), name).toBeCloseTo(0, 10);
      expect(f(1), name).toBeCloseTo(1, 10);
      if (name.startsWith('inOut')) {
        expect(f(0.5), name).toBeCloseTo(0.5, 10);
        expect(f(0.5 - 1e-9) - f(0.5 + 1e-9), `${name} continuous`).toBeCloseTo(0, 3);
      }
    }
  });

  it('matches the easings.net formulas at sample points', () => {
    const cases: Array<[keyof typeof Ease, number, number]> = [
      ['InOutSine', 0.25, (1 - Math.cos(Math.PI / 4)) / 2],
      ['InQuad', 0.5, 0.25],
      ['OutCubic', 0.5, 0.875],
      ['InOutQuart', 0.25, 0.03125],
      ['OutQuint', 0.5, 0.96875],
      ['OutExpo', 0.5, 0.96875],
      ['InCirc', 0.5, 1 - Math.sqrt(0.75)],
      ['OutBack', 0.5, 1.0876975],
      ['InOutBack', 0.25, -0.0996818],
      ['OutElastic', 0.5, 1.015625],
      ['OutBounce', 0.5, 0.765625],
      ['InBounce', 0.5, 0.234375],
    ];
    for (const [key, x, y] of cases) expect(resolveEase(Ease[key])(x), key).toBeCloseTo(y, 6);
  });

  it('Ease constants are the string names, PrimeTween style', () => {
    expect(Ease.OutBack).toBe('outBack');
    expect(Ease.Linear).toBe('linear');
    expect(Ease.InOutElastic).toBe('inOutElastic');
    expect(Object.keys(Ease)).toHaveLength(32);
    expect(Object.isFrozen(Ease)).toBe(true);
  });

  it('works on tweens by constant, by name, and through the default ease', () => {
    const a = { x: 0 };
    const b = { x: 0 };
    const c = { x: 0 };
    const d = { x: 0 };
    configure({ defaultEase: Ease.InQuad });
    Tween.position(a, { to: { x: 1 }, duration: 1, ease: Ease.OutCubic });
    Tween.position(b, { to: { x: 1 }, duration: 1, ease: 'outCubic' });
    Tween.position(c, { to: { x: 1 }, duration: 1, ease: Ease.Default });
    Tween.position(d, { to: { x: 1 }, duration: 1 });
    advance(0.5, 1);
    expect(a.x).toBeCloseTo(0.875);
    expect(b.x).toBeCloseTo(0.875);
    expect(c.x).toBeCloseTo(0.25);
    expect(d.x).toBeCloseTo(0.25);
  });

  it('rejects "default" as the default itself and unknown names', () => {
    expect(() => configure({ defaultEase: Ease.Default })).toThrow(/defaultEase/);
    expect(() => resolveEase('default')).toThrow(/default/);
    expect(() => resolveEase('outWobble' as never)).toThrow(/unknown ease/);
  });
});
