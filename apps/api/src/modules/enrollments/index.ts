import type { FastifyInstance } from "fastify"
import { enrollmentsRoutes } from "./routes/enrollments.routes.js"

/**
 * Enrollment + participant-profile domain module. Route paths mirror
 * packages/contracts/spec/enrollments.tsp — mounted under /v1.
 */
export async function enrollmentsModule(app: FastifyInstance) {
  await app.register(enrollmentsRoutes)
}
