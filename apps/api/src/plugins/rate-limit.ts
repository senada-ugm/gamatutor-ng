/**
 * Rate limiting via @fastify/rate-limit. Gated behind RATE_LIMIT_ENABLED
 * — on by default, can be disabled via RATE_LIMIT_ENABLED=false.
 *
 * Tiering strategy:
 * - auth-write (Better Auth mutation endpoints: sign-in, sign-up, password reset): 20 req/min
 * - coupon (Coupon validation: dictionary brute-force defense): 20 req/min
 * - upload (File uploads: disk saturation & payload bombing defense): 30 req/min
 * - general (Catalog browsing, learning content, health, general reads): 1000 req/min
 *
 * Store: REDIS_URL set => shared Redis store, so every instance behind a
 * load balancer counts against the same bucket. Unset => in-memory (single
 * instance VPS).
 */
import rateLimit from "@fastify/rate-limit"
import type { FastifyInstance, FastifyRequest } from "fastify"
import fp from "fastify-plugin"
import { Redis } from "ioredis"
import { env } from "../env.js"

export type RouteCategory = "auth-write" | "coupon" | "upload" | "general"

export function getRouteCategory(req: FastifyRequest): RouteCategory {
  const url = (req.url.split("?")[0] ?? req.url).toLowerCase()
  const method = req.method.toUpperCase()

  // Protect sensitive Better Auth mutation endpoints from credential stuffing and spam
  if (url.startsWith("/api/auth") && (method === "POST" || method === "PUT" || method === "DELETE")) {
    return "auth-write"
  }

  // Prevent dictionary attacks on coupon discount codes
  if (url.startsWith("/v1/coupons/validate") && method === "POST") {
    return "coupon"
  }

  // Prevent disk saturation & payload bombing
  if (url.startsWith("/v1/uploads") && method === "POST") {
    return "upload"
  }

  return "general"
}

export function resolveMaxRequests(req: FastifyRequest): number {
  const category = getRouteCategory(req)
  switch (category) {
    case "auth-write":
      return 20
    case "coupon":
      return 20
    case "upload":
      return 30
    case "general":
    default:
      return 1000
  }
}

export function generateRateLimitKey(req: FastifyRequest): string {
  const category = getRouteCategory(req)
  return `${req.ip}:${category}`
}

async function rateLimitPlugin(app: FastifyInstance, opts?: { forceEnabled?: boolean }) {
  if (!env.RATE_LIMIT_ENABLED && !opts?.forceEnabled) {
    app.log.info("Rate limiting disabled (RATE_LIMIT_ENABLED=false)")
    return
  }

  const errorResponseBuilder = (req: FastifyRequest, context: { after: string }) => ({
    statusCode: 429,
    error: {
      code: "rateLimitExceeded",
      message: `Terlalu banyak permintaan. Silakan coba lagi dalam ${context.after}.`,
      requestId: req.id,
    },
  })

  if (env.REDIS_URL) {
    const redis = new Redis(env.REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 1 })
    redis.on("error", (error) => app.log.error(error, "rate-limit redis error"))
    app.addHook("onClose", async () => {
      await redis.quit().catch(() => redis.disconnect())
    })
    await app.register(rateLimit, {
      redis,
      max: resolveMaxRequests,
      timeWindow: "1 minute",
      keyGenerator: generateRateLimitKey,
      errorResponseBuilder,
    })
    app.log.info("Rate limiting enabled (Redis-backed, tiered: auth/coupons=20/min, uploads=30/min, general=1000/min)")
    return
  }

  await app.register(rateLimit, {
    max: resolveMaxRequests,
    timeWindow: "1 minute",
    keyGenerator: generateRateLimitKey,
    errorResponseBuilder,
  })

  app.log.info("Rate limiting enabled (in-memory, tiered: auth/coupons=20/min, uploads=30/min, general=1000/min)")
}

export default fp(rateLimitPlugin, {
  name: "rate-limit-plugin",
})
