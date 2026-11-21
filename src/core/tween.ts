import { gsap } from 'gsap';
import { resolveEase, type Ease, type EaseFunction } from './ease';
import { attach, getSettings, isReducedMotion, type MotionKind, type ReducedBehavior } from './settings';
import {
  isElement,
  isSvg,
  makeInterpolator,
  makeSetter,
  noise,
  readValue,
  type Setter,
  type TweenTarget,
  type Value,
} from './target';

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
  /** Defaults to `defaultEase` ('outQuad'). */
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
  /** Any properties GSAP can set: CSS properties, CSS variables (`'--glow'`), object fields. */
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

/** Anything that can contain tweens (a Sequence). */
export interface Parent {
  readonly isAlive: boolean;
  stop(): void;
  complete(): void;
  /** @internal */
  _parent: Parent | undefined;
}

interface Renderer {
  /**
   * `k` is the eased, direction-adjusted progress of this cycle, `cycle` its index from 0,
   * `u` the raw progress and `time` the seconds into the cycle.
   */
  render(k: number, cycle: number, u: number, time: number): void;
}

interface Definition {
  target: TweenTarget | undefined;
  /** Properties this tween owns while it runs (the replacement rule). */
  props: string[];
  kind: MotionKind;
  options: TweenOptions;
  /** Called once, when the tween starts: read start values, build the renderer. */
  setup: () => Renderer;
  /** Values to show right away, before the start delay (explicit `from` values). */
  initial?: () => void;
}

const owners = new WeakMap<object, Map<string, Tween>>();
const byTarget = new WeakMap<object, Set<Tween>>();
/** Every tween and sequence that is alive and not inside a sequence. */
export const roots = new Set<{ stop(): void; complete(): void }>();

function rootOf(p: Parent | undefined): Parent | undefined {
  let r = p;
  while (r?._parent) r = r._parent;
  return r;
}

function vec(v: number | Vec2): Vec2 {
  return typeof v === 'number' ? { x: v, y: v } : v;
}

/**
 * One animation. Create tweens with the static methods (`Tween.position`, `Tween.scale`, ...).
 * A tween can be awaited: `await Tween.alpha(el, { to: 0 })`.
 */
export class Tween implements PromiseLike<void> {
  /** Resolves when the tween finishes, completes or is stopped. Never rejects. */
  readonly finished: Promise<void>;
  /** @internal */
  readonly _gs: gsap.core.Tween;
  /** @internal */
  _parent: Parent | undefined;
  /** @internal True for tweens that play forever. */
  readonly _infinite: boolean;

  private _alive = true;
  private _renderer: Renderer | undefined;
  private _resolve!: () => void;
  private readonly _def: Definition;
  private readonly _skip: boolean;
  private readonly _ease: EaseFunction;
  private readonly _cycleDur: number;
  private readonly _cycles: number;
  private readonly _mode: CycleMode;

  private constructor(def: Definition) {
    this._def = def;
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

    this._skip = skip;
    this._cycleDur = duration;
    this._cycles = cycles;
    this._infinite = cycles === -1;
    this._mode = o.cycleMode ?? 'restart';
    this._ease = resolveEase(o.ease ?? settings.defaultEase);
    this.finished = new Promise<void>((resolve) => {
      this._resolve = resolve;
    });

    const startDelay = Math.max(0, o.startDelay ?? 0);
    const endDelay = Math.max(0, o.endDelay ?? 0);
    this._gs = gsap.to(
      {},
      {
        duration: this._infinite ? duration : duration * cycles + endDelay,
        repeat: this._infinite ? -1 : 0,
        delay: startDelay,
        ease: 'none',
        overwrite: false,
        // Zero-duration tweens would otherwise render inside gsap.to(), before this wrapper exists.
        immediateRender: false,
        onUpdate: () => {
          this._renderAt(this._gs.totalTime());
        },
        onComplete: () => {
          this._renderAt(this._gs.totalTime());
          this._finishedOnce();
        },
      },
    );
    attach(this._gs);

    if (def.target) {
      let set = byTarget.get(def.target);
      if (!set) byTarget.set(def.target, (set = new Set()));
      set.add(this);
    }
    roots.add(this);
    if (!skip) def.initial?.();
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
    const channels = Object.keys(options.to).map((prop) => ({
      prop,
      from: options.from?.[prop],
      to: options.to[prop] as Value,
    }));
    return Tween._props(target, 'move', options, channels);
  }

