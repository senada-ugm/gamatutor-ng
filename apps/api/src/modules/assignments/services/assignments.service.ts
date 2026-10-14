import type {
  Assignment,
  AssignmentCreate,
  AssignmentGrade,
  AssignmentSubmission,
  AssignmentSubmissionCreate,
  AssignmentUpdate,
} from "@workspace/contracts"
import { and, eq, inArray, isNull, sql } from "drizzle-orm"
import { db, type Tx } from "../../../db/index.js"
import { assignmentSubmissions, assignments } from "../../../db/app-schema.js"
import { users as userTable } from "../../../db/auth-schema.js"
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../../lib/errors.js"
import { generateId } from "../../../lib/response.js"
import { claimUpload, fileUrlFor, getUploadRow, releaseUpload } from "../../uploads/services/uploads.service.js"

type AssignmentRow = typeof assignments.$inferSelect
type SubmissionRow = typeof assignmentSubmissions.$inferSelect

async function countSubmissions(assignmentId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(assignmentSubmissions)
    .where(eq(assignmentSubmissions.assignmentId, assignmentId))
  return row?.count ?? 0
}

/** Submission counts for many assignments in one grouped query — the
 *  list endpoint embeds the count per assignment, so per-assignment
 *  COUNT queries would be an N+1 storm. */
async function countSubmissionsBatch(assignmentIds: string[]): Promise<Map<string, number>> {
  if (assignmentIds.length === 0) return new Map()
  const rows = await db
    .select({ assignmentId: assignmentSubmissions.assignmentId, count: sql<number>`count(*)::int` })
    .from(assignmentSubmissions)
    .where(inArray(assignmentSubmissions.assignmentId, assignmentIds))
    .groupBy(assignmentSubmissions.assignmentId)
  return new Map(rows.map((r) => [r.assignmentId, r.count]))
}

