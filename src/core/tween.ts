import { isManual, rootList } from './clock';
import { cssEasing, resolveEase, type Ease, type EaseFunction } from './ease';
import {
  canAnimate,
  canAnimateAxes,
  cssText,
  GROUPS,
  groupValue,
  isElement,
  isSvg,
  readElement,
  TRANSFORM,
  writeElement,
  type TweenTarget,
} from './element';
import { Playable } from './playable';
import { getSettings, isReducedMotion, type MotionKind, type ReducedBehavior } from './settings';
import { makeInterpolator, noise, type Value } from './value';

/**
 * How cycles after the first play:
 * - `restart`: from the start again.
 * - `yoyo`: back and forth, with the ease mirrored so both directions feel the same.
 * - `rewind`: back and forth, the return is the forward motion played backwards.
 * - `incremental`: each cycle continues from where the last ended (numbers only).
 */
export type CycleMode = 'restart' | 'yoyo' | 'rewind' | 'incremental';

/** Options every tween takes. */
export interface TweenOptions {
  /** Seconds for one cycle. Defaults to `defaultDuration` (0.3). */
  duration?: number;
  /** A name (`'outBack'`), a constant (`Ease.OutBack`) or a function. Defaults to `defaultEase` ('outQuad'); `Ease.Default` asks for it explicitly. */
  ease?: Ease;
  /** Seconds to wait before the first cycle. */
  startDelay?: number;
  /** Seconds to wait after the last cycle before finishing (useful in sequences). */
  endDelay?: number;
  /** How many times to play. -1 plays forever. Default 1. */
  cycles?: number;
  /** Default 'restart'. */
  cycleMode?: CycleMode;
  /** Runs when the tween finishes on its own or through `complete()`, not when stopped. */
  onComplete?: () => void;
  /** Overrides what the reduced-motion policy does with this tween. */
  reducedMotion?: ReducedBehavior;
}

/** A partial 2D vector: leave out an axis to leave it alone. */
export interface Vec2 {
  x?: number;
  y?: number;
}

export interface PositionOptions extends TweenOptions {
  from?: Vec2;
  to: Vec2;
}
export interface ScaleOptions extends TweenOptions {
  /** A number scales both axes. */
  from?: number | Vec2;
  to: number | Vec2;
}
export interface NumberOptions extends TweenOptions {
  from?: number;
  to: number;
}
export interface ColorOptions extends TweenOptions {
  from?: string;
  to: string;
  /**
   * The property to tween. Defaults to `backgroundColor` on HTML elements, `fill` on SVG
   * elements and `color` on plain objects.
   */
  property?: string;
}
export interface PropertiesOptions extends TweenOptions {
  /**
   * Any CSS properties (`width`, `filter`, `backgroundColor`), CSS variables (`'--glow'`) or
   * fields of an object. On elements, `x`, `y`, `scaleX`, `scaleY`, `scale` and `rotation` are the
   * same channels `Tween.position`, `Tween.scale` and `Tween.rotation` use. Plain numbers on
   * length properties get `px`.
   */
  from?: Record<string, Value>;
  to: Record<string, Value>;
}
export interface CustomOptions extends TweenOptions {
  from: number;
  to: number;
  onValueChange: (value: number) => void;
}
export interface ShakeOptions extends TweenOptions {
  /** Largest offset: px for position (a number shakes both axes), degrees for rotation, scale units for scale. */
  strength: number | Vec2;
  /** How fast the noise moves. Default 30. */
  frequency?: number;
  /** Fade the shake out over its duration (trauma squared). Default true. */
  falloff?: boolean;
}
export interface PunchOptions extends TweenOptions {
  /** Peak offset: px for position, degrees for rotation, scale units for scale (0.2 = +20%). */
  strength: number | Vec2;
  /** Half-swings over the duration. 1 is a single swell, 3 swells, dips and settles. Default 3. */
  oscillations?: number;
}

type Group = keyof typeof GROUPS;

/** How the browser animates a channel natively; channels without one are written every frame. */
type Native = { group: Group } | { prop: string; format: (value: Value) => string | number };

/** One animated property of one tween, once its start values are known. */
interface Channel {
  prop: string;
  /** The value at eased progress `k` of cycle `cycle` (`u` raw progress, `time` seconds into it). */
  at(k: number, cycle: number, u: number, time: number): Value;
  write(value: Value): void;
  /** False when JS can only approximate the value (CSS strings that don't line up). */
  exact: boolean;
  native: Native | undefined;
}

