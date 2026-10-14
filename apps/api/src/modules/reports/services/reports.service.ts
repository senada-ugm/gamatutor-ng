import type { AttendanceSummary, CourseReport, CourseReportParticipant, InstitutionReport } from "@workspace/contracts"
import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { db } from "../../../db/index.js"
import {
  attendanceRecords,
  attendanceSessions,
  courseLessons,
  courseModules,
  courses,
  enrollments,
  institutions,
  lessonProgress,
} from "../../../db/app-schema.js"
import { users as userTable } from "../../../db/auth-schema.js"
import { NotFoundError } from "../../../lib/errors.js"

/**
 * Read-only aggregates — batched grouped queries (no per-participant
 * N+1), the same pattern as enrollments.service.ts's loadLessonStats.
 */

export async function getCourseReport(courseId: string): Promise<CourseReport> {
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1)
  if (!course) throw new NotFoundError("Course", courseId)

  // Denominators.
  const [moduleRows, sessionCountRow] = await Promise.all([
    db.select({ id: courseModules.id }).from(courseModules).where(eq(courseModules.courseId, courseId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(attendanceSessions)
      .where(eq(attendanceSessions.courseId, courseId)),
  ])
  const moduleIds = moduleRows.map((m) => m.id)
  const [lessonCountRow] = moduleIds.length
    ? await db
        .select({ count: sql<number>`count(*)::int` })
        .from(courseLessons)
        .where(inArray(courseLessons.moduleId, moduleIds))
    : [{ count: 0 }]
  const totalLessons = lessonCountRow?.count ?? 0
  const totalSessions = sessionCountRow[0]?.count ?? 0

  // Participants (selected/graduated — the funnel's participant set).
  const enrollmentRows = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.courseId, courseId), inArray(enrollments.status, ["selected", "graduated"])))
  const [registrantCountRow] = await db
    .select({
      count: sql<number>`count(*) filter (where ${enrollments.status} <> 'canceled' and ${enrollments.status} <> 'failed')::int`,
    })
    .from(enrollments)
    .where(eq(enrollments.courseId, courseId))

  if (enrollmentRows.length === 0) {
    return {
      courseId,
      title: course.title,
      registrantCount: registrantCountRow?.count ?? 0,
      participantCount: 0,
      totalLessons,
      totalSessions,
      participants: [],
    }
  }

  const userIds = enrollmentRows.map((e) => e.userId)
  const [accounts, progressRows, attendanceRows] = await Promise.all([
    db.select().from(userTable).where(inArray(userTable.id, userIds)),
    db
      .select({ userId: lessonProgress.userId, count: sql<number>`count(*)::int` })
      .from(lessonProgress)
      .where(and(inArray(lessonProgress.userId, userIds), eq(lessonProgress.courseId, courseId)))
      .groupBy(lessonProgress.userId),
    totalSessions > 0
      ? db
          .select({
            userId: attendanceRecords.userId,
            status: attendanceRecords.status,
            count: sql<number>`count(*)::int`,
          })
          .from(attendanceRecords)
          .innerJoin(attendanceSessions, eq(attendanceSessions.id, attendanceRecords.sessionId))
          .where(and(eq(attendanceSessions.courseId, courseId), inArray(attendanceRecords.userId, userIds)))
          .groupBy(attendanceRecords.userId, attendanceRecords.status)
      : Promise.resolve([] as { userId: string; status: string; count: number }[]),
  ])

  const accountById = new Map(accounts.map((a) => [a.id, a]))
  const completedByUser = new Map(progressRows.map((p) => [p.userId, p.count]))
  const attendanceByUser = new Map<string, { present: number; late: number; absent: number }>()
  for (const row of attendanceRows) {
    const bucket = attendanceByUser.get(row.userId) ?? { present: 0, late: 0, absent: 0 }
    if (row.status === "present") bucket.present += row.count
    else if (row.status === "late") bucket.late += row.count
    else if (row.status === "absent") bucket.absent += row.count
    attendanceByUser.set(row.userId, bucket)
  }

  const participants: CourseReportParticipant[] = enrollmentRows.map((e) => {
    const account = accountById.get(e.userId)
    const completedLessons = completedByUser.get(e.userId) ?? 0
    const bucket = attendanceByUser.get(e.userId) ?? { present: 0, late: 0, absent: 0 }
    const attended = bucket.present + bucket.late
    const summary: AttendanceSummary = {
      ...bucket,
      sessionsCount: totalSessions,
      attendancePercent: totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0,
    }
    return {
      user: { id: e.userId, name: account?.name ?? e.userId, email: account?.email ?? "" },
      enrollmentStatus: e.status as CourseReportParticipant["enrollmentStatus"],
      progressPercent: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
      completedLessons,
      attendance: summary,
      finalGrade: e.finalGrade ?? undefined,
      certificateId: e.certificateId ?? undefined,
    }
  })

  return {
    courseId,
    title: course.title,
    registrantCount: registrantCountRow?.count ?? 0,
    participantCount: participants.length,
    totalLessons,
    totalSessions,
    participants,
  }
}

