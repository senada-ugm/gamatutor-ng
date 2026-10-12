import { randomBytes } from "node:crypto"
import type {
  Certificate,
  CertificateIssue,
  CertificateSettings,
  CertificateSettingsUpdate,
} from "@workspace/contracts"
import { eq, or } from "drizzle-orm"
import { db, type Tx } from "../../../db/index.js"
import { certificateSettings, certificates, courses, enrollments, institutions } from "../../../db/app-schema.js"
import { users as userTable } from "../../../db/auth-schema.js"
import { ConflictError, ForbiddenError, NotFoundError } from "../../../lib/errors.js"
import { generateId } from "../../../lib/response.js"
import { hasPaidOrder } from "../../payments/services/payments.service.js"
import { claimUpload, extractUploadIdFromUrl, releaseUpload } from "../../uploads/services/uploads.service.js"

function toSettings(row: typeof certificateSettings.$inferSelect): CertificateSettings {
  return {
    courseId: row.courseId,
    signatures: row.signatures as CertificateSettings["signatures"],
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function getCertificateSettings(courseId: string): Promise<CertificateSettings> {
  const [row] = await db.select().from(certificateSettings).where(eq(certificateSettings.courseId, courseId)).limit(1)
  if (row) return toSettings(row)
  return { courseId, signatures: [], updatedAt: new Date().toISOString() }
}

async function reconcileSignatureUploads(
  courseId: string,
  oldSignatures: CertificateSettings["signatures"],
  newSignatures: CertificateSettings["signatures"],
  tx?: Tx
): Promise<void> {
  const oldUrls = new Set(oldSignatures.map((s) => s.signatureUrl).filter((url): url is string => !!url))
  const newUrls = new Set(newSignatures.map((s) => s.signatureUrl).filter((url): url is string => !!url))

  for (const url of newUrls) {
    if (oldUrls.has(url)) continue
    const uploadId = extractUploadIdFromUrl(url)
    if (uploadId) await claimUpload(uploadId, "certificate_settings", courseId, tx)
  }
  for (const url of oldUrls) {
    if (newUrls.has(url)) continue
    const uploadId = extractUploadIdFromUrl(url)
    if (uploadId) await releaseUpload(uploadId, tx)
  }
}

export async function updateCertificateSettings(
  courseId: string,
  input: CertificateSettingsUpdate
): Promise<CertificateSettings> {
  // One transaction: signature upload claims/releases and the settings
  // write succeed or fail together (a failed write would otherwise leak
  // claimed uploads that the orphan sweep can never recover).
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(certificateSettings)
      .where(eq(certificateSettings.courseId, courseId))
      .limit(1)
    const oldSignatures = (existing?.signatures as CertificateSettings["signatures"]) ?? []
    await reconcileSignatureUploads(courseId, oldSignatures, input.signatures, tx)

    if (existing) {
      const [row] = await tx
        .update(certificateSettings)
        .set({ signatures: input.signatures, updatedAt: new Date() })
        .where(eq(certificateSettings.id, existing.id))
        .returning()
      return toSettings(row!)
    }
    const [row] = await tx
      .insert(certificateSettings)
      .values({ id: generateId("cst"), courseId, signatures: input.signatures })
      .returning()
    return toSettings(row!)
  })
}

function randomSuffix(): string {
  return randomBytes(4).toString("hex").toUpperCase()
}

