import type { FastifyInstance } from "fastify"
import { reportsRoutes } from "./routes/reports.routes.js"

export async function reportsModule(app: FastifyInstance) {
  await app.register(reportsRoutes)
}
