import "@typespec/http";
import "@typespec/rest";

import "./shared/common.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using Lms.Common;

/**
 * Money domain: admin-managed discount coupons + per-(user, course)
 * payment orders. Amounts are integer Rupiah (the product's currency) —
 * no decimals, matching the existing Course.price convention.
 *
 * Payment today is MANUAL CONFIRMATION (bank/virtual-account transfer,
 * the realistic flow for Indonesian B2B training): the learner creates a
 * `pending` order, transfers the finalAmount, and a course manager
 * confirms receipt, flipping it to `paid`. paymentMethod is a string so
 * a real gateway adapter (midtrans/xendit/mayar webhook flipping the
 * same status) can land later without a contract change — the order
 * lifecycle is the stable part, not the rails.
 *
 * Funnel interaction: applying (self-enroll) stays free; a course with
 * price > 0 additionally requires a `paid` order before course CONTENT
 * unlocks (see course-access.ts's assertIsEnrolledParticipant) — select
 * first, pay, then learn.
 *
 * The gateway's webhook receiver (POST /payments/webhook, Stripe-
 * compatible signature verification) lives OUTSIDE this contract — an
 * operational endpoint the SDK should never generate a client for, same
 * precedent as POST /uploads/sweep and Better Auth's own routes. The
 * order lifecycle above is what it drives.
 */
namespace Lms {
  enum CouponDiscountType {
    percentage: "percentage";
    fixed: "fixed";
  }

  /** Computed alongside the stored row — the admin list embeds these per
   *  coupon (one grouped query, not N+1). */
  model CouponStats {
    totalUses: int32;
    uniqueUsers: int32;
    /** Sum of discountAmount across paid orders that used this coupon. */
    totalDiscountGiven: int32;
    remainingUses?: int32;
  }

  model Coupon {
    @key
    id: ResourceId;
    code: string;
    description?: string;
    discountType: CouponDiscountType;
    /** Percent (0-100] for percentage coupons; flat Rupiah for fixed. */
    discountValue: int32;
    /** Cap for percentage coupons, in Rupiah. */
    maxDiscountAmount?: int32;
    /** Scope: null = every course in scope; else only this course. */
    courseId?: ResourceId;
    /** Scope: null = platform-wide; else only courses of this institution. */
    institutionId?: ResourceId;
    /** Total redemption cap; null = unlimited. */
    maxUses?: int32;
    maxUsesPerUser: int32;
    @visibility(Lifecycle.Read)
    currentUses: int32;
    isActive: boolean;
    startsAt?: utcDateTime;
    expiresAt?: utcDateTime;
    @visibility(Lifecycle.Read)
    stats: CouponStats;
    @visibility(Lifecycle.Read)
    createdAt: utcDateTime;
  }

  model CouponCreate {
    code: string;
    description?: string;
    discountType: CouponDiscountType;
    @minValue(1)
    discountValue: int32;
    maxDiscountAmount?: int32;
    courseId?: ResourceId;
    institutionId?: ResourceId;
    maxUses?: int32;
    @minValue(1)
    maxUsesPerUser: int32;
    isActive?: boolean;
    startsAt?: utcDateTime;
    expiresAt?: utcDateTime;
  }

  model CouponUpdate {
    description?: string;
    discountType?: CouponDiscountType;
    discountValue?: int32;
    maxDiscountAmount?: int32;
    maxUses?: int32;
    maxUsesPerUser?: int32;
    isActive?: boolean;
    startsAt?: utcDateTime;
    expiresAt?: utcDateTime;
  }

  /** What the learner's coupon box calls: price a course with a code,
   *  without creating anything. */
  model CouponValidate {
    courseId: ResourceId;
    code: string;
  }

  model CouponPricing {
    originalPrice: int32;
    discountAmount: int32;
    finalPrice: int32;
  }

  model CouponValidation {
    valid: boolean;
    message?: string;
    coupon?: Coupon;
    pricing?: CouponPricing;
  }

  enum OrderStatus {
    pending: "pending";
    paid: "paid";
    canceled: "canceled";
    refunded: "refunded";
  }

  model Order {
    @key
    id: ResourceId;
    userId: ResourceId;
    courseId: ResourceId;
    couponId?: ResourceId;
    couponCode?: string;
    originalPrice: int32;
    discountAmount: int32;
    finalAmount: int32;
    status: OrderStatus;
    /** "manual_transfer" today; a gateway adapter fills this when one
     *  lands (see the domain comment above). */
    paymentMethod: string;
    @visibility(Lifecycle.Read)
    createdAt: utcDateTime;
    @visibility(Lifecycle.Read)
    paidAt?: utcDateTime;
    @visibility(Lifecycle.Read)
    confirmedByUserId?: ResourceId;
    paymentReference?: string;
    confirmationNotes?: string;
    proofUrl?: string;
    @visibility(Lifecycle.Read)
    refundedAt?: utcDateTime;
    refundReason?: string;
  }

