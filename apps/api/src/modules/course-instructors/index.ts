import type { FastifyInstance } from "fastify"
import { courseInstructorsRoutes } from "./routes/course-instructors.routes.js"

/**
 * Course-instructor domain module: per-course instructor assignment/invite.
 * Route paths mirror packages/contracts/spec/course-instructors.tsp —
 * mounted under /v1.
 */
export async function courseInstructorsModule(app: FastifyInstance) {
  await app.register(courseInstructorsRoutes)
}
