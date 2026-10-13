import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"
import { env } from "../../env.js"
import { dataResponse } from "../../lib/response.js"
import { resetAndSeedDatabase } from "../../db/seed.js"

const resetBodySchema = z.object({
  confirm: z.literal("CONFIRM_DATABASE_RESET"),
})

export function devRoutes(app: FastifyInstance) {
  // GET /v1/dev/status — reports whether DEV_MODE is active and available quick-login accounts
  app.get("/dev/status", async (request: FastifyRequest) => {
    if (!env.DEV_MODE) {
      return dataResponse({ devMode: false, accounts: [] }, request.id)
    }

    return dataResponse(
      {
        devMode: true,
        accounts: [
          {
            role: "admin",
            name: "LMS Admin",
            email: "admin@lms.dev",
            password: "correcthorsebatterystaple",
            description: "Full platform administrator with institution management & system settings",
          },
          {
            role: "owner",
            name: "Institution Owner",
            email: "owner@lms.dev",
            password: "correcthorsebatterystaple",
            description: "Owner of training institution with course management and instructor privileges",
          },
          {
            role: "user",
            name: "Trainee / Doctor",
            email: "user@lms.dev",
            password: "correcthorsebatterystaple",
            description: "Healthcare worker / Puskesmas doctor enrolled in DRIVE Diabetic Retinopathy",
          },
        ],
      },
      request.id
    )
  })

  // POST /v1/dev/reset-seed — wipes and re-seeds the demo database
  app.post("/dev/reset-seed", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!env.DEV_MODE) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Dev utilities are disabled" },
      })
    }

    const parseResult = resetBodySchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Must supply confirm: 'CONFIRM_DATABASE_RESET'",
        },
      })
    }

    try {
      request.log.warn("DEV_MODE: Resetting and re-seeding demo database...")
      await resetAndSeedDatabase()
      request.log.info("DEV_MODE: Demo database reset complete.")
      return dataResponse(
        {
          success: true,
          message: "Database has been reset and seeded with demo baseline data.",
        },
        request.id
      )
    } catch (err) {
      request.log.error(err, "DEV_MODE: Failed to reset and seed database")
      return reply.status(500).send({
        error: { code: "INTERNAL_ERROR", message: "Failed to reset and seed database" },
      })
    }
  })
}
