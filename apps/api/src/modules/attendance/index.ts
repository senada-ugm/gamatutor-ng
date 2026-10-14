import type { FastifyInstance } from "fastify"
import { attendanceRoutes } from "./routes/attendance.routes.js"

/**
 * Attendance domain module: sessions, check-in, manual records. Route
 * paths mirror packages/contracts/spec/attendance.tsp — mounted under
 * /v1.
 */
export async function attendanceModule(app: FastifyInstance) {
  await app.register(attendanceRoutes)
}
