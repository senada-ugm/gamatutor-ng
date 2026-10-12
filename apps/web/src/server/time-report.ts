/**
 * Study-time arithmetic over the event log (Tim DRIVE note 15). Pure: events
 * in, numbers out, so it is tested without a database.
 *
 * Active time is the sum of the gaps between a learner's consecutive events,
 * each gap capped at IDLE_CAP (heartbeats arrive every minute while the course
 * is open and visible, so a reading learner keeps producing short gaps). A gap
 * longer than SESSION_GAP ends a session and counts for nothing.
 */
export const IDLE_CAP_MS = 5 * 60_000;
export const SESSION_GAP_MS = 30 * 60_000;
/** Reports are in WIB (UTC+7, no daylight saving). */
export const WIB_OFFSET_MS = 7 * 3_600_000;

export interface TimedEvent {
  userId: string;
  at: Date;
  objectId: string;
}

export interface LearnerTime {
  userId: string;
  firstAt: Date;
  lastAt: Date;
  sessions: number;
  activeMs: number;
}

/** A gap between two events, attributed to the first one. */
export interface Span {
  userId: string;
  at: Date;
  objectId: string;
  ms: number;
}

function byUser(events: readonly TimedEvent[]): Map<string, TimedEvent[]> {
  const m = new Map<string, TimedEvent[]>();
  for (const e of events) {
    const list = m.get(e.userId) ?? [];
    list.push(e);
    m.set(e.userId, list);
  }
  for (const list of m.values()) list.sort((a, b) => a.at.getTime() - b.at.getTime());
  return m;
}

/** Every counted stretch of activity, ready to bucket by hour or page. */
export function activeSpans(events: readonly TimedEvent[]): Span[] {
  const spans: Span[] = [];
  for (const list of byUser(events).values()) {
    for (let i = 0; i + 1 < list.length; i++) {
      const a = list[i]!;
      const gap = list[i + 1]!.at.getTime() - a.at.getTime();
      if (gap <= 0 || gap > SESSION_GAP_MS) continue;
      spans.push({ userId: a.userId, at: a.at, objectId: a.objectId, ms: Math.min(gap, IDLE_CAP_MS) });
    }
  }
  return spans;
}

export function learnerTimes(events: readonly TimedEvent[]): Map<string, LearnerTime> {
  const out = new Map<string, LearnerTime>();
  for (const [userId, list] of byUser(events)) {
    let sessions = list.length ? 1 : 0;
    let activeMs = 0;
    for (let i = 0; i + 1 < list.length; i++) {
      const gap = list[i + 1]!.at.getTime() - list[i]!.at.getTime();
      if (gap > SESSION_GAP_MS) sessions++;
      else if (gap > 0) activeMs += Math.min(gap, IDLE_CAP_MS);
    }
    out.set(userId, {
      userId,
      firstAt: list[0]!.at,
      lastAt: list.at(-1)!.at,
      sessions,
      activeMs,
    });
  }
  return out;
}

/** Monday = 0 … Sunday = 6, and the hour, both in WIB. */
export function wibSlot(at: Date): { weekday: number; hour: number } {
  const shifted = new Date(at.getTime() + WIB_OFFSET_MS);
  return { weekday: (shifted.getUTCDay() + 6) % 7, hour: shifted.getUTCHours() };
}

/** YYYY-MM-DD in WIB. */
export function wibDate(at: Date): string {
  return new Date(at.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** "2026-10-13 21:05" in WIB, for tables and CSV. */
export function wibStamp(at: Date): string {
  return new Date(at.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 16).replace('T', ' ');
}

/** Active minutes per weekday × hour: when learners actually study. */
export function heatmap(spans: readonly Span[]): number[][] {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const s of spans) {
    const { weekday, hour } = wibSlot(s.at);
    grid[weekday]![hour]! += s.ms / 60_000;
  }
  return grid.map((row) => row.map((m) => Math.round(m)));
}

/** Distinct learners with any event, per WIB day, for the last `days` days. */
export function dailyLearners(
  events: readonly TimedEvent[],
  days: number,
  now: Date,
): Array<{ date: string; learners: number }> {
  const sets = new Map<string, Set<string>>();
  for (const e of events) {
    const d = wibDate(e.at);
    const s = sets.get(d) ?? new Set<string>();
    s.add(e.userId);
    sets.set(d, s);
  }
  const out: Array<{ date: string; learners: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = wibDate(new Date(now.getTime() - i * 86_400_000));
    out.push({ date: d, learners: sets.get(d)?.size ?? 0 });
  }
  return out;
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * Median active minutes per module across the learners who spent any time in
 * it. `moduleOf` maps a page id to its module label; course-level events (the
 * course id itself) fall outside every module and are skipped.
 */
export function minutesPerModule(
  spans: readonly Span[],
  moduleOf: ReadonlyMap<string, string>,
  order: readonly string[],
): Array<{ module: string; medianMinutes: number; learners: number }> {
  const perModule = new Map<string, Map<string, number>>();
  for (const s of spans) {
    const mod = moduleOf.get(s.objectId);
    if (!mod) continue;
    const users = perModule.get(mod) ?? new Map<string, number>();
    users.set(s.userId, (users.get(s.userId) ?? 0) + s.ms);
    perModule.set(mod, users);
  }
  return order.map((module) => {
    const users = perModule.get(module);
    const mins = users ? [...users.values()].map((ms) => ms / 60_000) : [];
    return { module, medianMinutes: Math.round(median(mins) * 10) / 10, learners: mins.length };
  });
}

/** "1 j 05 m" style duration for tables. */
export function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h ? `${h} j ${String(m).padStart(2, '0')} m` : `${m} m`;
}
