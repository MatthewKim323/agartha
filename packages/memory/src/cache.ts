/**
 * A tiny LRU with TTL, for gbrain query results.
 *
 * The predecessor had no caching at all: identical queries paid the full
 * retrieval cost every single time. Since a conversation circles the same few
 * topics, the hit rate here is the difference between retrieval being free and
 * retrieval being the slowest thing in the turn.
 */

interface Entry<V> {
  value: V;
  expiresAt: number;
}

export class LruCache<V> {
  private readonly map = new Map<string, Entry<V>>();
  private hits = 0;
  private misses = 0;

  constructor(
    private readonly max = 128,
    private readonly ttlMs = 5 * 60_000,
    /** Injectable clock so TTL is testable without sleeping. */
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): V | undefined {
    const entry = this.map.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (entry.expiresAt <= this.now()) {
      this.map.delete(key);
      this.misses++;
      return undefined;
    }
    // Re-insert to mark most-recently-used: Map preserves insertion order.
    this.map.delete(key);
    this.map.set(key, entry);
    this.hits++;
    return entry.value;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt: this.now() + this.ttlMs });
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  get size(): number {
    return this.map.size;
  }

  /** Hit rate since construction. Reported in the latency table. */
  stats(): { hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return { hits: this.hits, misses: this.misses, hitRate: total === 0 ? 0 : this.hits / total };
  }

  clear(): void {
    this.map.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

/**
 * Normalize so trivially different phrasings share a cache entry. Deliberately
 * conservative: lowercase, collapse whitespace, drop terminal punctuation. No
 * stemming or stopword removal, since those would collide questions that mean
 * genuinely different things.
 */
export function normalizeQuery(q: string): string {
  return q
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    // Trim BEFORE stripping terminal punctuation: with trailing whitespace the
    // end-anchor never matches, and "kali? " would key differently to "kali".
    .replace(/[?!.,;:]+$/g, "")
    .trim();
}
