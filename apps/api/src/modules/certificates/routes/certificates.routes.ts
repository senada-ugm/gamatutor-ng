import type { CertificateIssue, CertificateSettingsUpdate } from "@workspace/contracts"
import { zCertificateIssue, zCertificateSettingsUpdate } from "@workspace/contracts/zod"
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { assertCanManageCourse } from "../../../lib/course-access.js"

import { eq } from "drizzle-orm"
import { db } from "../../../db/index.js"
import { enrollments } from "../../../db/app-schema.js"
import { ForbiddenError, NotFoundError } from "../../../lib/errors.js"
import { notifyUserById } from "../../../lib/notify.js"
import { requireSession } from "../../../lib/require-session.js"
import { dataResponse } from "../../../lib/response.js"
import { validateBody } from "../../../lib/validation.js"
import { updateEnrollment } from "../../enrollments/services/enrollments.service.js"
import * as service from "../services/certificates.service.js"

const verifyQuerySchema = z.object({ code: z.string() })

export function certificatesRoutes(app: FastifyInstance) {
  app.get<{ Params: { courseId: string } }>("/courses/:courseId/certificate-settings", async (request) => {
    await requireSession(request)
    return dataResponse(await service.getCertificateSettings(request.params.courseId), request.id)
  })

  app.patch<{ Params: { courseId: string }; Body: CertificateSettingsUpdate }>(
    "/courses/:courseId/certificate-settings",
    { preValidation: [validateBody(zCertificateSettingsUpdate)] },
    async (request) => {
      const user = await requireSession(request)
      await assertCanManageCourse(user, request.params.courseId)
      return dataResponse(await service.updateCertificateSettings(request.params.courseId, request.body), request.id)
    }
  )

  app.get("/certificates/verify", async (request) => {
    const query = verifyQuerySchema.parse(request.query)
    return dataResponse(await service.verifyCertificate(query.code), request.id)
  })

  app.get<{ Params: { id: string } }>("/certificates/:id", async (request) => {
    const user = await requireSession(request)
    // Owner, admin, or a course manager. /certificates/verify is the
    // intentionally public surface (the QR link, gated by the code) —
    // serving the full model by bare id would let anyone holding an id
    // skip that code check and read the holder's email and the
    // verificationCode itself.
    const row = await service.getCertificateRow(request.params.id)
    if (row.userId !== user.id && user.role !== "admin") {
      await assertCanManageCourse(user, row.courseId)
    }
    return dataResponse(await service.getCertificate(request.params.id), request.id)
  })

  app.post<{ Params: { courseId: string }; Body: CertificateIssue }>(
    "/courses/:courseId/certificates",
    { preValidation: [validateBody(zCertificateIssue)] },
    async (request, reply) => {
      const user = await requireSession(request)
      const [enrollment] = await db
        .select()
        .from(enrollments)
        .where(eq(enrollments.id, request.body.enrollmentId))
        .limit(1)

      const isSelfClaim = enrollment && enrollment.userId === user.id
      if (!isSelfClaim) {
        await assertCanManageCourse(user, request.params.courseId)
        const created = await service.issueCertificate(request.params.courseId, request.body)
        reply.status(201)
        return dataResponse(created, request.id)
      }

      // Self-claim: a participant who passed the post-test graduates
      // themselves — the same transition a manager makes, which issues
      // the certificate atomically — instead of waiting for an admin.
      if (enrollment.courseId !== request.params.courseId) {
        throw new NotFoundError("Enrollment", request.body.enrollmentId)
      }
      if (enrollment.status === "graduated") {
        const existing = await service.issueCertificate(request.params.courseId, request.body)
        reply.status(201)
        return dataResponse(existing, request.id)
      }
      if (enrollment.status !== "selected") {
        throw new ForbiddenError("Pendaftaran Anda belum aktif untuk pelatihan ini")
      }
      const score = await service.passedPostTestScore(user.id, request.params.courseId)
      if (score === null) {
        throw new ForbiddenError("Sertifikat dapat diklaim setelah Anda lulus post-test")
      }
      const graduated = await updateEnrollment(enrollment.id, { status: "graduated", finalGrade: score })
      await notifyUserById(user.id, {
        type: "certificate_issued",
        title: "Sertifikat kelulusan diterbitkan",
        body: "Selamat! Sertifikat kelulusan Anda sudah tersedia.",
        link: graduated.certificateId ? `/certificates/${graduated.certificateId}` : undefined,
      })
      reply.status(201)
      return dataResponse(await service.getCertificate(graduated.certificateId!), request.id)
    }
  )
}
