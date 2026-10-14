import { eq, desc, sql } from "drizzle-orm"
import { db } from "../../../db/index.js"
import { learningTelemetryLogs, participantProfiles } from "../../../db/app-schema.js"
import { users } from "../../../db/auth-schema.js"
import { generateId } from "../../../lib/response.js"
import type {
  CourseTelemetrySummary,
  TelemetryDailyPoint,
  TelemetryEvent,
  TelemetryEventCreate,
} from "@workspace/contracts"

export async function recordTelemetryEvent(userId: string, input: TelemetryEventCreate): Promise<TelemetryEvent> {
  const id = generateId("tlm")
  const duration = input.dwellTimeSeconds ?? 0
  const now = new Date()
  const enteredAt = new Date(now.getTime() - duration * 1000)

  const [row] = await db
    .insert(learningTelemetryLogs)
    .values({
      id,
      userId,
      courseId: input.courseId,
      moduleId: input.moduleId,
      slideId: input.slideId,
      enteredAt,
      exitedAt: now,
      durationSeconds: duration,
      interactedElements: (input.interactionData as Record<string, unknown>) ?? {},
    })
    .returning()

  return {
    id: row!.id,
    userId: row!.userId,
    courseId: row!.courseId,
    moduleId: row!.moduleId ?? "",
    slideId: row!.slideId,
    eventType: input.eventType,
    dwellTimeSeconds: row!.durationSeconds,
    createdAt: row!.createdAt.toISOString(),
  }
}

export async function exportTelemetryCsv(courseId?: string): Promise<string> {
  const query = db
    .select({
      id: learningTelemetryLogs.id,
      timestamp: learningTelemetryLogs.createdAt,
      userId: learningTelemetryLogs.userId,
      courseId: learningTelemetryLogs.courseId,
      moduleId: learningTelemetryLogs.moduleId,
      slideId: learningTelemetryLogs.slideId,
      durationSeconds: learningTelemetryLogs.durationSeconds,
      userName: users.name,
      userEmail: users.email,
      profession: participantProfiles.profession,
      institutionName: participantProfiles.institutionName,
      strNumber: participantProfiles.strNumber,
    })
    .from(learningTelemetryLogs)
    .leftJoin(users, eq(learningTelemetryLogs.userId, users.id))
    .leftJoin(participantProfiles, eq(learningTelemetryLogs.userId, participantProfiles.id))
    .orderBy(desc(learningTelemetryLogs.createdAt))

  const rows = courseId ? await query.where(eq(learningTelemetryLogs.courseId, courseId)) : await query

  const headers = [
    "Log ID",
    "Timestamp",
    "User ID",
    "Learner Name",
    "Email",
    "Profession",
    "Health Center / Institution",
    "Doctor STR",
    "Course ID",
    "Module ID",
    "Slide ID",
    "Dwell Time (Seconds)",
  ]

  const lines = [headers.join(",")]
  for (const r of rows) {
    const values = [
      r.id,
      r.timestamp.toISOString(),
      r.userId,
      `"${(r.userName || "").replace(/"/g, '""')}"`,
      r.userEmail || "",
      `"${(r.profession || "").replace(/"/g, '""')}"`,
      `"${(r.institutionName || "").replace(/"/g, '""')}"`,
      `"${(r.strNumber || "").replace(/"/g, '""')}"`,
      r.courseId,
      r.moduleId || "",
      r.slideId,
      r.durationSeconds,
    ]
    lines.push(values.join(","))
  }

  return lines.join("\n")
}

/** WIB is the analytics timezone — the audience is Indonesian
 *  primary-care doctors (Review #15 asks "waktu yang sering modulnya
 *  diakses", which is only meaningful in wall-clock local time). */
const ANALYTICS_TZ = "Asia/Jakarta"

/** Study-time aggregates for the course report (Review note #15) — one
 *  grouped pass per shape over learning_telemetry_logs, never a
 *  per-participant query loop. Buckets use WIB; Postgres `dow` is
 *  Sunday-first and is converted to the Monday-first index the contract
 *  documents ((dow + 6) % 7). */
