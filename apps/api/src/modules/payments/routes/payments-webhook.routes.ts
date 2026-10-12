import type { FastifyInstance } from "fastify"
import { eq } from "drizzle-orm"
import { db } from "../../../db/index.js"
import { orders } from "../../../db/app-schema.js"
import { env } from "../../../env.js"
import { BadRequestError } from "../../../lib/errors.js"
import { notifyUserById } from "../../../lib/notify.js"
import { verifyWebhookSignature } from "../../../lib/stripe.js"
import * as service from "../services/payments.service.js"

/**
 * Stripe-compatible webhook receiver — POST /v1/payments/webhook.
 * Deliberately OUTSIDE the TypeSpec contract (operational endpoint, same
 * precedent as POST /uploads/sweep and Better Auth's own routes).
 *
 * Registered in its own encapsulated scope with a raw-body JSON parser:
 * signature verification needs the exact bytes the gateway signed, so
 * this scope must not run Fastify's default JSON parser first (same
 * trick mountAuth uses for Better Auth).
 */
export async function paymentsWebhookRoutes(app: FastifyInstance) {
  app.removeContentTypeParser("application/json")
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_request: unknown, body: unknown, done: (err: Error | null, result?: unknown) => void) => {
      done(null, body)
    }
  )

  app.post("/payments/webhook", async (request, reply) => {
    const rawBody = typeof request.body === "string" ? request.body : ""
    const signatureHeader = request.headers["stripe-signature"]
    if (
      !verifyWebhookSignature(
        rawBody,
        Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader,
        env.PAYMENT_WEBHOOK_SECRET
      )
    ) {
      // Bad signature = not our gateway talking. 400, no detail.
      throw new BadRequestError("Invalid webhook signature")
    }

    const event = JSON.parse(rawBody) as {
      type?: string
      data?: { object?: { id?: string; payment_intent?: string | null; metadata?: Record<string, string> } }
    }
    const object = event.data?.object

    if (event.type === "checkout.session.completed" && object?.id) {
      const paid = await service.markPaidViaGateway(object.id, object.payment_intent ?? null)
      if (paid) {
        // Same notification the manual-confirm path sends.
        await notifyUserById(paid.userId, {
          type: "order_paid",
          title: "Pembayaran diterima",
          body: "Pembayaran pelatihan Anda telah dikonfirmasi — materi pelatihan sekarang terbuka.",
          link: `/learn/${paid.courseId}`,
        })
      }
      // No row / not pending: duplicate delivery or already confirmed —
      // both converge to the same end state, acknowledge with 204.
    }
    // Unknown/unhandled event types are acknowledged, per webhook etiquette.

    reply.status(204)
    return null
  })
}

/** Kept for future use: look up an order by its external session — the
 *  debugging helper ops will want once more event types are handled. */
export async function findOrderBySession(sessionId: string) {
  const [row] = await db.select().from(orders).where(eq(orders.externalSessionId, sessionId)).limit(1)
  return row ?? null
}
