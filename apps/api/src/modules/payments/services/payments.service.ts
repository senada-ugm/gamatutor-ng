import type { Coupon, CouponPricing, CouponStats, CouponValidation, Order } from "@workspace/contracts"
import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { db, type Tx } from "../../../db/index.js"
import { coupons, courses, orders } from "../../../db/app-schema.js"
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
} from "../../../lib/errors.js"
import { generateId } from "../../../lib/response.js"
import { ilikeContains } from "../../../lib/search.js"
import { createCheckoutSession, gatewayEnabled, refundPaymentIntent } from "../../../lib/stripe.js"

type CouponRow = typeof coupons.$inferSelect
type OrderRow = typeof orders.$inferSelect

/** Pricing math — one place, used by validate AND create so the preview
 *  can never drift from what an order actually charges. */
export function computePricing(row: CouponRow, originalPrice: number): CouponPricing {
  const raw =
    row.discountType === "percentage"
      ? Math.round((originalPrice * Math.min(row.discountValue, 100)) / 100)
      : row.discountValue
  const capped = row.maxDiscountAmount != null ? Math.min(raw, row.maxDiscountAmount) : raw
  const discountAmount = Math.max(0, Math.min(capped, originalPrice))
  return { originalPrice, discountAmount, finalPrice: originalPrice - discountAmount }
}

async function couponStatsBatch(ids: string[]): Promise<Map<string, CouponStats>> {
  if (ids.length === 0) return new Map()
  // Per-coupon aggregates over PAID orders only — a canceled pending
  // order never consumed money, so it must not count as "discount given".
  const rows = await db
    .select({
      couponId: orders.couponId,
      totalUses: sql<number>`count(*)::int`,
      uniqueUsers: sql<number>`count(distinct ${orders.userId})::int`,
      totalDiscountGiven: sql<number>`coalesce(sum(${orders.discountAmount}), 0)::int`,
    })
    .from(orders)
    .where(and(inArray(orders.couponId, ids), eq(orders.status, "paid")))
    .groupBy(orders.couponId)
  return new Map(rows.map((r) => [r.couponId!, { ...r }]))
}

function toCoupon(row: CouponRow, stats?: CouponStats): Coupon {
  return {
    id: row.id,
    code: row.code,
    description: row.description ?? undefined,
    discountType: row.discountType as Coupon["discountType"],
    discountValue: row.discountValue,
    maxDiscountAmount: row.maxDiscountAmount ?? undefined,
    courseId: row.courseId ?? undefined,
    institutionId: row.institutionId ?? undefined,
    maxUses: row.maxUses ?? undefined,
    maxUsesPerUser: row.maxUsesPerUser,
    currentUses: row.currentUses,
    isActive: row.isActive,
    startsAt: row.startsAt?.toISOString(),
    expiresAt: row.expiresAt?.toISOString(),
    stats: stats ?? {
      totalUses: 0,
      uniqueUsers: 0,
      totalDiscountGiven: 0,
      remainingUses: row.maxUses ?? undefined,
    },
    createdAt: row.createdAt.toISOString(),
  }
}

export async function getCouponRow(id: string): Promise<CouponRow> {
  const [row] = await db.select().from(coupons).where(eq(coupons.id, id)).limit(1)
  if (!row) throw new NotFoundError("Coupon", id)
  return row
}

/** Single-coupon read with the same stats the list embeds. */
export async function getCoupon(id: string): Promise<Coupon> {
  const row = await getCouponRow(id)
  const stats = (await couponStatsBatch([id])).get(id)
  return toCoupon(
    row,
    stats
      ? { ...stats, remainingUses: row.maxUses != null ? Math.max(0, row.maxUses - row.currentUses) : undefined }
      : undefined
  )
}

