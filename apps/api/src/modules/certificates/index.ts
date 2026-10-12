import type { FastifyInstance } from "fastify"
import { certificatesRoutes } from "./routes/certificates.routes.js"

/**
 * Certificates domain module: certificate settings, issuance, lookup, and
 * public verification. Route paths mirror
 * packages/contracts/spec/{certificate-settings,certificates}.tsp —
 * mounted under /v1.
 */
export async function certificatesModule(app: FastifyInstance) {
  await app.register(certificatesRoutes)
}
