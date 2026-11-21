import { gsap } from 'gsap';
import type { Ease } from './ease';

/**
 * What a tween does when reduced motion is on:
 * - `animate`: plays normally.
 * - `jump`: goes straight to its end state (callbacks and promises still run).
 * - `shorten`: plays, but no longer than `shortenTo` seconds.
 * - `skip`: does nothing and finishes at once.
 */
export type ReducedBehavior = 'animate' | 'jump' | 'shorten' | 'skip';

/** The kind of a tween, which decides its reduced-motion behaviour. */
export type MotionKind = 'move' | 'fade' | 'effect' | 'value';

/**
 * `auto` follows the player's `prefers-reduced-motion` setting, `always` forces reduced motion
 * (for an in-game setting or testing), `never` ignores it.
 */
export type ReducedMotionMode = 'auto' | 'always' | 'never';

export interface ReducedMotionPolicy {
  /** Position, scale, rotation and other property tweens. Default `jump`. */
  move: ReducedBehavior;
  /** Alpha and colour. Default `shorten`. */
  fade: ReducedBehavior;
  /** Shakes and punches. Default `skip`. */
  effect: ReducedBehavior;
  /** `Tween.custom` and `Tween.delay` (numbers, text, timers). Default `animate`. */
  value: ReducedBehavior;
  /** Endless loops (`cycles: -1`) that are not `animate`. Default `skip`. */
  loops: 'skip' | 'animate';
  /** Longest duration of a `shorten` tween, in seconds. Default 0.15. */
  shortenTo: number;
}

export interface Settings {
  /** Used when a tween has no `ease` or `Ease.Default`. Any named ease or function. Default 'outQuad'. */
  defaultEase: Ease;
  /** Seconds. Default 0.3. */
  defaultDuration: number;
  /** Multiplies the speed of every teemo-tween animation. 0.25 is a handy slow motion. */
  timeScale: number;
  reducedMotion: ReducedMotionMode;
  reducedMotionPolicy: ReducedMotionPolicy;
}

export type SettingsInput = Partial<Omit<Settings, 'reducedMotionPolicy'>> & {
  reducedMotionPolicy?: Partial<ReducedMotionPolicy>;
};

const DEFAULTS: Settings = {
  defaultEase: 'outQuad',
  defaultDuration: 0.3,
  timeScale: 1,
  reducedMotion: 'auto',
  reducedMotionPolicy: {
    move: 'jump',
    fade: 'shorten',
    effect: 'skip',
    value: 'animate',
    loops: 'skip',
    shortenTo: 0.15,
  },
};

let current: Settings = { ...DEFAULTS, reducedMotionPolicy: { ...DEFAULTS.reducedMotionPolicy } };
let frozen = false;

let root: gsap.core.Timeline | undefined;

function applyTimeScale(): void {
  root?.timeScale(frozen ? 0 : current.timeScale);
}

/**
 * @internal Moves a new animation into the library's own timeline, which carries the global time
 * scale and hit stop. It lives inside GSAP's global timeline and is replaced once it empties.
 */
export function attach(animation: gsap.core.Animation): void {
  // An emptied root (its tweens were stopped) keeps a stale playhead: start a fresh one.
  if (root && (!root.parent || root.getChildren(false).length === 0)) {
    root.kill();
    root = undefined;
  }
  if (!root) {
    root = gsap.timeline({ autoRemoveChildren: true, smoothChildTiming: true });
    applyTimeScale();
  }
  root.add(animation, root.rawTime());
}

/** Changes global settings; returns the full settings now in force. */
export function configure(input: SettingsInput): Settings {
  const { reducedMotionPolicy, ...rest } = input;
  if (rest.defaultEase === 'default') {
    throw new Error('teemo-tween: defaultEase cannot be "default"');
  }
  if (rest.timeScale !== undefined && !(rest.timeScale >= 0)) {
    throw new Error('teemo-tween: timeScale must be 0 or more');
  }
  current = {
    ...current,
    ...rest,
    reducedMotionPolicy: { ...current.reducedMotionPolicy, ...reducedMotionPolicy },
  };
  if (rest.timeScale !== undefined) applyTimeScale();
  return getSettings();
}

/** Puts every setting back to its default. */
export function resetSettings(): Settings {
  current = { ...DEFAULTS, reducedMotionPolicy: { ...DEFAULTS.reducedMotionPolicy } };
  applyTimeScale();
  return getSettings();
}

/** A copy of the settings now in force. */
export function getSettings(): Settings {
  return { ...current, reducedMotionPolicy: { ...current.reducedMotionPolicy } };
}

let query: MediaQueryList | null | undefined;

/** True when tweens created now will use the reduced-motion policy. */
export function isReducedMotion(): boolean {
  if (current.reducedMotion === 'always') return true;
  if (current.reducedMotion === 'never') return false;
  if (query === undefined) {
    query =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
  }
  return query?.matches ?? false;
}

let hitStopTimer: ReturnType<typeof setTimeout> | undefined;
let hitStopEnds = 0;
let hitStopWaiters: Array<() => void> = [];

/**
 * Freezes every teemo-tween animation for `seconds` of real time: the "hit stop" that makes an impact land.
 * Overlapping calls extend the freeze. Resolves when time runs again.
 */
export function hitStop(seconds: number): Promise<void> {
  if (!(seconds > 0)) return Promise.resolve();
  const ends = Date.now() + seconds * 1000;
  const done = new Promise<void>((resolve) => hitStopWaiters.push(resolve));
  if (ends > hitStopEnds) {
    hitStopEnds = ends;
    if (hitStopTimer !== undefined) clearTimeout(hitStopTimer);
    frozen = true;
    applyTimeScale();
    hitStopTimer = setTimeout(() => {
      frozen = false;
      hitStopEnds = 0;
      hitStopTimer = undefined;
      applyTimeScale();
      const waiters = hitStopWaiters;
      hitStopWaiters = [];
      for (const w of waiters) w();
    }, seconds * 1000);
  }
  return done;
}
