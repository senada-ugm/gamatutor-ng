import type { InstitutionOwnershipGrant, InstitutionOwnershipsApiListByUserResponse } from "@workspace/contracts"
import { zInstitutionOwnershipGrant } from "@workspace/contracts/zod"
import type { FastifyInstance } from "fastify"
import { z } from "zod"

import { requireAdmin } from "../../../lib/require-admin.js"
import { requireSession } from "../../../lib/require-session.js"
import { dataResponse, paginate } from "../../../lib/response.js"
import { validateBody } from "../../../lib/validation.js"
import * as service from "../services/institutions.service.js"

const listByUserQuerySchema = z.object({
  userId: z.string().min(1, "userId is required"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
})

export function institutionOwnershipsRoutes(app: FastifyInstance) {
  app.get("/institution-ownerships", async (request): Promise<InstitutionOwnershipsApiListByUserResponse> => {
    const user = await requireSession(request)
    const query = listByUserQuerySchema.parse(request.query)
    // Non-admins can only ever list their own grants, regardless of
    // the userId they pass — enumerating who owns which institution
    // across users is admin-only (same rule as institution-requests
    // list). Every web caller reads its own session user's grants.
    const items = await service.listOwnershipsByUser(user.role === "admin" ? query.userId : user.id)
    return paginate(items, request.id, {
      page: query.page,
      pageSize: query.pageSize,
    })
  })

  app.post<{ Body: InstitutionOwnershipGrant }>(
    "/institution-ownerships",
    { preValidation: [validateBody(zInstitutionOwnershipGrant)] },
    async (request) => {
      const actor = await requireAdmin(request)
      const { userId, institutionId } = request.body
      const granted = await service.grantOwnership(userId, institutionId)
      return dataResponse(granted, request.id)
    }
  )
}
