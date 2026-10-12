import type { CourseInstructorCreate, CourseInstructorRoleUpdate } from "@workspace/contracts"
import { zCourseInstructorCreate, zCourseInstructorRoleUpdate } from "@workspace/contracts/zod"
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import {
  assertCanManageCourse,
  assertCanManageCourseInstructors,
  assertCanManageInstitution,
} from "../../../lib/course-access.js"

import { requireSession } from "../../../lib/require-session.js"
import { dataResponse, paginate } from "../../../lib/response.js"
import { validateBody } from "../../../lib/validation.js"
import * as service from "../services/course-instructors.service.js"

const listQuerySchema = z.object({
  courseId: z.string(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
})

const mineQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(100),
})

const rosterQuerySchema = z.object({
  institutionId: z.string(),
  excludeCourseId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
})

export function courseInstructorsRoutes(app: FastifyInstance) {
  // Both list endpoints expose instructor names + emails — personnel
  // data, not public directory material. The per-course roster is
  // visible to that course's managers (co-instructors coordinating);
  // the cross-course institution roster is owner/admin only, since it
  // enumerates every instructor in the institution at once.
  app.get("/course-instructors", async (request) => {
    const user = await requireSession(request)
    const query = listQuerySchema.parse(request.query)
    await assertCanManageCourse(user, query.courseId)
    const items = await service.listCourseInstructors(query.courseId)
    return paginate(items, request.id, { page: query.page, pageSize: query.pageSize })
  })

  app.get("/course-instructors/mine", async (request) => {
    const user = await requireSession(request)
    const query = mineQuerySchema.parse(request.query)
    const items = await service.listMyAssignments(user)
    const start = (query.page - 1) * query.pageSize
    return paginate(items.slice(start, start + query.pageSize), request.id, {
      page: query.page,
      pageSize: query.pageSize,
    })
  })

  app.get("/course-instructors/institution-roster", async (request) => {
    const user = await requireSession(request)
    const query = rosterQuerySchema.parse(request.query)
    await assertCanManageInstitution(user, query.institutionId)
    const items = await service.getInstitutionInstructorRoster(query.institutionId, query.excludeCourseId)
    return paginate(items, request.id, { page: query.page, pageSize: query.pageSize })
  })

  app.post<{ Body: CourseInstructorCreate }>(
    "/course-instructors",
    { preValidation: [validateBody(zCourseInstructorCreate)] },
    async (request, reply) => {
      const user = await requireSession(request)
      await assertCanManageCourseInstructors(user, request.body.courseId)
      const created = await service.createCourseInstructor(request.body)
      reply.status(201)
      return dataResponse(created, request.id)
    }
  )

  app.patch<{ Params: { id: string }; Body: CourseInstructorRoleUpdate }>(
    "/course-instructors/:id/role",
    { preValidation: [validateBody(zCourseInstructorRoleUpdate)] },
    async (request) => {
      const user = await requireSession(request)
      const courseId = await service.getCourseInstructorCourseId(request.params.id)
      await assertCanManageCourseInstructors(user, courseId)
      return dataResponse(await service.updateCourseInstructorRole(request.params.id, request.body), request.id)
    }
  )

  app.delete<{ Params: { id: string } }>("/course-instructors/:id", async (request, reply) => {
    const user = await requireSession(request)
    const courseId = await service.getCourseInstructorCourseId(request.params.id)
    await assertCanManageCourseInstructors(user, courseId)
    await service.removeCourseInstructor(request.params.id)
    return reply.status(204).send()
  })
}
