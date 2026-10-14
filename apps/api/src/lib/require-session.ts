import { fromNodeHeaders } from "better-auth/node"
import type { FastifyRequest } from "fastify"
import { auth } from "../auth.js"
import { ForbiddenError, UnauthorizedError } from "./errors.js"

/** Better Auth only rejects `banned` users when creating a NEW session —
 *  a session minted before the ban stays valid in its table. Every gate
 *  therefore re-checks the flag, so a suspended account loses API access
 *  immediately even if its session row survived (see users.service.ts's
 *  suspendUser, which deletes them as the primary mechanism). */
function assertNotBanned(user: { banned?: boolean | null }) {
  if (user.banned === true) throw new ForbiddenError("This account has been suspended")
}

/**
 * Reads the real Better Auth session off the request and requires that
 * one exists, without requiring admin. Reused by routes any signed-in
 * account can hit, where a separate ownership check decides *what* they
 * can act on (e.g. course create/update — see require-admin.ts for the
 * admin-only counterpart).
 */
export async function requireSession(request: FastifyRequest) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) })
  if (!session) throw new UnauthorizedError()
  assertNotBanned(session.user)
  return session.user
}

/** Same lookup without the 401: for surfaces where a session upgrades
 *  what you can see (public assets with private variants) instead of
 *  gating the whole route. A banned account is treated as anonymous —
 *  it must not receive the upgraded view. */
export async function getOptionalSession(request: FastifyRequest) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) })
  if (!session || session.user.banned === true) return null
  return session.user
}
