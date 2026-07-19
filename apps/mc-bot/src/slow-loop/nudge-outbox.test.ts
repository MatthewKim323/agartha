import { describe, expect, test } from "bun:test";
import type { GameState } from "@agartha/shared";
import { drainNudges, pushNudge } from "./nudge-outbox.js";

const state = (over: Partial<GameState> = {}) =>
  ({
    self: { health: 20, food: 20, position: { x: 0, y: 64, z: 0 }, state: "IDLE" },
    nearbyHostiles: [],
    inventory: [],
    recentChat: [],
    time: 1000,
    ...over,
  }) as unknown as GameState;

describe("nudge outbox", () => {
  test("queues and drains", () => {
    drainNudges();
    pushNudge("creeper approaching", state());
    const out = drainNudges();
    expect(out).toHaveLength(1);
    expect(out[0]!.reason).toBe("creeper approaching");
  });

  test("draining clears, so an event is surfaced once", () => {
    drainNudges();
    pushNudge("night falling", state());
    drainNudges();
    expect(drainNudges()).toHaveLength(0);
  });

  test("drops events too old to still be true", () => {
    // Reacting to a creeper from 40 seconds ago is noise, not presence.
    drainNudges();
    pushNudge("stale event", state());
    expect(drainNudges(-1)).toHaveLength(0);
  });

  test("keeps only the freshest when many pile up", () => {
    drainNudges();
    for (let i = 0; i < 25; i++) pushNudge(`event ${i}`, state());
    const out = drainNudges();
    expect(out.length).toBeLessThanOrEqual(10);
    // The newest survived, the oldest were dropped.
    expect(out.at(-1)!.reason).toBe("event 24");
    expect(out.some((n) => n.reason === "event 0")).toBe(false);
  });

  test("carries a rendered world snapshot, not a raw object", () => {
    drainNudges();
    pushNudge("threat", state());
    expect(typeof drainNudges()[0]!.state).toBe("string");
  });
});
