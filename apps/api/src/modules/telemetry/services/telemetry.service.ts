import { eq, desc } from "drizzle-orm"
import { db } from "../../../db/index.js"
import { learningTelemetryLogs, participantProfiles } from "../../../db/app-schema.js"
import { users } from "../../../db/auth-schema.js"
import { generateId } from "../../../lib/response.js"
import type { TelemetryEvent, TelemetryEventCreate } from "@workspace/contracts"

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