  model OrderCreate {
    courseId: ResourceId;
    couponCode?: string;
  }

  model OrderConfirmPayment {
    paymentReference?: string;
    note?: string;
    proofUrl?: string;
  }

  model OrderSubmitProof {
    paymentReference: string;
    proofUrl?: string;
  }

  model OrderRefund {
    reason: string;
  }

  /** A hosted Stripe-compatible checkout the learner is redirected to.
   *  Only available when the gateway is configured (PAYMENT_SECRET_KEY);
   *  otherwise 503 and the manual-transfer flow applies. */
  model CheckoutSession {
    orderId: ResourceId;
    sessionId: string;
    url: string;
  }

  @route("/coupons")
  @tag("Payments")
  interface CouponsApi {
    /** Lists coupons. Admin only. */
    @get
    @list
    list(
      ...PageParams,
      ...OrderByParam,
      ...SearchParam,
      @query isActive?: boolean,
      @query institutionId?: ResourceId,
      @query courseId?: ResourceId
    ): PagedResponse<Coupon> | ErrorResponse;

    /** Creates a coupon. Admin only. */
    @post
    create(@body body: CouponCreate): {
      @statusCode statusCode: 201;
      @header Location: string;
      @body body: DataResponse<Coupon>;
    } | ErrorResponse;

    /** Reads one coupon. Admin only. */
    @get
    get(@path id: ResourceId): DataResponse<Coupon> | ErrorResponse;

    /** Updates a coupon's rules/validity. Admin only; code and scope are
     *  immutable (redemptions reference the row, not the string). */
    @patch
    update(@path id: ResourceId, @body body: CouponUpdate): DataResponse<Coupon> | ErrorResponse;

    /** Deletes a coupon. Admin only; refused while any order still
     *  references it. */
    @delete
    delete(@path id: ResourceId): void | ErrorResponse;

    /** Prices a course with a coupon code — the learner-facing "Terapkan"
     *  button. Validates scope, window, quota, and per-user caps. */
    @post
    @route("validate")
    validate(@body body: CouponValidate): DataResponse<CouponValidation> | ErrorResponse;
  }

  @route("/orders")
  @tag("Payments")
  interface OrdersApi {
    /** Creates the caller's pending order for a paid course. Amounts are
     *  computed server-side from the course price and coupon — never
     *  trusted from the client. One active order per (user, course). */
    @post
    create(@body body: OrderCreate): {
      @statusCode statusCode: 201;
      @header Location: string;
      @body body: DataResponse<Order>;
    } | ErrorResponse;

    /** Lists orders. No params (or userId=self) = the caller's own;
     *  courseId = a course's orders, course managers only;
     *  institutionId = every order under one institution, its owners
     *  (and admins) only. */
    @get
    @list
    list(
      ...PageParams,
      ...OrderByParam,
      @query courseId?: ResourceId,
      @query institutionId?: ResourceId,
      @query userId?: ResourceId,
      @query status?: OrderStatus
    ): PagedResponse<Order> | ErrorResponse;

    /** Reads one order. Order owner, admin, or the course's managers. */
    @get
    get(@path id: ResourceId): DataResponse<Order> | ErrorResponse;

    /** Creates a hosted Stripe-compatible checkout session for a pending
     *  order and returns its URL — the learner pays on the gateway's page
     *  and the webhook flips the order to paid. Order owner only. */
    @post
    @route("{id}/checkout")
    createCheckout(@path id: ResourceId): DataResponse<CheckoutSession> | ErrorResponse;

    /** Learner submits their manual transfer reference/receipt proof for a pending order. Order owner only. */
    @post
    @route("{id}/submit-proof")
    submitProof(@path id: ResourceId, @body body: OrderSubmitProof): DataResponse<Order> | ErrorResponse;

    /** Institution-owner/admin confirmation of a received manual transfer —
     *  flips pending to paid and records the confirmer, payment reference, and optional proof URL. */
    @post
    @route("{id}/confirm-payment")
    confirmPayment(@path id: ResourceId, @body body?: OrderConfirmPayment): DataResponse<Order> | ErrorResponse;

    /** Cancels a pending order. Order owner (while pending) or course
     *  managers; releases the coupon redemption it consumed. */
    @post
    @route("{id}/cancel")
    cancel(@path id: ResourceId): DataResponse<Order> | ErrorResponse;

    /** Refunds a paid order. Course managers only; revokes the content
     *  access the payment granted (refunded no longer unlocks content). */
    @post
    @route("{id}/refund")
    refund(@path id: ResourceId, @body body: OrderRefund): DataResponse<Order> | ErrorResponse;
  }
}
