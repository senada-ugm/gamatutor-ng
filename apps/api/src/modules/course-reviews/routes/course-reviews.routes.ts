import type { FastifyPluginAsync } from "fastify"
import type { CourseReviewUpsert } from "@workspace/contracts"
import { zCourseReviewsApiListQuery, zCourseReviewsApiUpsertMineBody } from "@workspace/contracts/zod"
import { validateBody, validateQuery } from "../../../lib/validation.js"
import { getOptionalSession, requireSession } from "../../../lib/require-session.js"
import { dataResponse, pagedResponse } from "../../../lib/response.js"
import { getCourseReviewSummary, listCourseReviews, upsertMyCourseReview } from "../services/course-reviews.service.js"

export const courseReviewsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{
    Params: { courseId: string }
    Querystring: { page?: number; pageSize?: number }
  }>(
    "/courses/:courseId/reviews",
    { preValidation: [validateQuery(zCourseReviewsApiListQuery)] },
    async (request, reply) => {
      const page = request.query.page ?? 1
      const pageSize = request.query.pageSize ?? 20
      const { items, total } = await listCourseReviews(request.params.courseId, page, pageSize)
      return reply.send(pagedResponse(items, total, request.id, { page, pageSize }))
    }
  )

  app.get<{ Params: { courseId: string } }>("/courses/:courseId/reviews/summary", async (request, reply) => {
    const user = await getOptionalSession(request)
    const summary = await getCourseReviewSummary(request.params.courseId, user?.id)
    return reply.send(dataResponse(summary, request.id))
  })

  app.put<{
    Params: { courseId: string }
    Body: CourseReviewUpsert
  }>(
    "/courses/:courseId/reviews/mine",
    { preValidation: [validateBody(zCourseReviewsApiUpsertMineBody)] },
    async (request, reply) => {
      const user = await requireSession(request)
      const review = await upsertMyCourseReview(request.params.courseId, user.id, request.body)
      return reply.send(dataResponse(review, request.id))
    }
  )
}
