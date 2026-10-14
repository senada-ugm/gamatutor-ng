import type { FastifyInstance } from "fastify"
import { coursesRoutes } from "./routes/courses.routes.js"

/**
 * Course domain module: catalog/authoring resource. Route paths mirror
 * the TypeSpec `@route` values in packages/contracts/spec/courses.tsp —
 * mounted under /v1.
 */
export async function coursesModule(app: FastifyInstance) {
  await app.register(coursesRoutes)
}
