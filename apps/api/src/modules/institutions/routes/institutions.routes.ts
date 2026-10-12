import type {
  InstitutionCreate,
  InstitutionProfileUpdate,
  InstitutionsApiCreateResponse,
  InstitutionsApiGetResponse,
  InstitutionsApiListResponse,
  InstitutionsApiUpdateResponse,
} from "@workspace/contracts"
import { zInstitutionCreate, zInstitutionProfileUpdate } from "@workspace/contracts/zod"
import type { FastifyInstance } from "fastify"
import { z } from "zod"

import { requireAdmin } from "../../../lib/require-admin.js"
import { dataResponse, pagedResponse } from "../../../lib/response.js"
import { validateBody } from "../../../lib/validation.js"
import * as service from "../services/institutions.service.js"

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  q: z.string().optional(),
  orderBy: z.string().optional(),
})

export function institutionsRoutes(app: FastifyInstance) {
  app.get("/institutions", async (request): Promise<InstitutionsApiListResponse> => {
    const query = listQuerySchema.parse(request.query)
    const { rows, totalCount } = await service.listInstitutionsPaged({
      search: query.search ?? query.q,
      page: query.page,
      pageSize: query.pageSize,
    })
    return pagedResponse(rows, totalCount, request.id, {
      page: query.page,
      pageSize: query.pageSize,
    })
  })

  app.get<{ Params: { id: string } }>("/institutions/:id", async (request): Promise<InstitutionsApiGetResponse> => {
    return dataResponse(await service.getInstitution(request.params.id), request.id)
  })

  app.patch<{ Params: { id: string }; Body: InstitutionProfileUpdate }>(
    "/institutions/:id",
    { preValidation: [validateBody(zInstitutionProfileUpdate)] },
    async (request): Promise<InstitutionsApiUpdateResponse> => {
      await requireAdmin(request)
      return dataResponse(await service.updateInstitution(request.params.id, request.body), request.id)
    }
  )

  app.post<{ Body: InstitutionCreate }>(
    "/institutions",
    { preValidation: [validateBody(zInstitutionCreate)] },
    async (request, reply): Promise<InstitutionsApiCreateResponse> => {
      const admin = await requireAdmin(request)
      const created = await service.createInstitution(request.body, admin.id)
      reply.status(201)
      reply.header("Location", `/v1/institutions/${created.id}`)
      return dataResponse(created, request.id)
    }
  )
}
