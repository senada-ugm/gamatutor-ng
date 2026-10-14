import type { FastifyInstance } from "fastify"
import { auditRoutes } from "./routes/audit.routes.js"

export function auditModule(app: FastifyInstance): void {
  app.register(auditRoutes)
}