  /** Tweens a number and hands each value to `onValueChange`: for canvas, text, audio, anything. */
  static custom(options: CustomOptions): Tween {
    const { from, to, onValueChange } = options;
    const mode = options.cycleMode ?? 'restart';
    return new Tween({
      target: undefined,
      props: [],
      kind: 'value',
      options,
      setup: () => ({
        render(k, cycle) {
          onValueChange(from + (to - from) * k + (mode === 'incremental' ? cycle * (to - from) : 0));
        },
      }),
    });
  }

  /** Waits `seconds`, then calls `onComplete`. Awaitable like any tween. */
  static delay(seconds: number, onComplete?: () => void): Tween {
    return new Tween({
      target: undefined,
      props: [],
      kind: 'value',
      options: { duration: seconds, ease: 'linear', ...(onComplete ? { onComplete } : {}) },
      setup: () => ({ render() {} }),
    });
  }

  /** Shakes the position around where it is, then puts it back. */
  static shakePosition(target: TweenTarget, options: ShakeOptions): Tween {
    const s = vec(options.strength);
    return Tween._effect(target, options, [
      ['x', s.x ?? 0],
      ['y', s.y ?? 0],
    ], shakeWave(options));
  }

  /** Shakes the rotation (degrees) around where it is, then puts it back. */
  static shakeRotation(target: TweenTarget, options: ShakeOptions & { strength: number }): Tween {
    return Tween._effect(target, options, [['rotation', options.strength]], shakeWave(options));
  }

  /** Shakes the scale around where it is, then puts it back. */
  static shakeScale(target: TweenTarget, options: ShakeOptions): Tween {
    const s = vec(options.strength);
    return Tween._effect(target, options, [
      ['scaleX', s.x ?? 0],
      ['scaleY', s.y ?? 0],
    ], shakeWave(options));
  }

  /** A quick, springy push of the position that settles back where it was. */
  static punchPosition(target: TweenTarget, options: PunchOptions): Tween {
    const s = vec(options.strength);
    return Tween._effect(target, options, [
      ['x', s.x ?? 0],
      ['y', s.y ?? 0],
    ], punchWave(options));
  }

  /** A quick, springy twist (degrees) that settles back where it was. */
  static punchRotation(target: TweenTarget, options: PunchOptions & { strength: number }): Tween {
    return Tween._effect(target, options, [['rotation', options.strength]], punchWave(options));
  }

  /** A quick, springy swell of the scale that settles back where it was. */
  static punchScale(target: TweenTarget, options: PunchOptions): Tween {
    const s = vec(options.strength);
    return Tween._effect(target, options, [
      ['scaleX', s.x ?? 0],
      ['scaleY', s.y ?? 0],
    ], punchWave(options));
  }

  // ---------------------------------------------------------------- global control

  /** Stops every tween on `target` (or every tween and sequence, without a target). */
  static stopAll(target?: TweenTarget): number {
    const list = target ? [...(byTarget.get(target) ?? [])] : [...roots];
    for (const t of list) {
      if (t instanceof Tween) t._halt();
      else t.stop();
    }
    return list.length;
  }

  /** Completes every tween on `target` (or every tween and sequence, without a target). */
  static completeAll(target?: TweenTarget): number {
    const list = target ? [...(byTarget.get(target) ?? [])] : [...roots];
    for (const t of list) t.complete();
    return list.length;
  }

  /** True while any tween on `target` is alive (running or waiting to start). */
  static isTweening(target: TweenTarget): boolean {
    return (byTarget.get(target)?.size ?? 0) > 0;
  }

  // ---------------------------------------------------------------- instance API

  /** False once the tween has finished, completed or been stopped. */
  get isAlive(): boolean {
    return this._alive;
  }

  /** Playback speed of this tween; 2 is twice as fast. */
  get timeScale(): number {
    return this._gs.timeScale();
  }
  set timeScale(value: number) {
    this._gs.timeScale(value);
  }

  get isPaused(): boolean {
    return this._gs.paused();
  }
  set isPaused(value: boolean) {
    this._gs.paused(value);
  }