/** Admin dashboard aggregates: platform totals, participant funnel
 *  split, and 30-day growth — plain COUNTs, one round trip each. */
export async function getAdminOverview(): Promise<{
  totalUsers: number
  totalInstitutions: number
  totalCourses: number
  totalEnrollments: number
  activeParticipants: number
  graduatedParticipants: number
  completionRate: number
  growth30d: { newUsers: number; newCourses: number; newEnrollments: number; newInstitutions: number }
}> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const [userTableCounts, institutionCounts, courseCounts, enrollmentCounts, growth] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        recent: sql<number>`count(*) filter (where ${userTable.createdAt} >= ${cutoff})::int`,
      })
      .from(userTable),
    db
      .select({
        total: sql<number>`count(*)::int`,
        recent: sql<number>`count(*) filter (where ${institutions.createdAt} >= ${cutoff})::int`,
      })
      .from(institutions),
    db
      .select({
        total: sql<number>`count(*)::int`,
        recent: sql<number>`count(*) filter (where ${courses.createdAt} >= ${cutoff})::int`,
      })
      .from(courses),
    db
      .select({
        total: sql<number>`count(*)::int`,
        recent: sql<number>`count(*) filter (where ${enrollments.enrolledAt} >= ${cutoff})::int`,
        active: sql<number>`count(*) filter (where ${enrollments.status} = 'selected')::int`,
        graduated: sql<number>`count(*) filter (where ${enrollments.status} = 'graduated')::int`,
      })
      .from(enrollments),
    Promise.resolve(null),
  ])

  const active = enrollmentCounts[0]?.active ?? 0
  const graduated = enrollmentCounts[0]?.graduated ?? 0
  const participantBase = active + graduated
  return {
    totalUsers: userTableCounts[0]?.total ?? 0,
    totalInstitutions: institutionCounts[0]?.total ?? 0,
    totalCourses: courseCounts[0]?.total ?? 0,
    totalEnrollments: enrollmentCounts[0]?.total ?? 0,
    activeParticipants: active,
    graduatedParticipants: graduated,
    completionRate: participantBase > 0 ? Math.round((graduated / participantBase) * 100) : 0,
    growth30d: {
      newUsers: userTableCounts[0]?.recent ?? 0,
      newCourses: courseCounts[0]?.recent ?? 0,
      newEnrollments: enrollmentCounts[0]?.recent ?? 0,
      newInstitutions: institutionCounts[0]?.recent ?? 0,
    },
  }
}

/** One institution's funnel, broken down by course. Grouped queries
 *  over the institution's course ids rather than one pass per course —
 *  same batching discipline as getCourseReport. */
