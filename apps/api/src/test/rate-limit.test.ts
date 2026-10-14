import assert from "node:assert/strict"
import { describe, it } from "node:test"
import Fastify from "fastify"
import rateLimitPlugin, { generateRateLimitKey, getRouteCategory, resolveMaxRequests } from "../plugins/rate-limit.js"

describe("Tiered Rate Limiter & Abuse Defense", () => {
  describe("Route Categorization & Threshold Resolution", () => {
    it("categorizes auth mutation endpoints as auth-write (20 req/min)", () => {
      const signInReq = { url: "/api/auth/sign-in/email", method: "POST" } as any
      const signUpReq = { url: "/api/auth/sign-up/email", method: "POST" } as any
      const resetReq = { url: "/api/auth/reset-password", method: "POST" } as any

      assert.equal(getRouteCategory(signInReq), "auth-write")
      assert.equal(getRouteCategory(signUpReq), "auth-write")
      assert.equal(getRouteCategory(resetReq), "auth-write")

      assert.equal(resolveMaxRequests(signInReq), 20)
      assert.equal(resolveMaxRequests(signUpReq), 20)
      assert.equal(resolveMaxRequests(resetReq), 20)
    })

    it("allows auth read endpoints to fall into general category", () => {
      const getSessionReq = { url: "/api/auth/get-session", method: "GET" } as any
      assert.equal(getRouteCategory(getSessionReq), "general")
      assert.equal(resolveMaxRequests(getSessionReq), 1000)
    })

    it("categorizes upload mutations as upload (30 req/min)", () => {
      const uploadReq = { url: "/v1/uploads", method: "POST" } as any
      assert.equal(getRouteCategory(uploadReq), "upload")
      assert.equal(resolveMaxRequests(uploadReq), 30)

      const downloadReq = { url: "/v1/uploads/upl_123/file", method: "GET" } as any
      assert.equal(getRouteCategory(downloadReq), "general")
      assert.equal(resolveMaxRequests(downloadReq), 1000)
    })

    it("categorizes general business endpoints as general (1000 req/min)", () => {
      const coursesReq = { url: "/v1/courses", method: "GET" } as any
      const healthReq = { url: "/health", method: "GET" } as any

      assert.equal(getRouteCategory(coursesReq), "general")
      assert.equal(getRouteCategory(healthReq), "general")
      assert.equal(resolveMaxRequests(coursesReq), 1000)
      assert.equal(resolveMaxRequests(healthReq), 1000)
    })

    it("segregates rate-limit keys by IP and category", () => {
      const ip = "192.168.1.50"
      const authKey = generateRateLimitKey({ ip, url: "/api/auth/sign-in", method: "POST" } as any)
      const uploadKey = generateRateLimitKey({ ip, url: "/v1/uploads", method: "POST" } as any)
      const generalKey = generateRateLimitKey({ ip, url: "/v1/courses", method: "GET" } as any)

      assert.equal(authKey, "192.168.1.50:auth-write")
      assert.equal(uploadKey, "192.168.1.50:upload")
      assert.equal(generalKey, "192.168.1.50:general")
      assert.notEqual(authKey, uploadKey)
    })
  })

  describe("Fastify Rate Limiting Enforcement", () => {
    it("returns 429 with Common.ErrorResponse envelope when threshold is breached", async () => {
      const app = Fastify()
      await app.register(rateLimitPlugin, { forceEnabled: true })

      app.post("/api/auth/sign-in/email", async () => ({ ok: true }))

      // Fire 20 requests (allowed)
      for (let i = 0; i < 20; i++) {
        const res = await app.inject({
          method: "POST",
          url: "/api/auth/sign-in/email",
          remoteAddress: "10.0.0.1",
        })
        assert.equal(res.statusCode, 200)
      }

      // 21st request must trigger 429
      const blocked = await app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        remoteAddress: "10.0.0.1",
      })

      assert.equal(blocked.statusCode, 429)
      const payload = JSON.parse(blocked.payload)
      assert.equal(payload.error.code, "rateLimitExceeded")
      assert.ok(payload.error.message.includes("Terlalu banyak permintaan"))
      assert.ok(payload.error.requestId)

      // Different IP from same route should still be allowed
      const allowedDifferentIp = await app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        remoteAddress: "10.0.0.2",
      })
      assert.equal(allowedDifferentIp.statusCode, 200)

      await app.close()
    })
  })
})
