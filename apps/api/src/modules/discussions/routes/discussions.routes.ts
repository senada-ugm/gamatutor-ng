import type { DiscussionCreate, DiscussionReplyCreate } from "@workspace/contracts"
import { zDiscussionCreate, zDiscussionReplyCreate } from "@workspace/contracts/zod"
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import {
  assertCanAccessCourse,
  assertCanManageCourse,
  assertIsEnrolledParticipant,
} from "../../../lib/course-access.js"
import { ForbiddenError } from "../../../lib/errors.js"
import { requireSession } from "../../../lib/require-session.js"
import { dataResponse, paginate } from "../../../lib/response.js"
import { validateBody } from "../../../lib/validation.js"
import * as service from "../services/discussions.service.js"

const listQuerySchema = z.object({
  lessonId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
})

type ActingUser = { id: string; role?: string | null; email?: string | null }

/** Discussion thread management actions (pin/unpin/close/reopen): course
 *  managers (instructors/institution owners/admins) only. */
async function assertCanManageDiscussion(user: ActingUser, discussionId: string) {
  const discussion = await service.getDiscussionRow(discussionId)
  await assertCanManageCourse(user, discussion.courseId)
}

/** Thread author or course manager (delete / resolve / unresolve). */
async function assertCanModerateOrOwn(user: ActingUser, discussionId: string) {
  const discussion = await service.getDiscussionRow(discussionId)
  if (discussion.userId === user.id) return
  await assertCanManageCourse(user, discussion.courseId)
}

export function discussionsRoutes(app: FastifyInstance) {
  app.get<{ Params: { courseId: string } }>("/courses/:courseId/discussions", async (request) => {
    const user = await requireSession(request)
    await assertCanAccessCourse(user, request.params.courseId)
    const query = listQuerySchema.parse(request.query)
    const items = await service.listDiscussions(request.params.courseId, query.lessonId)
    return paginate(items, request.id, { page: query.page, pageSize: query.pageSize })
  })

  app.post<{ Params: { courseId: string }; Body: DiscussionCreate }>(
    "/courses/:courseId/discussions",
    { preValidation: [validateBody(zDiscussionCreate)] },
    async (request, reply) => {
      const user = await requireSession(request)
      await assertIsEnrolledParticipant(user, request.params.courseId)
      const created = await service.createDiscussion(request.params.courseId, user.id, request.body)
      reply.status(201)
      return dataResponse(created, request.id)
    }
  )

  app.get<{ Params: { id: string } }>("/discussions/:id", async (request) => {
    const user = await requireSession(request)
    const discussion = await service.getDiscussionRow(request.params.id)
    await assertCanAccessCourse(user, discussion.courseId)
    return dataResponse(await service.getDiscussionDetail(request.params.id), request.id)
  })

  app.delete<{ Params: { id: string } }>("/discussions/:id", async (request, reply) => {
    const user = await requireSession(request)
    await assertCanModerateOrOwn(user, request.params.id)
    await service.deleteDiscussion(request.params.id)
    reply.status(204)
    return null
  })

  const managerAction = (
    path: string,
    action: (id: string) => Promise<Awaited<ReturnType<typeof service.pinDiscussion>>>
  ) => {
    app.post<{ Params: { id: string } }>(path, async (request) => {
      const user = await requireSession(request)
      await assertCanManageDiscussion(user, request.params.id)
      return dataResponse(await action(request.params.id), request.id)
    })
  }

  managerAction("/discussions/:id/pin", service.pinDiscussion)
  managerAction("/discussions/:id/unpin", service.unpinDiscussion)
  managerAction("/discussions/:id/close", service.closeDiscussion)
  managerAction("/discussions/:id/reopen", service.reopenDiscussion)

  const resolveAction = (
    path: string,
    action: (id: string) => Promise<Awaited<ReturnType<typeof service.resolveDiscussion>>>
  ) => {
    app.post<{ Params: { id: string } }>(path, async (request) => {
      const user = await requireSession(request)
      await assertCanModerateOrOwn(user, request.params.id)
      return dataResponse(await action(request.params.id), request.id)
    })
  }

  resolveAction("/discussions/:id/resolve", service.resolveDiscussion)
  resolveAction("/discussions/:id/unresolve", service.unresolveDiscussion)

  app.post<{ Params: { id: string }; Body: DiscussionReplyCreate }>(
    "/discussions/:id/replies",
    { preValidation: [validateBody(zDiscussionReplyCreate)] },
    async (request, reply) => {
      const user = await requireSession(request)
      const discussion = await service.getDiscussionRow(request.params.id)
      if (discussion.isClosed) throw new ForbiddenError("This discussion is closed")
      await assertIsEnrolledParticipant(user, discussion.courseId)
      const created = await service.addReply(request.params.id, user.id, request.body)
      reply.status(201)
      return dataResponse(created, request.id)
    }
  )

  app.delete<{ Params: { discussionId: string; id: string } }>(
    "/discussions/:discussionId/replies/:id",
    async (request, reply) => {
      const user = await requireSession(request)
      const reply_ = await service.getReplyRow(request.params.discussionId, request.params.id)
      if (reply_.userId !== user.id) {
        const discussion = await service.getDiscussionRow(request.params.discussionId)
        await assertCanManageCourse(user, discussion.courseId)
      }
      await service.deleteReply(request.params.discussionId, request.params.id)
      reply.status(204)
      return null
    }
  )
}