export async function getInstitutionReport(institutionId: string): Promise<InstitutionReport> {
  const [institution] = await db.select().from(institutions).where(eq(institutions.id, institutionId)).limit(1)
  if (!institution) throw new NotFoundError("Institution", institutionId)

  const courseRows = await db
    .select({ id: courses.id, title: courses.title, status: courses.status })
    .from(courses)
    .where(eq(courses.institutionId, institutionId))
    .orderBy(courses.title)
  const courseIds = courseRows.map((c) => c.id)

  const empty: InstitutionReport = {
    institutionId,
    name: institution.name,
    courseCount: courseRows.length,
    publishedCourseCount: courseRows.filter((c) => c.status === "published").length,
    registrantCount: 0,
    participantCount: 0,
    graduatedCount: 0,
    completionRate: 0,
    byCourse: courseRows.map((c) => ({
      courseId: c.id,
      title: c.title,
      status: c.status as InstitutionReport["byCourse"][number]["status"],
      registrantCount: 0,
      participantCount: 0,
      graduatedCount: 0,
    })),
  }
  if (courseIds.length === 0) return empty

  const enrollmentRows = await db
    .select({
      courseId: enrollments.courseId,
      registrants: sql<number>`count(*) filter (where ${enrollments.status} <> 'canceled' and ${enrollments.status} <> 'failed')::int`,
      participants: sql<number>`count(*) filter (where ${enrollments.status} = 'selected' or ${enrollments.status} = 'graduated')::int`,
      graduated: sql<number>`count(*) filter (where ${enrollments.status} = 'graduated')::int`,
    })
    .from(enrollments)
    .where(inArray(enrollments.courseId, courseIds))
    .groupBy(enrollments.courseId)

  const enrollmentByCourse = new Map(enrollmentRows.map((r) => [r.courseId, r]))

  const byCourse = courseRows.map((c) => {
    const e = enrollmentByCourse.get(c.id)
    return {
      courseId: c.id,
      title: c.title,
      status: c.status as InstitutionReport["byCourse"][number]["status"],
      registrantCount: e?.registrants ?? 0,
      participantCount: e?.participants ?? 0,
      graduatedCount: e?.graduated ?? 0,
    }
  })

  const participantCount = byCourse.reduce((sum, c) => sum + c.participantCount, 0)
  const graduatedCount = byCourse.reduce((sum, c) => sum + c.graduatedCount, 0)

  return {
    ...empty,
    registrantCount: byCourse.reduce((sum, c) => sum + c.registrantCount, 0),
    participantCount,
    graduatedCount,
    // participantCount already counts graduated rows, so it is the
    // denominator outright — not participants + graduated.
    completionRate: participantCount > 0 ? Math.round((graduatedCount / participantCount) * 100) : 0,
    byCourse,
  }
}

/** CSV rows for a course's participant table — served by the operational
 *  export route (text/csv), same data as getCourseReport. */
export async function getCourseReportCsv(courseId: string): Promise<{ filename: string; csv: string }> {
  const report = await getCourseReport(courseId)
  const escape = (value: string | number | undefined | null) => {
    const s = value == null ? "" : String(value)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = [
    "Nama",
    "Email",
    "Status",
    "Progress (%)",
    "Lessons Selesai",
    "Hadir",
    "Terlambat",
    "Absen",
    "Kehadiran (%)",
    "Nilai Akhir",
    "Sertifikat",
  ]
  const lines = [header.join(",")]
  for (const p of report.participants) {
    lines.push(
      [
        escape(p.user.name),
        escape(p.user.email),
        p.enrollmentStatus,
        p.progressPercent,
        p.completedLessons,
        p.attendance.present,
        p.attendance.late,
        p.attendance.absent,
        p.attendance.attendancePercent,
        p.finalGrade ?? "",
        p.certificateId ?? "",
      ].join(",")
    )
  }
  const slug = report.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return { filename: `peserta-${slug || courseId}.csv`, csv: lines.join("\n") }
}