interface NativeAnimation {
  el: Element;
  frames: Keyframe[];
  timing: KeyframeEffectOptions;
}

interface Renderer {
  channels: Channel[];
  native?: NativeAnimation | undefined;
}

interface Definition {
  target: TweenTarget | undefined;
  /** Properties this tween owns while it runs (the replacement rule). */
  props: string[];
  kind: MotionKind;
  options: TweenOptions;
  /** Shakes and punches: they move around a base and put it back. */
  effect?: boolean;
  /** Called once, when the tween starts: read start values, build the channels. */
  setup: () => Channel[];
  /** Values to show right away, before the start delay (explicit `from` values). */
  initial?: (() => void) | undefined;
}

/** Tolerance for time comparisons: sums of frame times are never exactly the duration. */
const EPS = 1e-9;

const owners = new WeakMap<object, Map<string, Tween>>();
const byTarget = new WeakMap<object, Set<Tween>>();

/** Calls back without letting an exception break the frame loop for everything else. */
export function safeCall(fn: (() => void) | undefined): void {
  if (!fn) return;
  try {
    fn();
  } catch (error) {
    setTimeout(() => {
      throw error;
    });
  }
}

function rootOf(p: Playable | undefined): Playable | undefined {
  let r = p;
  while (r?._parent) r = r._parent;
  return r;
}

const vec = (v: number | Vec2): Vec2 => (typeof v === 'number' ? { x: v, y: v } : v);

function readObject(target: object, prop: string): Value {
  const v: unknown = (target as Record<string, unknown>)[prop];
  return typeof v === 'number' || typeof v === 'string' ? v : 0;
}

const writer = (target: TweenTarget, prop: string): ((v: Value) => void) =>
  isElement(target)
    ? (v) => writeElement(target, prop, v)
    : (v) => {
        (target as Record<string, unknown>)[prop] = v;
      };

const read = (target: TweenTarget, prop: string): Value =>
  isElement(target) ? readElement(target, prop) : readObject(target, prop);

/** Decides how each element property is animated natively. */
function nativeMap(props: string[]): Map<string, Native> {
  const map = new Map<string, Native>();
  if (!canAnimate()) return map;
  for (const [group, channels] of Object.entries(GROUPS) as Array<[Group, string[]]>) {
    const present = channels.filter((c) => props.includes(c));
    if (present.length === channels.length) {
      // The whole CSS property moves: animate it directly (GPU-friendly).
      for (const c of present) map.set(c, { group });
    } else if (present.length && canAnimateAxes()) {
      for (const c of present) {
        const t = TRANSFORM[c]!;
        map.set(c, { prop: t.variable, format: (v) => `${v}${t.unit}` });
      }
    }
  }
  for (const p of props) {
    if (TRANSFORM[p] || p.startsWith('--')) continue; // custom properties interpolate in JS
    map.set(p, { prop: p, format: (v) => (p === 'opacity' ? Number(v) : cssText(p, v)) });
  }
  return map;
}

/** Resolves duration, cycles and ease, applying the reduced-motion policy. Throws on bad input. */
function timing(def: Definition): { duration: number; cycles: number; skip: boolean; ease: EaseFunction } {
  const settings = getSettings();
  const o = def.options;
  let duration = o.duration ?? settings.defaultDuration;
  let cycles = o.cycles ?? 1;
  if (!(duration >= 0)) throw new Error('teemo-tween: duration must be 0 or more');
  if (!Number.isInteger(cycles) || (cycles < 1 && cycles !== -1)) {
    throw new Error('teemo-tween: cycles must be a whole number >= 1, or -1 for endless');
  }
  if (cycles === -1 && duration === 0) cycles = 1;
  let skip = false;
  if (isReducedMotion()) {
    const policy = settings.reducedMotionPolicy;
    const behavior = o.reducedMotion ?? policy[def.kind];
    if (behavior !== 'animate') {
      if (cycles === -1 && policy.loops === 'skip') skip = true;
      else if (behavior === 'skip') skip = true;
      else if (behavior === 'jump') duration = 0;
      else if (behavior === 'shorten') duration = Math.min(duration, policy.shortenTo);
      if (cycles === -1 && duration === 0) cycles = 1;
    }
  }
  if (skip) {
    duration = 0;
    cycles = 1;
  }
  const ease = o.ease ?? 'default';
  return { duration, cycles, skip, ease: resolveEase(ease === 'default' ? settings.defaultEase : ease) };
}

