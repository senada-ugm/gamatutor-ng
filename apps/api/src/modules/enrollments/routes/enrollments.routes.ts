import type { Enrollment, EnrollmentCreate, EnrollmentUpdate, ParticipantProfileUpdate } from "@workspace/contracts"
import { zEnrollmentCreate, zEnrollmentUpdate, zParticipantProfileUpdate } from "@workspace/contracts/zod"
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { assertCanManageCourse, assertCanManageInstitution } from "../../../lib/course-access.js"
import { ForbiddenError } from "../../../lib/errors.js"
import { notifyUserById } from "../../../lib/notify.js"
import { requireSession } from "../../../lib/require-session.js"
import { dataResponse, paginate, pagedResponse } from "../../../lib/response.js"
import { validateBody } from "../../../lib/validation.js"
import * as service from "../services/enrollments.service.js"

const listQuerySchema = z.object({
  courseId: z.string().optional(),
  institutionId: z.string().optional(),
  userId: z.string().optional(),
  status: z.string().optional(),
  orderBy: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
})

export function enrollmentsRoutes(app: FastifyInstance) {
  // Enrollment rows carry interview notes and failure reasons, so reads
  // are scoped here rather than trusting the query params: self-reads
  // and admin reads pass through as asked, a courseId read requires
  // managing that course, and a cross-user read keeps only rows in
  // courses the caller manages.
  app.get("/enrollments", async (request) => {
    const user = await requireSession(request)
    const query = listQuerySchema.parse(request.query)
    const paged = { page: query.page, pageSize: query.pageSize }

    // Enrollment rows carry interview notes and failure reasons, so
    // reads are scoped here rather than trusting the query params:
    // self-reads and admin reads pass through as asked (SQL-paginated),
    // a courseId read requires managing that course (SQL-paginated),
    // and a cross-user read keeps only rows in courses the caller
    // manages — that branch post-filters in JS over just the target's
    // own rows, so it paginates in memory.
    // An institution-wide read is its own branch, above the rest: it is
    // the only one keyed on something enrollment rows do not carry, and
    // it is gated on owning the institution rather than on the course.
    if (query.institutionId && !query.userId) {
      await assertCanManageInstitution(user, query.institutionId)
      const courseIds = await service.listCourseIdsForInstitution(query.institutionId)
      const { rows, totalCount } = await service.listEnrollmentsPaged({
        courseIds: query.courseId ? courseIds.filter((id) => id === query.courseId) : courseIds,
        status: query.status,
        orderBy: query.orderBy,
        ...paged,
      })
      return pagedResponse(rows, totalCount, request.id, paged)
    }

    if (user.role === "admin" || query.userId === user.id || (!query.userId && !query.courseId)) {
      // Admin (as asked), self-read, or bare non-admin list (forced to
      // own rows) — all SQL-paginated.
      const scopedUserId = user.role === "admin" ? query.userId : user.id
      const { rows, totalCount } = await service.listEnrollmentsPaged({
        courseId: query.courseId,
        userId: scopedUserId,
        status: query.status,
        ...paged,
      })
      return pagedResponse(rows, totalCount, request.id, paged)
    }
    if (query.userId) {
      // Cross-user read (user-info-dialog): filter the target's
      // enrollments down to courses this caller manages.
      const candidates = await service.listEnrollments({
        courseId: query.courseId,
        userId: query.userId,
        status: query.status,
      })
      const manageableByCourseId = new Map<string, boolean>()
      const items: Enrollment[] = []
      for (const enrollment of candidates) {
        let manageable = manageableByCourseId.get(enrollment.courseId)
        if (manageable === undefined) {
          manageable = await assertCanManageCourse(user, enrollment.courseId)
            .then(() => true)
            .catch(() => false)
          manageableByCourseId.set(enrollment.courseId, manageable)
        }
        if (manageable) items.push(enrollment)
      }
      return paginate(items, request.id, paged)
    }
    // A course's participant list (ParticipantsPanel) — managers only.
    await assertCanManageCourse(user, query.courseId!)
    const { rows, totalCount } = await service.listEnrollmentsPaged({
      courseId: query.courseId,
      status: query.status,
      ...paged,
    })
    return pagedResponse(rows, totalCount, request.id, paged)
  })

  app.get<{ Params: { id: string } }>("/enrollments/:id", async (request) => {
    const user = await requireSession(request)
    // Owner, admin, or a manager of the enrollment's course — anything
    // else is an IDOR into another participant's interview notes.
    const ownerId = await service.getEnrollmentOwnerId(request.params.id)
    if (ownerId !== user.id && user.role !== "admin") {
      const courseId = await service.getEnrollmentCourseId(request.params.id)
      await assertCanManageCourse(user, courseId)
    }
    return dataResponse(await service.getEnrollment(request.params.id), request.id)
  })

  app.post<{ Body: EnrollmentCreate }>(
    "/enrollments",
    { preValidation: [validateBody(zEnrollmentCreate)] },
    async (request, reply) => {
      const user = await requireSession(request)
      // Course managers may self-enroll into unpublished/closed courses
      // (previewing their own course); everyone else hits the gates.
      const managerBypass = await assertCanManageCourse(user, request.body.courseId)
        .then(() => true)
        .catch(() => false)
      const created = await service.enroll(user.id, request.body, { managerBypass })
      reply.status(201)
      return dataResponse(created, request.id)
    }
  )

  app.patch<{ Params: { id: string }; Body: EnrollmentUpdate }>(
    "/enrollments/:id",
    { preValidation: [validateBody(zEnrollmentUpdate)] },
    async (request) => {
      const user = await requireSession(request)
      const courseId = await service.getEnrollmentCourseId(request.params.id)

      // A student may cancel their own application, but only before
      // selection — after that the seat (and any certificate) is a
      // manager decision. Every other transition requires
      // course-management rights; the service re-validates the
      // transition itself (see ALLOWED_TRANSITIONS).
      if (request.body.status === "canceled") {
        const ownerId = await service.getEnrollmentOwnerId(request.params.id)
        const currentStatus = await service.getEnrollmentStatus(request.params.id)
        const selfCancelable = ownerId === user.id && ["registered", "interviewed"].includes(currentStatus)
        if (!selfCancelable) await assertCanManageCourse(user, courseId)
      } else {
        await assertCanManageCourse(user, courseId)
      }

      const updated = await service.updateEnrollment(request.params.id, request.body)

      // Funnel results are exactly the moments a learner would otherwise
      // have to poll for — notify after the update committed (see
      // lib/notify.ts for why this is fire-and-forget).
      if (["selected", "failed", "graduated"].includes(request.body.status)) {
        const recipientId = await service.getEnrollmentOwnerId(request.params.id)
        if (request.body.status === "selected") {
          await notifyUserById(recipientId, {
            type: "enrollment_selected",
            title: "Pendaftaran pelatihan disetujui",
            body: "Selamat — pendaftaran Anda telah disetujui. Pelatihan sekarang terbuka untuk Anda.",
            link: `/learn/${courseId}`,
          })
        } else if (request.body.status === "failed") {
          await notifyUserById(recipientId, {
            type: "enrollment_failed",
            title: "Pendaftaran pelatihan ditolak",
            body: request.body.failureNotes ?? "Mohon maaf, pendaftaran Anda belum disetujui untuk pelatihan ini.",
          })
        } else {
          await notifyUserById(recipientId, {
            type: "certificate_issued",
            title: "Sertifikat kelulusan diterbitkan",
            body: "Selamat! Sertifikat kelulusan Anda sudah tersedia.",
            link: updated.certificateId ? `/certificates/${updated.certificateId}` : undefined,
          })
        }
      }

      return dataResponse(updated, request.id)
    }
  )

  app.delete<{ Params: { id: string } }>("/enrollments/:id", async (request, reply) => {
    const user = await requireSession(request)
    const courseId = await service.getEnrollmentCourseId(request.params.id)
    await assertCanManageCourse(user, courseId)
    await service.deleteEnrollment(request.params.id)
    return reply.status(204).send()
  })

  // Batch read for a roster page. Capped like /users/user-capabilities:
  // an unbounded id list is a query-length and fan-out hazard, and no
  // page shows more rows than this.
  app.get("/participant-profiles", async (request) => {
    const user = await requireSession(request)
    const userIds = ((request.query as { userIds?: string }).userIds ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 200)
    return dataResponse(await service.listParticipantProfiles(userIds, user), request.id)
  })

  app.get<{ Params: { id: string } }>("/participant-profiles/:id", async (request) => {
    const user = await requireSession(request)
    // Self, or anyone managing at least one course this participant is
    // enrolled in — approximated here as "any signed-in user managing
    // courses" would be too loose, so require self OR admin; instructor/
    // owner access to a specific participant's profile happens through
    // the course-scoped enrollment list, not this direct-by-id lookup.
    if (user.id !== request.params.id && user.role !== "admin") {
      const ownEnrollments = await service.listEnrollments({ userId: request.params.id })
      const managesAny = await Promise.all(
        ownEnrollments.map((e) =>
          assertCanManageCourse(user, e.courseId)
            .then(() => true)
            .catch(() => false)
        )
      )
      if (!managesAny.some(Boolean)) throw new ForbiddenError("You cannot view this participant's profile")
    }
    // Only the owner reads their own identity numbers unmasked; a
    // manager or admin gets the masked tail (see lib/pii.ts).
    return dataResponse(
      await service.getParticipantProfile(request.params.id, user.id === request.params.id),
      request.id
    )
  })

  app.patch<{ Params: { id: string }; Body: ParticipantProfileUpdate }>(
    "/participant-profiles/:id",
    { preValidation: [validateBody(zParticipantProfileUpdate)] },
    async (request) => {
      const user = await requireSession(request)
      // Self-service only — even an admin edits a profile through the
      // account owner, not through this endpoint.
      if (request.params.id !== user.id) {
        throw new ForbiddenError("You can only edit your own profile")
      }
      return dataResponse(await service.updateParticipantProfile(user.id, request.body), request.id)
    }
  )
}
