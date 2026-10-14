import type {
  InstitutionCreate,
  InstitutionProfileUpdate,
  InstitutionRequest,
  InstitutionRequestCreate,
  RegisteredInstitution,
} from "@workspace/contracts"
import { and, desc, eq, inArray, or, ilike, sql } from "drizzle-orm"
import { db } from "../../../db/index.js"
import { institutionOwnerships, institutionRequests, institutions } from "../../../db/app-schema.js"
import { users as userTable } from "../../../db/auth-schema.js"
import { ConflictError, NotFoundError } from "../../../lib/errors.js"
import { generateId } from "../../../lib/response.js"
import { ilikeContains } from "../../../lib/search.js"
import { orderByClause } from "../../../lib/order.js"
import { claimUpload, extractUploadIdFromUrl, releaseUpload } from "../../uploads/services/uploads.service.js"

function toRegisteredInstitution(row: typeof institutions.$inferSelect): RegisteredInstitution {
  return {
    id: row.id,
    name: row.name,
    institutionType: row.institutionType,
    description: row.description ?? undefined,
    website: row.website ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    logo: row.logo,
    metadata: row.metadata ?? undefined,
    status: "approved",
    createdAt: row.createdAt.toISOString(),
  }
}

/** Just enough of an institution to denormalize onto a course card
 *  (name + logo) — batched so listing courses doesn't run one query per
 *  row. Mirrors enrollments.service.ts's loadEnrollmentCountsBatch. */
export async function loadInstitutionsBatch(
  institutionIds: string[]
): Promise<Map<string, { id: string; name: string; logo: string | null }>> {
  if (institutionIds.length === 0) return new Map()
  const rows = await db
    .select({ id: institutions.id, name: institutions.name, logo: institutions.logo })
    .from(institutions)
    .where(inArray(institutions.id, [...new Set(institutionIds)]))
  return new Map(rows.map((r) => [r.id, r]))
}

// ---------------------------------------------------------------------------
// Registered institutions
// ---------------------------------------------------------------------------

export async function listInstitutionsPaged(params: {
  search?: string
  orderBy?: string
  page: number
  pageSize: number
}): Promise<{ rows: RegisteredInstitution[]; totalCount: number }> {
  const where = params.search
    ? or(
        ilike(institutions.name, ilikeContains(params.search)),
        ilike(institutions.institutionType, ilikeContains(params.search)),
        ilike(institutions.description, ilikeContains(params.search))
      )
    : undefined

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(institutions)
    .where(where)
  const rows = await db
    .select()
    .from(institutions)
    .where(where)
    .orderBy(
      orderByClause(
        params.orderBy,
        { createdAt: institutions.createdAt, name: institutions.name },
        desc(institutions.createdAt)
      )
    )
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize)

  return { rows: rows.map(toRegisteredInstitution), totalCount: countRow?.count ?? 0 }
}

export async function getInstitution(id: string): Promise<RegisteredInstitution> {
  const [row] = await db.select().from(institutions).where(eq(institutions.id, id)).limit(1)
  if (!row) throw new NotFoundError("Institution", id)
  return toRegisteredInstitution(row)
}

/** Updates a registered institution's profile - type, status and
 *  createdAt are server-set and not editable here. */
export async function updateInstitution(id: string, input: InstitutionProfileUpdate): Promise<RegisteredInstitution> {
  const [existing] = await db.select().from(institutions).where(eq(institutions.id, id)).limit(1)
  if (!existing) throw new NotFoundError("Institution", id)

  // One transaction: the row update and the logo claim/release commit
  // together, same reasoning as courses.service.ts's updateCourse.
  const row = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(institutions)
      .set({
        name: input.name,
        description: input.description,
        website: input.website,
        email: input.email,
        phone: input.phone,
        address: input.address,
        logo: input.logo,
        metadata: input.metadata,
      })
      .where(eq(institutions.id, id))
      .returning()

    if (existing.logo !== updated!.logo) {
      const oldUploadId = extractUploadIdFromUrl(existing.logo)
      if (oldUploadId) await releaseUpload(oldUploadId, tx)
      const newUploadId = extractUploadIdFromUrl(updated!.logo)
      if (newUploadId) await claimUpload(newUploadId, "institution", updated!.id, tx)
    }
    return updated!
  })
  return toRegisteredInstitution(row)
}