/**
 * One animation. Create tweens with the static methods (`Tween.position`, `Tween.scale`, ...).
 * A tween can be awaited: `await Tween.alpha(el, { to: 0 })`.
 */
export class Tween extends Playable implements PromiseLike<void> {
  /** Resolves when the tween finishes, completes or is stopped. Never rejects. */
  readonly finished: Promise<void>;

  private _resolve!: () => void;
  private readonly _def: Definition;
  private readonly _skip: boolean;
  private readonly _ease: EaseFunction;
  private readonly _cycleDur: number;
  private readonly _cycles: number;
  private readonly _endless: boolean;
  private readonly _mode: CycleMode;
  private readonly _delay: number;
  private readonly _endDelay: number;
  private _renderer: Renderer | undefined;
  private _anim: Animation | null = null;
  private _live: Channel[] = [];
  private _shown: 'none' | 'start' | 'active' | 'end' = 'none';
  private _lastT = -Infinity;
  private _lastA = 0;

  private constructor(def: Definition) {
    // Validate before joining the clock, so a bad tween never runs.
    const t = timing(def);
    super();
    this._def = def;
    this._skip = t.skip;
    this._cycleDur = t.duration;
    this._cycles = t.cycles;
    this._endless = t.cycles === -1;
    const o = def.options;
    this._mode = o.cycleMode ?? 'restart';
    this._ease = t.ease;
    this._delay = Math.max(0, o.startDelay ?? 0);
    this._endDelay = Math.max(0, o.endDelay ?? 0);
    this.finished = new Promise<void>((resolve) => {
      this._resolve = resolve;
    });

    if (def.target) {
      let set = byTarget.get(def.target);
      if (!set) byTarget.set(def.target, (set = new Set()));
      set.add(this);
    }
    if (!t.skip) def.initial?.();
  }

  // ---------------------------------------------------------------- factories

  /** Moves a target to `to` (px on elements, `x`/`y` fields on objects). */
  static position(target: TweenTarget, options: PositionOptions): Tween {
    return Tween._props(target, 'move', options, axes('x', 'y', options.from, options.to));
  }

  /** Scales a target. A number scales both axes (`scaleX`/`scaleY`). */
  static scale(target: TweenTarget, options: ScaleOptions): Tween {
    const from = options.from === undefined ? undefined : vec(options.from);
    return Tween._props(target, 'move', options, axes('scaleX', 'scaleY', from, vec(options.to)));
  }

  /** Rotates a target, in degrees (the `rotation` field on objects). */
  static rotation(target: TweenTarget, options: NumberOptions): Tween {
    return Tween._props(target, 'move', options, [{ prop: 'rotation', from: options.from, to: options.to }]);
  }

  /** Fades a target: `opacity` on elements, the `alpha` field on objects. */
  static alpha(target: TweenTarget, options: NumberOptions): Tween {
    const prop = isElement(target) ? 'opacity' : 'alpha';
    return Tween._props(target, 'fade', options, [{ prop, from: options.from, to: options.to }]);
  }

  /** Blends a colour property; any CSS colour string works. */
  static color(target: TweenTarget, options: ColorOptions): Tween {
    const prop =
      options.property ?? (isSvg(target) ? 'fill' : isElement(target) ? 'backgroundColor' : 'color');
    return Tween._props(target, 'fade', options, [{ prop, from: options.from, to: options.to }]);
  }

  /** Tweens any set of properties: CSS properties, CSS variables, fields of an object. */
  static properties(target: TweenTarget, options: PropertiesOptions): Tween {
    const el = isElement(target);
    const channels: Array<{ prop: string; from: Value | undefined; to: Value }> = [];
    for (const [key, to] of Object.entries(options.to)) {
      const from = options.from?.[key];
      // `scale` on an element means both scale axes.
      const props = el && key === 'scale' ? ['scaleX', 'scaleY'] : [key];
      for (const prop of props) channels.push({ prop, from, to });
    }
    return Tween._props(target, 'move', options, channels);
  }

