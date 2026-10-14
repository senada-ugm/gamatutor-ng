import type {
  QuizAttemptGrade,
  QuizAttemptSubmit,
  QuizCreate,
  QuizQuestionCreate,
  QuizQuestionUpdate,
  QuizUpdate,
} from "@workspace/contracts"
import {
  zQuizAttemptGrade,
  zQuizAttemptSubmit,
  zQuizCreate,
  zQuizQuestionCreate,
  zQuizQuestionUpdate,
  zQuizUpdate,
} from "@workspace/contracts/zod"
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import {
  assertCanAccessCourse,
  assertCanManageCourse,
  assertIsEnrolledParticipant,
} from "../../../lib/course-access.js"

import { requireSession } from "../../../lib/require-session.js"
import { notifyUserById } from "../../../lib/notify.js"
import { dataResponse, paginate } from "../../../lib/response.js"
import { validateBody } from "../../../lib/validation.js"
import * as service from "../services/quizzes.service.js"

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

export function quizzesRoutes(app: FastifyInstance) {
  app.get<{ Params: { courseId: string } }>("/courses/:courseId/quizzes", async (request) => {
    const user = await requireSession(request)
    await assertCanAccessCourse(user, request.params.courseId)
    const query = pageQuerySchema.parse(request.query)
    const items = await service.listQuizzes(request.params.courseId)
    return paginate(items, request.id, { page: query.page, pageSize: query.pageSize })
  })

  app.post<{ Params: { courseId: string }; Body: QuizCreate }>(
    "/courses/:courseId/quizzes",
    { preValidation: [validateBody(zQuizCreate)] },
    async (request, reply) => {
      const user = await requireSession(request)
      await assertCanManageCourse(user, request.params.courseId)
      const created = await service.createQuiz(request.params.courseId, request.body)
      reply.status(201)
      return dataResponse(created, request.id)
    }
  )

  app.get<{ Params: { id: string } }>("/quizzes/:id", async (request) => {
    const user = await requireSession(request)
    const quiz = await service.getQuizRow(request.params.id)
    // Quizzes are visible to course managers and active participants only.
    await assertCanAccessCourse(user, quiz.courseId!)
    const manages = await canManage(user, quiz.courseId!)
    const includeAnswers =
      manages || (quiz.showCorrectAnswers && (await service.hasCompletedAttempt(request.params.id, user.id)))
    return dataResponse(await service.getQuizDetail(request.params.id, includeAnswers), request.id)
  })

  app.patch<{ Params: { id: string }; Body: QuizUpdate }>(
    "/quizzes/:id",
    { preValidation: [validateBody(zQuizUpdate)] },
    async (request) => {
      const user = await requireSession(request)
      const quiz = await service.getQuizRow(request.params.id)
      await assertCanManageCourse(user, quiz.courseId!)
      return dataResponse(await service.updateQuiz(request.params.id, request.body), request.id)
    }
  )

  app.delete<{ Params: { id: string } }>("/quizzes/:id", async (request, reply) => {
    const user = await requireSession(request)
    const quiz = await service.getQuizRow(request.params.id)
    await assertCanManageCourse(user, quiz.courseId!)
    await service.deleteQuiz(request.params.id)
    reply.status(204)
    return null
  })

  app.post<{ Params: { quizId: string }; Body: QuizQuestionCreate }>(
    "/quizzes/:quizId/questions",
    { preValidation: [validateBody(zQuizQuestionCreate)] },
    async (request, reply) => {
      const user = await requireSession(request)
      const quiz = await service.getQuizRow(request.params.quizId)
      await assertCanManageCourse(user, quiz.courseId!)
      const created = await service.createQuestion(request.params.quizId, request.body)
      reply.status(201)
      return dataResponse(created, request.id)
    }
  )

  app.patch<{ Params: { id: string }; Body: QuizQuestionUpdate }>(
    "/quiz-questions/:id",
    { preValidation: [validateBody(zQuizQuestionUpdate)] },
    async (request) => {
      const user = await requireSession(request)
      const question = await service.getQuestionRow(request.params.id)
      const quiz = await service.getQuizRow(question.quizId)
      await assertCanManageCourse(user, quiz.courseId!)
      return dataResponse(await service.updateQuestion(request.params.id, request.body), request.id)
    }
  )

  app.delete<{ Params: { id: string } }>("/quiz-questions/:id", async (request, reply) => {
    const user = await requireSession(request)
    const question = await service.getQuestionRow(request.params.id)
    const quiz = await service.getQuizRow(question.quizId)
    await assertCanManageCourse(user, quiz.courseId!)
    await service.deleteQuestion(request.params.id)
    reply.status(204)
    return null
  })

  app.get<{ Params: { quizId: string } }>("/quizzes/:quizId/attempts", async (request) => {
    const user = await requireSession(request)
    const query = pageQuerySchema.parse(request.query)
    // scope=all is the essay grading queue — managers only. The default
    // stays the caller's own attempts (QuizTake's attempts-remaining).
    if ((request.query as Record<string, unknown>)["scope"] === "all") {
      const quiz = await service.getQuizRow(request.params.quizId)
      await assertCanManageCourse(user, quiz.courseId!)
      const items = await service.listAllAttempts(request.params.quizId)
      return paginate(items, request.id, { page: query.page, pageSize: query.pageSize })
    }
    const items = await service.listMyAttempts(request.params.quizId, user.id)
    return paginate(items, request.id, { page: query.page, pageSize: query.pageSize })
  })

  app.post<{ Params: { quizId: string } }>("/quizzes/:quizId/attempts", async (request, reply) => {
    const user = await requireSession(request)
    const quiz = await service.getQuizRow(request.params.quizId)
    await assertIsEnrolledParticipant(user, quiz.courseId!)
    const created = await service.startAttempt(request.params.quizId, user.id)
    reply.status(201)
    return dataResponse(created, request.id)
  })

  app.get<{ Params: { id: string } }>("/quiz-attempts/:id", async (request) => {
    const user = await requireSession(request)
    const attempt = await service.getAttemptRow(request.params.id)
    if (attempt.userId !== user.id) {
      const quiz = await service.getQuizRow(attempt.quizId)
      await assertCanManageCourse(user, quiz.courseId!)
    }
    return dataResponse(await service.getAttempt(request.params.id), request.id)
  })

  app.post<{ Params: { id: string }; Body: QuizAttemptSubmit }>(
    "/quiz-attempts/:id/submit",
    { preValidation: [validateBody(zQuizAttemptSubmit)] },
    async (request) => {
      const user = await requireSession(request)
      return dataResponse(await service.submitAttempt(request.params.id, user.id, request.body), request.id)
    }
  )

  app.post<{ Params: { id: string }; Body: QuizAttemptGrade }>(
    "/quiz-attempts/:id/grade",
    { preValidation: [validateBody(zQuizAttemptGrade)] },
    async (request) => {
      const user = await requireSession(request)
      const attempt = await service.getAttemptRow(request.params.id)
      const quiz = await service.getQuizRow(attempt.quizId)
      await assertCanManageCourse(user, quiz.courseId!)
      const graded = await service.gradeAttempt(request.params.id, request.body)
      await notifyUserById(attempt.userId, {
        type: "quiz_graded",
        title: `Kuis "${quiz.title}" telah dinilai`,
        body: `Nilai akhir: ${graded.score ?? "-"}${graded.passed === true ? " — lulus." : graded.passed === false ? " — belum lulus." : "."}`,
        link: quiz.courseId ? `/learn/${quiz.courseId}/quizzes` : undefined,
      })
      return dataResponse(graded, request.id)
    }
  )

  app.delete<{ Params: { id: string } }>("/quiz-attempts/:id", async (request, reply) => {
    const user = await requireSession(request)
    const attempt = await service.getAttemptRow(request.params.id)
    const quiz = await service.getQuizRow(attempt.quizId)
    await assertCanManageCourse(user, quiz.courseId!)
    await service.deleteAttempt(request.params.id)
    reply.status(204)
    return null
  })
}
