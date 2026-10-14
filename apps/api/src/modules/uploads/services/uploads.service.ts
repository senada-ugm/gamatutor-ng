import path from "node:path"
import type { Upload } from "@workspace/contracts"
import type { MultipartFile } from "@fastify/multipart"
import { and, eq, or, sql } from "drizzle-orm"
import { db } from "../../../db/index.js"
import { assignmentSubmissions, assignments, uploads } from "../../../db/app-schema.js"
import { env } from "../../../env.js"
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from "../../../lib/errors.js"
import { generateId } from "../../../lib/response.js"
import type { Tx } from "../../../db/index.js"
import { assertCanManageCourse } from "../../../lib/course-access.js"
import { deleteStoredFile, readStoredFileHeader, statStoredFile, writeStoredFile } from "../../../lib/storage.js"

/** Generic cap for any upload purpose — a single, simple limit rather than
 *  per-purpose configuration this app has no need for yet. Enforced both
 *  by @fastify/multipart's `limits.fileSize` (see modules/uploads/index.ts)
 *  and rechecked here via `part.file.truncated`, which is only accurate
 *  once the stream has finished piping. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

const UPLOAD_FILE_PATH_PATTERN = /^\/v1\/uploads\/(upl_[a-zA-Z0-9]+)\/file$/

export function fileUrlFor(id: string): string {
  return `${env.API_PUBLIC_URL}/v1/uploads/${id}/file`
}

function toUpload(row: typeof uploads.$inferSelect): Upload {
  return {
    id: row.id,
    purpose: row.purpose,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    url: fileUrlFor(row.id),
    status: row.status as Upload["status"],
    createdAt: row.createdAt.toISOString(),
  }
}

/** Derives the stored MIME type from the file's actual magic bytes —
 *  never from the client-declared Content-Type. Unrecognized content
 *  falls back to application/octet-stream (the global noSniff header
 *  makes browsers download it instead of rendering), so a spoofed
 *  image/* or text/* declaration can't smuggle arbitrary bytes past the
 *  purpose checks. The extension only refines OOXML zip containers,
 *  whose concrete type can't be read from the first bytes alone. */
export function detectMimeType(
  header: Buffer,
  extension: string,
  params: { claimedMimeType?: string | undefined; fullRead: Buffer }
): string {
  if (header.length >= 8 && header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) {
    return "image/png"
  }
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return "image/jpeg"
  }
  if (
    header.length >= 6 &&
    (header.toString("ascii", 0, 6) === "GIF87a" || header.toString("ascii", 0, 6) === "GIF89a")
  ) {
    return "image/gif"
  }
  if (header.length >= 12 && header.toString("ascii", 0, 4) === "RIFF" && header.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp"
  }
  if (header.length >= 4 && header.toString("ascii", 0, 4) === "%PDF") {
    return "application/pdf"
  }
  if (header.length >= 4 && header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04) {
    if (extension === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    if (extension === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    if (extension === ".pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    return "application/zip"
  }

  // Text has no magic bytes. A claimed text/* type is honored only when
  // the content actually looks like text (no NUL bytes, decodes as UTF-8)
  // — a binary payload wearing a text/* label stays octet-stream.
  const claimed = params.claimedMimeType ?? ""
  if (claimed.startsWith("text/") && looksLikeText(params.fullRead)) {
    return claimed
  }

  return "application/octet-stream"
}

/** Text heuristic for honoring text/* claims: no NUL byte anywhere and
 *  the buffer decodes as UTF-8 without replacement characters. */
export function looksLikeText(buf: Buffer): boolean {
  if (buf.length === 0) return true
  if (buf.includes(0)) return false
  try {
    // fatal:true makes invalid UTF-8 THROW rather than emit U+FFFD —
    // either way it is not text. (Caught by the unit suite: the
    // pre-fix version crashed the upload instead of degrading it.)
    new TextDecoder("utf-8", { fatal: true }).decode(buf)
    return true
  } catch {
    return false
  }
}

/** Parses an upload id back out of a URL previously handed out by
 *  fileUrlFor — used to claim/release uploads referenced by another
 *  entity's field (e.g. Course.thumbnail). Deliberately strict (exact
 *  path shape, prefixed id pattern) rather than a substring match, so an
 *  unrelated string that happens to contain something upload-id-shaped
 *  can't be misparsed. Returns null for anything that doesn't match,
 *  including null/undefined/non-URL input. */
export function extractUploadIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const match = new URL(url).pathname.match(UPLOAD_FILE_PATH_PATTERN)
    return match ? match[1]! : null
  } catch {
    return null
  }
}

