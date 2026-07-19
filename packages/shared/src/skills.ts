/**
 * The canonical list of skill names.
 *
 * Lives in `shared` rather than next to the implementations so the MCP input
 * schema can constrain `run_skill` to an enum. That constraint is the whole
 * point: `name` used to be a free-form string, so when the voice model heard
 * "go dig me up some iron" it could emit `mine_ore`, `dig`, or `mine_iron` —
 * none of which exist — and the call died as "unknown skill" after the model
 * had already said "on it" out loud. An enum makes the wrong name unemittable
 * rather than merely wrong.
 *
 * Gemini's Schema subset supports `enum` (it survives sanitizeSchema), so this
 * reaches the model as a real constraint and not just prose in a description.
 *
 * The dependency arrow stays correct — shared knows the NAMES, the app owns the
 * IMPLEMENTATIONS. `skills/index.ts` asserts at startup that the two agree, and
 * a test asserts it at build time, so this can't silently drift.
 */
export const SKILL_NAMES = [
  // movement / presence
  "follow_player",
  "scout_ahead",
  // gathering
  "chop_tree",
  "mine_vein",
  "mine_down",
  "tunnel",
  "gather",
  "collect_drops",
  // combat
  "combat_assist",
  "hunt",
  // building
  "build",
  "build_helper",
  // items
  "craft",
  "make_tools",
  "fetch_item",
  "give_item",
  "inventory_report",
] as const;

export type SkillName = (typeof SKILL_NAMES)[number];

const NAME_SET: ReadonlySet<string> = new Set(SKILL_NAMES);

export function isSkillName(name: string): name is SkillName {
  return NAME_SET.has(name);
}

/**
 * Closest valid skill name by edit distance, for error messages. If the model
 * does get a bad name through (a hand-written MCP call, a schema the client
 * didn't enforce), the failure should teach it the right name in one turn
 * rather than just saying "no".
 */
export function suggestSkill(name: string): SkillName | null {
  const target = name.toLowerCase().trim();
  let best: SkillName | null = null;
  let bestScore = Infinity;
  for (const candidate of SKILL_NAMES) {
    const d = editDistance(target, candidate);
    if (d < bestScore) {
      bestScore = d;
      best = candidate;
    }
  }
  // Only suggest when it's plausibly a typo/near-miss, not a wild guess.
  return bestScore <= Math.max(3, Math.floor(target.length / 2)) ? best : null;
}

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let cur = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n]!;
}
