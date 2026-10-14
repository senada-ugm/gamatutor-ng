import type { LessonCreate, LessonUpdate, ModuleCreate, ModuleUpdate } from "@workspace/contracts"
import { zLessonCreate, zLessonUpdate, zModuleCreate, zModuleUpdate } from "@workspace/contracts/zod"
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { assertCanManageCourse, assertIsEnrolledParticipant } from "../../../lib/course-access.js"

import { requireSession } from "../../../lib/require-session.js"
import { dataResponse, paginate } from "../../../lib/response.js"
import { validateBody, validateQuery } from "../../../lib/validation.js"
import * as service from "../services/course-content.service.js"

const lessonProgressQuerySchema = z.object({
  courseId: z.string(),
  userId: z.string(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
})

export function courseContentRoutes(app: FastifyInstance) {
  app.post<{ Params: { courseId: string }; Body: ModuleCreate }>(
    "/courses/:courseId/modules",
    { preValidation: [validateBody(zModuleCreate)] },
    async (request, reply) => {
      const user = await requireSession(request)
      await assertCanManageCourse(user, request.params.courseId)
      const created = await service.createModule(request.params.courseId, request.body)
      reply.status(201)
      return dataResponse(created, request.id)
    }
  )

  app.patch<{ Params: { moduleId: string }; Body: ModuleUpdate }>(
    "/modules/:moduleId",
    { preValidation: [validateBody(zModuleUpdate)] },
    async (request) => {
      const user = await requireSession(request)
      const courseId = await service.getModuleCourseId(request.params.moduleId)
      await assertCanManageCourse(user, courseId)
      return dataResponse(await service.updateModule(request.params.moduleId, request.body), request.id)
    }
  )

  app.delete<{ Params: { moduleId: string } }>("/modules/:moduleId", async (request, reply) => {
    const user = await requireSession(request)
    const courseId = await service.getModuleCourseId(request.params.moduleId)
    await assertCanManageCourse(user, courseId)
    await service.deleteModule(request.params.moduleId)
    return reply.status(204).send()
  })

  app.post<{ Params: { moduleId: string }; Body: LessonCreate }>(
    "/modules/:moduleId/lessons",
    { preValidation: [validateBody(zLessonCreate)] },
    async (request, reply) => {
      const user = await requireSession(request)
      const courseId = await service.getModuleCourseId(request.params.moduleId)
      await assertCanManageCourse(user, courseId)
      const created = await service.createLesson(request.params.moduleId, request.body)
      reply.status(201)
      return dataResponse(created, request.id)
    }
  )

  app.patch<{ Params: { lessonId: string }; Body: LessonUpdate }>(
    "/lessons/:lessonId",
    { preValidation: [validateBody(zLessonUpdate)] },
    async (request) => {
      const user = await requireSession(request)
      const courseId = await service.getLessonCourseId(request.params.lessonId)
      await assertCanManageCourse(user, courseId)
      return dataResponse(await service.updateLesson(request.params.lessonId, request.body), request.id)
    }
  )

  app.delete<{ Params: { lessonId: string } }>("/lessons/:lessonId", async (request, reply) => {
    const user = await requireSession(request)
    const courseId = await service.getLessonCourseId(request.params.lessonId)
    await assertCanManageCourse(user, courseId)
    await service.deleteLesson(request.params.lessonId)
    return reply.status(204).send()
  })

  app.get("/lesson-progress", async (request) => {
    const user = await requireSession(request)
    const query = lessonProgressQuerySchema.parse(request.query)
    // Progress is per-user private: read your own, or manage the course
    // to read a participant's — never pass an arbitrary userId.
    if (query.userId !== user.id) {
      await assertCanManageCourse(user, query.courseId)
    }
    const items = await service.listLessonProgress(query.courseId, query.userId)
    return paginate(items, request.id, { page: query.page, pageSize: query.pageSize })
  })

  app.post<{ Params: { lessonId: string }; Querystring: { courseId: string } }>(
    "/lesson-progress/:lessonId/complete",
    { preValidation: [validateQuery(z.object({ courseId: z.string().min(1) }))] },
    async (request) => {
      const user = await requireSession(request)
      const courseId = request.query.courseId
      await assertIsEnrolledParticipant(user, courseId)
      return dataResponse(await service.completeLesson(user.id, request.params.lessonId, courseId), request.id)
    }
  )

  app.delete<{ Params: { lessonId: string } }>("/lesson-progress/:lessonId/complete", async (request, reply) => {
    const user = await requireSession(request)
    await service.uncompleteLesson(user.id, request.params.lessonId)
    return reply.status(204).send()
  })
}