export async function createCoupon(
  input: Omit<CouponRow, "id" | "currentUses" | "createdAt" | "updatedAt">
): Promise<Coupon> {
  const [row] = await db
    .insert(coupons)
    .values({ ...input, id: generateId("cpn") })
    .returning()
    .catch((error) => {
      const cause = (error as { cause?: { code?: string; constraint?: string } })?.cause
      if (cause?.code === "23505" && (cause.constraint ?? "").includes("code")) {
        throw new ConflictError(`Coupon code '${input.code}' already exists`)
      }
      throw error
    })
  return toCoupon(row!)
}

export async function listCouponsPaged(params: {
  isActive?: boolean
  institutionId?: string
  courseId?: string
  search?: string
  page: number
  pageSize: number
}): Promise<{ rows: Coupon[]; totalCount: number }> {
  const conditions = [
    params.isActive !== undefined ? eq(coupons.isActive, params.isActive) : undefined,
    params.institutionId ? eq(coupons.institutionId, params.institutionId) : undefined,
    params.courseId ? eq(coupons.courseId, params.courseId) : undefined,
    params.search
      ? sql`(${coupons.code} ilike ${ilikeContains(params.search)} or ${coupons.description} ilike ${ilikeContains(params.search)})`
      : undefined,
  ].filter((c) => c !== undefined)
  const where = conditions.length ? and(...conditions) : undefined

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(coupons)
    .where(where)
  const rows = await db
    .select()
    .from(coupons)
    .where(where)
    .orderBy(coupons.createdAt)
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize)
  const stats = await couponStatsBatch(rows.map((r) => r.id))
  return {
    rows: rows.map((r) => {
      const s = stats.get(r.id)
      return toCoupon(
        r,
        s ? { ...s, remainingUses: r.maxUses != null ? Math.max(0, r.maxUses - r.currentUses) : undefined } : undefined
      )
    }),
    totalCount: countRow?.count ?? 0,
  }
}

export async function updateCoupon(id: string, patch: Partial<CouponRow>): Promise<Coupon> {
  const row = await getCouponRow(id)
  const [updated] = await db
    .update(coupons)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(coupons.id, id))
    .returning()
  const stats = (await couponStatsBatch([id])).get(id)
  return toCoupon(
    updated ?? row,
    stats
      ? {
          ...stats,
          remainingUses:
            (updated ?? row).maxUses != null
              ? Math.max(0, (updated ?? row).maxUses! - (updated ?? row).currentUses)
              : undefined,
        }
      : undefined
  )
}

export async function deleteCoupon(id: string): Promise<void> {
  await getCouponRow(id)
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(eq(orders.couponId, id))
  if ((row?.count ?? 0) > 0) {
    throw new ConflictError("This coupon has orders referencing it — deactivate it instead of deleting")
  }
  await db.delete(coupons).where(eq(coupons.id, id))
}

/** All non-amount rules a coupon must pass for this user + course.
 *  Returns a human-readable reason on failure (surfaced by validate). */
async function couponRejectionReason(row: CouponRow, courseId: string, userId: string): Promise<string | null> {
  if (!row.isActive) return "Kupon ini tidak aktif"
  const now = new Date()
  if (row.startsAt && now < row.startsAt) return "Kupon belum berlaku"
  if (row.expiresAt && now > row.expiresAt) return "Kupon sudah kedaluwarsa"
  if (row.courseId && row.courseId !== courseId) return "Kupon tidak berlaku untuk pelatihan ini"
  if (row.institutionId) {
    const [course] = await db
      .select({ institutionId: courses.institutionId })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1)
    if (!course || course.institutionId !== row.institutionId) return "Kupon tidak berlaku untuk pelatihan ini"
  }
  if (row.maxUses != null && row.currentUses >= row.maxUses) return "Kuota kupon sudah habis"
  if (row.maxUsesPerUser > 0) {
    const [perUser] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          eq(orders.couponId, row.id),
          eq(orders.userId, userId),
          inArray(orders.status, ["pending", "paid", "refunded"])
        )
      )
    if ((perUser?.count ?? 0) >= row.maxUsesPerUser) return "Anda sudah mencapai batas pemakaian kupon ini"
  }
  return null
}

