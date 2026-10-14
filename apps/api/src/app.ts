import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import cors from "@fastify/cors"
import scalarApiReference from "@scalar/fastify-api-reference"
import { toNodeHandler } from "better-auth/node"
import Fastify from "fastify"
import YAML from "yaml"
import { auth } from "./auth.js"
import { env, corsOrigins } from "./env.js"
import { getOptionalSession } from "./lib/require-session.js"
import { isMaintenanceMode } from "./lib/maintenance.js"
import { handleError } from "./lib/errors.js"
import { auditModule } from "./modules/audit/index.js"
import { assignmentsModule } from "./modules/assignments/index.js"
import { certificatesModule } from "./modules/certificates/index.js"
import { courseContentModule } from "./modules/course-content/index.js"
import { courseInstructorsModule } from "./modules/course-instructors/index.js"
import { coursesModule } from "./modules/courses/index.js"
import { enrollmentsModule } from "./modules/enrollments/index.js"
import { healthRoutes } from "./modules/health/index.js"
import { institutionsModule } from "./modules/institutions/index.js"
import { notificationsModule } from "./modules/notifications/index.js"
import { reportsModule } from "./modules/reports/index.js"
import { announcementsModule } from "./modules/announcements/index.js"
import { platformSettingsModule } from "./modules/platform-settings/index.js"
import { quizzesModule } from "./modules/quizzes/index.js"
import { telemetryModule } from "./modules/telemetry/index.js"
import { uploadsModule } from "./modules/uploads/index.js"
import { startUploadSweep, stopUploadSweep } from "./modules/uploads/services/uploads.service.js"
import { usersModule } from "./modules/users/index.js"
import { devModule } from "./modules/dev/index.js"
import rateLimitPlugin from "./plugins/rate-limit.js"
import metricsPlugin from "./plugins/metrics.js"
import securityHeadersPlugin from "./plugins/security-headers.js"

const require = createRequire(import.meta.url)

/**
 * Load the OpenAPI spec compiled from packages/contracts' TypeSpec sources.
 * The `./openapi` subpath export in the contracts package points at the
 * committed YAML, so this stays correct wherever the workspace is checked
 * out.
 */
function loadOpenApiSpec() {
  const specPath = require.resolve("@workspace/contracts/openapi")
  const specContent = readFileSync(specPath, "utf-8")
  return YAML.parse(specContent)
}

/**
 * Minimal Fastify app (adapted from the vamios-core skeleton): security
 * headers → CORS → rate limit → auth → API docs → modules.
 */
export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === "test" ? false : { level: env.LOG_LEVEL },
    trustProxy: env.TRUST_PROXY,
  })

  // Route handlers throw; this renders every failure — domain AppErrors,
  // zod validation, Fastify parser errors — as Common.ErrorResponse
  // (see handleError), so no per-handler catch boilerplate is needed.
  app.setErrorHandler((error, request, reply) => {
    const { statusCode, body } = handleError(error, request.id)
    if (statusCode >= 500) request.log.error({ err: error }, "request failed")
    reply.status(statusCode).send(body)
  })

  await registerCorePlugins(app)
  await mountAuth(app)
  await setupApiDocs(app)

  // Maintenance mode (platform-settings): while on, every business
  // route answers 503 to non-admins. Exempt: the auth surface (people
  // must still sign in/out and recover passwords), health probes (an
  // orchestrator must not kill us during maintenance), and the docs.
  // The settings read is cached briefly (see lib/maintenance.ts).
  app.addHook("onRequest", async (request, reply) => {
    const path = request.url.split("?")[0] ?? request.url
    const exempt =
      path === "/health" ||
      path === "/v1/health" ||
      path.startsWith("/api/auth") ||
      path.startsWith("/docs") ||
      !path.startsWith("/v1")
    if (exempt) return

    if (!(await isMaintenanceMode())) return

    const session = await getOptionalSession(request)
    if (session?.role === "admin") return

    reply.status(503)
    return reply.send({
      error: {
        code: "maintenance",
        message: "Platform sedang dalam pemeliharaan. Coba beberapa saat lagi.",
        requestId: request.id,
      },
    })
  })

  // Modules
  // The route answers on both /health (infra probes, CI) and /v1/health
  // (the generated SDK's baseUrl already includes the /v1 prefix).
  await app.register(healthRoutes)
  await app.register(institutionsModule, { prefix: "/v1" })
  await app.register(coursesModule, { prefix: "/v1" })
  await app.register(courseContentModule, { prefix: "/v1" })
  await app.register(courseInstructorsModule, { prefix: "/v1" })
  await app.register(enrollmentsModule, { prefix: "/v1" })
  await app.register(assignmentsModule, { prefix: "/v1" })
  await app.register(certificatesModule, { prefix: "/v1" })
  await app.register(quizzesModule, { prefix: "/v1" })
  await app.register(uploadsModule, { prefix: "/v1" })
  await app.register(notificationsModule, { prefix: "/v1" })
  await app.register(reportsModule, { prefix: "/v1" })
  await app.register(announcementsModule, { prefix: "/v1" })
  await app.register(platformSettingsModule, { prefix: "/v1" })
  await app.register(usersModule, { prefix: "/v1" })
  await app.register(auditModule, { prefix: "/v1" })
  await app.register(telemetryModule, { prefix: "/v1" })
  await app.register(devModule, { prefix: "/v1" })

  // Orphaned-upload sweep: started once the app is ready, stopped on
  // shutdown — not a bare module-scope setInterval, which would leak
  // across dev-server reloads and has no clean shutdown path.
  app.addHook("onReady", async () => {
    startUploadSweep((error) => app.log.error(error, "upload sweep failed"))
  })
  app.addHook("onClose", async () => {
    stopUploadSweep()
  })

  return app
}