async function toCertificate(row: typeof certificates.$inferSelect): Promise<Certificate> {
  const [account] = await db.select().from(userTable).where(eq(userTable.id, row.userId)).limit(1)
  const [course] = await db.select().from(courses).where(eq(courses.id, row.courseId)).limit(1)
  const [settings] = await db
    .select()
    .from(certificateSettings)
    .where(eq(certificateSettings.courseId, row.courseId))
    .limit(1)
  const institution = course
    ? (await db.select().from(institutions).where(eq(institutions.id, course.institutionId)).limit(1))[0]
    : undefined

  return {
    id: row.id,
    enrollmentId: row.enrollmentId,
    courseId: row.courseId,
    userId: row.userId,
    certificateNumber: row.certificateNumber,
    verificationCode: row.verificationCode,
    title: row.title,
    description: row.description ?? undefined,
    customFields: row.customFields as Record<string, string>,
    issuedAt: row.issuedAt.toISOString(),
    user: { name: account?.name ?? row.userId, email: account?.email ?? "" },
    course: {
      title: course?.title ?? "",
      certificateSignatures: (settings?.signatures as CertificateSettings["signatures"]) ?? [],
    },
    institution: { name: institution?.name ?? "" },
  }
}

export async function getCertificateRow(id: string) {
  const [row] = await db.select().from(certificates).where(eq(certificates.id, id)).limit(1)
  if (!row) throw new NotFoundError("Certificate", id)
  return row
}

export async function getCertificate(id: string): Promise<Certificate> {
  return toCertificate(await getCertificateRow(id))
}

export async function verifyCertificate(code: string): Promise<Certificate> {
  const [row] = await db
    .select()
    .from(certificates)
    .where(or(eq(certificates.verificationCode, code), eq(certificates.certificateNumber, code)))
    .limit(1)
  if (!row) throw new NotFoundError("Certificate", code)
  return toCertificate(row)
}

export async function issueCertificate(courseId: string, input: CertificateIssue, tx?: Tx): Promise<Certificate> {
  const [enrollment] = await db.select().from(enrollments).where(eq(enrollments.id, input.enrollmentId)).limit(1)
  if (!enrollment || enrollment.courseId !== courseId) throw new NotFoundError("Enrollment", input.enrollmentId)

  const [existing] = await db
    .select()
    .from(certificates)
    .where(eq(certificates.enrollmentId, input.enrollmentId))
    .limit(1)
  if (existing) return toCertificate(existing)

  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1)
  if (!course) throw new NotFoundError("Course", courseId)

  if ((course.price ?? 0) > 0) {
    const paid = await hasPaidOrder(enrollment.userId, courseId, tx)
    if (!paid) {
      throw new ForbiddenError("Sertifikat tidak dapat diterbitkan: peserta belum melunasi pembayaran pelatihan ini")
    }
  }

  const year = new Date().getFullYear()
  const d = tx ?? db

  // Roll fresh number/code suffixes per attempt: a unique violation on
  // certificate_number/verification_code is a random suffix collision
  // (retry with new values), while one on enrollment_id means this
  // enrollment is already certified (two concurrent graduates). The old
  // catch-all mapped both to the same "already has a certificate" 409.
  const isEnrollmentCollision = (error: unknown): boolean => {
    const cause = (error as { cause?: { code?: string; constraint?: string } })?.cause
    return cause?.code === "23505" && (cause.constraint ?? "").includes("enrollment_id")
  }

  let row: typeof certificates.$inferSelect | undefined
  for (let attempt = 0; !row && attempt < 3; attempt++) {
    const rows = await d
      .insert(certificates)
      .values({
        id: generateId("cert"),
        enrollmentId: input.enrollmentId,
        courseId,
        userId: enrollment.userId,
        certificateNumber: `CERT/${year}/${randomSuffix()}`,
        verificationCode: `SKR-${randomSuffix()}`,
        title: input.title ?? "Sertifikat Kelulusan",
        description: input.description ?? `Sertifikat kelulusan ${course.title}`,
        customFields: (input.customFields ?? {}) as Record<string, string>,
      })
      .returning()
      .catch((error) => {
        if (isEnrollmentCollision(error)) {
          throw new ConflictError("This enrollment already has a certificate")
        }
        if (attempt >= 2) {
          throw new ConflictError("Could not allocate a unique certificate number, please retry")
        }
        return []
      })
    row = rows[0]
  }

  await d
    .update(enrollments)
    .set({ certificateIssued: true, certificateId: row!.id })
    .where(eq(enrollments.id, input.enrollmentId))

  return toCertificate(row!)
}
