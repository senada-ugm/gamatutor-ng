import type { FastifyInstance } from "fastify"
import { assertCanManageCourse, assertCanManageInstitution } from "../../../lib/course-access.js"
import { requireAdmin } from "../../../lib/require-admin.js"
import { requireSession } from "../../../lib/require-session.js"
import { dataResponse } from "../../../lib/response.js"
import * as service from "../services/reports.service.js"

export function reportsRoutes(app: FastifyInstance) {
  app.get<{ Params: { courseId: string } }>("/courses/:courseId/report", async (request) => {
    const user = await requireSession(request)
    await assertCanManageCourse(user, request.params.courseId)
    return dataResponse(await service.getCourseReport(request.params.courseId), request.id)
  })

  app.get<{ Params: { institutionId: string } }>("/institutions/:institutionId/report", async (request) => {
    const user = await requireSession(request)
    await assertCanManageInstitution(user, request.params.institutionId)
    return dataResponse(await service.getInstitutionReport(request.params.institutionId), request.id)
  })

  app.get("/admin/overview", async (request) => {
    await requireAdmin(request)
    return dataResponse(await service.getAdminOverview(), request.id)
  })

  app.get("/admin/financial-summary", async (request) => {
    await requireAdmin(request)
    return dataResponse(await service.getFinancialSummary(), request.id)
  })

  /** Not part of the TypeSpec contract on purpose — operational CSV
   *  formatting of the report data (see reports.tsp's header comment for
   *  the same precedent as POST /uploads/sweep). Same manager gate as
   *  the JSON report. */
  app.get<{ Params: { courseId: string } }>("/courses/:courseId/participants/export", async (request, reply) => {
    const user = await requireSession(request)
    await assertCanManageCourse(user, request.params.courseId)
    const { filename, csv } = await service.getCourseReportCsv(request.params.courseId)
    // BOM so Excel opens UTF-8 Indonesian text correctly.
    reply.header("Content-Type", "text/csv; charset=utf-8")
    reply.header("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`)
    return "\uFEFF" + csv
  })

  app.get<{ Params: { institutionId: string } }>(
    "/institutions/:institutionId/orders/export",
    async (request, reply) => {
      const user = await requireSession(request)
      await assertCanManageInstitution(user, request.params.institutionId)
      const { filename, csv } = await service.getInstitutionOrdersCsv(request.params.institutionId)
      reply.header("Content-Type", "text/csv; charset=utf-8")
      reply.header("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`)
      return "\uFEFF" + csv
    }
  )
}
