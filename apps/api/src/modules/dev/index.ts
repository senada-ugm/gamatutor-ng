import type { FastifyInstance } from "fastify"
import { devRoutes } from "./routes.js"

export async function devModule(app: FastifyInstance) {
  devRoutes(app)
}