/** The learner's "Terapkan" button: price the course with the code,
 *  creating nothing. */
export async function validateCoupon(courseId: string, code: string, userId: string): Promise<CouponValidation> {
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1)
  if (!course) throw new NotFoundError("Course", courseId)
  const price = course.price ?? 0

  const [row] = await db.select().from(coupons).where(eq(coupons.code, code.trim())).limit(1)
  if (!row) return { valid: false, message: "Kode kupon tidak ditemukan" }
  const rejection = await couponRejectionReason(row, courseId, userId)
  if (rejection) return { valid: false, message: rejection }
  return {
    valid: true,
    coupon: toCoupon(row),
    pricing: computePricing(row, price),
  }
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    userId: row.userId,
    courseId: row.courseId,
    couponId: row.couponId ?? undefined,
    couponCode: row.couponCode ?? undefined,
    originalPrice: row.originalPrice,
    discountAmount: row.discountAmount,
    finalAmount: row.finalAmount,
    status: row.status as Order["status"],
    paymentMethod: row.paymentMethod,
    confirmedByUserId: row.confirmedByUserId ?? undefined,
    paymentReference: row.paymentReference ?? undefined,
    confirmationNotes: row.confirmationNotes ?? undefined,
    proofUrl: row.proofUrl ?? undefined,
    createdAt: row.createdAt.toISOString(),
    paidAt: row.paidAt?.toISOString(),
    refundedAt: row.refundedAt?.toISOString(),
    refundReason: row.refundReason ?? undefined,
  }
}

export async function getOrderRow(id: string): Promise<OrderRow> {
  const [row] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  if (!row) throw new NotFoundError("Order", id)
  return row
}

export async function getOrder(id: string): Promise<Order> {
  return toOrder(await getOrderRow(id))
}

/** Creates the caller's pending order. Runs in one transaction: the
 *  coupon row is locked FOR UPDATE (redemption count can't race), the
 *  active-order uniqueness is re-checked, and both writes (order +
 *  currentUses increment) commit together. */
export async function createOrder(userId: string, input: { courseId: string; couponCode?: string }): Promise<Order> {
  const created = await db.transaction(async (tx) => {
    const [course] = await tx.select().from(courses).where(eq(courses.id, input.courseId)).for("update").limit(1)
    if (!course) throw new NotFoundError("Course", input.courseId)
    const price = course.price ?? 0
    if (price <= 0) throw new BadRequestError("This course is free — no order is needed")

    const [existingActive] = await tx
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(eq(orders.userId, userId), eq(orders.courseId, input.courseId), inArray(orders.status, ["pending", "paid"]))
      )
      .limit(1)
    if (existingActive) throw new ConflictError("You already have an active order for this course")

    let couponRow: CouponRow | null = null
    let discountAmount = 0
    if (input.couponCode?.trim()) {
      const [lockedCoupon] = await tx
        .select()
        .from(coupons)
        .where(eq(coupons.code, input.couponCode.trim()))
        .for("update")
        .limit(1)
      couponRow = lockedCoupon ?? null
      if (!couponRow) throw new BadRequestError("Kode kupon tidak ditemukan")
      const rejection = await couponRejectionReason(couponRow, input.courseId, userId)
      if (rejection) throw new BadRequestError(rejection)
      discountAmount = computePricing(couponRow, price).discountAmount
      await tx
        .update(coupons)
        .set({ currentUses: couponRow.currentUses + 1 })
        .where(eq(coupons.id, couponRow.id))
    }

    const [row] = await tx
      .insert(orders)
      .values({
        id: generateId("ord"),
        userId,
        courseId: input.courseId,
        couponId: couponRow?.id,
        couponCode: couponRow?.code,
        originalPrice: price,
        discountAmount,
        finalAmount: price - discountAmount,
        status: "pending",
      })
      .returning()
    return row!
  })
  return toOrder(created)
}