  /** Tweens a number and hands each value to `onValueChange`: for canvas, text, audio, anything. */
  static custom(options: CustomOptions): Tween {
    const { from, to, onValueChange } = options;
    const incremental = options.cycleMode === 'incremental';
    return new Tween({
      target: undefined,
      props: [],
      kind: 'value',
      options,
      setup: () => [
        {
          prop: '',
          exact: true,
          native: undefined,
          at: (k, cycle) => from + (to - from) * k + (incremental ? cycle * (to - from) : 0),
          write: (v) => onValueChange(v as number),
        },
      ],
    });
  }

  /** Waits `seconds`, then calls `onComplete`. Awaitable like any tween. */
  static delay(seconds: number, onComplete?: () => void): Tween {
    return new Tween({
      target: undefined,
      props: [],
      kind: 'value',
      options: { duration: seconds, ease: 'linear', ...(onComplete ? { onComplete } : {}) },
      setup: () => [],
    });
  }

  /** Shakes the position around where it is, then puts it back. */
  static shakePosition(target: TweenTarget, options: ShakeOptions): Tween {
    const s = vec(options.strength);
    return Tween._effect(target, options, [['x', s.x ?? 0], ['y', s.y ?? 0]], shakeWave(options));
  }

  /** Shakes the rotation (degrees) around where it is, then puts it back. */
  static shakeRotation(target: TweenTarget, options: ShakeOptions & { strength: number }): Tween {
    return Tween._effect(target, options, [['rotation', options.strength]], shakeWave(options));
  }

  /** Shakes the scale around where it is, then puts it back. */
  static shakeScale(target: TweenTarget, options: ShakeOptions): Tween {
    const s = vec(options.strength);
    return Tween._effect(target, options, [['scaleX', s.x ?? 0], ['scaleY', s.y ?? 0]], shakeWave(options));
  }

  /** A quick, springy push of the position that settles back where it was. */
  static punchPosition(target: TweenTarget, options: PunchOptions): Tween {
    const s = vec(options.strength);
    return Tween._effect(target, options, [['x', s.x ?? 0], ['y', s.y ?? 0]], punchWave(options));
  }

  /** A quick, springy twist (degrees) that settles back where it was. */
  static punchRotation(target: TweenTarget, options: PunchOptions & { strength: number }): Tween {
    return Tween._effect(target, options, [['rotation', options.strength]], punchWave(options));
  }

  /** A quick, springy swell of the scale that settles back where it was. */
  static punchScale(target: TweenTarget, options: PunchOptions): Tween {
    const s = vec(options.strength);
    return Tween._effect(target, options, [['scaleX', s.x ?? 0], ['scaleY', s.y ?? 0]], punchWave(options));
  }

  // ---------------------------------------------------------------- global control

  /** Stops every tween on `target` (or every tween and sequence, without a target). */
  static stopAll(target?: TweenTarget): number {
    if (!target) {
      const list = rootList();
      for (const r of list) r.stop();
      return list.length;
    }
    const list = [...(byTarget.get(target) ?? [])];
    for (const t of list) t._halt();
    return list.length;
  }

  /** Completes every tween on `target` (or every tween and sequence, without a target). */
  static completeAll(target?: TweenTarget): number {
    const list = target ? [...(byTarget.get(target) ?? [])] : rootList();
    for (const t of list) t.complete();
    return list.length;
  }

  /** True while any tween on `target` is alive (running or waiting to start). */
  static isTweening(target: TweenTarget): boolean {
    return (byTarget.get(target)?.size ?? 0) > 0;
  }

  // ---------------------------------------------------------------- instance API

  /** Total seconds including delays and all cycles; `Infinity` for endless tweens. */
  get duration(): number {
    return this._total;
  }

  /**
   * Stops where it is, without `onComplete`. Shakes and punches put their target back first.
   * Inside a sequence this stops the whole sequence.
   */
  stop(): void {
    if (!this._alive) return;
    if (this._parent) {
      rootOf(this._parent)?.stop();
      return;
    }
    this._halt();
  }

  /**
   * Jumps to the end state and runs `onComplete`. An endless tween ends at the end of its current
   * cycle (`restart`, `incremental`) or back at its start (`yoyo`, `rewind`).
   * Inside a sequence this completes the whole sequence.
   */
  complete(): void {
    if (!this._alive) return;
    if (this._parent) {
      rootOf(this._parent)?.complete();
      return;
    }
    this._completeNow();
  }