export async function storeUpload(params: {
  purpose: string
  part: MultipartFile
  uploadedByUserId: string
}): Promise<Upload> {
  const id = generateId("upl")
  const rawExt = path.extname(params.part.filename ?? "").toLowerCase()
  const sanitizedExt = /^\.[a-z0-9]+$/i.test(rawExt) ? rawExt : ""
  const storageKey = `${id}${sanitizedExt}`

  await writeStoredFile(storageKey, params.part.file)

  // Only accurate once the stream has fully drained — @fastify/multipart
  // truncates silently mid-stream rather than throwing.
  if (params.part.file.truncated) {
    await deleteStoredFile(storageKey)
    throw new BadRequestError(`File exceeds the ${MAX_UPLOAD_BYTES}-byte limit`)
  }

  const { size } = await statStoredFile(storageKey)
  const header = await readStoredFileHeader(storageKey, 32)
  const claimed = params.part.mimetype
  // Full read only when a text/* claim needs validating — the header
  // alone can't prove textiness. Files are capped at MAX_UPLOAD_BYTES.
  const fullRead = claimed?.startsWith("text/")
    ? await readStoredFileHeader(storageKey, MAX_UPLOAD_BYTES)
    : Buffer.alloc(0)
  const mimeType = detectMimeType(header, sanitizedExt, { claimedMimeType: claimed, fullRead })

  // Purpose validation (e.g., thumbnail or avatar must be an image)
  if (["thumbnail", "avatar", "image", "logo"].includes(params.purpose.toLowerCase())) {
    if (!mimeType.startsWith("image/")) {
      await deleteStoredFile(storageKey)
      throw new BadRequestError(`Purpose '${params.purpose}' requires a valid image file (PNG, JPEG, WEBP, GIF)`)
    }
  }

  const [row] = await db
    .insert(uploads)
    .values({
      id,
      purpose: params.purpose,
      originalFilename: params.part.filename ?? "file",
      mimeType,
      sizeBytes: size,
      storageKey,
      status: "unclaimed",
      uploadedByUserId: params.uploadedByUserId,
    })
    .returning()
  return toUpload(row!)
}

type UploadViewer = { id: string; role?: string | null } | null

/**
 * Read entitlement for an upload's metadata or bytes. Publicly rendered
 * assets (catalog thumbnails claimed by a course, institution logos,
 * certificate signature images claimed by certificate settings) are
 * anonymous-readable; everything else — unclaimed uploads and assignment
 * attachments — is uploader/admin only, with assignment attachments
 * additionally readable by their submitter and the course's managers.
 * The id is unguessable, but it is the only thing protecting private
 * documents here.
 */
async function assertCanReadUpload(row: typeof uploads.$inferSelect, viewer: UploadViewer): Promise<void> {
  if (viewer && (viewer.role === "admin" || row.uploadedByUserId === viewer.id)) return

  if (row.status === "claimed") {
    if (row.ownerType === "course" || row.ownerType === "institution" || row.ownerType === "certificate_settings")
      return

    if (row.ownerType === "assignment_submission" && viewer && row.ownerId) {
      const [submission] = await db
        .select({ userId: assignmentSubmissions.userId, courseId: assignments.courseId })
        .from(assignmentSubmissions)
        .innerJoin(assignments, eq(assignments.id, assignmentSubmissions.assignmentId))
        .where(eq(assignmentSubmissions.id, row.ownerId))
        .limit(1)
      if (submission) {
        if (submission.userId === viewer.id) return
        await assertCanManageCourse(viewer, submission.courseId)
        return
      }
    }
  }

  if (!viewer) throw new UnauthorizedError()
  throw new ForbiddenError("You do not have access to this upload")
}

export async function getUploadStatusForViewer(id: string, viewer: UploadViewer): Promise<Upload> {
  const [row] = await db.select().from(uploads).where(eq(uploads.id, id)).limit(1)
  if (!row) throw new NotFoundError("Upload", id)
  await assertCanReadUpload(row, viewer)
  return toUpload(row)
}

export async function getUploadFileForViewer(
  id: string,
  viewer: UploadViewer
): Promise<{ storageKey: string; mimeType: string; originalFilename: string }> {
  const [row] = await db.select().from(uploads).where(eq(uploads.id, id)).limit(1)
  if (!row) throw new NotFoundError("Upload", id)
  await assertCanReadUpload(row, viewer)
  return { storageKey: row.storageKey, mimeType: row.mimeType, originalFilename: row.originalFilename }
}

export async function getUploadStatus(id: string): Promise<Upload> {
  const [row] = await db.select().from(uploads).where(eq(uploads.id, id)).limit(1)
  if (!row) throw new NotFoundError("Upload", id)
  return toUpload(row)
}

