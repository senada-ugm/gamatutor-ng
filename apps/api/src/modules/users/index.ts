import type { FastifyInstance } from "fastify"
import { usersRoutes } from "./routes/users.routes.js"

export function usersModule(app: FastifyInstance): void {
  app.register(usersRoutes)
}