async function registerCorePlugins(app: import("fastify").FastifyInstance) {
  // Metrics first: its onRequest/onResponse hooks must be registered
  // before the module routes to time every one of them.
  await app.register(metricsPlugin, { prefix: "" })
  await app.register(securityHeadersPlugin)

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      if (corsOrigins.includes(origin) || (env.NODE_ENV !== "production" && env.CORS_ORIGIN === "")) {
        return cb(null, true)
      }
      return cb(new Error("Not allowed by CORS"), false)
    },
    // Better Auth's session lives in a cookie — the web app needs it
    // echoed back cross-origin (the web frontend on :3000, apps/api on :8000).
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })

  await app.register(rateLimitPlugin)
}

/**
 * Mounts Better Auth's handler at /api/auth/*. Scoped in its own
 * encapsulated plugin so the content-type parser override below (Better
 * Auth reads the raw request body itself; Fastify's default JSON parser
 * would otherwise consume the stream first) doesn't affect any other
 * route's normal Fastify body parsing.
 */
async function mountAuth(app: import("fastify").FastifyInstance) {
  await app.register(async (scoped) => {
    scoped.removeContentTypeParser("application/json")
    scoped.addContentTypeParser("application/json", (_request, payload, done) => {
      done(null, payload)
    })

    const handler = toNodeHandler(auth)
    scoped.all("/api/auth/*", async (request, reply) => {
      // reply.hijack() bypasses Fastify's reply pipeline entirely, so
      // @fastify/cors's onRequest hook (which only stages headers on the
      // Fastify `reply` wrapper) never actually reaches the socket —
      // toNodeHandler writes straight to the raw Node response. Set the
      // same headers directly on the raw response before handing off,
      // restricted to the same corsOrigins allow-list @fastify/cors
      // enforces for the rest of the app.
      const origin = request.headers.origin
      const isAllowed =
        origin && (corsOrigins.includes(origin) || (env.NODE_ENV !== "production" && env.CORS_ORIGIN === ""))
      if (origin && isAllowed) {
        reply.raw.setHeader("Access-Control-Allow-Origin", origin)
        reply.raw.setHeader("Access-Control-Allow-Credentials", "true")
        reply.raw.setHeader("Vary", "Origin")
      }
      if (request.method === "OPTIONS") {
        reply.raw.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        reply.raw.setHeader("Access-Control-Allow-Headers", request.headers["access-control-request-headers"] ?? "*")
        reply.raw.writeHead(204)
        reply.raw.end()
        return
      }

      reply.hijack()
      await handler(request.raw, reply.raw)
    })
  })
}

async function setupApiDocs(app: import("fastify").FastifyInstance) {
  const openApiSpec = loadOpenApiSpec()
  app.get("/openapi.json", async () => openApiSpec)

  await app.register(scalarApiReference, {
    routePrefix: "/docs",
    configuration: {
      pageTitle: "LMS API Documentation",
      theme: "kepler",
      url: "/openapi.json",
    },
  })
}
