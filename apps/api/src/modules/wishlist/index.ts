import type { FastifyInstance } from "fastify"
import { wishlistRoutes } from "./routes/wishlist.routes.js"

export async function wishlistModule(app: FastifyInstance) {
  await app.register(wishlistRoutes)
}