  then<A = void, B = never>(
    onfulfilled?: ((value: void) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): Promise<A | B> {
    return this.finished.then(onfulfilled, onrejected);
  }

  // ---------------------------------------------------------------- timing internals

  /** @internal */
  get _total(): number {
    return this._endless ? Infinity : this._delay + this._cycleDur * this._cycles + this._endDelay;
  }

  /** @internal */
  get _infinite(): boolean {
    return this._endless;
  }

  /** @internal Checks this tween may join a sequence. */
  _checkAdopt(): void {
    if (this._parent) throw new Error('teemo-tween: this tween is already in a sequence');
    if (!this._alive) throw new Error('teemo-tween: cannot add a finished tween to a sequence');
  }

  /** @internal */
  _render(T: number, v: number): void {
    if (!this._alive) return;
    const a = T - this._delay;
    const end = this._endless ? Infinity : this._cycleDur * this._cycles;
    if (a < 0) {
      if (this._shown === 'active' || this._shown === 'end') this._show('start');
    } else if (this._claim()) {
      if (a < end - EPS) {
        if (this._shown !== 'active') this._enter();
        this._play(a, v);
      } else if (this._shown !== 'end') {
        this._show('end');
      }
    }
    this._lastA = a;
    const total = this._total;
    const crossed = this._lastT < total - EPS && T >= total - EPS;
    this._lastT = T;
    if (crossed) this._finishedOnce();
  }

  /** @internal Jumps to the end without involving the parent. */
  _completeNow(): void {
    if (!this._alive) return;
    if (this._claim()) {
      this._cancel();
      if (this._endless) {
        const d = this._cycleDur;
        let cycle = d > 0 ? Math.floor(Math.max(0, this._lastA) / d) : 0;
        if ((this._mode === 'yoyo' || this._mode === 'rewind') && cycle % 2 === 0) cycle += 1;
        this._writeAt(cycle, 1);
      } else {
        this._writeEnd();
      }
      this._shown = 'end';
    }
    safeCall(this._def.options.onComplete);
    this._finish();
  }

  /** @internal Stops without onComplete: values stay where they are; effects restore their base. */
  _halt(): void {
    if (!this._alive) return;
    if (this._shown === 'active' && this._renderer) {
      if (this._def.effect) {
        this._writeEnd();
      } else {
        const channels = this._renderer.channels;
        let committed = false;
        if (this._anim && channels.some((c) => !c.exact && c.native)) {
          try {
            this._anim.commitStyles();
            committed = true;
          } catch {
            // Not rendered (display: none): fall back to what JS can compute.
          }
        }
        const [k, cycle, u, time] = this._state(this._lastA);
        for (const c of channels) if (c.exact || !committed) c.write(c.at(k, cycle, u, time));
      }
      this._shown = 'end'; // values are written: finishing must not write them again
    }
    this._cancel();
    this._finish();
  }

  /** @internal Ends its life: called once it finished, completed, stopped or its sequence ended. */
  _finish(): void {
    if (!this._alive) return;
    this._alive = false;
    // Never drop a running native animation without writing where it is: the element would snap back.
    if (this._shown === 'active' && this._renderer) {
      const [k, cycle, u, time] = this._state(this._lastA);
      for (const c of this._renderer.channels) c.write(c.at(k, cycle, u, time));
    }
    this._cancel();
    const t = this._def.target;
    if (t) {
      byTarget.get(t)?.delete(this);
      const map = owners.get(t);
      if (map) for (const p of this._def.props) if (map.get(p) === this) map.delete(p);
    }
    this._detach();
    this._resolve();
  }

  private _finishedOnce(): void {
    if (!this._alive) return;
    safeCall(this._def.options.onComplete);
    // Inside a sequence the tween stays alive until the sequence ends (it may play again).
    if (this._parent) this._resolve();
    else this._finish();
  }

  /** Starts owning the properties (the replacement rule) and reads start values. */
  private _claim(): Renderer | undefined {
    if (this._renderer || this._skip || !this._alive) return this._renderer;
    const t = this._def.target;
    if (t) {
      let map = owners.get(t);
      if (!map) owners.set(t, (map = new Map()));
      const mine = rootOf(this._parent);
      for (const p of this._def.props) {
        const old = map.get(p);
        if (old && old !== this && old._alive && !(mine && rootOf(old._parent) === mine)) old._halt();
      }
      for (const p of this._def.props) map.set(p, this);
    }
    const channels = this._def.setup();
    this._renderer = { channels, native: isElement(t) ? this._nativeFor(t, channels) : undefined };
    return this._renderer;
  }

  /** Builds the keyframes the browser plays for this tween's native channels. */
  private _nativeFor(el: Element, channels: Channel[]): NativeAnimation | undefined {
    const native = channels.filter((c) => c.native);
    if (!native.length || this._cycleDur <= 0) return undefined;
    if (!this._def.effect && this._endless && this._mode === 'incremental') return undefined;
    const frame = (k: number, cycle: number, u: number): Keyframe => {
      const out: Keyframe = {};
      const groups: Partial<Record<Group, Record<string, number>>> = {};
      for (const c of native) {
        const value = c.at(k, cycle, u, u * this._cycleDur);
        const n = c.native!;
        if ('group' in n) (groups[n.group] ??= {})[c.prop] = Number(value);
        else out[n.prop] = n.format(value);
      }
      for (const [g, values] of Object.entries(groups) as Array<[Group, Record<string, number>]>) {
        out[g] = groupValue(g, values);
      }
      return out;
    };
    const d = this._cycleDur * 1000;
    const iterations = (n: number) => (this._endless ? Infinity : n);
    const timing: KeyframeEffectOptions = { fill: 'both', easing: 'linear', duration: d, iterations: iterations(this._cycles) };
    let frames: Keyframe[];
    if (this._def.effect) {
      const steps = Math.min(400, Math.max(8, Math.ceil(this._cycleDur * 90)));
      frames = Array.from({ length: steps + 1 }, (_, i) => frame(0, 0, i / steps));
    } else {
      const easing = cssEasing(this._ease);
      if (this._mode === 'yoyo') {
        frames = [
          { ...frame(0, 0, 0), offset: 0, easing },
          { ...frame(1, 0, 1), offset: 0.5, easing },
          { ...frame(0, 0, 0), offset: 1 },
        ];
        timing.duration = d * 2;
        timing.iterations = iterations(this._cycles / 2);
      } else if (this._mode === 'incremental') {
        const n = this._cycles;
        frames = Array.from({ length: n + 1 }, (_, i) => ({ ...frame(0, i, 0), offset: i / n, easing }));
        timing.duration = d * n;
        timing.iterations = 1;
      } else {
        frames = [{ ...frame(0, 0, 0), easing }, frame(1, 0, 1)];
        if (this._mode === 'rewind') timing.direction = 'alternate';
      }
    }
    return { el, frames, timing };
  }

  /** Becomes active: starts the native animation (if any). */
  private _enter(): void {
    const r = this._renderer!;
    this._cancel();
    if (r.native) {
      try {
        this._anim = r.native.el.animate(r.native.frames, r.native.timing);
      } catch {
        r.native = undefined; // e.g. a value the browser rejects: animate it from JS instead
      }
    }
    this._live = this._anim ? r.channels.filter((c) => !c.native) : r.channels;
    this._shown = 'active';
  }

  /** Keeps the native animation in step with this tween's time and writes the JS channels. */
  private _play(a: number, v: number): void {
    const anim = this._anim;
    if (anim) {
      const target = a * 1000;
      if (isManual() || v === 0) {
        if (anim.playState !== 'paused') anim.pause();
        anim.currentTime = target;
      } else {
        if (anim.playbackRate !== v) anim.playbackRate = v;
        if (anim.playState === 'paused') {
          anim.play();
          anim.currentTime = target;
        } else {
          const current = anim.currentTime;
          if (typeof current !== 'number' || Math.abs(current - target) > 20) anim.currentTime = target;
        }
      }
    }
    if (this._live.length) {
      const [k, cycle, u, time] = this._state(a);
      for (const c of this._live) c.write(c.at(k, cycle, u, time));
    }
  }

  /** Leaves the active window: commits the boundary values and drops the native animation. */
  private _show(edge: 'start' | 'end'): void {
    this._cancel();
    if (edge === 'end' || this._def.effect) this._writeEnd();
    else this._writeAt(0, 0);
    this._shown = edge;
  }

  private _cancel(): void {
    if (this._anim) {
      this._anim.cancel();
      this._anim = null;
    }
  }

  private _writeEnd(): void {
    this._writeAt(this._endless ? 0 : this._cycles - 1, 1);
  }

  private _writeAt(cycle: number, u: number): void {
    const r = this._renderer;
    if (!r) return;
    const k = this._k(cycle, u);
    for (const c of r.channels) c.write(c.at(k, cycle, u, u * this._cycleDur));
  }

  /** Cycle state at active time `a`: [eased progress, cycle, raw progress, seconds into cycle]. */
  private _state(a: number): [number, number, number, number] {
    const d = this._cycleDur;
    const e = Math.max(0, a);
    if (d <= 0 || (!this._endless && e >= d * this._cycles - EPS)) {
      const cycle = this._endless ? 0 : this._cycles - 1;
      return [this._k(cycle, 1), cycle, 1, d];
    }
    const cycle = Math.floor(e / d);
    const u = (e - cycle * d) / d;
    return [this._k(cycle, u), cycle, u, u * d];
  }

  /** Eased progress, adjusted for direction. The ends of a cycle are exact. */
  private _k(cycle: number, u: number): number {
    const curve = this._ease;
    const ease = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : curve(t));
    const odd = cycle % 2 === 1;
    if (this._mode === 'yoyo' && odd) return 1 - ease(u);
    if (this._mode === 'rewind' && odd) return ease(1 - u);
    return ease(u);
  }

