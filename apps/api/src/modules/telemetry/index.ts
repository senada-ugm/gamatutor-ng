import type { FastifyInstance } from "fastify"
import { telemetryRoutes } from "./routes/telemetry.routes.js"

export async function telemetryModule(app: FastifyInstance) {
  telemetryRoutes(app)
}
