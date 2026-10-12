import { fromNodeHeaders } from "better-auth/node"
import type { FastifyRequest } from "fastify"
import { auth } from "../auth.js"
import { ForbiddenError, UnauthorizedError } from "./errors.js"

/**
 * Reads the real Better Auth session off the request and requires an
 * admin. Reused by every admin-only route (e.g. institution create) —
 * routes any signed-in account can hit, gated by a separate ownership
 * check, use require-session.ts's requireSession instead (e.g. course
 * create/update).
 */
export async function requireAdmin(request: FastifyRequest) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) })
  if (!session) throw new UnauthorizedError()
  if (session.user.banned === true) throw new ForbiddenError("This account has been suspended")
  if (session.user.role !== "admin") throw new ForbiddenError("Admin access required")
  return session.user
}
