/**
 * Prometheus metrics at GET /metrics (unauthenticated — bind the scrape
 * to an internal interface / firewall it at the network layer, the
 * standard arrangement for k8s-style deployments):
 *
 *   - Node default metrics (event loop, GC, memory, …)
 *   - http_request_duration_seconds histogram per route/method/status
 *   - db_pool gauges (total/idle/waiting connections)
 */
import type { FastifyInstance } from "fastify"
import fp from "fastify-plugin"
import { collectDefaultMetrics, Gauge, Histogram, Registry } from "@prometheus-io/client"
import { pool } from "../db/index.js"

const register = new Registry()
collectDefaultMetrics({ register })

const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
})

function poolGauge(name: string, help: string, read: () => number) {
  return new Gauge({
    name,
    help,
    registers: [register],
    collect() {
      this.set(read())
    },
  })
}

async function metricsPlugin(app: FastifyInstance) {
  poolGauge("db_pool_total_connections", "Postgres pool total connections", () => pool.totalCount)
  poolGauge("db_pool_idle_connections", "Postgres pool idle connections", () => pool.idleCount)
  poolGauge("db_pool_waiting_clients", "Clients waiting for a pool connection", () => pool.waitingCount)

  app.addHook("onRequest", async (request) => {
    ;(request as unknown as { metricsStart: bigint }).metricsStart = process.hrtime.bigint()
  })

  app.addHook("onResponse", async (request, reply) => {
    const start = (request as unknown as { metricsStart?: bigint }).metricsStart
    if (start === undefined) return
    const seconds = Number(process.hrtime.bigint() - start) / 1e9
    // route is the Fastify pattern ("/v1/courses/:id"), not the raw URL —
    // cardinality stays bounded instead of growing per id.
    httpRequestDuration.observe(
      { method: request.method, route: request.routeOptions?.url ?? "unmatched", status: String(reply.statusCode) },
      seconds
    )
  })

  app.get("/metrics", async (_request, reply) => {
    reply.header("Content-Type", register.contentType)
    return register.metrics()
  })
}

export default fp(metricsPlugin, {
  name: "metrics-plugin",
})