/**
 * Admin-only direct registration — grants the creating admin ownership
 * immediately (see institutions.tsp's InstitutionCreate doc comment).
 * Both writes run in one transaction: an institution with no owner (or a
 * grant referencing a missing institution) can't be left behind.
 */
export async function createInstitution(input: InstitutionCreate, ownerUserId: string): Promise<RegisteredInstitution> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(institutions)
      .values({
        id: generateId("ins"),
        name: input.name,
        institutionType: input.institutionType,
        description: input.description,
        website: input.website,
        email: input.email,
        phone: input.phone,
        address: input.address,
        logo: input.logo,
        metadata: input.metadata,
      })
      .returning()
    const uploadId = extractUploadIdFromUrl(row!.logo)
    if (uploadId) await claimUpload(uploadId, "institution", row!.id, tx)
    await grantOwnershipIn(tx, ownerUserId, row!.id)
    return toRegisteredInstitution(row!)
  })
}

// ---------------------------------------------------------------------------
// Registration requests — the self-service "Ajukan Institusi" queue any
// signed-in account can submit to; only an admin can approve/reject (see
// institution-requests.routes.ts). requestedByUser's display name/email
// are joined from Better Auth's real user table at read time, not stored
// on the row (see app-schema.ts's institutionRequests doc comment).
// ---------------------------------------------------------------------------

function toInstitutionRequest(
  row: typeof institutionRequests.$inferSelect,
  requester: { name: string; email: string } | undefined
): InstitutionRequest {
  return {
    id: row.id,
    institutionName: row.institutionName,
    institutionType: row.institutionType,
    description: row.description ?? undefined,
    website: row.website ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    logo: row.logo,
    justification: row.justification ?? undefined,
    requestedByUserId: row.requestedByUserId,
    requestedByUser: requester ?? { name: "Unknown", email: "" },
    status: row.status as InstitutionRequest["status"],
    createdAt: row.createdAt.toISOString(),
    rejectionReason: row.rejectionReason ?? undefined,
  }
}