/** Internal (non-contract) read returning the raw row — for callers that
 *  must check uploader ownership or size/mime when accepting an upload
 *  reference (e.g. assignment submission constraints). The contract's
 *  Upload shape deliberately omits uploadedByUserId. */
export async function getUploadRow(id: string): Promise<typeof uploads.$inferSelect> {
  const [row] = await db.select().from(uploads).where(eq(uploads.id, id)).limit(1)
  if (!row) throw new NotFoundError("Upload", id)
  return row
}

export async function getUploadFile(
  id: string
): Promise<{ storageKey: string; mimeType: string; originalFilename: string }> {
  const [row] = await db.select().from(uploads).where(eq(uploads.id, id)).limit(1)
  if (!row) throw new NotFoundError("Upload", id)
  return { storageKey: row.storageKey, mimeType: row.mimeType, originalFilename: row.originalFilename }
}

export async function deleteUpload(id: string, actingUser: { id: string; role?: string | null }): Promise<void> {
  const [row] = await db.select().from(uploads).where(eq(uploads.id, id)).limit(1)
  if (!row) throw new NotFoundError("Upload", id)
  if (actingUser.role !== "admin" && row.uploadedByUserId !== actingUser.id) {
    throw new ForbiddenError("You did not upload this file")
  }
  await deleteStoredFile(row.storageKey)
  await db.delete(uploads).where(eq(uploads.id, id))
}

/** Marks an upload as attached to a real entity. Silently a no-op if the
 *  id doesn't resolve to a row (e.g. it was already swept) — the caller
 *  is saving its own entity either way, and a stale/missing upload
 *  reference shouldn't block that. */
export async function claimUpload(id: string, ownerType: string, ownerId: string, tx?: Tx): Promise<void> {
  await (tx ?? db)
    .update(uploads)
    .set({ status: "claimed", claimedAt: new Date(), ownerType, ownerId })
    .where(eq(uploads.id, id))
}

/** Reverses claimUpload — used when a saved entity's reference to this
 *  upload is replaced by a different one (e.g. a course's thumbnail is
 *  swapped), so the old file re-enters the orphan sweep pool instead of
 *  leaking forever as permanently "claimed" but unreferenced. */
export async function releaseUpload(id: string, tx?: Tx): Promise<void> {
  await (tx ?? db)
    .update(uploads)
    .set({ status: "unclaimed", releasedAt: new Date() })
    .where(and(eq(uploads.id, id), eq(uploads.status, "claimed")))
}

/** Deletes the disk file + row for any upload still `unclaimed` past
 *  UPLOAD_ORPHAN_TTL_HOURS, keyed off releasedAt when set (a
 *  claimed-then-released upload) or createdAt otherwise (never claimed
 *  at all). Runs on an interval (see startUploadSweep below) and is also
 *  exposed as an admin-triggerable route for ops/testing. */
export async function sweepOrphanedUploads(): Promise<number> {
  const cutoff = new Date(Date.now() - env.UPLOAD_ORPHAN_TTL_HOURS * 60 * 60 * 1000)
  // Batch in chunks of 100 to prevent OOM on runaway unclaimed upload piles
  const candidates = await db
    .select()
    .from(uploads)
    .where(
      and(
        eq(uploads.status, "unclaimed"),
        or(
          and(sql`${uploads.releasedAt} is not null`, sql`${uploads.releasedAt} <= ${cutoff}`),
          and(sql`${uploads.releasedAt} is null`, sql`${uploads.createdAt} <= ${cutoff}`)
        )
      )
    )
    .limit(100)

  let deleted = 0
  for (const row of candidates) {
    await deleteStoredFile(row.storageKey)
    await db.delete(uploads).where(eq(uploads.id, row.id))
    deleted++
  }
  return deleted
}

let sweepInterval: NodeJS.Timeout | undefined

/** Checks for sweepable uploads on an interval, started from an onReady
 *  hook (see app.ts) rather than a bare module-scope setInterval — this
 *  gives it a clean shutdown path (onClose -> stopUploadSweep) and avoids
 *  leaking timers across dev-server reloads. The check cadence is
 *  clamped independently of the TTL itself (1 min - 1 hour) so a short
 *  TTL used for testing doesn't spin a near-zero-delay interval — for
 *  that case, POST /v1/uploads/sweep triggers a check on demand. */
export function startUploadSweep(onError: (error: unknown) => void): void {
  const intervalMs = Math.min(Math.max(env.UPLOAD_ORPHAN_TTL_HOURS * 60 * 60 * 1000, 60_000), 60 * 60 * 1000)
  sweepInterval = setInterval(() => {
    sweepOrphanedUploads().catch(onError)
  }, intervalMs)
  sweepInterval.unref()
}

export function stopUploadSweep(): void {
  clearInterval(sweepInterval)
  sweepInterval = undefined
}