  private static _props(
    target: TweenTarget,
    kind: MotionKind,
    options: TweenOptions,
    channels: Array<{ prop: string; from: Value | undefined; to: Value }>,
  ): Tween {
    const incremental = options.cycleMode === 'incremental';
    const withFrom = channels.filter((c) => c.from !== undefined);
    return new Tween({
      target,
      props: channels.map((c) => c.prop),
      kind,
      options,
      initial: withFrom.length
        ? () => {
            for (const c of withFrom) writer(target, c.prop)(c.from as Value);
          }
        : undefined,
      setup: () => {
        const natives = isElement(target) ? nativeMap(channels.map((c) => c.prop)) : undefined;
        return channels.map((c): Channel => {
          let from = c.from ?? read(target, c.prop);
          if (typeof c.to === 'number' && typeof from === 'string') from = parseFloat(from) || 0;
          const lerp = makeInterpolator(from, c.to);
          const step = typeof from === 'number' && typeof c.to === 'number' ? c.to - from : 0;
          return {
            prop: c.prop,
            exact: lerp.exact,
            native: natives?.get(c.prop),
            at: (k, cycle) => {
              const v = lerp.at(k);
              return incremental && typeof v === 'number' ? v + step * cycle : v;
            },
            write: writer(target, c.prop),
          };
        });
      },
    });
  }

