import type { FastifyInstance } from "fastify"
import { courseContentRoutes } from "./routes/course-content.routes.js"

/**
 * Course content domain module: modules/lessons/lesson-progress. Route
 * paths mirror packages/contracts/spec/course-content.tsp — mounted
 * under /v1.
 */
export async function courseContentModule(app: FastifyInstance) {
  await app.register(courseContentRoutes)
}
