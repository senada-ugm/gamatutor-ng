import type { WishlistAdd } from "@workspace/contracts"
import { zWishlistAdd } from "@workspace/contracts/zod"
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { requireSession } from "../../../lib/require-session.js"
import { pagedResponse, dataResponse } from "../../../lib/response.js"
import { validateBody } from "../../../lib/validation.js"
import * as service from "../services/wishlist.service.js"

const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  orderBy: z.string().optional(),
})

export function wishlistRoutes(app: FastifyInstance) {
  app.get("/wishlist", async (request) => {
    const user = await requireSession(request)
    const query = pageQuerySchema.parse(request.query)
    // Own rows only; the service scopes by the session user.
    const items = await service.listWishlist(user.id, query.page, query.pageSize)
    return pagedResponse(items, items.length, request.id, { page: query.page, pageSize: query.pageSize })
  })

  app.post("/wishlist", { preValidation: [validateBody(zWishlistAdd)] }, async (request, reply) => {
    const user = await requireSession(request)
    const body = request.body as WishlistAdd
    const item = await service.addToWishlist(user.id, body.courseId)
    reply.status(201)
    return dataResponse(item, request.id)
  })

  app.delete<{ Params: { courseId: string } }>("/wishlist/:courseId", async (request, reply) => {
    const user = await requireSession(request)
    await service.removeFromWishlist(user.id, request.params.courseId)
    reply.status(204)
    return null
  })
}
