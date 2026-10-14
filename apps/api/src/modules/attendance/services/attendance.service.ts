import type {
  AttendanceCheckIn,
  AttendanceRecord,
  AttendanceRecordManualUpdate,
  AttendanceSession,
  AttendanceSessionActivate,
  AttendanceSessionCreate,
  AttendanceSessionUpdate,
  EnrolledStudentAttendance,
} from "@workspace/contracts"
import { randomBytes, randomInt } from "node:crypto"
import { and, eq, inArray } from "drizzle-orm"
import { db } from "../../../db/index.js"
import { attendanceRecords, attendanceSessions, enrollments } from "../../../db/app-schema.js"
import { users as userTable } from "../../../db/auth-schema.js"
import { env } from "../../../env.js"
import { BadRequestError, ForbiddenError, NotFoundError } from "../../../lib/errors.js"
import { generateId } from "../../../lib/response.js"

/** Numeric-code TTL: generous by default (typing takes time; the per-user
 *  5-fail lockout plus the 6-digit space handles guessing), env-overridable
 *  for stricter rotation. QR TTL stays short — scanning is instant, and a
 *  stale QR failing IS the proximity proof working. */
const CODE_EXPIRY_SECONDS = env.ATTENDANCE_CODE_EXPIRY_SECONDS
const QR_EXPIRY_SECONDS = 20
const DEFAULT_RADIUS_METERS = 100

/** crypto-grade randomness — Math.random() is predictable after a few
 *  observed outputs, and these guard check-ins. */
function randomCode(): string {
  return String(randomInt(100000, 1000000))
}

function randomToken(): string {
  return `qr_${randomBytes(16).toString("hex")}`
}

/** Great-circle distance in meters (haversine). */
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const toRad = (v: number) => (v * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function toSession(row: typeof attendanceSessions.$inferSelect, includePrivate: boolean): AttendanceSession {
  return {
    id: row.id,
    courseId: row.courseId,
    title: row.title,
    sessionDate: row.sessionDate.toISOString(),
    startTime: row.startTime ?? undefined,
    endTime: row.endTime ?? undefined,
    sessionStatus: row.sessionStatus as AttendanceSession["sessionStatus"],
    verificationMethod: row.verificationMethod as AttendanceSession["verificationMethod"],
    codeExpirySeconds: row.codeExpirySeconds ?? undefined,
    verificationCode: includePrivate ? (row.verificationCode ?? undefined) : undefined,
    qrToken: includePrivate ? (row.qrToken ?? undefined) : undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    radiusMeters: row.radiusMeters,
    lateThresholdMinutes: row.lateThresholdMinutes,
    notes: row.notes ?? undefined,
  }
}

function toRecord(row: typeof attendanceRecords.$inferSelect): AttendanceRecord {
  return {
    id: row.id,
    sessionId: row.sessionId,
    userId: row.userId,
    status: row.status as AttendanceRecord["status"],
    checkedInAt: row.checkedInAt?.toISOString(),
    checkedInMethod: (row.checkedInMethod as AttendanceRecord["checkedInMethod"]) ?? undefined,
    excuseReason: row.excuseReason ?? undefined,
  }
}

export async function listSessions(courseId: string, includePrivate: boolean): Promise<AttendanceSession[]> {
  const rows = await db.select().from(attendanceSessions).where(eq(attendanceSessions.courseId, courseId))
  return rows.map((r) => toSession(r, includePrivate))
}

async function getSessionRow(id: string) {
  const [row] = await db.select().from(attendanceSessions).where(eq(attendanceSessions.id, id)).limit(1)
  if (!row) throw new NotFoundError("AttendanceSession", id)
  return row
}

export async function getSessionCourseId(id: string): Promise<string> {
  return (await getSessionRow(id)).courseId
}

export async function getSession(id: string, includePrivate: boolean): Promise<AttendanceSession> {
  return toSession(await getSessionRow(id), includePrivate)
}

export async function createSession(courseId: string, input: AttendanceSessionCreate): Promise<AttendanceSession> {
  const [row] = await db
    .insert(attendanceSessions)
    .values({
      id: generateId("ats"),
      courseId,
      title: input.title,
      sessionDate: new Date(input.sessionDate),
      startTime: input.startTime,
      endTime: input.endTime,
      lateThresholdMinutes: input.lateThresholdMinutes ?? 15,
    })
    .returning()
  return toSession(row!, true)
}

export async function updateSession(id: string, input: AttendanceSessionUpdate): Promise<AttendanceSession> {
  const [row] = await db
    .update(attendanceSessions)
    .set({
      title: input.title,
      sessionStatus: input.sessionStatus,
      startTime: input.startTime,
      endTime: input.endTime,
      lateThresholdMinutes: input.lateThresholdMinutes,
      notes: input.notes,
    })
    .where(eq(attendanceSessions.id, id))
    .returning()
  if (!row) throw new NotFoundError("AttendanceSession", id)
  return toSession(row, true)
}

export async function activateSession(id: string, input: AttendanceSessionActivate): Promise<AttendanceSession> {
  await getSessionRow(id)
  const now = new Date()
  const [row] = await db
    .update(attendanceSessions)
    .set({
      sessionStatus: "active",
      verificationMethod: input.verificationMethod,
      verificationCode: input.verificationMethod === "code" ? randomCode() : null,
      codeGeneratedAt: input.verificationMethod === "code" ? now : null,
      codeExpirySeconds: input.verificationMethod === "code" ? CODE_EXPIRY_SECONDS : null,
      qrToken: input.verificationMethod === "qr" ? randomToken() : null,
      qrTokenExpiresAt: input.verificationMethod === "qr" ? new Date(now.getTime() + QR_EXPIRY_SECONDS * 1000) : null,
      latitude: input.latitude,
      longitude: input.longitude,
      radiusMeters: input.latitude !== undefined ? (input.radiusMeters ?? DEFAULT_RADIUS_METERS) : undefined,
    })
    .where(eq(attendanceSessions.id, id))
    .returning()
  return toSession(row!, true)
}

export async function getRoster(sessionId: string): Promise<EnrolledStudentAttendance[]> {
  const session = await getSessionRow(sessionId)
  const enrolled = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.courseId, session.courseId), inArray(enrollments.status, ["selected", "graduated"])))
  if (enrolled.length === 0) return []

  const userIds = enrolled.map((e) => e.userId)
  const accounts = await db.select().from(userTable).where(inArray(userTable.id, userIds))
  const accountById = new Map(accounts.map((a) => [a.id, a]))

  const records = await db
    .select()
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.sessionId, sessionId), inArray(attendanceRecords.userId, userIds)))
  const recordByUserId = new Map(records.map((r) => [r.userId, r]))

  return enrolled.map((e) => {
    const account = accountById.get(e.userId)
    const record = recordByUserId.get(e.userId)
    return {
      user: { id: e.userId, name: account?.name ?? e.userId, email: account?.email ?? "" },
      record: record ? toRecord(record) : undefined,
    }
  })
}