  private static _effect(
    target: TweenTarget,
    options: TweenOptions,
    channels: Array<[prop: string, strength: number]>,
    wave: (u: number, time: number, channel: number) => number,
  ): Tween {
    const active = channels.filter(([, s]) => s !== 0);
    return new Tween({
      target,
      props: active.map(([p]) => p),
      kind: 'effect',
      effect: true,
      options: { ease: 'linear', ...options },
      setup: () => {
        const seed = Math.random() * 100;
        const natives = isElement(target) ? nativeMap(active.map(([p]) => p)) : undefined;
        return active.map(([prop, strength], i): Channel => {
          const base = Number(read(target, prop)) || 0;
          const channel = seed + i * 7.31;
          return {
            prop,
            exact: true,
            native: natives?.get(prop),
            at: (_k, _cycle, u, time) => (u >= 1 ? base : base + strength * wave(u, time, channel)),
            write: writer(target, prop),
          };
        });
      },
    });
  }
}

function axes(
  px: string,
  py: string,
  from: Vec2 | undefined,
  to: Vec2,
): Array<{ prop: string; from: Value | undefined; to: Value }> {
  const out: Array<{ prop: string; from: Value | undefined; to: Value }> = [];
  if (to.x !== undefined) out.push({ prop: px, from: from?.x, to: to.x });
  if (to.y !== undefined) out.push({ prop: py, from: from?.y, to: to.y });
  return out;
}

function shakeWave(options: ShakeOptions): (u: number, time: number, channel: number) => number {
  const frequency = options.frequency ?? 30;
  const falloff = options.falloff ?? true;
  return (u, time, channel) => (falloff ? (1 - u) ** 2 : 1) * noise(time * frequency, channel);
}

function punchWave(options: PunchOptions): (u: number) => number {
  const n = options.oscillations ?? 3;
  return (u) => Math.sin(u * Math.PI * n) * (1 - u);
}
