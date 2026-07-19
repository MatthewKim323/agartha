/**
 * Test the memory path without voice or Minecraft.
 *
 *   bun --env-file=.env scripts/gbrain-test.ts
 *   bun --env-file=.env scripts/gbrain-test.ts "who is katie"
 *
 * Exercises exactly what the voice agent's `recall` tool does, so if this
 * works, recall works.
 */
import { GbrainClient, formatMemory } from "../packages/memory/src/index.js";

const url = process.env.GBRAIN_MCP_URL ?? "http://localhost:3131/mcp";
const token = process.env.GBRAIN_TOKEN ?? "";

console.log(`endpoint: ${url}`);
console.log(`token:    ${token ? `${token.slice(0, 12)}…(${token.length} chars)` : "MISSING"}`);

if (!token) {
  console.error("\nNo GBRAIN_TOKEN. Create one with: gbrain auth create --name agartha");
  process.exit(1);
}

// Is the server even up?
try {
  const health = await fetch(url.replace("/mcp", "/health"), { signal: AbortSignal.timeout(3000) });
  console.log(`health:   ${health.status === 200 ? "ok" : `HTTP ${health.status}`}`);
} catch {
  console.error("\ngbrain is not reachable. Is the LaunchAgent running?");
  console.error("  launchctl print gui/$(id -u)/com.matthewkim.gbrain | head");
  process.exit(1);
}

const client = new GbrainClient({ url, token, timeoutMs: 5000, limit: 4 });

const queries = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["what is matt building at kali", "who is katie", "what is jabby", "minecraft itto"];

console.log("\n--- recall ---");
let anyHits = 0;
for (const q of queries) {
  const res = await client.recall(q);
  anyHits += res.hits.length;
  const tag = res.cached ? "cached" : `${res.ms}ms`;
  console.log(`\n"${q}"  [${tag}]${res.skipped ? ` skipped=${res.skipped}` : ""}`);
  if (res.hits.length === 0) {
    console.log("  (no hits)");
  } else {
    for (const h of res.hits) {
      console.log(`  ${h.score.toFixed(2)}  ${h.slug}`);
      console.log(`        ${h.text.replace(/\s+/g, " ").slice(0, 110)}`);
    }
  }
}

console.log("\n--- cache (same queries again) ---");
for (const q of queries) {
  const res = await client.recall(q);
  console.log(`  "${q.slice(0, 40)}": ${res.cached ? "HIT (0ms)" : `miss (${res.ms}ms)`}`);
}
console.log(`\ncache stats: ${JSON.stringify(client.cacheStats())}`);

console.log("\n--- what the model actually receives ---");
const sample = await client.recall(queries[0]!);
console.log(formatMemory(sample.hits).slice(0, 500) || "(empty)");

await client.close();

if (anyHits === 0) {
  console.error("\nNo hits on ANY query. Most likely the running server does not know this");
  console.error("token: gbrain caches its token table at boot, so a token created after");
  console.error("the server started is rejected until it restarts.");
  process.exit(1);
}
console.log("\nmemory path works.");
process.exit(0);