export async function listRequests(params: {
  status?: InstitutionRequest["status"]
  search?: string
  requestedByUserId?: string
  orderBy?: string
}): Promise<InstitutionRequest[]> {
  const conditions = [
    params.status ? eq(institutionRequests.status, params.status) : undefined,
    params.requestedByUserId ? eq(institutionRequests.requestedByUserId, params.requestedByUserId) : undefined,
  ].filter((c) => c !== undefined)

  const rows = await db
    .select({ request: institutionRequests, requesterName: userTable.name, requesterEmail: userTable.email })
    .from(institutionRequests)
    .leftJoin(userTable, eq(institutionRequests.requestedByUserId, userTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(
      orderByClause(
        params.orderBy,
        { createdAt: institutionRequests.createdAt, institutionName: institutionRequests.institutionName },
        desc(institutionRequests.createdAt)
      )
    )

  let requests = rows.map((r) =>
    toInstitutionRequest(r.request, r.requesterName ? { name: r.requesterName, email: r.requesterEmail! } : undefined)
  )
  if (params.search) {
    const q = params.search.toLowerCase()
    requests = requests.filter(
      (r) => r.institutionName.toLowerCase().includes(q) || r.requestedByUser.name.toLowerCase().includes(q)
    )
  }
  return requests
}

export async function getRequest(id: string): Promise<InstitutionRequest> {
  const [row] = await db
    .select({ request: institutionRequests, requesterName: userTable.name, requesterEmail: userTable.email })
    .from(institutionRequests)
    .leftJoin(userTable, eq(institutionRequests.requestedByUserId, userTable.id))
    .where(eq(institutionRequests.id, id))
    .limit(1)
  if (!row) throw new NotFoundError("Institution request", id)
  return toInstitutionRequest(
    row.request,
    row.requesterName ? { name: row.requesterName, email: row.requesterEmail! } : undefined
  )
}

/** Creates a pending request attributed to the real authenticated
 *  submitter — see institution-requests.routes.ts's requireSession. */
export async function createRequest(
  input: InstitutionRequestCreate,
  requester: { id: string; name: string; email: string }
): Promise<InstitutionRequest> {
  const [row] = await db
    .insert(institutionRequests)
    .values({
      id: generateId("req"),
      institutionName: input.institutionName,
      institutionType: input.institutionType,
      description: input.description,
      website: input.website,
      email: input.email,
      phone: input.phone,
      address: input.address,
      logo: input.logo,
      justification: input.justification,
      requestedByUserId: requester.id,
    })
    .returning()
  return toInstitutionRequest(row!, { name: requester.name, email: requester.email })
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Approves a pending request: registers the institution AND grants the
 * requester ownership — the elevation step that turns a regular account
 * into an institution-scoped admin. All three writes run in one
 * transaction, and the request itself is claimed with a guarded
 * `WHERE status = 'pending'` update first, so two concurrent approvals
 * can't both mint an institution from the same request.
 */
export async function approveRequest(requestId: string): Promise<RegisteredInstitution> {
  return db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(institutionRequests)
      .set({ status: "approved" })
      .where(and(eq(institutionRequests.id, requestId), eq(institutionRequests.status, "pending")))
      .returning()
    if (!claimed) {
      const request = await getRequest(requestId)
      throw new ConflictError(`Request '${requestId}' is already ${request.status}`)
    }

    const [row] = await tx
      .insert(institutions)
      .values({
        id: generateId("ins"),
        name: claimed.institutionName,
        institutionType: claimed.institutionType,
        description: claimed.description,
        website: claimed.website,
        email: claimed.email,
        phone: claimed.phone,
        address: claimed.address,
        logo: claimed.logo,
      })
      .returning()
    // The logo was only stored on the request until now — claim it here,
    // now that it's attached to a real, permanent institution. A rejected
    // request's logo is left unclaimed for the orphan sweep to reap.
    const uploadId = extractUploadIdFromUrl(claimed.logo)
    if (uploadId) await claimUpload(uploadId, "institution", row!.id, tx)
    await grantOwnershipIn(tx, claimed.requestedByUserId, row!.id)
    return toRegisteredInstitution(row!)
  })
}

export async function rejectRequest(requestId: string, reason: string): Promise<InstitutionRequest> {
  const request = await getRequest(requestId)
  if (request.status !== "pending") {
    throw new ConflictError(`Request '${requestId}' is already ${request.status}`)
  }
  const [row] = await db
    .update(institutionRequests)
    .set({ status: "rejected", rejectionReason: reason })
    .where(eq(institutionRequests.id, requestId))
    .returning()
  return toInstitutionRequest(row!, request.requestedByUser)
}

// ---------------------------------------------------------------------------
// Ownerships
// ---------------------------------------------------------------------------

export async function listOwnershipsByUser(userId: string) {
  const rows = await db.select().from(institutionOwnerships).where(eq(institutionOwnerships.userId, userId))
  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    institutionId: row.institutionId,
    grantedAt: row.grantedAt.toISOString(),
  }))
}

/** Idempotent grant — approving the same request twice won't double-join,
 *  and the (userId, institutionId) unique index backstops the race the
 *  check-then-insert shape can't (two concurrent grants converge on one
 *  row via onConflictDoNothing + re-read). */
export function grantOwnership(userId: string, institutionId: string) {
  return db.transaction((tx) => grantOwnershipIn(tx, userId, institutionId))
}

async function grantOwnershipIn(tx: Tx, userId: string, institutionId: string) {
  const [existing] = await tx
    .select()
    .from(institutionOwnerships)
    .where(and(eq(institutionOwnerships.userId, userId), eq(institutionOwnerships.institutionId, institutionId)))
    .limit(1)
  if (existing) {
    return {
      id: existing.id,
      userId: existing.userId,
      institutionId: existing.institutionId,
      grantedAt: existing.grantedAt.toISOString(),
    }
  }

  const [row] = await tx
    .insert(institutionOwnerships)
    .values({ id: generateId("own"), userId, institutionId })
    .onConflictDoNothing()
    .returning()
  if (row) {
    return { id: row.id, userId: row.userId, institutionId: row.institutionId, grantedAt: row.grantedAt.toISOString() }
  }
  const [winner] = await tx
    .select()
    .from(institutionOwnerships)
    .where(and(eq(institutionOwnerships.userId, userId), eq(institutionOwnerships.institutionId, institutionId)))
    .limit(1)
  return {
    id: winner!.id,
    userId: winner!.userId,
    institutionId: winner!.institutionId,
    grantedAt: winner!.grantedAt.toISOString(),
  }
}