export async function getCourseTelemetrySummary(courseId: string): Promise<CourseTelemetrySummary> {
  const [byUser, byCell, byDay] = await Promise.all([
    db
      .select({
        userId: learningTelemetryLogs.userId,
        totalDwell: sql<number>`coalesce(sum(${learningTelemetryLogs.durationSeconds}), 0)::int`,
        events: sql<number>`count(*)::int`,
        lastActiveAt: sql<string | null>`max(${learningTelemetryLogs.createdAt})`,
      })
      .from(learningTelemetryLogs)
      .where(eq(learningTelemetryLogs.courseId, courseId))
      .groupBy(learningTelemetryLogs.userId),
    db
      .select({
        dow: sql<number>`extract(dow from (${learningTelemetryLogs.enteredAt} at time zone 'UTC') at time zone 'Asia/Jakarta')::int`,
        hour: sql<number>`extract(hour from (${learningTelemetryLogs.enteredAt} at time zone 'UTC') at time zone 'Asia/Jakarta')::int`,
        dwell: sql<number>`coalesce(sum(${learningTelemetryLogs.durationSeconds}), 0)::int`,
      })
      .from(learningTelemetryLogs)
      .where(eq(learningTelemetryLogs.courseId, courseId))
      .groupBy(
        sql`extract(dow from (${learningTelemetryLogs.enteredAt} at time zone 'UTC') at time zone 'Asia/Jakarta')`,
        sql`extract(hour from (${learningTelemetryLogs.enteredAt} at time zone 'UTC') at time zone 'Asia/Jakarta')`
      ),
    db
      .select({
        day: sql<string>`to_char(((${learningTelemetryLogs.createdAt} at time zone 'UTC') at time zone 'Asia/Jakarta')::date, 'YYYY-MM-DD')`,
        dwell: sql<number>`coalesce(sum(${learningTelemetryLogs.durationSeconds}), 0)::int`,
        learners: sql<number>`count(distinct ${learningTelemetryLogs.userId})::int`,
      })
      .from(learningTelemetryLogs)
      .where(eq(learningTelemetryLogs.courseId, courseId))
      .groupBy(sql`((${learningTelemetryLogs.createdAt} at time zone 'UTC') at time zone 'Asia/Jakarta')::date`),
  ])

  // 7x24 day-major Monday-first, all zeros to start.
  const heatmap = new Array<number>(7 * 24).fill(0)
  for (const cell of byCell) {
    const dayIdx = (cell.dow + 6) % 7
    const index = dayIdx * 24 + cell.hour
    heatmap[index] = (heatmap[index] ?? 0) + cell.dwell
  }

  // 30-day series oldest-first, zero-filled so the chart axis is
  // continuous; days with no logs are simply absent from byDay.
  const dwellByDay = new Map<string, number>(byDay.map((d) => [d.day, d.dwell]))
  const learnersByDay = new Map<string, number>(byDay.map((d) => [d.day, d.learners]))
  const trend30d: TelemetryDailyPoint[] = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000)
    // Date in WIB regardless of the server's own timezone: shift by the
    // zone's fixed +07:00 offset (WIB has no DST).
    const wib = new Date(d.getTime() + 7 * 3_600_000)
    const key = wib.toISOString().slice(0, 10)
    trend30d.push({
      date: key,
      dwellSeconds: dwellByDay.get(key) ?? 0,
      activeLearners: learnersByDay.get(key) ?? 0,
    })
  }

  const accounts = byUser.length
    ? await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(sql`${users.id} in ${byUser.map((u) => u.userId)}`)
    : []
  const accountById = new Map(accounts.map((a) => [a.id, a]))

  const sortedTotals = byUser.map((u) => u.totalDwell).sort((a, b) => a - b)
  const median = sortedTotals.length
    ? sortedTotals.length % 2 === 1
      ? sortedTotals[(sortedTotals.length - 1) / 2]!
      : Math.round((sortedTotals[sortedTotals.length / 2 - 1]! + sortedTotals[sortedTotals.length / 2]!) / 2)
    : 0

  return {
    courseId,
    totalDwellSeconds: sortedTotals.reduce((sum, v) => sum + v, 0),
    medianParticipantDwellSeconds: median,
    activeParticipants: byUser.length,
    heatmapDwellSeconds: heatmap,
    trend30d,
    byParticipant: byUser
      .map((u) => ({
        user: {
          id: u.userId,
          name: accountById.get(u.userId)?.name ?? u.userId,
          email: accountById.get(u.userId)?.email ?? "",
        },
        totalDwellSeconds: u.totalDwell,
        events: u.events,
        lastActiveAt: u.lastActiveAt ? new Date(u.lastActiveAt).toISOString() : undefined,
      }))
      .sort((a, b) => b.totalDwellSeconds - a.totalDwellSeconds),
  }
}
