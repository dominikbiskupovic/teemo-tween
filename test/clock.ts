import { gsap } from 'gsap';

let now = 0;

/** Moves GSAP's clock forward by `seconds`, in frames of 1/60 s (or one step if `frames` is 1). */
export function advance(seconds: number, frames = Math.max(1, Math.round(seconds * 60))): void {
  const step = seconds / frames;
  for (let i = 0; i < frames; i++) {
    now += step;
    gsap.updateRoot(now);
  }
}

export function resetClock(): void {
  now = gsap.globalTimeline.time();
}
resetClock();

/** Lets pending promise callbacks run. */
export const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