/** Manager confirms a received manual transfer with audit trail. */
export async function confirmPayment(
  id: string,
  confirmedByUserId: string,
  details?: { paymentReference?: string; note?: string; proofUrl?: string }
): Promise<Order> {
  const row = await getOrderRow(id)
  if (row.status !== "pending")
    throw new ConflictError(`Only a pending order can be confirmed (this one is '${row.status}')`)
  const [updated] = await db
    .update(orders)
    .set({
      status: "paid",
      paidAt: new Date(),
      confirmedByUserId,
      paymentReference: details?.paymentReference?.trim() || null,
      confirmationNotes: details?.note?.trim() || null,
      proofUrl: details?.proofUrl?.trim() || null,
    })
    .where(and(eq(orders.id, id), eq(orders.status, "pending")))
    .returning()
  if (!updated) throw new ConflictError("Order was already confirmed")
  return toOrder(updated)
}

/** Learner attaches their manual transfer proof / payment reference to their own pending order. */
export async function submitTransferProof(
  id: string,
  userId: string,
  details: { paymentReference: string; proofUrl?: string }
): Promise<Order> {
  const row = await getOrderRow(id)
  if (row.userId !== userId) throw new ForbiddenError("You can only submit proof for your own orders")
  if (row.status !== "pending") {
    throw new ConflictError(`Cannot submit proof for an order in status '${row.status}'`)
  }
  const [updated] = await db
    .update(orders)
    .set({
      paymentReference: details.paymentReference.trim(),
      proofUrl: details.proofUrl?.trim() || null,
    })
    .where(and(eq(orders.id, id), eq(orders.status, "pending")))
    .returning()
  if (!updated) throw new ConflictError("Order is no longer pending")
  return toOrder(updated)
}

// ---------------------------------------------------------------------------
// Stripe-compatible gateway (lib/stripe.ts). Manual-transfer flows above
// stay the default when the gateway is unconfigured.
// ---------------------------------------------------------------------------

/** Creates a hosted checkout session for the caller's pending order.
 *  The amount is recomputed server-side from the order row — never from
 *  the request. */
export async function createGatewayCheckout(
  id: string,
  user: { id: string; email?: string | null }
): Promise<{ orderId: string; sessionId: string; url: string }> {
  if (!gatewayEnabled()) {
    throw new ServiceUnavailableError("Online payment is not configured — complete the manual transfer instead")
  }
  const row = await getOrderRow(id)
  if (row.userId !== user.id) throw new ForbiddenError("This is not your order")
  if (row.status !== "pending") {
    throw new ConflictError(`Only a pending order can be paid online (this one is '${row.status}')`)
  }
  const [course] = await db.select({ title: courses.title }).from(courses).where(eq(courses.id, row.courseId)).limit(1)

  const session = await createCheckoutSession({
    orderId: row.id,
    amount: row.finalAmount,
    title: course?.title ?? "LMS course",
    userEmail: user.email ?? "",
  })
  if ("error" in session) throw new BadRequestError(`Gateway refused the checkout session: ${session.error}`)

  await db.update(orders).set({ externalSessionId: session.id, paymentMethod: "stripe" }).where(eq(orders.id, id))
  return { orderId: row.id, sessionId: session.id, url: session.url }
}

/** Webhook-driven confirmation: flips the order to paid and records the
 *  gateway's payment intent. Idempotent — duplicate deliveries of
 *  checkout.session.completed converge on one paid row, and an order
 *  already confirmed via manual transfer is left untouched. */
export async function markPaidViaGateway(sessionId: string, paymentIntentId: string | null): Promise<Order | null> {
  const [updated] = await db
    .update(orders)
    .set({
      status: "paid",
      paidAt: new Date(),
      paymentMethod: "stripe",
      externalPaymentIntentId: paymentIntentId,
    })
    .where(and(eq(orders.externalSessionId, sessionId), eq(orders.status, "pending")))
    .returning()
  return updated ? toOrder(updated) : null
}

