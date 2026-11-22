import { advanceClock } from '../src/core/clock';

/** Moves the clock forward by `seconds`, in frames of 1/60 s (or one step if `frames` is 1). */
export function advance(seconds: number, frames = Math.max(1, Math.round(seconds * 60))): void {
  for (let i = 0; i < frames; i++) advanceClock((seconds * 1000) / frames);
}

/** Lets pending promise callbacks run. */
export const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/** What the browser actually renders for an element's position, scale and rotation. */
export function transformOf(el: Element): { x: number; y: number; scaleX: number; scaleY: number; rotation: number } {
  const css = getComputedStyle(el);
  const t = css.translate === 'none' ? [] : css.translate.split(' ');
  const s = css.scale === 'none' ? [] : css.scale.split(' ');
  const r = css.rotate === 'none' ? '0deg' : (css.rotate.split(' ').pop() as string);
  return {
    x: parseFloat(t[0] ?? '0'),
    y: parseFloat(t[1] ?? '0'),
    scaleX: parseFloat(s[0] ?? '1'),
    scaleY: parseFloat(s[1] ?? s[0] ?? '1'),
    rotation: parseFloat(r),
  };
}

/** Running native animations on an element (to check the browser, not JS, is animating). */
export const nativeAnimations = (el: Element): Animation[] => el.getAnimations();
