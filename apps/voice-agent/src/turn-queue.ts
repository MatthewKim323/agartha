/**
 * Coalescing turn queue.
 *
 * The predecessor had two independent rate limiters that both DROPPED input:
 * a 10s BRAIN_COOLDOWN_MS on the action path, and a `let responding = false`
 * single-flight on the voice path. Say "come here" and then "actually mine
 * that" within ten seconds and the second one was silently lost — no queue, no
 * error, nothing.
 *
 * This coalesces instead. Utterances arriving while the agent is busy are
 * merged into the next turn rather than discarded, and rapid-fire fragments of
 * one thought are joined into a single turn instead of firing several.
 *
 * The model is jabby's own turn-engine: wait a short quiet window, and if the
 * speaker is clearly mid-thought, wait a little longer, up to a hard cap.
 */

export interface TurnQueueOptions {
  /** Silence after an utterance before it's considered a complete turn. */
  quietMs?: number;
  /** Never hold a turn longer than this, however much someone rambles. */
  maxHoldMs?: number;
  /** Injectable timers, so tests don't sleep. */
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  now?: () => number;
}

/** Trailing conjunctions and fillers that signal the speaker isn't finished. */
const CONTINUING = /\b(and|but|so|then|because|cause|also|plus|or|um|uh|like|its|it's|the|a|to)\s*$/i;

export function looksContinuing(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (t.endsWith(",")) return true;
  if (/[.!?]$/.test(t)) return false;
  return CONTINUING.test(t);
}

export class TurnQueue {
  private pending: string[] = [];
  private timer: unknown = null;
  private firstQueuedAt = 0;
  private running = false;
  private readonly opts: Required<TurnQueueOptions>;

  constructor(
    /** Invoked with the coalesced text. Never called concurrently with itself. */
    private readonly onTurn: (text: string) => Promise<void>,
    options: TurnQueueOptions = {},
  ) {
    this.opts = {
      quietMs: options.quietMs ?? 700,
      maxHoldMs: options.maxHoldMs ?? 3000,
      setTimer: options.setTimer ?? ((fn, ms) => setTimeout(fn, ms)),
      clearTimer: options.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>)),
      now: options.now ?? Date.now,
    };
  }

  /** Number of utterances waiting. Nothing is ever dropped, so this only grows. */
  get depth(): number {
    return this.pending.length;
  }

  get busy(): boolean {
    return this.running;
  }

  /** Accept an utterance. Always queued, never rejected. */
  push(text: string): void {
    const t = text.trim();
    if (!t) return;

    if (this.pending.length === 0) this.firstQueuedAt = this.opts.now();
    this.pending.push(t);
    this.arm();
  }

  private arm(): void {
    if (this.timer !== null) this.opts.clearTimer(this.timer);

    const held = this.opts.now() - this.firstQueuedAt;
    const remaining = Math.max(0, this.opts.maxHoldMs - held);
    // Give a trailing-off speaker extra room, but never past the hard cap.
    const last = this.pending[this.pending.length - 1] ?? "";
    const wait = Math.min(looksContinuing(last) ? this.opts.quietMs * 2 : this.opts.quietMs, remaining);

    this.timer = this.opts.setTimer(() => {
      this.timer = null;
      void this.flush();
    }, wait);
  }

  /** Fire the coalesced turn now. Safe to call directly (barge-in, /say). */
  async flush(): Promise<void> {
    if (this.timer !== null) {
      this.opts.clearTimer(this.timer);
      this.timer = null;
    }
    // Already mid-turn: leave the queue alone. Whatever accumulated will go out
    // in the next turn, which is the whole point of not dropping.
    if (this.running) return;
    if (this.pending.length === 0) return;

    const text = this.pending.join(" ");
    this.pending = [];
    this.running = true;
    try {
      await this.onTurn(text);
    } catch {
      // A failed turn must not wedge the queue.
    } finally {
      this.running = false;
      // Anything that arrived while we were talking goes out next.
      if (this.pending.length > 0) this.arm();
    }
  }

  /** Drop pending input. For leaving a call, not for backpressure. */
  reset(): void {
    if (this.timer !== null) this.opts.clearTimer(this.timer);
    this.timer = null;
    this.pending = [];
  }
}
