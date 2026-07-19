/**
 * Does the reasoning lane actually answer?
 *
 * Same shape as `gbrain-test.ts`: a one-command check that the remote surface
 * is reachable, authenticated, and returning plans this codebase can execute —
 * without needing a Discord call or a live Minecraft server.
 *
 *   bun --env-file=.env scripts/plan-test.ts
 *   bun --env-file=.env scripts/plan-test.ts "build us a base before dark"
 */
import { Planner, speakablePlan } from "../apps/voice-agent/src/plan.js";

const goal = process.argv.slice(2).join(" ") || "get me a full set of iron gear";

const planner = new Planner({
  url: process.env.RUNTYPE_MCP_URL,
  key: process.env.RUNTYPE_MCP_KEY,
  timeoutMs: Number(process.env.RUNTYPE_TIMEOUT_MS || 30_000),
});

if (!planner.enabled) {
  console.error("reasoning lane not configured — set RUNTYPE_MCP_URL and RUNTYPE_MCP_KEY");
  process.exit(1);
}

const context = [
  "world state:",
  "- time: day",
  "- inventory: empty",
  "- nearby: forest, no crafting table",
].join("\n");

console.log(`goal: ${goal}\n`);
const started = Date.now();
const plan = await planner.plan(goal, context);

if (!plan) {
  console.error(`no plan returned after ${Date.now() - started}ms`);
  process.exit(1);
}

console.log(`${plan.steps.length} steps in ${plan.ms}ms\n`);
console.log(speakablePlan(plan));
console.log("\nfull:");
for (const [i, s] of plan.steps.entries()) {
  console.log(`  ${i + 1}. ${s.skill}${s.args ? ` ${JSON.stringify(s.args)}` : ""}${s.why ? `  — ${s.why}` : ""}`);
}
if (plan.dropped.length > 0) {
  // Not a warning to ignore: a skill the planner keeps reaching for and not
  // finding is a real gap in the skill set, and this is where it shows up.
  console.log(`\ndropped (not real skills): ${plan.dropped.join(", ")}`);
}
process.exit(0);
