import { describe, expect, test } from "bun:test";
import { TurnQueue, looksContinuing } from "./turn-queue.js";

/** Manual clock + timer so coalescing windows are tested without sleeping. */
function harness() {
  let now = 0;
  const timers: Array<{ id: number; at: number; fn: () => void }> = [];
  let nextId = 1;

  const opts = {
    quietMs: 100,
    maxHoldMs: 500,
    now: () => now,
    setTimer: (fn: () => void, ms: number) => {
      const id = nextId++;
      timers.push({ id, at: now + ms, fn });
      return id;
    },
    clearTimer: (h: unknown) => {
      const i = timers.findIndex((t) => t.id === h);
      if (i >= 0) timers.splice(i, 1);
    },
  };

  /** Advance the clock, firing any timers that come due. */
  async function advance(ms: number) {
    now += ms;
    const due = timers.filter((t) => t.at <= now);
    for (const t of due) {
      const i = timers.indexOf(t);
      if (i >= 0) timers.splice(i, 1);
      t.fn();
    }
    await Promise.resolve();
    await Promise.resolve();
  }

  return { opts, advance, setNow: (v: number) => (now = v) };
}

describe("looksContinuing", () => {
  test("trailing conjunction means keep waiting", () => {
    expect(looksContinuing("go get wood and")).toBe(true);
    expect(looksContinuing("mine that because")).toBe(true);
  });

  test("terminal punctuation means done", () => {
    expect(looksContinuing("go get wood.")).toBe(false);
    expect(looksContinuing("what are you doing?")).toBe(false);
  });

  test("a trailing comma means keep waiting", () => {
    expect(looksContinuing("first that,")).toBe(true);
  });

  test("a plain complete phrase is done", () => {
    expect(looksContinuing("come here")).toBe(false);
  });

  test("empty is not continuing", () => {
    expect(looksContinuing("   ")).toBe(false);
  });
});

describe("TurnQueue", () => {
  test("fires one turn after the quiet window", async () => {
    const h = harness();
    const turns: string[] = [];
    const q = new TurnQueue(async (t) => void turns.push(t), h.opts);

    q.push("come here");
    await h.advance(50);
    expect(turns).toEqual([]);
    await h.advance(60);
    expect(turns).toEqual(["come here"]);
  });

  test("coalesces fragments of one thought into a single turn", async () => {
    const h = harness();
    const turns: string[] = [];
    const q = new TurnQueue(async (t) => void turns.push(t), h.opts);

    q.push("go get wood");
    await h.advance(50);
    q.push("and then come back");
    await h.advance(110);

    expect(turns).toEqual(["go get wood and then come back"]);
  });

  test("THE REGRESSION: a second command during a turn is queued, not dropped", async () => {
    // This is the exact case the predecessor lost: two commands inside its
    // 10s cooldown, the second silently discarded.
    const h = harness();
    const turns: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));

    const q = new TurnQueue(async (t) => {
      turns.push(t);
      if (turns.length === 1) await gate; // hold the first turn open
    }, h.opts);

    q.push("come here");
    await h.advance(110);
    expect(turns).toEqual(["come here"]);
    expect(q.busy).toBe(true);

    q.push("actually mine that"); // arrives mid-turn
    await h.advance(200);
    expect(turns).toHaveLength(1); // still busy, correctly not run concurrently

    release();
    await Promise.resolve();
    await Promise.resolve();
    await h.advance(200);

    expect(turns).toEqual(["come here", "actually mine that"]); // NOT dropped
  });

  test("never runs two turns concurrently", async () => {
    const h = harness();
    let active = 0;
    let maxActive = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));

    const q = new TurnQueue(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await gate;
      active--;
    }, h.opts);

    q.push("one");
    await h.advance(110);
    q.push("two");
    await h.advance(110);
    release();
    await h.advance(200);

    expect(maxActive).toBe(1);
  });

  test("the hard cap fires even while someone keeps trailing off", async () => {
    const h = harness();
    const turns: string[] = [];
    const q = new TurnQueue(async (t) => void turns.push(t), h.opts);

    // Each push looks continuing, which without a cap would extend forever.
    // 10 pushes x 60ms = 600ms of talking against a 500ms cap, so the cap must
    // cut in mid-stream rather than waiting for silence.
    for (let i = 0; i < 10; i++) {
      q.push(`part ${i} and`);
      await h.advance(60);
    }
    await h.advance(300);

    expect(turns.length).toBeGreaterThanOrEqual(1);

    // The invariant that actually matters: continuous speech gets chunked, but
    // no fragment is ever dropped on the floor.
    const all = turns.join(" ");
    for (let i = 0; i < 10; i++) expect(all).toContain(`part ${i}`);
  });

  test("a throwing turn does not wedge the queue", async () => {
    const h = harness();
    const turns: string[] = [];
    const q = new TurnQueue(async (t) => {
      turns.push(t);
      if (turns.length === 1) throw new Error("brain exploded");
    }, h.opts);

    q.push("first");
    await h.advance(110);
    expect(q.busy).toBe(false);

    q.push("second");
    await h.advance(110);
    expect(turns).toEqual(["first", "second"]);
  });

  test("ignores empty and whitespace-only input", async () => {
    const h = harness();
    const turns: string[] = [];
    const q = new TurnQueue(async (t) => void turns.push(t), h.opts);
    q.push("   ");
    q.push("");
    await h.advance(200);
    expect(turns).toEqual([]);
    expect(q.depth).toBe(0);
  });

  test("reset drops pending input for leaving a call", async () => {
    const h = harness();
    const turns: string[] = [];
    const q = new TurnQueue(async (t) => void turns.push(t), h.opts);
    q.push("never mind");
    q.reset();
    await h.advance(300);
    expect(turns).toEqual([]);
  });
});
