import type {
  CouponCreate,
  CouponUpdate,
  CouponValidate,
  OrderConfirmPayment,
  OrderCreate,
  OrderRefund,
  OrderSubmitProof,
} from "@workspace/contracts"
import {
  zCouponCreate,
  zCouponUpdate,
  zCouponValidate,
  zOrderConfirmPayment,
  zOrderCreate,
  zOrderRefund,
  zOrderSubmitProof,
} from "@workspace/contracts/zod"
import type { FastifyInstance } from "fastify"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "../../../db/index.js"
import { courses } from "../../../db/app-schema.js"
import { assertCanManageCourse, assertCanManageInstitution } from "../../../lib/course-access.js"
import { listCourseIdsForInstitution } from "../../enrollments/services/enrollments.service.js"
import { ForbiddenError, NotFoundError } from "../../../lib/errors.js"
import { notifyUserById } from "../../../lib/notify.js"
import { requireAdmin } from "../../../lib/require-admin.js"
import { requireSession } from "../../../lib/require-session.js"
import { dataResponse, pagedResponse } from "../../../lib/response.js"
import { validateBody } from "../../../lib/validation.js"
import * as service from "../services/payments.service.js"

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  isActive: z.coerce.boolean().optional(),
  institutionId: z.string().optional(),
  courseId: z.string().optional(),
  search: z.string().optional(),
  orderBy: z.string().optional(),
})

const ordersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  courseId: z.string().optional(),
  institutionId: z.string().optional(),
  userId: z.string().optional(),
  status: z.string().optional(),
  orderBy: z.string().optional(),
})

