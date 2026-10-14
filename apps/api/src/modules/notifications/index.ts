import type { FastifyInstance } from "fastify"
import { notificationsRoutes } from "./routes/notifications.routes.js"

export async function notificationsModule(app: FastifyInstance) {
  await app.register(notificationsRoutes)
}
