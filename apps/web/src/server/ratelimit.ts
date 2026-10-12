/**
 * Fixed-window counters kept in memory. Enough for one Node process; a second
 * process would need a shared store.
 */
const windows = new Map<string, { count: number; resetAt: number }>();

export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  w.count++;
  return w.count <= limit;
}

export function resetRateLimits(): void {
  windows.clear();
}