/** Refunds a paid order. Orders paid through the gateway are refunded
 *  THERE first — the local status only flips once the money actually
 *  moves back. Manual-transfer orders skip the gateway leg. */
export async function refundOrder(id: string, reason: string): Promise<Order> {
  const row = await getOrderRow(id)
  if (row.status !== "paid") throw new ConflictError(`Only a paid order can be refunded (this one is '${row.status}')`)
  if (row.externalPaymentIntentId && gatewayEnabled()) {
    const refunded = await refundPaymentIntent(row.externalPaymentIntentId)
    if (refunded !== true) {
      throw new ConflictError(`Gateway refund failed: ${refunded.error} — the order stays marked paid`)
    }
  }
  const [updated] = await db
    .update(orders)
    .set({ status: "refunded", refundedAt: new Date(), refundReason: reason })
    .where(and(eq(orders.id, id), eq(orders.status, "paid")))
    .returning()
  if (!updated) throw new ConflictError("Order was already refunded")
  return toOrder(updated)
}

/** Cancels a pending order, releasing the coupon redemption it held. */
export async function cancelOrder(id: string): Promise<Order> {
  const row = await getOrderRow(id)
  if (row.status !== "pending")
    throw new ConflictError(`Only a pending order can be canceled (this one is '${row.status}')`)
  const updated = await db.transaction(async (tx) => {
    const [canceled] = await tx
      .update(orders)
      .set({ status: "canceled", canceledAt: new Date() })
      .where(and(eq(orders.id, id), eq(orders.status, "pending")))
      .returning()
    if (!canceled) throw new ConflictError("Order was already canceled")
    if (canceled.couponId) {
      await tx
        .update(coupons)
        .set({ currentUses: sql`greatest(${coupons.currentUses} - 1, 0)` })
        .where(eq(coupons.id, canceled.couponId))
    }
    return canceled
  })
  return toOrder(updated)
}

/** Orders the caller may see: their own, or everything for a course
 *  they manage (route enforces the manager check for courseId). */
export async function listOrdersPaged(params: {
  userId?: string
  courseId?: string
  courseIds?: string[]
  status?: string
  page: number
  pageSize: number
}): Promise<{ rows: Order[]; totalCount: number }> {
  const conditions = [
    params.userId ? eq(orders.userId, params.userId) : undefined,
    params.courseId ? eq(orders.courseId, params.courseId) : undefined,
    // An institution with no courses matches nothing; `inArray` on an
    // empty list is a SQL error and omitting it would list everything.
    params.courseIds ? (params.courseIds.length ? inArray(orders.courseId, params.courseIds) : sql`false`) : undefined,
    params.status ? eq(orders.status, params.status) : undefined,
  ].filter((c) => c !== undefined)
  const where = conditions.length ? and(...conditions) : undefined
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(where)
  const rows = await db
    .select()
    .from(orders)
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize)
  return { rows: rows.map(toOrder), totalCount: countRow?.count ?? 0 }
}

/** The content gate's one lookup: does this user hold a paid order for
 *  this course? Callers only invoke it for courses with price > 0. */
export async function hasPaidOrder(userId: string, courseId: string, tx?: Tx): Promise<boolean> {
  const d = tx ?? db
  const [row] = await d
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.courseId, courseId), eq(orders.status, "paid")))
    .limit(1)
  return !!row
}

/** Batch lookup: returns a set of "userId:courseId" keys for paid orders. */
export async function getPaidOrdersSet(pairs: { userId: string; courseId: string }[]): Promise<Set<string>> {
  if (pairs.length === 0) return new Set()
  const userIds = [...new Set(pairs.map((p) => p.userId))]
  const courseIds = [...new Set(pairs.map((p) => p.courseId))]
  const rows = await db
    .select({ userId: orders.userId, courseId: orders.courseId })
    .from(orders)
    .where(and(inArray(orders.userId, userIds), inArray(orders.courseId, courseIds), eq(orders.status, "paid")))
  return new Set(rows.map((r) => `${r.userId}:${r.courseId}`))
}
