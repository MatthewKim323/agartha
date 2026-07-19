import { createAdminClient } from "@insforge/sdk";

/**
 * Episodic memory: what the agent has DONE.
 *
 * The counterpart to gbrain, which is what the agent KNOWS. Two stores because
 * they answer different questions and have different privacy properties:
 *
 *   gbrain    semantic, personal, private   "who is katie"
 *   episodic  behavioural, shared, hostable "how often does chop_tree fail"
 *
 * PRIVACY BOUNDARY, enforced here and in the schema: nothing retrieved from
 * gbrain is ever written into this store. We record what the agent did — tools,
 * timings, outcomes — never matt's personal corpus.
 *
 * WRITES ARE FIRE-AND-FORGET. Telemetry must never be able to slow down or
 * break a turn. Every write is buffered and flushed on an interval; a failure
 * drops the batch and logs, it does not propagate.
 */

export interface EpisodicConfig {
  url: string;
  apiKey: string;
  /** How often to flush buffered rows. */
  flushMs?: number;
  /** Drop the oldest rows past this, so an outage can't grow memory unbounded. */
  maxBuffer?: number;
}

export interface UtteranceRow {
  heard?: string;
  said?: string;
  latency_ms?: number;
  trace_id?: string;
}

export interface ToolCallRow {
  tool: string;
  args?: unknown;
  result?: string;
  ok?: boolean;
  duration_ms?: number;
  trace_id?: string;
}

export interface TraceRow {
  trace_id: string;
  label: string;
  marks: Record<string, number>;
  total_ms?: number;
  outcome?: string;
}

type Client = ReturnType<typeof createAdminClient>;

/**
 * Minimal shape of the SDK's query builder. Declared rather than imported
 * because the SDK types it against generated schema types we don't produce.
 */
interface QueryBuilder extends PromiseLike<{ data: unknown; error: unknown }> {
  eq(column: string, value: unknown): QueryBuilder;
  order(column: string, opts?: { ascending?: boolean }): QueryBuilder;
  limit(n: number): QueryBuilder;
}

export class EpisodicMemory {
  private readonly client: Client | null;
  private sessionId: string | null = null;
  private readonly buffers = {
    utterances: [] as Record<string, unknown>[],
    tool_calls: [] as Record<string, unknown>[],
    traces: [] as Record<string, unknown>[],
  };
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly cfg: Required<EpisodicConfig>;
  private dropped = 0;