/** Wall-clock minutes since midnight for an instant, in the business
 *  timezone — session times are authored as local "HH:MM" strings, and
 *  comparing them against the SERVER's timezone (UTC in most containers)
 *  would mark everyone hours late (or always present). */
function wallClockMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: env.BUSINESS_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(instant)
  const [hh, mm] = parts.split(":").map(Number)
  return (hh ?? 0) * 60 + (mm ?? 0)
}

export function computeStatus(session: typeof attendanceSessions.$inferSelect, checkInTime: Date): "present" | "late" {
  if (!session.startTime) return "present"
  const [hh, mm] = session.startTime.split(":").map(Number)
  const sessionStartMinutes = (hh ?? 0) * 60 + (mm ?? 0)
  const checkInMinutes = wallClockMinutes(checkInTime)
  return checkInMinutes > sessionStartMinutes + session.lateThresholdMinutes ? "late" : "present"
}

// Per (sessionId, userId) failed checkIn attempt tracker to prevent code brute-forcing.
// lastAttemptAt lets stale counters be pruned — the map would otherwise
// grow forever on a long-lived process (it is only deleted on success).
const failedAttempts = new Map<string, { count: number; lockedUntil: number; lastAttemptAt: number }>()

const FAILED_ATTEMPT_TTL_MS = 10 * 60 * 1000

function pruneFailedAttempts(now: number) {
  if (failedAttempts.size < 1000) return
  for (const [key, entry] of failedAttempts) {
    if (entry.lockedUntil < now && entry.lastAttemptAt < now - FAILED_ATTEMPT_TTL_MS) {
      failedAttempts.delete(key)
    }
  }
}

