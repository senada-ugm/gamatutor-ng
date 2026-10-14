import type {
  AttendanceCheckIn,
  AttendanceRecordManualUpdate,
  AttendanceSessionActivate,
  AttendanceSessionCreate,
  AttendanceSessionUpdate,
} from "@workspace/contracts"
import {
  zAttendanceCheckIn,
  zAttendanceRecordManualUpdate,
  zAttendanceSessionActivate,
  zAttendanceSessionCreate,
  zAttendanceSessionUpdate,
} from "@workspace/contracts/zod"
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import {
  assertCanAccessCourse,
  assertCanManageCourse,
  assertIsEnrolledParticipant,
} from "../../../lib/course-access.js"

import { requireSession } from "../../../lib/require-session.js"
import { dataResponse, paginate } from "../../../lib/response.js"
import { validateBody } from "../../../lib/validation.js"
import * as service from "../services/attendance.service.js"

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(100),
})

/** Whether the caller manages the given course - used to decide if a
 *  session's private verification fields (code/qrToken) are included. */
async function canManage(user: Awaited<ReturnType<typeof requireSession>>, courseId: string): Promise<boolean> {
  try {
    await assertCanManageCourse(user, courseId)
    return true
  } catch {
    return false
  }
}

export function attendanceRoutes(app: FastifyInstance) {
  app.get<{ Params: { courseId: string } }>("/courses/:courseId/attendance-sessions", async (request) => {
    const user = await requireSession(request)
    await assertCanAccessCourse(user, request.params.courseId)
    const query = listQuerySchema.parse(request.query)
    const includePrivate = await canManage(user, request.params.courseId)
    const items = await service.listSessions(request.params.courseId, includePrivate)
    return paginate(items, request.id, { page: query.page, pageSize: query.pageSize })
  })

  app.post<{ Params: { courseId: string }; Body: AttendanceSessionCreate }>(
    "/courses/:courseId/attendance-sessions",
    { preValidation: [validateBody(zAttendanceSessionCreate)] },
    async (request, reply) => {
      const user = await requireSession(request)
      await assertCanManageCourse(user, request.params.courseId)
      const created = await service.createSession(request.params.courseId, request.body)
      reply.status(201)
      return dataResponse(created, request.id)
    }
  )

  app.get<{ Params: { id: string } }>("/attendance-sessions/:id", async (request) => {
    const user = await requireSession(request)
    const courseId = await service.getSessionCourseId(request.params.id)
    await assertCanAccessCourse(user, courseId)
    const includePrivate = await canManage(user, courseId)
    return dataResponse(await service.getSession(request.params.id, includePrivate), request.id)
  })

  app.patch<{ Params: { id: string }; Body: AttendanceSessionUpdate }>(
    "/attendance-sessions/:id",
    { preValidation: [validateBody(zAttendanceSessionUpdate)] },
    async (request) => {
      const user = await requireSession(request)
      const courseId = await service.getSessionCourseId(request.params.id)
      await assertCanManageCourse(user, courseId)
      return dataResponse(await service.updateSession(request.params.id, request.body), request.id)
    }
  )

  app.post<{ Params: { id: string }; Body: AttendanceSessionActivate }>(
    "/attendance-sessions/:id/activate",
    { preValidation: [validateBody(zAttendanceSessionActivate)] },
    async (request) => {
      const user = await requireSession(request)
      const courseId = await service.getSessionCourseId(request.params.id)
      await assertCanManageCourse(user, courseId)
      return dataResponse(await service.activateSession(request.params.id, request.body), request.id)
    }
  )

  app.get<{ Params: { id: string } }>("/attendance-sessions/:id/roster", async (request) => {
    const user = await requireSession(request)
    const courseId = await service.getSessionCourseId(request.params.id)
    await assertCanManageCourse(user, courseId)
    return dataResponse(await service.getRoster(request.params.id), request.id)
  })

  app.get<{ Params: { id: string } }>("/attendance-sessions/:id/my-record", async (request) => {
    const user = await requireSession(request)
    return dataResponse(await service.getMyRecord(request.params.id, user.id), request.id)
  })

  app.post<{ Params: { id: string }; Body: AttendanceCheckIn }>(
    "/attendance-sessions/:id/check-in",
    { preValidation: [validateBody(zAttendanceCheckIn)] },
    async (request) => {
      const user = await requireSession(request)
      const courseId = await service.getSessionCourseId(request.params.id)
      await assertIsEnrolledParticipant(user, courseId)
      return dataResponse(await service.checkIn(request.params.id, user.id, request.body), request.id)
    }
  )

  app.patch<{ Params: { id: string; userId: string }; Body: AttendanceRecordManualUpdate }>(
    "/attendance-sessions/:id/records/:userId",
    { preValidation: [validateBody(zAttendanceRecordManualUpdate)] },
    async (request) => {
      const user = await requireSession(request)
      const courseId = await service.getSessionCourseId(request.params.id)
      await assertCanManageCourse(user, courseId)
      return dataResponse(await service.markRecord(request.params.id, request.params.userId, request.body), request.id)
    }
  )
}
