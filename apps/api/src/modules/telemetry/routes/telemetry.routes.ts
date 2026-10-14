import type { FastifyInstance } from "fastify"
import type { TelemetryEventCreate } from "@workspace/contracts"
import { requireSession } from "../../../lib/require-session.js"
import { assertCanManageCourse } from "../../../lib/course-access.js"
import { dataResponse } from "../../../lib/response.js"
import * as service from "../services/telemetry.service.js"

export function telemetryRoutes(app: FastifyInstance) {
  app.post<{ Body: TelemetryEventCreate }>("/telemetry/events", async (request, reply) => {
    const user = await requireSession(request)
    const result = await service.recordTelemetryEvent(user.id, request.body)
    reply.status(201)
    return dataResponse(result, request.id)
  })

  app.get<{ Params: { courseId: string } }>("/courses/:courseId/telemetry-summary", async (request) => {
    const user = await requireSession(request)
    await assertCanManageCourse(user, request.params.courseId)
    return dataResponse(await service.getCourseTelemetrySummary(request.params.courseId), request.id)
  })

  /**
   * Operational CSV export of learning telemetry logs across slides and doctors.
   * Listed under INTENTIONAL_EXCLUSIONS in check-api-contract-parity.mjs.
   */
  app.get<{ Querystring: { courseId?: string } }>("/reports/telemetry/export", async (request, reply) => {
    await requireSession(request)
    const csv = await service.exportTelemetryCsv(request.query.courseId)
    const filename = `telemetry-report-${new Date().toISOString().slice(0, 10)}.csv`
    reply.header("Content-Type", "text/csv; charset=utf-8")
    reply.header("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`)
    return "\uFEFF" + csv
  })
}
