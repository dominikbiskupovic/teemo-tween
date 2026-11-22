/**
 * The library's clock: one frame loop (requestAnimationFrame) that drives every running tween and
 * sequence, plus the global time scale and hit stop. Time is read from `document.timeline`, the
 * same clock the browser's Web Animations run on, so native animations and this loop stay in step.
 */

/** Something the frame loop drives: a tween or sequence that is not inside a sequence. */
export interface Driven {
  /** Folds elapsed time into its reference before the global speed changes. */
  _fold(now: number): void;
  /** Renders itself at clock time `now` (ms). */
  _tick(now: number): void;
  stop(): void;
  complete(): void;
}

const roots = new Set<Driven>();
let manualTime: number | null = null;
let handle: ReturnType<typeof setTimeout> | number | undefined;
let timeScale = 1;
let frozen = false;
let frozenUntil = -Infinity;
let waiters: Array<() => void> = [];

/** Clock time in milliseconds. */
export function now(): number {
  if (manualTime !== null) return manualTime;
  const t = typeof document !== 'undefined' ? document.timeline?.currentTime : null;
  if (typeof t === 'number') return t;
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** How fast root animations run relative to real time: the time scale, or 0 during a hit stop. */
export const globalVelocity = (): number => (frozen ? 0 : timeScale);

/** True when time only moves through {@link advanceClock} (tests, video capture). */
export const isManual = (): boolean => manualTime !== null;

export function addRoot(d: Driven): void {
  roots.add(d);
  wake();
}

export function removeRoot(d: Driven): void {
  roots.delete(d);
}

/** Every running root animation. */
export const rootList = (): Driven[] => [...roots];

function wake(): void {
  if (manualTime !== null || handle !== undefined || (roots.size === 0 && !frozen)) return;
  handle =
    typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame(frame)
      : setTimeout(frame, 16);
}

function frame(): void {
  handle = undefined;
  tick(now());
  wake();
}

/** Renders every root animation at clock time `t`. */
export function tick(t: number): void {
  if (frozen && t >= frozenUntil) {
    changeVelocity(() => {
      frozen = false;
      frozenUntil = -Infinity;
    }, t);
    const done = waiters;
    waiters = [];
    for (const resolve of done) resolve();
  }
  for (const d of [...roots]) d._tick(t);
}

function changeVelocity(change: () => void, t = now()): void {
  for (const d of roots) d._fold(t);
  change();
}

/** Sets the global time scale and re-syncs everything to it. */
export function setTimeScale(value: number): void {
  if (value === timeScale) return;
  const t = now();
  changeVelocity(() => {
    timeScale = value;
  }, t);
  tick(t);
}

/** Freezes every animation for `ms` of real time; overlapping calls extend the freeze. */
export function freezeFor(ms: number): Promise<void> {
  if (!(ms > 0)) return Promise.resolve();
  const done = new Promise<void>((resolve) => waiters.push(resolve));
  const t = now();
  if (t + ms > frozenUntil) {
    frozenUntil = t + ms;
    if (!frozen) {
      changeVelocity(() => {
        frozen = true;
      }, t);
      tick(t);
    }
  }
  wake();
  return done;
}

// ------------------------------------------------------------------ manual time (internal)

/** @internal Stops the frame loop; time then moves only through {@link advanceClock}. */
export function useManualClock(): void {
  if (handle !== undefined) {
    if (typeof cancelAnimationFrame === 'function' && typeof handle === 'number') cancelAnimationFrame(handle);
    else clearTimeout(handle);
    handle = undefined;
  }
  manualTime = now();
}

/** @internal Moves manual time forward by `ms` and renders. */
export function advanceClock(ms: number): void {
  if (manualTime === null) throw new Error('teemo-tween: advanceClock needs useManualClock() first');
  manualTime += ms;
  tick(manualTime);
}

/** @internal Clears hit stop and time scale (between tests). */
export function resetClock(): void {
  frozen = false;
  frozenUntil = -Infinity;
  timeScale = 1;
  const done = waiters;
  waiters = [];
  for (const resolve of done) resolve();
}
