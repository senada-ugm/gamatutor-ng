import type {
  UserSuspend,
  UsersApiGetResponse,
  UsersApiListResponse,
  UsersApiSuspendResponse,
} from "@workspace/contracts"
import { zAccountStatus, zUserRole, zUserSuspend } from "@workspace/contracts/zod"
import type { FastifyInstance } from "fastify"
import { z } from "zod"

import { recordAudit } from "../../../lib/audit.js"
import { requireAdmin } from "../../../lib/require-admin.js"
import { dataResponse, pagedResponse } from "../../../lib/response.js"
import { validateBody } from "../../../lib/validation.js"
import * as service from "../services/users.service.js"

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  q: z.string().optional(),
  orderBy: z.string().optional(),
  role: zUserRole.optional(),
  status: zAccountStatus.optional(),
})

const idParamsSchema = z.object({ id: z.string().min(1) })

export function usersRoutes(app: FastifyInstance) {
  // The whole surface is admin-only — account names/emails/statuses are
  // PII, and suspension is an administrative action.
  app.get("/users", async (request): Promise<UsersApiListResponse> => {
    await requireAdmin(request)
    const query = listQuerySchema.parse(request.query)
    const paged = { page: query.page, pageSize: query.pageSize }
    const { rows, totalCount } = await service.listUsersPaged({
      role: query.role,
      status: query.status,
      search: query.search ?? query.q,
      orderBy: query.orderBy,
      ...paged,
    })
    return pagedResponse(rows, totalCount, request.id, paged)
  })

  app.get("/users/:id", async (request): Promise<UsersApiGetResponse> => {
    await requireAdmin(request)
    const { id } = idParamsSchema.parse(request.params)
    return dataResponse(await service.getUser(id), request.id)
  })

  app.post<{ Body: UserSuspend }>(
    "/users/:id/suspend",
    { preValidation: [validateBody(zUserSuspend)] },
    async (request): Promise<UsersApiSuspendResponse> => {
      const actor = await requireAdmin(request)
      const { id } = idParamsSchema.parse(request.params)
      const suspended = await service.suspendUser(id, request.body.reason)
      await recordAudit({
        actorUserId: actor.id,
        action: "user.suspend",
        entityType: "user",
        entityId: id,
        metadata: { reason: request.body.reason },
      })
      return dataResponse(suspended, request.id)
    }
  )

  app.get("/users/user-capabilities", async (request) => {
    await requireAdmin(request)
    const raw = (request.query as { userIds?: string }).userIds ?? ""
    const userIds = raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 200)
    return dataResponse(await service.getUserCapabilities(userIds), request.id)
  })

  app.post("/users/:id/reactivate", async (request) => {
    const actor = await requireAdmin(request)
    const { id } = idParamsSchema.parse(request.params)
    const reactivated = await service.reactivateUser(id)
    await recordAudit({ actorUserId: actor.id, action: "user.reactivate", entityType: "user", entityId: id })
    return dataResponse(reactivated, request.id)
  })
}
