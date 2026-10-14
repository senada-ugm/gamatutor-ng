import type { FastifyInstance } from "fastify"
import { assignmentsRoutes } from "./routes/assignments.routes.js"

/**
 * Assignments domain module: file/text submissions with instructor
 * grading. Route paths mirror packages/contracts/spec/assignments.tsp —
 * mounted under /v1.
 */
export async function assignmentsModule(app: FastifyInstance) {
  await app.register(assignmentsRoutes)
}
