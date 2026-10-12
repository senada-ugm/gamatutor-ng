import type { FastifyInstance } from "fastify"
import { announcementsRoutes } from "./routes/announcements.routes.js"

export async function announcementsModule(app: FastifyInstance) {
  await app.register(announcementsRoutes)
}
