import type { Announcement, AnnouncementCreate } from "@workspace/contracts"
import { zAnnouncementCreate } from "@workspace/contracts/zod"
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { assertCanAccessCourse, assertCanManageCourse } from "../../../lib/course-access.js"
import { requireSession } from "../../../lib/require-session.js"
import { dataResponse, pagedResponse } from "../../../lib/response.js"
import { validateBody } from "../../../lib/validation.js"
import * as service from "../services/announcements.service.js"

const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  orderBy: z.string().optional(),
})

export function announcementsRoutes(app: FastifyInstance) {
  app.get<{ Params: { courseId: string } }>("/courses/:courseId/announcements", async (request) => {
    const user = await requireSession(request)
    // Managers see their own drafts; participants see published only.
    let includeDrafts = false
    try {
      await assertCanManageCourse(user, request.params.courseId)
      includeDrafts = true
    } catch {
      await assertCanAccessCourse(user, request.params.courseId)
    }
    const query = pageQuerySchema.parse(request.query)
    const { rows, totalCount } = await service.listAnnouncements(
      request.params.courseId,
      includeDrafts,
      query.page,
      query.pageSize
    )
    return pagedResponse(rows, totalCount, request.id, { page: query.page, pageSize: query.pageSize })
  })

  app.post<{ Params: { courseId: string }; Body: AnnouncementCreate }>(
    "/courses/:courseId/announcements",
    { preValidation: [validateBody(zAnnouncementCreate)] },
    async (request, reply) => {
      const user = await requireSession(request)
      await assertCanManageCourse(user, request.params.courseId)
      const body = request.body as AnnouncementCreate
      if (body.courseId !== request.params.courseId) {
        // The path scopes; the body echoing a different course is a bug.
        body.courseId = request.params.courseId
      }
      const created = await service.createAnnouncement(body, { id: user.id, name: user.name ?? user.id })
      reply.status(201)
      return dataResponse(created, request.id)
    }
  )

  const managerAction = (path: string, action: (id: string) => Promise<Announcement>) => {
    app.post<{ Params: { id: string } }>(path, async (request) => {
      const user = await requireSession(request)
      const row = await service.getAnnouncementRow(request.params.id)
      await assertCanManageCourse(user, row.courseId)
      return dataResponse(await action(request.params.id), request.id)
    })
  }

  managerAction("/announcements/:id/pin", service.pinAnnouncement)
  managerAction("/announcements/:id/unpin", service.unpinAnnouncement)
  managerAction("/announcements/:id/publish", service.publishAnnouncement)

  app.delete<{ Params: { id: string } }>("/announcements/:id", async (request, reply) => {
    const user = await requireSession(request)
    const row = await service.getAnnouncementRow(request.params.id)
    await assertCanManageCourse(user, row.courseId)
    await service.deleteAnnouncement(request.params.id)
    reply.status(204)
    return null
  })
}
