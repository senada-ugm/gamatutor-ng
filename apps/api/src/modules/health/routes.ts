import type { HealthApiCheckResponse, HealthStatus } from "@workspace/contracts"
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { sql } from "drizzle-orm"
import { db } from "../../db/index.js"
import { dataResponse } from "../../lib/response.js"

export function healthRoutes(app: FastifyInstance) {
  const handler = async (request: FastifyRequest, reply: FastifyReply): Promise<HealthApiCheckResponse> => {
    // Real readiness signal: a node with a dead database must not pass
    // orchestrator health checks even though the process itself is fine.
    let dbOk = true
    try {
      await db.execute(sql`select 1`)
    } catch {
      dbOk = false
    }
    const status: HealthStatus["status"] = dbOk ? "ok" : "degraded"
    const payload = dataResponse({ status, timestamp: new Date().toISOString() }, request.id)
    if (dbOk) return payload
    reply.status(503)
    return payload as HealthApiCheckResponse
  }

  // Bare path for infra probes/CI; /v1 for the generated SDK (its client
  // baseUrl already includes the /v1 prefix).
  app.get("/health", handler)
  app.get("/v1/health", handler)
}
