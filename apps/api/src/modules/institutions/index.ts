import type { FastifyInstance } from "fastify"
import { institutionOwnershipsRoutes } from "./routes/institution-ownerships.routes.js"
import { institutionRequestsRoutes } from "./routes/institution-requests.routes.js"
import { institutionsRoutes } from "./routes/institutions.routes.js"

/**
 * Institution domain module: registration requests, approved institutions,
 * and ownership grants. Route paths mirror the TypeSpec `@route` values in
 * packages/contracts/spec/institutions.tsp — mounted under /v1.
 */
export async function institutionsModule(app: FastifyInstance) {
  await app.register(institutionsRoutes)
  await app.register(institutionRequestsRoutes)
  await app.register(institutionOwnershipsRoutes)
}
