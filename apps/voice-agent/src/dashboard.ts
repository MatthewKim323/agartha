import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { logger } from "./log.js";

const log = logger("dash");

/**
 * Live coordination view.
 *
 * The multi-agent track asks you to "make coordination visible", and until now
 * this system's coordination has been entirely invisible: four lanes running at
 * wildly different timescales, observable only as interleaved terminal lines.
 *
 * Served from the agent process rather than the browser talking to InsForge
 * directly, for one specific reason: the InsForge admin key would have to ship
 * to the client. The agent already holds the state, so it serves it.
 */

export interface LaneEvent {
  lane: "reflex" | "voice" | "action" | "memory" | "reflection";
  label: string;
  at: number;
  /** ms the operation took, when known. */
  ms?: number;
  ok?: boolean;
}

export interface DashboardState {
  startedAt: number;
  session: string | null;
  persona: string[];
  connected: { bot: boolean; gbrain: boolean; episodic: boolean; live: boolean };
  counters: Record<string, number>;
  events: LaneEvent[];
  reliability: Array<Record<string, unknown>>;
}

export class Dashboard {
  private readonly events: LaneEvent[] = [];
  private server: ReturnType<typeof createServer> | null = null;
  private readonly max = 200;

  constructor(private readonly snapshot: () => Omit<DashboardState, "events">) {}

  /** Record something a lane did. Cheap and synchronous — called from hot paths. */
  push(lane: LaneEvent["lane"], label: string, opts: { ms?: number; ok?: boolean } = {}): void {
    this.events.push({ lane, label, at: Date.now(), ms: opts.ms, ok: opts.ok });
    while (this.events.length > this.max) this.events.shift();
  }

  start(port: number): void {
    this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.url === "/api/state") {
        res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
        res.end(JSON.stringify({ ...this.snapshot(), events: this.events }));
        return;
      }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(PAGE);
    });
    // Loopback only: this exposes session transcripts.
    this.server.listen(port, "127.0.0.1", () => log.info(`dashboard: http://localhost:${port}`));
  }

  stop(): void {
    this.server?.close();
    this.server = null;
  }
}

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>agartha — live</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; background:#0a0b0e; color:#e6e6e6;
         font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; padding:24px; }
  h1 { font-size:15px; margin:0 0 2px; letter-spacing:.14em; text-transform:uppercase; color:#fff; }
  .sub { color:#6b7280; margin-bottom:20px; font-size:12px; }
  .pills { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:22px; }
  .pill { padding:3px 9px; border-radius:99px; font-size:11px; border:1px solid #222634; color:#6b7280; }
  .pill.on { border-color:#164e3f; background:#0c1f1a; color:#4ade80; }
  .pill.off { border-color:#3f1d1d; background:#1f0d0d; color:#f87171; }
  .lanes { display:grid; gap:10px; margin-bottom:24px; }
  .lane { display:grid; grid-template-columns:78px 1fr; align-items:start; gap:12px; }
  .name { color:#6b7280; text-transform:uppercase; font-size:10px;
          letter-spacing:.12em; padding-top:6px; }
  .track { background:#0e1015; border:1px solid #1a1d26; border-radius:6px;
           min-height:34px; padding:5px; display:flex; gap:4px; flex-wrap:wrap; align-content:flex-start; }
  .ev { padding:3px 7px; border-radius:4px; font-size:11px; white-space:nowrap;
        border:1px solid transparent; animation:in .25s ease; }
  @keyframes in { from { opacity:0; transform:translateY(-2px) } }
  .reflex .ev { background:#0d1a12; color:#4ade80; border-color:#14301f; }
  .voice  .ev { background:#1a160a; color:#fbbf24; border-color:#332a12; }
  .action .ev { background:#0a1420; color:#60a5fa; border-color:#12263d; }
  .memory .ev { background:#170f1e; color:#c084fc; border-color:#2b1a38; }
  /* Deliberately the slow lane. Seeing it tick over seconds while voice keeps
     answering in under two is the whole architecture in one screenshot. */
  .reflection .ev { background:#1e1210; color:#fb923c; border-color:#3a2116; }
  .ev.bad { background:#1f0d0d !important; color:#f87171 !important; border-color:#3f1d1d !important; }
  .ms { opacity:.55; margin-left:5px; }
  table { border-collapse:collapse; font-size:12px; }
  th { text-align:left; color:#6b7280; font-weight:400; padding:3px 18px 3px 0;
       font-size:10px; text-transform:uppercase; letter-spacing:.1em; }
  td { padding:3px 18px 3px 0; color:#d1d5db; }
  .good { color:#4ade80; } .warn { color:#fbbf24; } .bad { color:#f87171; }
  .k { color:#6b7280; }
</style></head><body>
<h1>agartha</h1>
<div class="sub" id="sub">connecting…</div>
<div class="pills" id="pills"></div>
<div class="lanes">
  <div class="lane reflex"><div class="name">reflex<br><span class="k">15Hz</span></div><div class="track" id="t-reflex"></div></div>
  <div class="lane voice"><div class="name">voice<br><span class="k">1.8s p50</span></div><div class="track" id="t-voice"></div></div>
  <div class="lane action"><div class="name">action<br><span class="k">~3ms</span></div><div class="track" id="t-action"></div></div>
  <div class="lane memory"><div class="name">memory<br><span class="k">~25ms</span></div><div class="track" id="t-memory"></div></div>
  <div class="lane reflection"><div class="name">reasoning<br><span class="k">~8s, off-path</span></div><div class="track" id="t-reflection"></div></div>
</div>
<table id="rel"></table>
<script>
const esc = s => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
async function tick() {
  let s; try { s = await (await fetch('/api/state')).json(); } catch { return; }
  const up = Math.floor((Date.now() - s.startedAt) / 1000);
  document.getElementById('sub').textContent =
    'up ' + up + 's · session ' + (s.session ? s.session.slice(0,8) : 'none') +
    ' · persona: ' + (s.persona.length ? s.persona.join(' + ') : 'fallback');

  document.getElementById('pills').innerHTML = Object.entries(s.connected)
    .map(([k,v]) => '<span class="pill ' + (v?'on':'off') + '">' + k + '</span>').join('')
    + Object.entries(s.counters).map(([k,v]) =>
        '<span class="pill">' + k + ' ' + v + '</span>').join('');

  for (const lane of ['reflex','voice','action','memory','reflection']) {
    const evs = s.events.filter(e => e.lane === lane).slice(-14);
    document.getElementById('t-' + lane).innerHTML = evs.map(e =>
      '<span class="ev' + (e.ok === false ? ' bad' : '') + '">' + esc(e.label) +
      (e.ms != null ? '<span class="ms">' + e.ms + 'ms</span>' : '') + '</span>').join('');
  }

  const rows = s.reliability || [];
  document.getElementById('rel').innerHTML = rows.length
    ? '<tr><th>tool</th><th>calls</th><th>success</th><th>avg</th></tr>' + rows.map(r => {
        const rate = Number(r.success_rate);
        const cls = rate >= 90 ? 'good' : rate >= 50 ? 'warn' : 'bad';
        return '<tr><td>' + esc(r.tool) + '</td><td>' + r.calls +
          '</td><td class="' + cls + '">' + rate + '%</td><td>' + (r.avg_ms ?? '-') + 'ms</td></tr>';
      }).join('')
    : '';
}
tick(); setInterval(tick, 400);
</script></body></html>`;