function toAssignment(row: AssignmentRow, submissionCount: number): Assignment {
  return {
    id: row.id,
    courseId: row.courseId,
    lessonId: row.lessonId ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    instructions: row.instructions ?? undefined,
    maxScore: row.maxScore,
    dueDate: row.dueDate?.toISOString(),
    allowLateSubmission: row.allowLateSubmission,
    lateSubmissionPenalty: row.lateSubmissionPenalty,
    allowedFileTypes: row.allowedFileTypes,
    maxFileSize: row.maxFileSize ?? undefined,
    maxFiles: row.maxFiles,
    isActive: row.isActive,
    submissionCount,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function getAssignmentRow(id: string): Promise<AssignmentRow> {
  const [row] = await db
    .select()
    .from(assignments)
    .where(and(eq(assignments.id, id), isNull(assignments.deletedAt)))
    .limit(1)
  if (!row) throw new NotFoundError("Assignment", id)
  return row
}

export async function listAssignments(courseId: string): Promise<Assignment[]> {
  const rows = await db
    .select()
    .from(assignments)
    .where(and(eq(assignments.courseId, courseId), isNull(assignments.deletedAt)))
  const counts = await countSubmissionsBatch(rows.map((r) => r.id))
  return rows.map((row) => toAssignment(row, counts.get(row.id) ?? 0))
}

export async function getAssignment(id: string): Promise<Assignment> {
  const row = await getAssignmentRow(id)
  return toAssignment(row, await countSubmissions(id))
}

export async function createAssignment(courseId: string, input: AssignmentCreate): Promise<Assignment> {
  const [row] = await db
    .insert(assignments)
    .values({
      id: generateId("asn"),
      courseId,
      lessonId: input.lessonId,
      title: input.title,
      description: input.description,
      instructions: input.instructions,
      maxScore: input.maxScore ?? 100,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      allowLateSubmission: input.allowLateSubmission ?? false,
      lateSubmissionPenalty: input.lateSubmissionPenalty ?? 0,
      allowedFileTypes: input.allowedFileTypes ?? [],
      maxFileSize: input.maxFileSize,
      maxFiles: input.maxFiles ?? 1,
      isActive: input.isActive ?? true,
    })
    .returning()
  return toAssignment(row!, 0)
}

export async function updateAssignment(id: string, input: AssignmentUpdate): Promise<Assignment> {
  await getAssignmentRow(id)
  const { dueDate, ...rest } = input
  const patch: Partial<AssignmentRow> = { ...rest }
  if (dueDate !== undefined) patch.dueDate = new Date(dueDate)
  const [row] = await db.update(assignments).set(patch).where(eq(assignments.id, id)).returning()
  return toAssignment(row!, await countSubmissions(id))
}

export async function deleteAssignment(id: string): Promise<void> {
  await getAssignmentRow(id)
  await db.update(assignments).set({ deletedAt: new Date() }).where(eq(assignments.id, id))
}

/** Batched user lookup — one query for all rows instead of one per
 *  submission (the manager's submissions list was an N+1). */
async function toSubmissions(rows: SubmissionRow[]): Promise<AssignmentSubmission[]> {
  if (rows.length === 0) return []
  const accounts = await db
    .select()
    .from(userTable)
    .where(inArray(userTable.id, [...new Set(rows.map((r) => r.userId))]))
  const accountById = new Map(accounts.map((a) => [a.id, a]))
  return rows.map((row) => {
    const account = accountById.get(row.userId)
    return {
      id: row.id,
      assignmentId: row.assignmentId,
      content: row.content ?? undefined,
      attachments: row.attachments,
      status: row.status as AssignmentSubmission["status"],
      score: row.score ?? undefined,
      feedback: row.feedback ?? undefined,
      submittedAt: row.submittedAt.toISOString(),
      gradedAt: row.gradedAt?.toISOString(),
      isLate: row.isLate,
      user: { id: row.userId, name: account?.name ?? row.userId, email: account?.email ?? "" },
    }
  })
}

async function toSubmission(row: SubmissionRow): Promise<AssignmentSubmission> {
  return (await toSubmissions([row]))[0]!
}

export async function listSubmissionsForManager(assignmentId: string): Promise<AssignmentSubmission[]> {
  const rows = await db.select().from(assignmentSubmissions).where(eq(assignmentSubmissions.assignmentId, assignmentId))
  return toSubmissions(rows)
}

export async function listOwnSubmission(assignmentId: string, userId: string): Promise<AssignmentSubmission[]> {
  const rows = await db
    .select()
    .from(assignmentSubmissions)
    .where(and(eq(assignmentSubmissions.assignmentId, assignmentId), eq(assignmentSubmissions.userId, userId)))
  return toSubmissions(rows)
}

export async function getSubmissionRow(id: string): Promise<SubmissionRow> {
  const [row] = await db.select().from(assignmentSubmissions).where(eq(assignmentSubmissions.id, id)).limit(1)
  if (!row) throw new NotFoundError("AssignmentSubmission", id)
  return row
}

export async function getSubmission(id: string): Promise<AssignmentSubmission> {
  return toSubmission(await getSubmissionRow(id))
}

/** Claims each newly-referenced upload and releases any that the
 *  submission no longer references, mirroring
 *  certificates.service.ts's reconcileSignatureUploads. */
async function reconcileAttachmentUploads(
  submissionId: string,
  oldAttachments: SubmissionRow["attachments"],
  newUploadIds: string[],
  tx?: Tx
): Promise<void> {
  const oldIds = new Set(oldAttachments.map((a) => a.uploadId))
  const newIds = new Set(newUploadIds)
  for (const id of newIds) {
    if (!oldIds.has(id)) await claimUpload(id, "assignment_submission", submissionId, tx)
  }
  for (const id of oldIds) {
    if (!newIds.has(id)) await releaseUpload(id, tx)
  }
}

/**
 * Overwrite-until-graded resubmission rule: creates or replaces the
 * caller's submission while it's absent/draft/submitted/returned;
 * rejected once it's `graded` until the instructor calls `reopen`.
 */
export async function submitAssignment(
  assignmentId: string,
  userId: string,
  input: AssignmentSubmissionCreate
): Promise<AssignmentSubmission> {
  const assignment = await getAssignmentRow(assignmentId)
  const [existing] = await db
    .select()
    .from(assignmentSubmissions)
    .where(and(eq(assignmentSubmissions.assignmentId, assignmentId), eq(assignmentSubmissions.userId, userId)))
    .limit(1)

  if (existing?.status === "graded") {
    throw new ConflictError("This submission has been graded — ask the instructor to reopen it before resubmitting")
  }

  const isLate = assignment.dueDate ? new Date() > assignment.dueDate : false
  if (isLate && !assignment.allowLateSubmission) {
    throw new ForbiddenError("The deadline has passed and late submissions are not allowed for this assignment")
  }

  // The assignment's own file policy — enforced here, at the only entry
  // point, because the generic upload endpoint can't know each
  // assignment's rules. Mime is the server-detected value (magic bytes),
  // never the client's claim.
  const uploadIds = [...new Set(input.attachmentUploadIds ?? [])]
  if (assignment.maxFiles > 0 && uploadIds.length > assignment.maxFiles) {
    throw new BadRequestError(`This assignment accepts at most ${assignment.maxFiles} file(s)`)
  }
  const attachments = await Promise.all(
    uploadIds.map(async (uploadId) => {
      const upload = await getUploadRow(uploadId)
      if (upload.uploadedByUserId !== userId) {
        throw new ForbiddenError(`Attachment '${upload.originalFilename}' was not uploaded by you`)
      }
      if (assignment.maxFileSize != null && upload.sizeBytes > assignment.maxFileSize) {
        throw new BadRequestError(
          `Attachment '${upload.originalFilename}' exceeds this assignment's max file size (${assignment.maxFileSize} bytes)`
        )
      }
      if (assignment.allowedFileTypes.length > 0 && !assignment.allowedFileTypes.includes(upload.mimeType)) {
        throw new BadRequestError(
          `Attachment '${upload.originalFilename}' has type '${upload.mimeType}', which this assignment does not allow`
        )
      }
      return {
        uploadId,
        url: fileUrlFor(upload.id),
        name: upload.originalFilename,
        size: upload.sizeBytes,
        mimeType: upload.mimeType,
      }
    })
  )

  const submissionId = existing?.id ?? generateId("asb")

  const values = {
    content: input.content,
    attachments,
    status: "submitted" as const,
    score: null,
    feedback: null,
    submittedAt: new Date(),
    gradedAt: null,
    isLate,
  }

  // Attachment claim/release and the submission write commit together —
  // a failed insert would otherwise leave uploads claimed forever.
  return db.transaction(async (tx) => {
    await reconcileAttachmentUploads(submissionId, existing?.attachments ?? [], uploadIds, tx)
    const [row] = existing
      ? await tx.update(assignmentSubmissions).set(values).where(eq(assignmentSubmissions.id, existing.id)).returning()
      : await tx
          .insert(assignmentSubmissions)
          .values({ id: submissionId, assignmentId, userId, ...values })
          .returning()
    return toSubmission(row!)
  })
}

export async function gradeSubmission(id: string, input: AssignmentGrade): Promise<AssignmentSubmission> {
  const submission = await getSubmissionRow(id)
  const assignment = await getAssignmentRow(submission.assignmentId)

  if (input.score < 0 || input.score > assignment.maxScore) {
    throw new BadRequestError(`Score must be between 0 and the assignment's maxScore (${assignment.maxScore})`)
  }

  // Late submissions lose lateSubmissionPenalty percent of the entered
  // score (rounded) — the stored score is the final, penalty-applied
  // value the certificate/transcript consumers should see.
  let finalScore = input.score
  if (submission.isLate && assignment.lateSubmissionPenalty > 0) {
    const penalty = Math.min(assignment.lateSubmissionPenalty, 100)
    finalScore = Math.round((input.score * (100 - penalty)) / 100)
  }

  const [row] = await db
    .update(assignmentSubmissions)
    .set({ status: "graded", score: finalScore, feedback: input.feedback, gradedAt: new Date() })
    .where(eq(assignmentSubmissions.id, id))
    .returning()
  return toSubmission(row!)
}

export async function reopenSubmission(id: string): Promise<AssignmentSubmission> {
  const submission = await getSubmissionRow(id)
  if (submission.status !== "graded") throw new ConflictError("Only a graded submission can be reopened")
  const [row] = await db
    .update(assignmentSubmissions)
    .set({ status: "returned" })
    .where(eq(assignmentSubmissions.id, id))
    .returning()
  return toSubmission(row!)
}