  constructor(cfg: EpisodicConfig) {
    this.cfg = {
      url: cfg.url,
      apiKey: cfg.apiKey,
      flushMs: cfg.flushMs ?? 5000,
      maxBuffer: cfg.maxBuffer ?? 500,
    };
    this.client =
      cfg.url && cfg.apiKey ? createAdminClient({ baseUrl: cfg.url, apiKey: cfg.apiKey }) : null;
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  get currentSession(): string | null {
    return this.sessionId;
  }

  /** Open a session. Returns null (rather than throwing) if the store is down. */
  async startSession(opts: { world?: string; player?: string } = {}): Promise<string | null> {
    if (!this.client) return null;
    try {
      const { data, error } = await this.client
        .database.from("sessions")
        .insert([{ world: opts.world ?? null, player: opts.player ?? null }])
        .select();
      if (error || !data?.[0]) return null;
      this.sessionId = (data[0] as { id: string }).id;
      this.timer = setInterval(() => void this.flush(), this.cfg.flushMs);
      return this.sessionId;
    } catch {
      return null;
    }
  }

  recordUtterance(row: UtteranceRow): void {
    this.push("utterances", row as Record<string, unknown>);
  }

  recordToolCall(row: ToolCallRow): void {
    this.push("tool_calls", {
      ...row,
      ok: row.ok ?? true,
      // jsonb column: keep args structured, but never let a huge payload in.
      args: row.args ? JSON.parse(JSON.stringify(row.args).slice(0, 4000)) : null,
      result: row.result?.slice(0, 2000) ?? null,
    });
  }

  recordTrace(row: TraceRow): void {
    this.push("traces", row as unknown as Record<string, unknown>);
  }

  private push(table: keyof typeof this.buffers, row: Record<string, unknown>): void {
    if (!this.client || !this.sessionId) return;
    const buf = this.buffers[table];
    buf.push({ ...row, session_id: this.sessionId });
    // Bound the buffer. Losing old telemetry beats growing without limit while
    // the backend is unreachable.
    while (buf.length > this.cfg.maxBuffer) {
      buf.shift();
      this.dropped++;
    }
  }

  /** Write everything buffered. Never throws. */
  async flush(): Promise<void> {
    if (!this.client) return;
    for (const table of Object.keys(this.buffers) as Array<keyof typeof this.buffers>) {
      const rows = this.buffers[table];
      if (rows.length === 0) continue;
      const batch = rows.splice(0, rows.length);
      try {
        const { error } = await this.client.database.from(table).insert(batch);
        // On failure the batch is gone. Telemetry is not worth a retry storm in
        // front of a live conversation.
        if (error) this.dropped += batch.length;
      } catch {
        this.dropped += batch.length;
      }
    }
  }

  /** Close the session, write the summary, flush. */
  async endSession(summary?: string, counts?: { tools: number; utterances: number }): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.flush();
    if (!this.client || !this.sessionId) return;
    try {
      await this.client
        .database.from("sessions")
        .update({
          ended_at: new Date().toISOString(),
          summary: summary ?? null,
          tool_calls: counts?.tools ?? 0,
          utterances: counts?.utterances ?? 0,
        })
        .eq("id", this.sessionId);
    } catch {
      /* best effort */
    }
    this.sessionId = null;
  }

  get droppedRows(): number {
    return this.dropped;
  }

  // ── self-query: the substrate for the history() tool ──────────────────────

  /** Recent sessions, most recent first. */
  async recentSessions(limit = 5): Promise<Array<Record<string, unknown>>> {
    return this.select("sessions", (q) => q.order("started_at", { ascending: false }).limit(limit));
  }

  /**
   * Per-tool success rate. This is the agent knowing whether it is actually
   * good at something, rather than assuming it is.
   */
  async toolReliability(): Promise<Array<Record<string, unknown>>> {
    return this.select("tool_reliability", (q) => q.order("calls", { ascending: false }).limit(20));
  }

  /** Latency trend by day — "am I getting slower". */
  async latencyByDay(days = 7): Promise<Array<Record<string, unknown>>> {
    return this.select("latency_by_day", (q) => q.order("day", { ascending: false }).limit(days));
  }

  /** What was actually said in a session. */
  async sessionUtterances(sessionId: string, limit = 50): Promise<Array<Record<string, unknown>>> {
    return this.select("utterances", (q) =>
      q.eq("session_id", sessionId).order("at", { ascending: true }).limit(limit),
    );
  }

  /** Recent failures, for "what do I usually get wrong". */
  async recentFailures(limit = 10): Promise<Array<Record<string, unknown>>> {
    return this.select("tool_calls", (q) =>
      q.eq("ok", false).order("at", { ascending: false }).limit(limit),
    );
  }

  /**
   * The SDK's query builder is generically typed against a schema we don't
   * generate types for, so it's taken loosely here and the rows are treated as
   * opaque records. Everything downstream only reads named columns.
   */
  private async select(
    table: string,
    build: (q: QueryBuilder) => QueryBuilder,
  ): Promise<Array<Record<string, unknown>>> {
    if (!this.client) return [];
    try {
      const base = this.client.database.from(table).select() as unknown as QueryBuilder;
      const { data, error } = await build(base);
      if (error || !Array.isArray(data)) return [];
      return data as Array<Record<string, unknown>>;
    } catch {
      return [];
    }
  }

  async close(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.flush();
  }
}
