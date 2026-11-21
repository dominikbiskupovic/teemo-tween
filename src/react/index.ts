/**
 * React helpers. Optional: the core does not depend on React.
 *
 * @packageDocumentation
 */
import { useEffect, useLayoutEffect, useRef, type DependencyList, type RefObject } from 'react';
import type { Sequence, Tween } from '../index';

type Animation = Tween | Sequence;

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Collects animations so they can all be stopped at once. */
export interface TweenScope {
  /** Tracks an animation and returns it, so you can write `scope.add(Tween.scale(...))`. */
  add<T extends Animation>(animation: T): T;
  /** Stops every tracked animation that is still alive. */
  stopAll(): void;
}

/** Creates a scope outside React (for game loops, screens, pools). */
export function createTweenScope(): TweenScope {
  const live = new Set<Animation>();
  return {
    add(animation) {
      live.add(animation);
      void animation.finished.then(() => live.delete(animation));
      return animation;
    },
    stopAll() {
      for (const a of [...live]) a.stop();
      live.clear();
    },
  };
}

/**
 * A scope that stops its animations when the component unmounts. Use it in event handlers:
 *
 * ```tsx
 * const tweens = useTweenScope();
 * <button onClick={(e) => tweens.add(punchScale(e.currentTarget))} />
 * ```
 */
export function useTweenScope(): TweenScope {
  const ref = useRef<TweenScope | null>(null);
  ref.current ??= createTweenScope();
  const scope = ref.current;
  useEffect(() => () => scope.stopAll(), [scope]);
  return scope;
}

/**
 * Runs `create(element)` when the element mounts and whenever `deps` change; stops the previous
 * animation first and stops the last one on unmount. Safe under React strict mode.
 *
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * useTween(ref, (el) => popIn(el), []);
 * useTween(ref, (el) => countUp(el, { to: score }), [score]);
 * ```
 */
export function useTween<E extends Element>(
  ref: RefObject<E | null>,
  create: (element: E) => Animation | undefined | void,
  deps: DependencyList,
): void {
  // The effect closure is rebuilt each render, so it calls the `create` of the render whose deps changed.
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const animation = create(el);
    return () => animation?.stop();
  }, deps);
}
