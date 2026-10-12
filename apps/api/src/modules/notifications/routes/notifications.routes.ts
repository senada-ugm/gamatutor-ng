import type { Notification } from "@workspace/contracts"
import type { FastifyInstance } from "fastify"
import { and, desc, eq, isNull } from "drizzle-orm"
import { z } from "zod"
import { db } from "../../../db/index.js"
import { notifications } from "../../../db/app-schema.js"
import { NotFoundError } from "../../../lib/errors.js"
import { requireSession } from "../../../lib/require-session.js"
import { pagedResponse } from "../../../lib/response.js"

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  unreadOnly: z.coerce.boolean().optional(),
  orderBy: z.string().optional(),
})

function toNotification(row: typeof notifications.$inferSelect): Notification {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type as Notification["type"],
    title: row.title,
    body: row.body ?? undefined,
    link: row.link ?? undefined,
    readAt: row.readAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }
}

export function notificationsRoutes(app: FastifyInstance) {
  app.get("/notifications", async (request) => {
    const user = await requireSession(request)
    const query = listQuerySchema.parse(request.query)
    // Own rows only — there is no admin view into anyone's inbox.
    const conditions = [eq(notifications.userId, user.id)]
    if (query.unreadOnly) conditions.push(isNull(notifications.readAt))
    const where = and(...conditions)
    const rows = await db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize)
    return pagedResponse(rows.map(toNotification), rows.length, request.id, {
      page: query.page,
      pageSize: query.pageSize,
    })
  })

  app.post<{ Params: { id: string } }>("/notifications/:id/read", async (request) => {
    const user = await requireSession(request)
    const [row] = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.id, request.params.id), eq(notifications.userId, user.id)))
      .limit(1)
    if (!row) throw new NotFoundError("Notification", request.params.id)
    const [updated] = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(eq(notifications.id, request.params.id))
      .returning()
    return {
      data: toNotification(updated ?? row),
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    }
  })

  app.post("/notifications/read-all", async (request, reply) => {
    const user = await requireSession(request)
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)))
    reply.status(204)
    return null
  })
}