export function paymentsRoutes(app: FastifyInstance) {
  // ------------------------------------------------------------------
  // Coupons (admin-managed master data)
  // ------------------------------------------------------------------
  app.get("/coupons", async (request) => {
    await requireAdmin(request)
    const query = listQuerySchema.parse(request.query)
    const paged = { page: query.page, pageSize: query.pageSize }
    const { rows, totalCount } = await service.listCouponsPaged({
      isActive: query.isActive,
      institutionId: query.institutionId,
      courseId: query.courseId,
      search: query.search,
      ...paged,
    })
    return pagedResponse(rows, totalCount, request.id, paged)
  })

  app.post<{ Body: CouponCreate }>(
    "/coupons",
    { preValidation: [validateBody(zCouponCreate)] },
    async (request, reply) => {
      const admin = await requireAdmin(request)
      const created = await service.createCoupon({
        code: request.body.code.trim(),
        description: request.body.description ?? null,
        discountType: request.body.discountType,
        discountValue: request.body.discountValue,
        maxDiscountAmount: request.body.maxDiscountAmount ?? null,
        courseId: request.body.courseId ?? null,
        institutionId: request.body.institutionId ?? null,
        maxUses: request.body.maxUses ?? null,
        maxUsesPerUser: request.body.maxUsesPerUser,
        isActive: request.body.isActive ?? true,
        startsAt: request.body.startsAt ? new Date(request.body.startsAt) : null,
        expiresAt: request.body.expiresAt ? new Date(request.body.expiresAt) : null,
        createdById: admin.id,
      })
      reply.status(201)
      reply.header("Location", `/v1/coupons/${created.id}`)
      return dataResponse(created, request.id)
    }
  )

  app.get<{ Params: { id: string } }>("/coupons/:id", async (request) => {
    await requireAdmin(request)
    return dataResponse(await service.getCoupon(request.params.id), request.id)
  })

  app.patch<{ Params: { id: string }; Body: CouponUpdate }>(
    "/coupons/:id",
    { preValidation: [validateBody(zCouponUpdate)] },
    async (request) => {
      await requireAdmin(request)
      const { startsAt, expiresAt, ...rest } = request.body
      const patch: Parameters<typeof service.updateCoupon>[1] = { ...rest }
      if (startsAt !== undefined) patch.startsAt = startsAt ? new Date(startsAt) : null
      if (expiresAt !== undefined) patch.expiresAt = expiresAt ? new Date(expiresAt) : null
      return dataResponse(await service.updateCoupon(request.params.id, patch), request.id)
    }
  )

  app.delete<{ Params: { id: string } }>("/coupons/:id", async (request, reply) => {
    await requireAdmin(request)
    await service.deleteCoupon(request.params.id)
    reply.status(204)
    return null
  })

  app.post("/coupons/validate", { preValidation: [validateBody(zCouponValidate)] }, async (request) => {
    const user = await requireSession(request)
    const { courseId, code } = request.body as CouponValidate
    return dataResponse(await service.validateCoupon(courseId, code, user.id), request.id)
  })

  // ------------------------------------------------------------------
  // Orders
  // ------------------------------------------------------------------
  app.post("/orders", { preValidation: [validateBody(zOrderCreate)] }, async (request, reply) => {
    const user = await requireSession(request)
    const body = request.body as OrderCreate
    const created = await service.createOrder(user.id, { courseId: body.courseId, couponCode: body.couponCode })
    reply.status(201)
    reply.header("Location", `/v1/orders/${created.id}`)
    return dataResponse(created, request.id)
  })

  app.get("/orders", async (request) => {
    const user = await requireSession(request)
    const query = ordersQuerySchema.parse(request.query)
    const paged = { page: query.page, pageSize: query.pageSize }
    // An institution's order book is owner-only; a course's is
    // manager-only; everything else is forced to the caller's own rows.
    if (query.institutionId) {
      await assertCanManageInstitution(user, query.institutionId)
      const courseIds = await listCourseIdsForInstitution(query.institutionId)
      const { rows, totalCount } = await service.listOrdersPaged({
        courseIds: query.courseId ? courseIds.filter((id) => id === query.courseId) : courseIds,
        status: query.status,
        ...paged,
      })
      return pagedResponse(rows, totalCount, request.id, paged)
    }
    if (query.courseId) {
      await assertCanManageCourse(user, query.courseId)
      const { rows, totalCount } = await service.listOrdersPaged({
        courseId: query.courseId,
        status: query.status,
        ...paged,
      })
      return pagedResponse(rows, totalCount, request.id, paged)
    }
    const userId = user.role === "admin" ? query.userId : user.id
    const { rows, totalCount } = await service.listOrdersPaged({ userId, status: query.status, ...paged })
    return pagedResponse(rows, totalCount, request.id, paged)
  })

  app.get<{ Params: { id: string } }>("/orders/:id", async (request) => {
    const user = await requireSession(request)
    const row = await service.getOrderRow(request.params.id)
    if (row.userId !== user.id && user.role !== "admin") {
      await assertCanManageCourse(user, row.courseId)
    }
    return dataResponse(await service.getOrder(request.params.id), request.id)
  })

  app.post<{ Params: { id: string } }>("/orders/:id/checkout", async (request) => {
    const user = await requireSession(request)
    return dataResponse(await service.createGatewayCheckout(request.params.id, user), request.id)
  })

  app.post<{ Params: { id: string }; Body: OrderSubmitProof }>(
    "/orders/:id/submit-proof",
    { preValidation: [validateBody(zOrderSubmitProof)] },
    async (request) => {
      const user = await requireSession(request)
      return dataResponse(await service.submitTransferProof(request.params.id, user.id, request.body), request.id)
    }
  )

  app.post<{ Params: { id: string }; Body?: OrderConfirmPayment }>("/orders/:id/confirm-payment", async (request) => {
    const user = await requireSession(request)
    const row = await service.getOrderRow(request.params.id)
    const [course] = await db
      .select({ institutionId: courses.institutionId })
      .from(courses)
      .where(eq(courses.id, row.courseId))
      .limit(1)
    if (!course) throw new NotFoundError("Course", row.courseId)
    await assertCanManageInstitution(user, course.institutionId)
    const details = request.body ? (zOrderConfirmPayment.parse(request.body) as OrderConfirmPayment) : undefined
    const paid = await service.confirmPayment(request.params.id, user.id, details)
    await notifyUserById(row.userId, {
      type: "order_paid",
      title: "Pembayaran dikonfirmasi",
      body: "Pembayaran pelatihan Anda telah dikonfirmasi — materi pelatihan sekarang terbuka.",
      link: `/learn/${row.courseId}`,
    })
    return dataResponse(paid, request.id)
  })

  app.post<{ Params: { id: string } }>("/orders/:id/cancel", async (request) => {
    const user = await requireSession(request)
    const row = await service.getOrderRow(request.params.id)
    if (row.userId !== user.id && user.role !== "admin") {
      await assertCanManageCourse(user, row.courseId)
    }
    return dataResponse(await service.cancelOrder(request.params.id), request.id)
  })

  app.post<{ Params: { id: string }; Body: OrderRefund }>(
    "/orders/:id/refund",
    { preValidation: [validateBody(zOrderRefund)] },
    async (request) => {
      const user = await requireSession(request)
      const row = await service.getOrderRow(request.params.id)
      const [course] = await db
        .select({ institutionId: courses.institutionId })
        .from(courses)
        .where(eq(courses.id, row.courseId))
        .limit(1)
      if (!course) throw new NotFoundError("Course", row.courseId)
      await assertCanManageInstitution(user, course.institutionId)
      const body = request.body as OrderRefund
      const refunded = await service.refundOrder(request.params.id, body.reason)
      await notifyUserById(row.userId, {
        type: "order_refunded",
        title: "Pembayaran dikembalikan",
        body: `Pesanan pelatihan Anda telah direfund. Alasan: ${body.reason}`,
        link: `/courses/${row.courseId}`,
      })
      return dataResponse(refunded, request.id)
    }
  )
}
