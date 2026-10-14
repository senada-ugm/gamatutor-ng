import type {
  AssignmentCreate,
  AssignmentGrade,
  AssignmentSubmissionCreate,
  AssignmentUpdate,
} from "@workspace/contracts"
import {
  zAssignmentCreate,
  zAssignmentGrade,
  zAssignmentSubmissionCreate,
  zAssignmentUpdate,
} from "@workspace/contracts/zod"
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import {
  assertCanAccessCourse,
  assertCanManageCourse,
  assertIsEnrolledParticipant,
} from "../../../lib/course-access.js"
import { notifyUserById } from "../../../lib/notify.js"

import { requireSession } from "../../../lib/require-session.js"
import { dataResponse, paginate } from "../../../lib/response.js"
import { validateBody } from "../../../lib/validation.js"
import * as service from "../services/assignments.service.js"

const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
})

type ActingUser = { id: string; role?: string | null; email?: string | null }

async function canManage(user: ActingUser, courseId: string): Promise<boolean> {
  try {
    await assertCanManageCourse(user, courseId)
    return true
  } catch {
    return false
  }
}

export function assignmentsRoutes(app: FastifyInstance) {
  app.get<{ Params: { courseId: string } }>("/courses/:courseId/assignments", async (request) => {
    const user = await requireSession(request)
    await assertCanAccessCourse(user, request.params.courseId)
    const query = pageQuerySchema.parse(request.query)
    const items = await service.listAssignments(request.params.courseId)
    return paginate(items, request.id, { page: query.page, pageSize: query.pageSize })
  })

  app.post<{ Params: { courseId: string }; Body: AssignmentCreate }>(
    "/courses/:courseId/assignments",
    { preValidation: [validateBody(zAssignmentCreate)] },
    async (request, reply) => {
      const user = await requireSession(request)
      await assertCanManageCourse(user, request.params.courseId)
      const created = await service.createAssignment(request.params.courseId, request.body)
      reply.status(201)
      return dataResponse(created, request.id)
    }
  )

  app.get<{ Params: { id: string } }>("/assignments/:id", async (request) => {
    const user = await requireSession(request)
    const row = await service.getAssignmentRow(request.params.id)
    await assertCanAccessCourse(user, row.courseId)
    return dataResponse(await service.getAssignment(request.params.id), request.id)
  })

  app.patch<{ Params: { id: string }; Body: AssignmentUpdate }>(
    "/assignments/:id",
    { preValidation: [validateBody(zAssignmentUpdate)] },
    async (request) => {
      const user = await requireSession(request)
      const row = await service.getAssignmentRow(request.params.id)
      await assertCanManageCourse(user, row.courseId)
      return dataResponse(await service.updateAssignment(request.params.id, request.body), request.id)
    }
  )

  app.delete<{ Params: { id: string } }>("/assignments/:id", async (request, reply) => {
    const user = await requireSession(request)
    const row = await service.getAssignmentRow(request.params.id)
    await assertCanManageCourse(user, row.courseId)
    await service.deleteAssignment(request.params.id)
    reply.status(204)
    return null
  })

  app.get<{ Params: { assignmentId: string } }>("/assignments/:assignmentId/submissions", async (request) => {
    const user = await requireSession(request)
    const assignment = await service.getAssignmentRow(request.params.assignmentId)
    const query = pageQuerySchema.parse(request.query)
    const manages = await canManage(user, assignment.courseId)
    const items = manages
      ? await service.listSubmissionsForManager(request.params.assignmentId)
      : await service.listOwnSubmission(request.params.assignmentId, user.id)
    return paginate(items, request.id, { page: query.page, pageSize: query.pageSize })
  })

  app.post<{ Params: { assignmentId: string }; Body: AssignmentSubmissionCreate }>(
    "/assignments/:assignmentId/submissions",
    { preValidation: [validateBody(zAssignmentSubmissionCreate)] },
    async (request, reply) => {
      const user = await requireSession(request)
      const assignment = await service.getAssignmentRow(request.params.assignmentId)
      await assertIsEnrolledParticipant(user, assignment.courseId)
      const created = await service.submitAssignment(request.params.assignmentId, user.id, request.body)
      reply.status(201)
      return dataResponse(created, request.id)
    }
  )

  app.get<{ Params: { id: string } }>("/assignment-submissions/:id", async (request) => {
    const user = await requireSession(request)
    const row = await service.getSubmissionRow(request.params.id)
    if (row.userId !== user.id) {
      const assignment = await service.getAssignmentRow(row.assignmentId)
      await assertCanManageCourse(user, assignment.courseId)
    }
    return dataResponse(await service.getSubmission(request.params.id), request.id)
  })

  app.post<{ Params: { id: string }; Body: AssignmentGrade }>(
    "/assignment-submissions/:id/grade",
    { preValidation: [validateBody(zAssignmentGrade)] },
    async (request) => {
      const user = await requireSession(request)
      const row = await service.getSubmissionRow(request.params.id)
      const assignment = await service.getAssignmentRow(row.assignmentId)
      await assertCanManageCourse(user, assignment.courseId)
      const graded = await service.gradeSubmission(request.params.id, request.body)
      await notifyUserById(row.userId, {
        type: "assignment_graded",
        title: `Tugas "${assignment.title}" telah dinilai`,
        body: `Nilai akhir: ${graded.score ?? "-"}. ${request.body.feedback ?? ""}`.trim(),
        link: `/learn/${assignment.courseId}/assignments`,
      })
      return dataResponse(graded, request.id)
    }
  )

  app.post<{ Params: { id: string } }>("/assignment-submissions/:id/return", async (request) => {
    const user = await requireSession(request)
    const row = await service.getSubmissionRow(request.params.id)
    const assignment = await service.getAssignmentRow(row.assignmentId)
    await assertCanManageCourse(user, assignment.courseId)
    return dataResponse(await service.reopenSubmission(request.params.id), request.id)
  })
}
