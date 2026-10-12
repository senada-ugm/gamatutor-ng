import type { AuditLogApiListResponse } from "@workspace/contracts"
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { requireAdmin } from "../../../lib/require-admin.js"
import { pagedResponse } from "../../../lib/response.js"
import * as service from "../services/audit.service.js"

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().optional(),
})

export function auditRoutes(app: FastifyInstance) {
  app.get("/audit-log", async (request): Promise<AuditLogApiListResponse> => {
    await requireAdmin(request)
    const query = listQuerySchema.parse(request.query)
    const { rows, totalCount } = await service.listAuditLogPaged({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
    })
    return pagedResponse(rows, totalCount, request.id, { page: query.page, pageSize: query.pageSize })
  })
}
