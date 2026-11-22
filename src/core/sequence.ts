import { Playable } from './playable';
import { safeCall, Tween } from './tween';

export interface SequenceOptions {
  /** How many times to play. -1 plays forever. Default 1. */
  cycles?: number;
  /** `restart` plays again from the start; `rewind` plays the sequence backwards. Default 'restart'. */
  cycleMode?: 'restart' | 'rewind';
  /** Runs when the sequence finishes on its own or through `complete()`. */
  onComplete?: () => void;
}

type Item = Tween | Sequence;

interface Call {
  at: number;
  fn: () => void;
}

/**
 * Tweens, delays and callbacks on one timeline.
 *
 * ```ts
 * Sequence.create()
 *   .chain(Tween.scale(el, { to: 1.2 }))   // after everything so far
 *   .group(Tween.alpha(el, { to: 1 }))     // together with the previous item
 *   .chainDelay(0.1)
 *   .chainCallback(() => sound.play())
 *   .insert(0.2, Tween.shakePosition(el, { strength: 6 }))  // at an exact time
 * ```
 */
export class Sequence extends Playable implements PromiseLike<void> {
  /** Resolves when the sequence finishes, completes or is stopped. Never rejects. */
  readonly finished: Promise<void>;

  private _resolve!: () => void;
  private readonly _options: SequenceOptions;
  private readonly _cycles: number;
  private readonly _rewind: boolean;
  private readonly _items: Item[] = [];
  private readonly _calls: Call[] = [];
  private _marks = 0;
  private _lastStart = 0;
  private _hasEndless = false;
  private _lastT = -Infinity;
  private _prevL = -Infinity;
  private _lastCycle = 0;

  private constructor(options: SequenceOptions) {
    const cycles = options.cycles ?? 1;
    if (!Number.isInteger(cycles) || (cycles < 1 && cycles !== -1)) {
      throw new Error('teemo-tween: cycles must be a whole number >= 1, or -1 for endless');
    }
    super();
    this._options = options;
    this._cycles = cycles;
    this._rewind = options.cycleMode === 'rewind';
    this.finished = new Promise<void>((resolve) => {
      this._resolve = resolve;
    });
  }

  /** Starts an empty sequence; it plays as soon as you add items. */
  static create(options: SequenceOptions = {}): Sequence {
    return new Sequence(options);
  }

  /** Adds `item` after everything added so far. */
  chain(item: Item): this {
    return this._place(item, this._endTime());
  }

  /** Adds `item` at the same start time as the previously added item. */
  group(item: Item): this {
    return this._place(item, this._lastStart);
  }

  /** Adds `item` at `time` seconds from the start of the sequence. */
  insert(time: number, item: Item): this {
    return this._place(item, time);
  }

  /** Adds a pause after everything added so far. */
  chainDelay(seconds: number): this {
    const at = this._endTime() + Math.max(0, seconds);
    this._marks = Math.max(this._marks, at);
    this._lastStart = at;
    return this;
  }

  /** Calls `callback` after everything added so far. */
  chainCallback(callback: () => void): this {
    const at = this._endTime();
    this._addCall(at, callback);
    this._lastStart = at;
    return this;
  }

  /** Calls `callback` at `time` seconds from the start of the sequence. */
  insertCallback(time: number, callback: () => void): this {
    this._addCall(Math.max(0, time), callback);
    return this;
  }

  /** Seconds of one cycle; `Infinity` if it contains an endless tween. */
  get duration(): number {
    return this._hasEndless ? Infinity : this._cycleDur();
  }

  /** Stops where it is, without `onComplete`. Inside another sequence it stops the outer one. */
  stop(): void {
    if (!this._alive) return;
    if (this._parent) {
      this._parent.stop();
      return;
    }
    this._halt();
  }

