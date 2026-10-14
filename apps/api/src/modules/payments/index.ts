import type { FastifyInstance } from "fastify"
import { paymentsRoutes } from "./routes/payments.routes.js"
import { paymentsWebhookRoutes } from "./routes/payments-webhook.routes.js"

export async function paymentsModule(app: FastifyInstance) {
  await app.register(paymentsRoutes)
  // Own scope: the webhook needs the raw signed body, not Fastify's
  // parsed JSON (see payments-webhook.routes.ts).
  await app.register(paymentsWebhookRoutes)
}
