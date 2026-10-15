import type {
  InstitutionRequestCreate,
  InstitutionRequestReject,
  InstitutionRequestsApiApproveResponse,
  InstitutionRequestsApiCreateResponse,
  InstitutionRequestsApiGetResponse,
  InstitutionRequestsApiListResponse,
} from "@workspace/contracts"
import {
  zInstitutionRequestCreate,
  zInstitutionRequestReject,
  zInstitutionRequestStatus,
} from "@workspace/contracts/zod"
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { ForbiddenError } from "../../../lib/errors.js"
import { requireAdmin } from "../../../lib/require-admin.js"
import { requireSession } from "../../../lib/require-session.js"
import * as settingsService from "../../platform-settings/services/platform-settings.service.js"
import { dataResponse, paginate } from "../../../lib/response.js"
import { validateBody } from "../../../lib/validation.js"
import * as service from "../services/institutions.service.js"

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  q: z.string().optional(),
  orderBy: z.string().optional(),
  status: zInstitutionRequestStatus.optional(),
  requestedByUserId: z.string().optional(),
})

export function institutionRequestsRoutes(app: FastifyInstance) {
  app.get("/institution-requests", async (request): Promise<InstitutionRequestsApiListResponse> => {
    const user = await requireSession(request)
    const query = listQuerySchema.parse(request.query)
    // Non-admins can only ever list their own requests, regardless of
    // what requestedByUserId they pass — the admin review queue (no
    // filter, or any userId) is admin-only.
    const requestedByUserId = user.role === "admin" ? query.requestedByUserId : user.id
    const items = await service.listRequests({
      status: query.status,
      search: query.search ?? query.q,
      requestedByUserId,
      orderBy: query.orderBy,
    })
    return paginate(items, request.id, {
      page: query.page,
      pageSize: query.pageSize,
    })
  })

  app.get<{ Params: { id: string } }>(
    "/institution-requests/:id",
    async (request): Promise<InstitutionRequestsApiGetResponse> => {
      const user = await requireSession(request)
      const found = await service.getRequest(request.params.id)
      if (user.role !== "admin" && found.requestedByUserId !== user.id) {
        throw new ForbiddenError("You may only view your own institution request")
      }
      return dataResponse(found, request.id)
    }
  )

  app.post<{ Body: InstitutionRequestCreate }>(
    "/institution-requests",
    { preValidation: [validateBody(zInstitutionRequestCreate)] },
    async (request, reply): Promise<InstitutionRequestsApiCreateResponse> => {
      const user = await requireSession(request)
      // Platform kill-switch for the self-service form (admin-managed
      // via PATCH /platform-settings).
      if (!(await settingsService.institutionRequestsAllowed())) {
        throw new ForbiddenError("The institution request form is currently closed")
      }
      const created = await service.createRequest(request.body, user)
      reply.status(201)
      reply.header("Location", `/v1/institution-requests/${created.id}`)
      return dataResponse(created, request.id)
    }
  )

  app.post<{ Params: { id: string } }>(
    "/institution-requests/:id/approve",
    async (request): Promise<InstitutionRequestsApiApproveResponse> => {
      const actor = await requireAdmin(request)
      const approved = await service.approveRequest(request.params.id)
      return dataResponse(approved, request.id)
    }
  )

  app.post<{ Params: { id: string }; Body: InstitutionRequestReject }>(
    "/institution-requests/:id/reject",
    { preValidation: [validateBody(zInstitutionRequestReject)] },
    async (request) => {
      const actor = await requireAdmin(request)
      const rejected = await service.rejectRequest(request.params.id, request.body.reason)
      return dataResponse(rejected, request.id)
    }
  )
}
