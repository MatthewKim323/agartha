import { describe, expect, test } from "bun:test";
import { LruCache, normalizeQuery } from "./cache.js";

describe("normalizeQuery", () => {
  test("collapses case, whitespace, and trailing punctuation", () => {
    expect(normalizeQuery("  What   is  KALI? ")).toBe("what is kali");
  });

  test("phrasings that differ only in punctuation share a key", () => {
    expect(normalizeQuery("who is matt")).toBe(normalizeQuery("Who is Matt?"));
  });

  test("does not collide genuinely different questions", () => {
    expect(normalizeQuery("what is kali")).not.toBe(normalizeQuery("who is kali"));
  });

  test("keeps interior punctuation", () => {
    expect(normalizeQuery("it's a co-op bot!")).toBe("it's a co-op bot");
  });
});

describe("LruCache", () => {
  test("returns what was stored", () => {
    const c = new LruCache<number>();
    c.set("a", 1);
    expect(c.get("a")).toBe(1);
  });

  test("misses on an unknown key", () => {
    expect(new LruCache<number>().get("nope")).toBeUndefined();
  });

  test("evicts the least recently used, not the oldest inserted", () => {
    const c = new LruCache<number>(2);
    c.set("a", 1);
    c.set("b", 2);
    c.get("a"); // 'a' is now most-recently-used, so 'b' should go
    c.set("c", 3);
    expect(c.get("a")).toBe(1);
    expect(c.get("b")).toBeUndefined();
    expect(c.get("c")).toBe(3);
  });

  test("respects max size", () => {
    const c = new LruCache<number>(3);
    for (let i = 0; i < 10; i++) c.set(`k${i}`, i);
    expect(c.size).toBe(3);
  });

  test("expires entries past the TTL", () => {
    let now = 1000;
    const c = new LruCache<number>(10, 500, () => now);
    c.set("a", 1);
    now = 1400;
    expect(c.get("a")).toBe(1); // still inside the window
    now = 1600;
    expect(c.get("a")).toBeUndefined(); // past it
  });

  test("re-setting a key refreshes its TTL", () => {
    let now = 1000;
    const c = new LruCache<number>(10, 500, () => now);
    c.set("a", 1);
    now = 1400;
    c.set("a", 2);
    now = 1800;
    expect(c.get("a")).toBe(2);
  });

  test("tracks hit rate", () => {
    const c = new LruCache<number>();
    c.set("a", 1);
    c.get("a");
    c.get("a");
    c.get("miss");
    const s = c.stats();
    expect(s.hits).toBe(2);
    expect(s.misses).toBe(1);
    expect(s.hitRate).toBeCloseTo(2 / 3);
  });

  test("hit rate is 0 rather than NaN before any access", () => {
    expect(new LruCache<number>().stats().hitRate).toBe(0);
  });
});
