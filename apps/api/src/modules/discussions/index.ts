import type { FastifyInstance } from "fastify"
import { discussionsRoutes } from "./routes/discussions.routes.js"

/**
 * Discussions domain module: course Q&A threads with nested replies,
 * pin/close/resolve moderation. Route paths mirror
 * packages/contracts/spec/discussions.tsp — mounted under /v1.
 */
export async function discussionsModule(app: FastifyInstance) {
  await app.register(discussionsRoutes)
}
