import { act, render } from '@testing-library/react';
import { StrictMode, useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Tween } from '../src';
import { createTweenScope, useTween, useTweenScope, type TweenScope } from '../src/react';
import { advance } from './clock';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('react helpers', () => {
  it('useTween runs on mount, reruns on deps and stops on unmount, in strict mode', () => {
    const created: Tween[] = [];
    let setN: (n: number) => void = () => {};
    function Box() {
      const ref = useRef<HTMLDivElement>(null);
      const [n, set] = useState(0);
      setN = set;
      useTween(ref, (el) => {
        const t = Tween.position(el, { to: { x: 100 + n }, duration: 10 });
        created.push(t);
        return t;
      }, [n]);
      return <div ref={ref} />;
    }
    const view = render(<StrictMode><Box /></StrictMode>);
    // strict mode mounts, cleans up and mounts again: only the last one lives
    expect(created.filter((t) => t.isAlive)).toHaveLength(1);
    act(() => setN(1));
    expect(created.filter((t) => t.isAlive)).toHaveLength(1);
    expect(created.at(-1)!.isAlive).toBe(true);
    view.unmount();
    expect(created.every((t) => !t.isAlive)).toBe(true);
  });

  it('useTween ignores a missing element and a factory that returns nothing', () => {
    const fn = vi.fn();
    function Nothing() {
      const ref = useRef<HTMLDivElement>(null);
      useTween(ref, fn, []);
      return null;
    }
    render(<Nothing />).unmount();
    expect(fn).not.toHaveBeenCalled();
  });

  it('useTweenScope stops what it tracked on unmount, and survives strict mode', () => {
    let scope: TweenScope | undefined;
    function Panel() {
      scope = useTweenScope();
      return null;
    }
    const view = render(<StrictMode><Panel /></StrictMode>);
    const t = scope!.add(Tween.position({ x: 0 }, { to: { x: 1 }, duration: 10 }));
    advance(0.1);
    expect(t.isAlive).toBe(true);
    view.unmount();
    expect(t.isAlive).toBe(false);
  });

  it('createTweenScope forgets finished animations and stops the rest', async () => {
    const scope = createTweenScope();
    const short = scope.add(Tween.delay(0.1));
    const long = scope.add(Tween.delay(5));
    advance(0.2);
    await short;
    scope.stopAll();
    expect(long.isAlive).toBe(false);
  });
});
