import multipart from "@fastify/multipart"
import type { FastifyInstance } from "fastify"
import { uploadsRoutes } from "./routes/uploads.routes.js"
import { MAX_UPLOAD_CEILING_BYTES } from "./services/uploads.service.js"

/**
 * Upload domain module. @fastify/multipart is fastify-plugin-wrapped (it
 * does NOT create its own encapsulation scope), so it's registered inside
 * this same scoped sub-plugin as the routes that use it — mirroring
 * app.ts's mountAuth(), which scopes its own content-type-parser override
 * the same way, so neither affects any other module's normal body
 * parsing.
 */
export async function uploadsModule(app: FastifyInstance) {
  await app.register(async (scoped) => {
    await scoped.register(multipart, {
      limits: { fileSize: MAX_UPLOAD_CEILING_BYTES, files: 1 },
    })
    await scoped.register(uploadsRoutes)
  })
}
