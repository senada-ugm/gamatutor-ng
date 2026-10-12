import type { FastifyInstance } from "fastify"
import { healthRoutes } from "./routes.js"

export { healthRoutes }

/** Module wrapper for consistency with other modules. */
export async function healthModule(app: FastifyInstance) {
  await app.register(healthRoutes)
}