  /** Jumps to the end (running every callback on the way) and runs `onComplete`. */
  complete(): void {
    if (!this._alive) return;
    if (this._parent) {
      this._parent.complete();
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

  /** @internal */
  get _total(): number {
    if (this._cycles === -1 || this._hasEndless) return Infinity;
    return this._cycleDur() * this._cycles;
  }

  /** @internal */
  get _infinite(): boolean {
    return this._cycles === -1 || this._hasEndless;
  }

  /** @internal Checks this sequence may join another one. */
  _checkAdopt(): void {
    if (this._parent) throw new Error('teemo-tween: this sequence is already in a sequence');
    if (!this._alive) throw new Error('teemo-tween: cannot add a finished sequence to a sequence');
    if (this._cycles === -1) throw new Error('teemo-tween: an endless sequence cannot be nested');
  }

  /** @internal */
  _render(T: number, v: number): void {
    if (!this._alive) return;
    // An empty sequence waits for items instead of finishing on its first frame.
    if (!this._items.length && !this._calls.length && this._marks === 0) return;
    const D = this._hasEndless ? Infinity : this._cycleDur();
    let cycle = 0;
    let L = T;
    if (D !== Infinity && T >= 0) {
      if (D <= 0) L = 0;
      else if (this._cycles !== -1 && T >= D * this._cycles - 1e-9) {
        cycle = this._cycles - 1;
        L = D;
      } else {
        cycle = Math.floor(T / D);
        L = T - cycle * D;
      }
    }
    const back = this._rewind && cycle % 2 === 1;
    if (back) L = D - L;
    this._apply(cycle, L, back ? -v : v);
    const total = this._total;
    const crossed = this._lastT < total - 1e-9 && T >= total - 1e-9;
    this._lastT = T;
    if (crossed) this._finishedOnce();
  }

  /** @internal */
  _halt(): void {
    if (!this._alive) return;
    for (const item of this._items) item._halt();
    this._end();
  }

  /** @internal */
  _completeNow(): void {
    if (!this._alive) return;
    if (this._hasEndless || (!this._items.length && !this._calls.length)) {
      for (const item of this._items) item._completeNow();
    } else if (this._cycles === -1) {
      // An endless sequence completes at the end of its current pass.
      this._apply(this._lastCycle + (this._rewind && this._lastCycle % 2 === 1 ? 1 : 0), this._cycleDur(), 0);
    } else {
      const ranOnComplete = this._lastT < this._total;
      this._render(this._total, 0); // runs the remaining tweens, callbacks and onComplete
      this._end();
      if (ranOnComplete) return;
    }
    safeCall(this._options.onComplete);
    this._end();
  }

  /** @internal */
  _finish(): void {
    this._end();
  }

  /** Renders children and fires callbacks for local time `L` in `cycle`, moving at `vL`. */
  private _apply(cycle: number, L: number, vL: number): void {
    this._fireCalls(cycle, L);
    const forward = cycle > this._lastCycle || (cycle === this._lastCycle && L >= this._prevL);
    this._lastL = L;
    // Forward, later items render last (they win); backward, earlier items do.
    const items = forward ? this._items : [...this._items].reverse();
    for (const item of items) {
      if (item._alive) item._render(item._childT(L), item._paused ? 0 : vL * item._ts);
    }
    this._prevL = L;
    this._lastCycle = cycle;
  }

  private _fireCalls(cycle: number, L: number): void {
    if (!this._calls.length) return;
    const D = this._cycleDur();
    const start = (c: number) => (this._rewind && c % 2 === 1 ? D : 0);
    const end = (c: number) => (this._rewind && c % 2 === 1 ? 0 : D);
    // [from, to, includeFrom]: each stretch of local time the playhead crossed since last frame.
    const spans: Array<[number, number, boolean]> = [];
    const pc = this._lastCycle;
    if (cycle === pc) spans.push([this._prevL, L, false]);
    else if (cycle > pc) {
      spans.push([this._prevL, end(pc), false]);
      for (let c = pc + 1; c < cycle && c < pc + 3; c++) spans.push([start(c), end(c), true]);
      spans.push([start(cycle), L, true]);
    } else {
      spans.push([this._prevL, start(pc), false]);
      spans.push([end(cycle), L, true]);
    }
    for (const [a, b, inclusive] of spans) {
      if (b > a) {
        for (const call of this._calls) {
          if ((inclusive ? call.at >= a : call.at > a) && call.at <= b) safeCall(call.fn);
        }
      } else if (b < a) {
        for (let i = this._calls.length - 1; i >= 0; i--) {
          const call = this._calls[i]!;
          if ((inclusive ? call.at <= a : call.at < a) && call.at >= b) safeCall(call.fn);
        }
      }
    }
  }

  private _finishedOnce(): void {
    if (!this._alive) return;
    safeCall(this._options.onComplete);
    if (this._parent) this._resolve();
    else this._end();
  }

  private _end(): void {
    if (!this._alive) return;
    this._alive = false;
    for (const item of this._items) item._finish();
    this._detach();
    this._resolve();
  }

  private _cycleDur(): number {
    let d = this._marks;
    for (const item of this._items) d = Math.max(d, item._endInParent());
    for (const call of this._calls) d = Math.max(d, call.at);
    return d;
  }

  private _endTime(): number {
    if (this._hasEndless) throw new Error('teemo-tween: nothing can be chained after an endless tween');
    return this._cycleDur();
  }

  private _addCall(at: number, fn: () => void): void {
    if (!this._alive) throw new Error('teemo-tween: this sequence has already finished');
    this._calls.push({ at, fn });
    this._calls.sort((x, y) => x.at - y.at);
  }

  private _place(item: Item, at: number): this {
    if (!this._alive) throw new Error('teemo-tween: this sequence has already finished');
    item._checkAdopt();
    const start = Math.max(0, at);
    item._adoptAt(this, start);
    // Keep items in start order: rendering order decides who wins a shared property.
    const i = this._items.findIndex((x) => x._refL > start);
    if (i === -1) this._items.push(item);
    else this._items.splice(i, 0, item);
    this._lastStart = start;
    if (item._infinite) this._hasEndless = true;
    return this;
  }
}
