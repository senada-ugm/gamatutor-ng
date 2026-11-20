import type { FastifyPluginAsync } from "fastify"
import { courseReviewsRoutes } from "./routes/course-reviews.routes.js"

export const courseReviewsModule: FastifyPluginAsync = async (app) => {
  await app.register(courseReviewsRoutes)
}
