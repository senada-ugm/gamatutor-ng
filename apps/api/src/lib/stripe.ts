import { createHmac, timingSafeEqual } from "node:crypto"
import { env } from "../env.js"

/**
 * Minimal Stripe-compatible gateway client. Speaks just enough of the
 * Stripe REST surface for the order flow — hosted Checkout redirect +
 * webhook confirmation + refund — against real Stripe or any processor
 * that implements the same shapes (Bearer auth, form-encoded bodies,
 * Stripe-Signature webhooks). Point PAYMENT_API_BASE at a different base
 * URL to switch processors; no SDK dependency on purpose.
 *
 * Disabled by design: every helper returns null when PAYMENT_SECRET_KEY
 * is unset, and callers fall back to the manual-transfer flow.
 */

export function gatewayEnabled(): boolean {
  return env.PAYMENT_SECRET_KEY.length > 0
}

/** Stripe bodies are application/x-www-form-urlencoded with bracketed
 *  nested params (line_items[0][price_data][currency]). */
function formEncode(entries: Array<[string, string]>): string {
  const params = new URLSearchParams()
  for (const [key, value] of entries) params.append(key, value)
  return params.toString()
}

async function stripeRequest<T>(
  path: string,
  entries: Array<[string, string]>
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const res = await fetch(`${env.PAYMENT_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.PAYMENT_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formEncode(entries),
  })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const error = body.error as { message?: string } | undefined
    return { ok: false, status: res.status, error: error?.message ?? `gateway ${res.status}` }
  }
  return { ok: true, data: body as T }
}

export interface CheckoutSession {
  id: string
  url: string
  payment_intent?: string | null
}

/** Creates a hosted Checkout Session the learner is redirected to. The
 *  order id rides in metadata + client_reference_id so the webhook can
 *  find its way home without trusting any client-supplied amount. */
export async function createCheckoutSession(params: {
  orderId: string
  amount: number
  title: string
  userEmail: string
}): Promise<CheckoutSession | { error: string }> {
  const successUrl = env.PAYMENT_SUCCESS_URL || `${env.WEB_PUBLIC_URL}/account/orders?payment=success`
  const cancelUrl = env.PAYMENT_CANCEL_URL || `${env.WEB_PUBLIC_URL}/account/orders?payment=cancelled`
  const result = await stripeRequest<CheckoutSession>("/v1/checkout/sessions", [
    ["mode", "payment"],
    ["success_url", successUrl],
    ["cancel_url", cancelUrl],
    ["customer_email", params.userEmail],
    ["client_reference_id", params.orderId],
    ["metadata[orderId]", params.orderId],
    ["line_items[0][quantity]", "1"],
    ["line_items[0][price_data][currency]", env.PAYMENT_CURRENCY],
    ["line_items[0][price_data][unit_amount]", String(params.amount)],
    ["line_items[0][price_data][product_data][name]", params.title],
  ])
  if (!result.ok) return { error: result.error }
  return result.data
}

/** Refunds a PaymentIntent in full. Used by refundOrder when the order
 *  was paid through the gateway — the money must actually move back
 *  before the local status flips to refunded. */
export async function refundPaymentIntent(paymentIntentId: string): Promise<true | { error: string }> {
  const result = await stripeRequest<{ id: string }>("/v1/refunds", [["payment_intent", paymentIntentId]])
  if (!result.ok) return { error: result.error }
  return true
}

const WEBHOOK_TOLERANCE_SECONDS = 300

/**
 * Verifies a Stripe-Signature header against the raw request body:
 * `t=<unix>,v1=hex(hmac_sha256(secret, `${t}.${rawBody}`))`. Constant-time
 * compare; rejects timestamps older than the tolerance window (replay).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
  now = Date.now()
): boolean {
  if (!signatureHeader) return false
  let timestamp = ""
  const provided: string[] = []
  for (const part of signatureHeader.split(",")) {
    const [key, value] = part.split("=", 2)
    if (key === "t") timestamp = value ?? ""
    else if (key === "v1" && value) provided.push(value)
  }
  if (!timestamp || provided.length === 0) return false
  const ageSeconds = Math.floor(now / 1000) - Number(timestamp)
  if (
    !Number.isFinite(ageSeconds) ||
    ageSeconds > WEBHOOK_TOLERANCE_SECONDS ||
    ageSeconds < -WEBHOOK_TOLERANCE_SECONDS
  ) {
    return false
  }
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")
  const expectedBuf = Buffer.from(expected, "hex")
  for (const candidate of provided) {
    const candidateBuf = Buffer.from(candidate, "hex")
    if (candidateBuf.length === expectedBuf.length && timingSafeEqual(candidateBuf, expectedBuf)) return true
  }
  return false
}
