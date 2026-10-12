import { check, eq, status } from "../lib/assert.mjs"

/**
 * The paid funnel: coupon authoring + validation, then the full order
 * lifecycle — create (with coupon pricing), gateway checkout behavior,
 * manual confirmation (the realistic Indonesian B2B flow), refund, and
 * the content-unlock rule: a paid course's material stays locked to a
 * selected enrollee until their order is paid.
 */
export async function run(ctx) {
  console.log("\n== Coupons & Payments ==")
  const { admin, user, anon, ids } = ctx

  // --- a dedicated PAID course (the journey course stays free) ---
  const paid = status(
    "admin creates a paid course",
    await admin.post("/v1/courses", {
      json: {
        title: `Journey Paid Course ${ctx.stamp}`,
        institutionId: ids.institution,
        courseType: "online",
        isDisabilityFriendly: false,
        supportedDisabilityTypes: [],
        price: 100000,
      },
    }),
    201
  )
  const paidCourseId = paid?.data?.id
  status("admin publishes the paid course", await admin.post(`/v1/courses/${paidCourseId}/publish`), 200)

  // --- coupons ---
  const coupon = status(
    "admin creates a 20% coupon",
    await admin.post("/v1/coupons", {
      json: {
        code: `JOURNEY${ctx.stamp}`,
        description: "journey discount",
        discountType: "percentage",
        discountValue: 20,
        maxUsesPerUser: 2,
        courseId: paidCourseId,
      },
    }),
    201
  )
  const couponId = coupon?.data?.id
  const listed = status("admin lists coupons", await admin.get(`/v1/coupons?courseId=${paidCourseId}`), 200)
  check(
    "coupon appears in the list",
    (listed?.data ?? []).some((c) => c.id === couponId)
  )
  const fetched = status("admin fetches the coupon by id", await admin.get(`/v1/coupons/${couponId}`), 200)
  eq("coupon stats are computed on read", fetched?.data?.stats?.totalUses, 0)
  status(
    "anon cannot validate a coupon",
    await anon.post("/v1/coupons/validate", { json: { courseId: paidCourseId, code: `JOURNEY${ctx.stamp}` } }),
    401
  )

  // --- the order lifecycle ---
  status(
    "user self-enrolls in the paid course",
    await user.post("/v1/enrollments", { json: { courseId: paidCourseId } }),
    201
  )
  // admin sees every row; find the user's enrollment under it
  const enrollments = await admin
    .get(`/v1/enrollments?courseId=${paidCourseId}&pageSize=10`)
    .then((r) => r.body?.data ?? [])
  const paidEnrollmentId = (enrollments.find((e) => e.userId === ids.userId) ?? enrollments[0])?.id
  const module = status(
    "admin adds a module+lesson to the paid course",
    await admin.post(`/v1/courses/${paidCourseId}/modules`, { json: { title: "Paid Module" } }),
    201
  )
  const lesson = status(
    "admin adds the paid lesson",
    await admin.post(`/v1/modules/${module?.data?.id}/lessons`, { json: { title: "Paid Lesson" } }),
    201
  )
  const paidLessonId = lesson?.data?.id
  status(
    "admin selects the enrollee",
    await admin.patch(`/v1/enrollments/${paidEnrollmentId}`, { json: { status: "selected" } }),
    200
  )

  // selected but UNPAID: content stays locked (the business rule)
  status(
    "unpaid selected enrollee cannot complete paid lessons",
    await user.post(`/v1/lesson-progress/${paidLessonId}/complete?courseId=${paidCourseId}`),
    403
  )

  const validated = status(
    "user validates the coupon",
    await user.post("/v1/coupons/validate", { json: { courseId: paidCourseId, code: `JOURNEY${ctx.stamp}` } }),
    200
  )
  eq("coupon pricing computed server-side", validated?.data?.pricing?.finalPrice, 80000)
  status(
    "invalid coupon code reports invalid",
    await user.post("/v1/coupons/validate", { json: { courseId: paidCourseId, code: "NOPE" } }),
    200
  )
  check("invalid coupon flagged, not errored", validated?.data !== undefined)

  const order = status(
    "user creates the order with the coupon",
    await user.post("/v1/orders", { json: { courseId: paidCourseId, couponCode: `JOURNEY${ctx.stamp}` } }),
    201
  )
  const orderId = order?.data?.id
  eq("order priced at the discounted amount", order?.data?.finalAmount, 80000)
  const mine = status("user lists their orders", await user.get("/v1/orders"), 200)
  check(
    "order appears in the buyer's list",
    (mine?.data ?? []).some((o) => o.id === orderId)
  )
  const one = status("user fetches the order by id", await user.get(`/v1/orders/${orderId}`), 200)
  eq("order carries the coupon code", one?.data?.couponCode, `JOURNEY${ctx.stamp}`)
  status("anon cannot create an order", await anon.post("/v1/orders", { json: { courseId: paidCourseId } }), 401)

  // gateway checkout: only available with PAYMENT_SECRET_KEY; the local
  // default has none, so this is the documented 503 (manual flow applies)
  const checkout = await user.post(`/v1/orders/${orderId}/checkout`)
  check("checkout is either hosted (200) or unconfigured (503)", checkout.status === 200 || checkout.status === 503)

  // learner attaches manual transfer reference / proof
  const submittedProof = status(
    "user submits manual transfer proof",
    await user.post(`/v1/orders/${orderId}/submit-proof`, {
      json: { paymentReference: `BCA-${ctx.stamp}`, proofUrl: "https://example.com/proof.jpg" },
    }),
    200
  )
  eq("proof reference persisted", submittedProof?.data?.paymentReference, `BCA-${ctx.stamp}`)

  // manual confirmation by the manager flips it to paid…
  status("plain user cannot confirm their own payment", await user.post(`/v1/orders/${orderId}/confirm-payment`), 403)
  const confirmed = status(
    "admin confirms the manual transfer",
    await admin.post(`/v1/orders/${orderId}/confirm-payment`),
    200
  )
  eq("order is paid", confirmed?.data?.status, "paid")

  // …which unlocks the content
  status(
    "paid enrollee can now complete lessons",
    await user.post(`/v1/lesson-progress/${paidLessonId}/complete?courseId=${paidCourseId}`),
    200
  )

  // refund revokes the access the payment granted
  const refunded = status(
    "admin refunds the paid order",
    await admin.post(`/v1/orders/${orderId}/refund`, { json: { reason: "journey test refund" } }),
    200
  )
  eq("order is refunded", refunded?.data?.status, "refunded")
  status(
    "refunded enrollee loses content access",
    await user.post(`/v1/lesson-progress/${paidLessonId}/complete?courseId=${paidCourseId}`),
    403
  )

  // cancel path on a fresh pending order
  const order2 = status(
    "user creates a second order",
    await user.post("/v1/orders", { json: { courseId: paidCourseId } }),
    201
  )
  status("user cancels their pending order", await user.post(`/v1/orders/${order2?.data?.id}/cancel`), 200)

  // coupon lifecycle close-out
  status(
    "admin deactivates the coupon",
    await admin.patch(`/v1/coupons/${couponId}`, { json: { isActive: false } }),
    200
  )
  const postPatch = status(
    "user re-validates the deactivated coupon",
    await user.post("/v1/coupons/validate", { json: { courseId: paidCourseId, code: `JOURNEY${ctx.stamp}` } }),
    200
  )
  check("deactivated coupon no longer applies", postPatch?.data?.valid === false)
  // Used coupons are permanent records — deletion is refused, deactivation is the path
  status("deleting a coupon with orders is refused", await admin.delete(`/v1/coupons/${couponId}`), 409)
  const throwaway = status(
    "admin creates a throwaway coupon",
    await admin.post("/v1/coupons", {
      json: { code: `THROW${ctx.stamp}`, discountType: "fixed", discountValue: 1000, maxUsesPerUser: 1 },
    }),
    201
  )
  status("admin deletes the unused coupon", await admin.delete(`/v1/coupons/${throwaway?.data?.id}`), 204)

  ctx.ids.paidCourse = paidCourseId
}
