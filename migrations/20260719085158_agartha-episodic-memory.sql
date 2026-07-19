-- Episodic memory for agartha.
--
-- gbrain is what the agent KNOWS (semantic memory of matt, private, existing).
-- This is what the agent HAS DONE (episodic: sessions, utterances, tool calls,
-- timings, outcomes).
--
-- The point is not analytics. It is that the agent can query its own history:
-- "what did we build last session", "how often does chop_tree fail", "am I
-- getting slower". Metacognition grounded in telemetry rather than a prompt
-- that says "reflect on yourself".
--
-- PRIVACY BOUNDARY, non-negotiable: nothing from gbrain is copied here. This
-- stores what the agent did, never matt's personal corpus. Retrieved memory
-- text must never be written into these tables.

-- ── sessions ────────────────────────────────────────────────────────────────
create table if not exists public.sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  world        text,
  player       text,
  -- Written by the post-call reflection pass.
  summary      text,
  -- Denormalized counters so "how did last session go" is one row, not a join.
  tool_calls   integer not null default 0,
  utterances   integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists sessions_user_started_idx
  on public.sessions (user_id, started_at desc);

-- ── utterances: one row per thing said to or by the agent ───────────────────
create table if not exists public.utterances (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.sessions(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade,
  heard         text,
  said          text,
  -- End of speech to first audio out. The number the project is about.
  latency_ms    integer,
  trace_id      text,
  at            timestamptz not null default now()
);

create index if not exists utterances_session_idx on public.utterances (session_id, at);
create index if not exists utterances_latency_idx on public.utterances (latency_ms)
  where latency_ms is not null;

-- ── tool_calls: the agent's actual actions ──────────────────────────────────
create table if not exists public.tool_calls (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.sessions(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,
  tool         text not null,
  args         jsonb,
  result       text,
  -- Distinguishes "the bot tried and failed" from "the bot never tried",
  -- which is the difference between a reliability bug and a prompting bug.
  ok           boolean not null default true,
  duration_ms  integer,
  trace_id     text,
  at           timestamptz not null default now()
);

create index if not exists tool_calls_session_idx on public.tool_calls (session_id, at);
create index if not exists tool_calls_tool_idx on public.tool_calls (tool, at desc);
create index if not exists tool_calls_failures_idx on public.tool_calls (tool) where ok = false;

-- ── traces: per-stage timings, for the latency table ────────────────────────
create table if not exists public.traces (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references public.sessions(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  trace_id    text not null,
  label       text not null,
  -- stage name -> ms since trace start
  marks       jsonb not null default '{}'::jsonb,
  total_ms    integer,
  outcome     text,
  at          timestamptz not null default now()
);

create index if not exists traces_label_idx on public.traces (label, at desc);

-- ── row level security ──────────────────────────────────────────────────────
-- Multi-tenant from the start. Retrofitting isolation onto a companion product
-- that holds someone's history is not something to do later.

alter table public.sessions   enable row level security;
alter table public.utterances enable row level security;
alter table public.tool_calls enable row level security;
alter table public.traces     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['sessions', 'utterances', 'tool_calls', 'traces'] loop
    execute format($f$
      drop policy if exists %1$s_select_own on public.%1$s;
      create policy %1$s_select_own on public.%1$s
        for select using (user_id = auth.uid());
    $f$, t);
    execute format($f$
      drop policy if exists %1$s_insert_own on public.%1$s;
      create policy %1$s_insert_own on public.%1$s
        for insert with check (user_id = auth.uid());
    $f$, t);
    execute format($f$
      drop policy if exists %1$s_update_own on public.%1$s;
      create policy %1$s_update_own on public.%1$s
        for update using (user_id = auth.uid()) with check (user_id = auth.uid());
    $f$, t);
    execute format($f$
      drop policy if exists %1$s_delete_own on public.%1$s;
      create policy %1$s_delete_own on public.%1$s
        for delete using (user_id = auth.uid());
    $f$, t);
  end loop;
end $$;

-- ── self-knowledge views ────────────────────────────────────────────────────
-- These exist so the agent's history() tool is a cheap select rather than
-- aggregation logic living in the client.

-- "how often does each tool actually work?"
create or replace view public.tool_reliability as
select
  user_id,
  tool,
  count(*)                                          as calls,
  count(*) filter (where ok)                        as succeeded,
  round(100.0 * count(*) filter (where ok) / nullif(count(*), 0), 1) as success_rate,
  round(avg(duration_ms))                           as avg_ms,
  max(at)                                           as last_used
from public.tool_calls
group by user_id, tool;

-- "am I getting slower?"
create or replace view public.latency_by_day as
select
  user_id,
  date_trunc('day', at)                                                  as day,
  count(*)                                                               as n,
  round(avg(latency_ms))                                                 as avg_ms,
  percentile_cont(0.5) within group (order by latency_ms)::int           as p50_ms,
  percentile_cont(0.95) within group (order by latency_ms)::int          as p95_ms
from public.utterances
where latency_ms is not null
group by user_id, date_trunc('day', at);
