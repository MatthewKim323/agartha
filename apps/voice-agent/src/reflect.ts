import type { GbrainClient } from "@agartha/memory";
import { logger } from "./log.js";

const log = logger("reflect");

/**
 * Reflection: what turns a series of sessions into a relationship.
 *
 * Runs strictly after a call ends. Nothing here is ever in the speech path,
 * which is why it is allowed to be slow.
 *
 * The predecessor kept its Minecraft memory deliberately walled off from
 * gbrain ("itto owns the spatial/MC data locally, itto never calls the brain"),
 * so the agent could remember where a chest was but had no idea who it was
 * playing with. Spatial data stays local, because it is high-volume and only
 * meaningful in-world. What goes to gbrain is what matters across sessions:
 * what you built together, what you were trying to do, what you enjoyed.
 */

export interface SessionExchange {
  who: string;
  said: string;
  did?: string;
}

/** Pad a date part to two digits without pulling in a date library. */
const pad = (n: number) => String(n).padStart(2, "0");

export function sessionSlug(at: Date): string {
  return `minecraft/${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}`;
}

/**
 * Render a session as a gbrain page.
 *
 * Deliberately a transcript summary rather than model-extracted "facts":
 * gbrain already runs its own extraction over pages, so inventing a second
 * extraction here would mean two competing sources of truth about the same
 * conversation.
 */
export function formatSession(exchanges: SessionExchange[], at: Date, tools: string[]): string {
  const when = at.toISOString();
  const lines: string[] = [
    `# Minecraft session ${when}`,
    "",
    "A voice session in Minecraft. Written by the agent after the call ended.",
    "",
  ];

  if (exchanges.length > 0) {
    lines.push("## What was said", "");
    for (const e of exchanges) {
      lines.push(`- **${e.who}**: ${e.said.replace(/\s+/g, " ").trim()}`);
      if (e.did) lines.push(`  - did: ${e.did}`);
    }
    lines.push("");
  }

  if (tools.length > 0) {
    const counts = new Map<string, number>();
    for (const t of tools) counts.set(t, (counts.get(t) ?? 0) + 1);
    const summary = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, n]) => (n > 1 ? `${name} x${n}` : name))
      .join(", ");
    lines.push("## What got done", "", summary, "");
  }

  return lines.join("\n");
}

/**
 * Persist a session. Best-effort by design: called during shutdown, where the
 * process may be on a deadline.
 */
export async function reflect(
  gbrain: GbrainClient,
  exchanges: SessionExchange[],
  tools: string[],
  at = new Date(),
): Promise<boolean> {
  // A session where nobody said anything isn't worth a page.
  if (exchanges.length === 0 && tools.length === 0) {
    log.debug("nothing to reflect on");
    return false;
  }

  const slug = sessionSlug(at);
  const ok = await gbrain.remember(slug, `Minecraft session ${at.toISOString()}`, formatSession(exchanges, at, tools));
  log.info(ok ? `wrote ${slug}` : `failed to write ${slug}`);
  return ok;
}
