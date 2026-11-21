import { gsap } from 'gsap';
import { attach } from './settings';
import { roots, Tween, type Parent } from './tween';

export interface SequenceOptions {
  /** How many times to play. -1 plays forever. Default 1. */
  cycles?: number;
  /** `restart` plays again from the start; `rewind` plays the sequence backwards. Default 'restart'. */
  cycleMode?: 'restart' | 'rewind';
  /** Runs when the sequence finishes on its own or through `complete()`. */
  onComplete?: () => void;
}

type Item = Tween | Sequence;

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
export class Sequence implements PromiseLike<void>, Parent {
  /** Resolves when the sequence finishes, completes or is stopped. Never rejects. */
  readonly finished: Promise<void>;
  /** @internal */
  readonly _gs: gsap.core.Timeline;
  /** @internal */
  _parent: Parent | undefined;
  /** @internal */
  _infinite: boolean;

  private _alive = true;
  private _resolve!: () => void;
  private _lastStart = 0;
  private _hasEndless = false;
  private readonly _items: Item[] = [];
  private readonly _options: SequenceOptions;

  private constructor(options: SequenceOptions) {
    this._options = options;
    const cycles = options.cycles ?? 1;
    if (!Number.isInteger(cycles) || (cycles < 1 && cycles !== -1)) {
      throw new Error('teemo-tween: cycles must be a whole number >= 1, or -1 for endless');
    }
    this._infinite = cycles === -1;
    this.finished = new Promise<void>((resolve) => {
      this._resolve = resolve;
    });
    this._gs = gsap.timeline({
      repeat: cycles === -1 ? -1 : cycles - 1,
      yoyo: options.cycleMode === 'rewind',
      onComplete: () => {
        if (!this._alive) return;
        this._options.onComplete?.();
        if (this._parent) this._resolve();
        else this._end();
      },
    });
    attach(this._gs);
    roots.add(this);
  }

  /** Starts an empty sequence; it plays as soon as you add items. */
  static create(options: SequenceOptions = {}): Sequence {
    return new Sequence(options);
  }

  /** Adds `item` after everything added so far. */
  chain(item: Item): this {
    return this._place(item, this._end_time());
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
    const at = this._end_time() + Math.max(0, seconds);
    this._gs.set({}, {}, at);
    this._lastStart = at;
    return this;
  }

  /** Calls `callback` after everything added so far. */
  chainCallback(callback: () => void): this {
    const at = this._end_time();
    this._gs.call(callback, undefined, at);
    this._lastStart = at;
    return this;
  }

  /** Calls `callback` at `time` seconds from the start of the sequence. */
  insertCallback(time: number, callback: () => void): this {
    this._gs.call(callback, undefined, time);
    return this;
  }

  get isAlive(): boolean {
    return this._alive;
  }

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

  /** Seconds of one cycle; `Infinity` if it contains an endless tween. */
  get duration(): number {
    return this._hasEndless ? Infinity : this._gs.duration();
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

  /** @internal */
  _adopt(parent: Parent): void {
    if (this._parent) throw new Error('teemo-tween: this sequence is already in a sequence');
    if (!this._alive) throw new Error('teemo-tween: cannot add a finished sequence to a sequence');
    if (this._infinite) throw new Error('teemo-tween: an endless sequence cannot be nested');
    this._parent = parent;
    roots.delete(this);
  }

  /** @internal */
  _halt(): void {
    if (!this._alive) return;
    this._gs.kill();
    for (const item of this._items) item._halt();
    this._end();
  }

  /** @internal */
  _completeNow(): void {
    if (!this._alive) return;
    if (this._hasEndless) {
      this._gs.kill();
      for (const item of this._items) item._completeNow();
      this._options.onComplete?.();
      this._end();
      return;
    }
    if (this._infinite) this._gs.repeat(0);
    this._gs.progress(1);
    // A timeline with nothing in it never fires onComplete.
    if (this._alive) {
      this._options.onComplete?.();
      this._end();
    }
  }

  /** @internal */
  _finish(): void {
    this._end();
  }

  private _end(): void {
    if (!this._alive) return;
    this._alive = false;
    for (const item of this._items) item._finish();
    roots.delete(this);
    this._resolve();
  }

  private _end_time(): number {
    if (this._hasEndless) {
      throw new Error('teemo-tween: nothing can be chained after an endless tween');
    }
    return this._gs.duration();
  }

  private _place(item: Item, at: number): this {
    if (!this._alive) throw new Error('teemo-tween: this sequence has already finished');
    item._adopt(this);
    this._items.push(item);
    this._gs.add(item._gs, Math.max(0, at));
    this._lastStart = Math.max(0, at);
    if (item._infinite) this._hasEndless = true;
    return this;
  }
}