  /** Total seconds including delays and all cycles; `Infinity` for endless tweens. */
  get duration(): number {
    const o = this._def.options;
    if (this._infinite) return Infinity;
    return (o.startDelay ?? 0) + this._cycleDur * this._cycles + (o.endDelay ?? 0);
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

  // ---------------------------------------------------------------- internals

  /** @internal Moves this tween into a sequence. */
  _adopt(parent: Parent): void {
    if (this._parent) throw new Error('teemo-tween: this tween is already in a sequence');
    if (!this._alive) throw new Error('teemo-tween: cannot add a finished tween to a sequence');
    this._parent = parent;
    roots.delete(this);
  }

  /** @internal Jumps to the end without callbacks of its own parent (used by sequences). */
  _completeNow(): void {
    if (!this._alive) return;
    const elapsed = this._gs.totalTime();
    this._gs.kill();
    if (this._infinite) {
      let cycle = this._cycleDur > 0 ? Math.floor(elapsed / this._cycleDur) : 0;
      if ((this._mode === 'yoyo' || this._mode === 'rewind') && cycle % 2 === 0) cycle += 1;
      this._renderCycle(cycle, 1);
    } else {
      this._renderAt(Infinity);
    }
    this._def.options.onComplete?.();
    this._finish();
  }

  /** @internal Stops without onComplete; effects restore their base values. */
  _halt(): void {
    if (!this._alive) return;
    this._gs.kill();
    if (this._def.kind === 'effect' && this._renderer) this._renderCycle(this._cycles - 1, 1);
    this._finish();
  }

  /** @internal Called by the parent sequence when it ends. */
  _finish(): void {
    if (!this._alive) return;
    this._alive = false;
    const t = this._def.target;
    if (t) {
      byTarget.get(t)?.delete(this);
      const map = owners.get(t);
      if (map) for (const p of this._def.props) if (map.get(p) === this) map.delete(p);
    }
    roots.delete(this);
    this._resolve();
  }

  private _finishedOnce(): void {
    if (!this._alive) return;
    this._def.options.onComplete?.();
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
    this._renderer = this._def.setup();
    return this._renderer;
  }

  private _renderAt(elapsed: number): void {
    if (!this._claim()) return;
    const d = this._cycleDur;
    const e = Math.max(0, elapsed);
    if (d <= 0 || (!this._infinite && e >= d * this._cycles)) {
      this._renderCycle(this._infinite ? 0 : this._cycles - 1, 1);
      return;
    }
    const cycle = Math.floor(e / d);
    this._renderCycle(cycle, (e - cycle * d) / d);
  }

  private _renderCycle(cycle: number, u: number): void {
    const r = this._claim();
    if (!r) return;
    const ease = this._ease;
    const odd = cycle % 2 === 1;
    let k: number;
    if (this._mode === 'yoyo' && odd) k = 1 - ease(u);
    else if (this._mode === 'rewind' && odd) k = ease(1 - u);
    else k = u >= 1 ? ease(1) : ease(u);
    r.render(k, cycle, u, u * this._cycleDur);
  }

  private static _props(
    target: TweenTarget,
    kind: MotionKind,
    options: TweenOptions,
    channels: Array<{ prop: string; from: Value | undefined; to: Value }>,
  ): Tween {
    const setters = new Map<string, Setter>();
    const setter = (prop: string): Setter => {
      let s = setters.get(prop);
      if (!s) setters.set(prop, (s = makeSetter(target, prop)));
      return s;
    };
    const incremental = options.cycleMode === 'incremental';
    const withFrom = channels.filter((c) => c.from !== undefined);
    return new Tween({
      target,
      props: channels.map((c) => c.prop),
      kind,
      options,
      initial: withFrom.length
        ? () => {
            for (const c of withFrom) setter(c.prop)(c.from as Value);
          }
        : undefined,
      setup: () => {
        const parts = channels.map((c) => {
          let from = c.from ?? readValue(target, c.prop);
          if (typeof c.to === 'number' && typeof from === 'string') from = parseFloat(from) || 0;
          const step = typeof from === 'number' && typeof c.to === 'number' ? c.to - from : 0;
          return { set: setter(c.prop), lerp: makeInterpolator(from, c.to), step };
        });
        return {
          render(k, cycle) {
            for (const p of parts) {
              const v = p.lerp(k);
              p.set(incremental && typeof v === 'number' ? v + p.step * cycle : v);
            }
          },
        };
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
      options: { ease: 'linear', ...options },
      setup: () => {
        const seed = Math.random() * 100;
        const parts = active.map(([prop, strength], i) => {
          const base = Number(readValue(target, prop)) || 0;
          return { set: makeSetter(target, prop), base, strength, channel: seed + i * 7.31 };
        });
        return {
          render(_k, _cycle, u, time) {
            for (const p of parts) {
              p.set(u >= 1 ? p.base : p.base + p.strength * wave(u, time, p.channel));
            }
          },
        };
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
