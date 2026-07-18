/**
 * Latency tracing.
 *
 * This exists because neither predecessor project could state its own latency.
 * One had aspirational targets in its docs and no instrumentation at all; the
 * other had Prometheus histograms wired up and never recorded a single result.
 * That is how a commit message came to claim "14s -> ~5s" for a path the logs
 * showed running at 7-13s.
 *
 * So: one trace per utterance, threaded through every stage from mic to motion,
 * and every performance claim in this repo cites a number this module produced.
 *
 * Usage:
 *   const t = startTrace("utterance");
 *   t.mark("transcript");        // ms since trace start
 *   t.mark("tool_dispatch");
 *   t.end("ok");                 // emits one structured line, records for stats
 *
 * Stage timings are cumulative from t0, not deltas. Deltas are derivable and
 * cumulative is what you actually want when comparing two runs.
 */

export interface TraceRecord {
  id: string;
  label: string;
  /** Wall-clock start, ms since epoch. */
  startedAt: number;
  /** Stage name -> ms since trace start. Insertion-ordered. */
  marks: Record<string, number>;
  /** Total duration in ms. */
  totalMs: number;
  outcome: string;
}

export interface Trace {
  readonly id: string;
  /** Record a stage boundary. Repeating a name overwrites, so loops don't leak. */
  mark(stage: string): void;
  /** Ms since this trace started, without recording a mark. */
  elapsed(): number;
  /** Close the trace, emit it, and return the record. Idempotent. */
  end(outcome?: string): TraceRecord;
}

type Sink = (rec: TraceRecord) => void;

/** Short, readable, unique enough for correlating one run's log lines. */
function traceId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ── the completed-trace ring buffer, for percentile reporting ──

const HISTORY_LIMIT = 1000;
const history: TraceRecord[] = [];

let sink: Sink = (rec) => {
  // One line, greppable by id, parseable as JSON. Deliberately not the pretty
  // logger: these lines get piped into the stats script.
  // eslint-disable-next-line no-console
  console.log(`[trace] ${JSON.stringify(rec)}`);
};

/** Redirect trace output (tests, or a file/metrics sink later). */
export function setTraceSink(fn: Sink): void {
  sink = fn;
}

export function startTrace(label: string): Trace {
  const id = traceId();
  const startedAt = Date.now();
  const t0 = performance.now();
  const marks: Record<string, number> = {};
  let ended = false;

  return {
    id,
    mark(stage: string): void {
      if (ended) return; // a late mark is a bug, not a reason to throw mid-turn
      marks[stage] = Math.round(performance.now() - t0);
    },
    elapsed(): number {
      return Math.round(performance.now() - t0);
    },
    end(outcome = "ok"): TraceRecord {
      const rec: TraceRecord = {
        id,
        label,
        startedAt,
        marks: { ...marks },
        totalMs: Math.round(performance.now() - t0),
        outcome,
      };
      if (ended) return rec; // idempotent: double-end shouldn't double-count
      ended = true;
      history.push(rec);
      while (history.length > HISTORY_LIMIT) history.shift();
      sink(rec);
      return rec;
    },
  };
}

// ── stats ──

/**
 * Nearest-rank percentile. For p50 of [1,2,3,4] this gives 3, not 2.5.
 * Interpolation would invent a latency that never happened; for tail latency
 * the honest answer is an observation that actually occurred.
 */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1]!;
}

export interface StageStats {
  stage: string;
  count: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
}

/** Percentiles per stage across recorded traces, optionally filtered by label. */
export function traceStats(label?: string): StageStats[] {
  const relevant = label ? history.filter((r) => r.label === label) : history;
  const byStage = new Map<string, number[]>();

  for (const rec of relevant) {
    for (const [stage, ms] of Object.entries(rec.marks)) {
      const arr = byStage.get(stage) ?? [];
      arr.push(ms);
      byStage.set(stage, arr);
    }
    const totals = byStage.get("total") ?? [];
    totals.push(rec.totalMs);
    byStage.set("total", totals);
  }

  return [...byStage.entries()].map(([stage, values]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return {
      stage,
      count: sorted.length,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      min: sorted[0]!,
      max: sorted[sorted.length - 1]!,
    };
  });
}

export function resetTraceHistory(): void {
  history.length = 0;
}

export function traceHistory(): readonly TraceRecord[] {
  return history;
}

/** Markdown table, for pasting measured numbers into docs. */
export function formatStats(stats: StageStats[]): string {
  if (stats.length === 0) return "(no traces recorded)";
  const rows = stats.map(
    (s) => `| ${s.stage} | ${s.count} | ${s.p50} | ${s.p95} | ${s.p99} | ${s.min} | ${s.max} |`,
  );
  return [
    "| stage | n | p50 | p95 | p99 | min | max |",
    "|---|---|---|---|---|---|---|",
    ...rows,
  ].join("\n");
}
