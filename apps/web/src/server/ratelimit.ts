/**
 * Fixed-window counters kept in memory. Enough for one Node process; a second
 * process would need a shared store.
 */
const windows = new Map<string, { count: number; resetAt: number }>();
const MAX_KEYS = 50_000;

function sweep(now: number): void {
  if (windows.size < MAX_KEYS) return;
  for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
}

function current(key: string, now: number) {
  const w = windows.get(key);
  return w && w.resetAt > now ? w : null;
}

/** Counts this call and says whether it is still within the limit. */
export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  sweep(now);
  const w = current(key, now);
  if (!w) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  w.count++;
  return w.count <= limit;
}

/** True once `key` has failed `limit` times in the window; does not count. */
export function blocked(key: string, limit: number, now = Date.now()): boolean {
  const w = current(key, now);
  return !!w && w.count >= limit;
}

/** Records one failure for `key`. */
export function fail(key: string, windowMs: number, now = Date.now()): void {
  allow(key, Number.POSITIVE_INFINITY, windowMs, now);
}

export function resetRateLimits(): void {
  windows.clear();
}
