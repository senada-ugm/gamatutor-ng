import type { CertificateIssue, CertificateSettingsUpdate } from "@workspace/contracts"
import { zCertificateIssue, zCertificateSettingsUpdate } from "@workspace/contracts/zod"
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { assertCanManageCourse } from "../../../lib/course-access.js"

import { eq } from "drizzle-orm"
import { db } from "../../../db/index.js"
import { enrollments } from "../../../db/app-schema.js"
import { requireSession } from "../../../lib/require-session.js"
import { dataResponse } from "../../../lib/response.js"
import { validateBody } from "../../../lib/validation.js"
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
      }
      const created = await service.issueCertificate(request.params.courseId, request.body)
      reply.status(201)
      return dataResponse(created, request.id)
    }
  )
}
