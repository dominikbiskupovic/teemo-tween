import { addRoot, globalVelocity, now, removeRoot } from './clock';

/**
 * Timing shared by tweens and sequences. A root runs on the clock; a child inside a sequence runs
 * on its parent's local time. `T` is seconds since the start, including any start delay.
 */
export abstract class Playable {
  /** @internal */
  _parent: Playable | undefined;
  /** @internal Local time of the parent at the last render (sequences only). */
  _lastL = 0;
  /** @internal */
  _alive = true;
  /** @internal */
  _ts = 1;
  /** @internal */
  _paused = false;
  /** @internal */
  _pausedT = 0;
  // A root: T = refT + (clock - refNow) * speed. A child: T = refT + (parentLocal - refL) * ts.
  /** @internal */
  _refT = 0;
  /** @internal */
  _refNow: number;
  /** @internal */
  _refL = 0;

  constructor() {
    this._refNow = now();
    addRoot(this);
  }

  /** @internal Seconds from start to finish, Infinity if endless. */
  abstract get _total(): number;
  /** @internal True if it never ends on its own. */
  abstract get _infinite(): boolean;
  /** @internal Renders at time `T`, moving at `v` (T-seconds per clock second, negative when rewinding). */
  abstract _render(T: number, v: number): void;
  /** @internal Stops without callbacks. */
  abstract _halt(): void;
  /** @internal Jumps to the end without involving the parent. */
  abstract _completeNow(): void;
  /** @internal Ends its life (the parent finished). */
  abstract _finish(): void;
  abstract stop(): void;
  abstract complete(): void;

  /** False once it has finished, completed or been stopped. */
  get isAlive(): boolean {
    return this._alive;
  }

  /** Playback speed; 2 is twice as fast. */
  get timeScale(): number {
    return this._ts;
  }
  set timeScale(value: number) {
    if (!Number.isFinite(value) || value < 0) throw new Error('teemo-tween: timeScale must be 0 or more');
    if (this._parent) {
      this._refT = this._childT(this._parent._lastL);
      this._refL = this._parent._lastL;
      this._ts = value;
    } else {
      const t = now();
      this._fold(t);
      this._ts = value;
      this._tick(t);
    }
  }

  get isPaused(): boolean {
    return this._paused;
  }
  set isPaused(value: boolean) {
    if (value === this._paused) return;
    if (this._parent) {
      const L = this._parent._lastL;
      if (value) this._pausedT = this._childT(L);
      else {
        this._refT = this._pausedT;
        this._refL = L;
      }
      this._paused = value;
      return;
    }
    const t = now();
    if (value) this._pausedT = this._rootT(t);
    else {
      this._refT = this._pausedT;
      this._refNow = t;
    }
    this._paused = value;
    this._tick(t);
  }

  /** @internal Time when the parent is at local time `L`. */
  _childT(L: number): number {
    return this._paused ? this._pausedT : this._refT + (L - this._refL) * this._ts;
  }

  /** @internal Where this child ends in its parent's local time. */
  _endInParent(): number {
    const total = this._total;
    if (total === Infinity) return Infinity;
    if (this._ts <= 0) return this._refL;
    return this._refL + (total - this._refT) / this._ts;
  }

  /** @internal Time at clock time `t` (ms), for a root. */
  _rootT(t: number): number {
    if (this._paused) return this._pausedT;
    return this._refT + ((t - this._refNow) / 1000) * this._ts * globalVelocity();
  }

  /** @internal */
  _fold(t: number): void {
    if (this._parent || this._paused) return;
    this._refT = this._rootT(t);
    this._refNow = t;
  }

  /** @internal */
  _tick(t: number): void {
    if (this._parent || !this._alive) return;
    this._render(this._rootT(t), this._paused ? 0 : this._ts * globalVelocity());
  }

  /** @internal Moves this animation into a sequence, starting at `at` in its local time. */
  _adoptAt(parent: Playable, at: number): void {
    removeRoot(this);
    this._parent = parent;
    this._refT = 0;
    this._refL = at;
  }

  /** @internal Leaves the clock (finished or stopped). */
  _detach(): void {
    removeRoot(this);
  }
}
