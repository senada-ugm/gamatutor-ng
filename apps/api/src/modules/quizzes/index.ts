import type { FastifyInstance } from "fastify"
import { quizzesRoutes } from "./routes/quizzes.routes.js"

/**
 * Quizzes domain module: quiz/question authoring, attempts, and
 * server-side grading. Route paths mirror
 * packages/contracts/spec/quizzes.tsp — mounted under /v1.
 */
export async function quizzesModule(app: FastifyInstance) {
  await app.register(quizzesRoutes)
}
