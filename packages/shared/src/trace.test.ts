import { describe, expect, test, beforeEach } from "bun:test";
import {
  formatStats,
  percentile,
  resetTraceHistory,
  setTraceSink,
  startTrace,
  traceHistory,
  traceStats,
} from "./trace.js";

beforeEach(() => {
  resetTraceHistory();
  setTraceSink(() => {}); // silence output during tests
});

describe("percentile", () => {
  test("uses nearest-rank, not interpolation", () => {
    // rank = ceil(0.5 * 4) = 2, so the 2nd smallest. Interpolation would give
    // 2.5, a latency that never actually happened.
    expect(percentile([1, 2, 3, 4], 50)).toBe(2);
  });

  test("p99 of a single sample is that sample", () => {
    expect(percentile([42], 99)).toBe(42);
  });

  test("p100 is the max, p1 is the min", () => {
    const s = [1, 5, 9];
    expect(percentile(s, 100)).toBe(9);
    expect(percentile(s, 1)).toBe(1);
  });

  test("empty input does not throw", () => {
    expect(percentile([], 50)).toBe(0);
  });
});

describe("trace", () => {
  test("records marks and a total", () => {
    const t = startTrace("utterance");
    t.mark("transcript");
    t.mark("dispatch");
    const rec = t.end();

    expect(rec.label).toBe("utterance");
    expect(Object.keys(rec.marks)).toEqual(["transcript", "dispatch"]);
    expect(rec.totalMs).toBeGreaterThanOrEqual(0);
    expect(rec.outcome).toBe("ok");
  });

  test("marks are cumulative from t0, so they never decrease", async () => {
    const t = startTrace("utterance");
    await Bun.sleep(5);
    t.mark("a");
    await Bun.sleep(5);
    t.mark("b");
    const rec = t.end();
    expect(rec.marks.b!).toBeGreaterThanOrEqual(rec.marks.a!);
  });

  test("end is idempotent so a double-end cannot double-count", () => {
    const t = startTrace("utterance");
    t.end();
    t.end();
    expect(traceHistory().length).toBe(1);
  });

  test("a mark after end is ignored rather than throwing mid-turn", () => {
    const t = startTrace("utterance");
    const rec = t.end();
    t.mark("late");
    expect(rec.marks.late).toBeUndefined();
    expect(traceHistory()[0]!.marks.late).toBeUndefined();
  });

  test("repeating a mark overwrites so loops do not leak entries", () => {
    const t = startTrace("utterance");
    t.mark("tick");
    t.mark("tick");
    t.mark("tick");
    const rec = t.end();
    expect(Object.keys(rec.marks)).toEqual(["tick"]);
  });

  test("outcome is carried through for failure filtering", () => {
    const t = startTrace("utterance");
    expect(t.end("timeout").outcome).toBe("timeout");
  });

  test("the sink sees every completed trace exactly once", () => {
    const seen: string[] = [];
    setTraceSink((r) => seen.push(r.id));
    const a = startTrace("x");
    const b = startTrace("x");
    a.end();
    b.end();
    b.end();
    expect(seen).toEqual([a.id, b.id]);
  });
});

describe("traceStats", () => {
  test("aggregates per stage and includes a synthetic total", () => {
    for (let i = 0; i < 3; i++) {
      const t = startTrace("utterance");
      t.mark("transcript");
      t.end();
    }
    const stats = traceStats("utterance");
    const stages = stats.map((s) => s.stage).sort();
    expect(stages).toEqual(["total", "transcript"]);
    expect(stats.find((s) => s.stage === "transcript")!.count).toBe(3);
  });

  test("filters by label so one loop's numbers do not pollute another's", () => {
    startTrace("voice").end();
    startTrace("voice").end();
    startTrace("reflex").end();
    expect(traceStats("voice").find((s) => s.stage === "total")!.count).toBe(2);
    expect(traceStats("reflex").find((s) => s.stage === "total")!.count).toBe(1);
  });

  test("no traces yields no stats rather than throwing", () => {
    expect(traceStats("nothing")).toEqual([]);
    expect(formatStats([])).toBe("(no traces recorded)");
  });

  test("formatStats emits a markdown table with a header", () => {
    startTrace("utterance").end();
    const md = formatStats(traceStats("utterance"));
    expect(md.split("\n")[0]).toContain("| stage | n | p50 |");
    expect(md).toContain("| total |");
  });
});