export async function checkIn(sessionId: string, userId: string, body: AttendanceCheckIn): Promise<AttendanceRecord> {
  const session = await getSessionRow(sessionId)
  if (session.sessionStatus !== "active") throw new BadRequestError("This session is not currently active")

  const attemptKey = `${sessionId}:${userId}`
  const attemptInfo = failedAttempts.get(attemptKey)
  const now = new Date()
  pruneFailedAttempts(now.getTime())

  if (attemptInfo && attemptInfo.lockedUntil > now.getTime()) {
    const waitSec = Math.ceil((attemptInfo.lockedUntil - now.getTime()) / 1000)
    throw new ForbiddenError(`Too many failed check-in attempts. Please wait ${waitSec} seconds.`)
  }

  if (session.verificationMethod === "code") {
    // The code rotates on activation and expires after codeExpirySeconds —
    // enforce the expiry server-side, not just in the UI: an unexpired
    // check would keep a leaked 6-digit code valid for the whole session.
    const codeExpiryMs = (session.codeExpirySeconds ?? CODE_EXPIRY_SECONDS) * 1000
    const codeExpired = !!session.codeGeneratedAt && now.getTime() - session.codeGeneratedAt.getTime() > codeExpiryMs
    if (codeExpired || !body.code || body.code !== session.verificationCode) {
      const currentCount = (attemptInfo?.count ?? 0) + 1
      if (currentCount >= 5) {
        failedAttempts.set(attemptKey, { count: 0, lockedUntil: now.getTime() + 60_000, lastAttemptAt: now.getTime() })
        throw new ForbiddenError("Too many failed attempts. Check-in locked for 60 seconds.")
      } else {
        failedAttempts.set(attemptKey, { count: currentCount, lockedUntil: 0, lastAttemptAt: now.getTime() })
      }
      throw new ForbiddenError(
        codeExpired
          ? "The verification code has expired — ask the instructor for a new one"
          : "Invalid or expired verification code"
      )
    }
  } else if (session.verificationMethod === "qr") {
    if (
      !body.qrToken ||
      body.qrToken !== session.qrToken ||
      (session.qrTokenExpiresAt && session.qrTokenExpiresAt < now)
    ) {
      throw new ForbiddenError("Invalid or expired QR code")
    }
  }

  // Clear any failed attempts upon successful challenge
  failedAttempts.delete(attemptKey)

  if (session.latitude != null && session.longitude != null) {
    if (body.latitude == null || body.longitude == null) {
      throw new BadRequestError("Your location is required to check in to this session")
    }
    const distance = distanceMeters(session.latitude, session.longitude, body.latitude, body.longitude)
    if (distance > session.radiusMeters) {
      throw new ForbiddenError(`You are too far from the session location (${Math.round(distance)}m away)`)
    }
  }

  const status = computeStatus(session, now)
  const method = session.verificationMethod === "qr" ? "qr" : session.verificationMethod === "code" ? "code" : "manual"

  // onConflictDoNothing against the (sessionId, userId) unique index
  // instead of select-then-insert: a double check-in race previously died
  // on a raw pg unique-violation error instead of returning the record.
  const [inserted] = await db
    .insert(attendanceRecords)
    .values({
      id: generateId("atr"),
      sessionId,
      userId,
      status,
      checkedInAt: now,
      checkedInMethod: method,
      checkedInLatitude: body.latitude,
      checkedInLongitude: body.longitude,
    })
    .onConflictDoNothing()
    .returning()
  if (inserted) return toRecord(inserted)

  const [existing] = await db
    .select()
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.sessionId, sessionId), eq(attendanceRecords.userId, userId)))
    .limit(1)
  return toRecord(existing!)
}

export async function getMyRecord(sessionId: string, userId: string): Promise<AttendanceRecord | null> {
  const [row] = await db
    .select()
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.sessionId, sessionId), eq(attendanceRecords.userId, userId)))
    .limit(1)
  return row ? toRecord(row) : null
}

export async function markRecord(
  sessionId: string,
  userId: string,
  input: AttendanceRecordManualUpdate
): Promise<AttendanceRecord> {
  const [existing] = await db
    .select()
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.sessionId, sessionId), eq(attendanceRecords.userId, userId)))
    .limit(1)

  if (existing) {
    const [row] = await db
      .update(attendanceRecords)
      .set({
        status: input.status,
        excuseReason: input.excuseReason,
        checkedInAt: input.status === "absent" ? null : (existing.checkedInAt ?? new Date()),
        checkedInMethod: existing.checkedInMethod ?? "manual",
      })
      .where(eq(attendanceRecords.id, existing.id))
      .returning()
    return toRecord(row!)
  }

  const [row] = await db
    .insert(attendanceRecords)
    .values({
      id: generateId("atr"),
      sessionId,
      userId,
      status: input.status,
      excuseReason: input.excuseReason,
      checkedInAt: input.status === "absent" ? undefined : new Date(),
      checkedInMethod: "manual",
    })
    .returning()
  return toRecord(row!)
}
