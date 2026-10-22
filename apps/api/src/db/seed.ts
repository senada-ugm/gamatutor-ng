/**
 * Dev seed: creates one admin and one plain user through Better Auth's own
 * sign-up API (so password hashing matches real accounts), then flips the
 * admin's emailVerified/role directly in the DB — the one place a direct
 * write is correct, since bootstrapping the very first admin has no
 * authenticated admin session to call the real admin API with yet. Every
 * later admin action goes through the real API.
 */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { eq, sql } from "drizzle-orm"
import { auth } from "../auth.js"
import { db } from "./index.js"
import {
  courses,
  courseInstructors,
  enrollments,
  institutionOwnerships,
  institutions,
  participantProfiles,
  slideDecks,
} from "./app-schema.js"
import { generateId } from "../lib/response.js"
import { users } from "./auth-schema.js"
import { createCourse, publishCourse } from "../modules/courses/services/courses.service.js"
import { createLesson, createModule } from "../modules/course-content/services/course-content.service.js"
import { createQuiz, createQuestion } from "../modules/quizzes/services/quizzes.service.js"
import type { LessonCreate } from "@workspace/contracts"

const SEED_PASSWORD = "correcthorsebatterystaple"

async function upsertSeedUser(email: string, name: string) {
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (existing) {
    console.log(`↷ ${email} already exists (${existing.id})`)
    return existing
  }

  const { user: created } = await auth.api.signUpEmail({
    body: { email, password: SEED_PASSWORD, name },
  })
  console.log(`✓ created ${email} (${created.id})`)
  return created
}

export async function seedDatabase() {
  const admin = await upsertSeedUser("admin@lms.dev", "LMS Admin")
  await db.update(users).set({ emailVerified: true, role: "admin" }).where(eq(users.id, admin.id))
  console.log(`  → ${admin.email} marked verified + role=admin`)

  const plain = await upsertSeedUser("user@lms.dev", "LMS User")
  await db.update(users).set({ emailVerified: true }).where(eq(users.id, plain.id))
  console.log(`  → ${plain.email} marked verified (role=user, default)`)

  const owner = await upsertSeedUser("owner@lms.dev", "LMS Institution Owner")
  await db.update(users).set({ emailVerified: true }).where(eq(users.id, owner.id))
  console.log(`  → ${owner.email} marked verified (role=user)`)

  // --- Official Institution: Departemen Oftalmologi FK-KMK UGM (owned by owner@lms.dev) ---
  const [existingInst] = await db
    .select()
    .from(institutions)
    .where(eq(institutions.name, "Departemen Oftalmologi FK-KMK UGM"))
    .limit(1)

  let institutionId = existingInst?.id
  if (!existingInst) {
    const [inst] = await db
      .insert(institutions)
      .values({
        id: generateId("ins"),
        name: "Departemen Oftalmologi FK-KMK UGM",
        institutionType: "pemerintah",
        logo: "/content/drive-retinopati/assets/v42_image1.png",
        description:
          "Departemen Oftalmologi, Fakultas Kedokteran, Kesehatan Masyarakat, dan Keperawatan (FK-KMK) Universitas Gadjah Mada - RSUP Dr. Sardjito Yogyakarta.",
        website: "https://fk.ugm.ac.id",
        email: "owner@lms.dev",
        address: "Jl. Farmako, Sekip Utara, Yogyakarta",
        status: "approved",
      })
      .returning()
    institutionId = inst!.id
    console.log(`  → created Departemen Oftalmologi FK-KMK UGM (${institutionId})`)
  }

  // Ensure owner@lms.dev holds real ownership of this institution
  const [ownerGrant] = await db
    .select()
    .from(institutionOwnerships)
    .where(eq(institutionOwnerships.userId, owner.id))
    .limit(1)

  if (!ownerGrant) {
    await db.insert(institutionOwnerships).values({
      id: generateId("own"),
      userId: owner.id,
      institutionId: institutionId!,
    })
    console.log(`  → granted ${owner.email} ownership of Departemen Oftalmologi FK-KMK UGM`)
  } else if (ownerGrant.institutionId !== institutionId) {
    await db
      .update(institutionOwnerships)
      .set({ institutionId: institutionId! })
      .where(eq(institutionOwnerships.id, ownerGrant.id))
    console.log(`  → updated ${owner.email} ownership to Departemen Oftalmologi FK-KMK UGM`)
  }

  // --- SINGLE CANONICAL COURSE: "Pengenalan Diabetes dan Retinopati Diabetika" ---
  // Owned by owner@lms.dev's institution
  const [existingCourse] = await db.select().from(courses).where(eq(courses.slug, "drive-retinopati")).limit(1)
  let driveCourseId = existingCourse?.id

  if (!existingCourse) {
    const created = await createCourse(
      {
        institutionId: institutionId!,
        title: "Pengenalan Diabetes dan Retinopati Diabetika",
        shortDescription:
          "Pelatihan interaktif skrining dan deteksi dini Retinopati Diabetika untuk dokter layanan primer berbasis pedoman klinis PERKENI, IDF, dan AAO.",
        description:
          "Pengenalan Diabetes dan Retinopati Diabetika. Dilengkapi narasi klinis terstandar, visualisasi anatomi 2D, alur patofisiologi sequential, simulasi grading fundus, kuis evaluasi, dan penerbitan sertifikat kelulusan resmi.",
        thumbnail: "/content/drive-retinopati/assets/v42_image1.png",
        courseType: "online",
        level: "beginner",
        isDisabilityFriendly: true,
        supportedDisabilityTypes: [],
      },
      { id: owner.id, name: owner.name }
    )

    await db.update(courses).set({ slug: "drive-retinopati" }).where(eq(courses.id, created.id))
    driveCourseId = created.id

    const deckManifest = JSON.parse(
      readFileSync(fileURLToPath(new URL("./seed-data/drive-retinopati.deck.json", import.meta.url)), "utf-8")
    ) as Record<string, unknown>

    const driveModules = ((deckManifest.modules as Array<Record<string, unknown>>) || [])
      .filter((m) => Array.isArray(m.pages) && m.pages.length > 0)
      .map((m) => ({
        title: (m.label as string) || (m.title as string) || (m.id as string),
        lessons: ((m.pages as Array<Record<string, unknown>>) || []).map((p) => ({
          title: (p.title as string) || (p.kicker as string) || (p.id as string),
          contentType: "text" as const,
          textContent: (p.transcript as string) || (p.body as string) || (p.title as string) || (p.id as string),
          isPreview: m.id === "pengantar",
        })),
      }))

    for (const mod of driveModules) {
      const createdMod = await createModule(created.id, { title: mod.title })
      for (const les of mod.lessons) {
        await createLesson(createdMod.id, les)
      }
    }

    await publishCourse(driveCourseId, { id: owner.id })
    console.log(
      `  → seeded single canonical course (${driveCourseId}) "Pengenalan Diabetes dan Retinopati Diabetika" under ${owner.email}'s institution`
    )
  } else {
    await db
      .update(courses)
      .set({
        title: "Pengenalan Diabetes dan Retinopati Diabetika",
        institutionId: institutionId!,
        instructor: { id: owner.id, name: owner.name },
        status: "published",
      })
      .where(eq(courses.id, existingCourse.id))
    console.log(
      `  → updated course (${existingCourse.id}) title to "Pengenalan Diabetes dan Retinopati Diabetika" under institution (${institutionId})`
    )
  }

  // Load interactive slide deck manifest
  const deckManifest = JSON.parse(
    readFileSync(fileURLToPath(new URL("./seed-data/drive-retinopati.deck.json", import.meta.url)), "utf-8")
  ) as Record<string, unknown>

  // Assign owner@lms.dev as accepted instructor on the course
  await db
    .insert(courseInstructors)
    .values({
      id: generateId("ci"),
      courseId: driveCourseId!,
      email: owner.email,
      userId: owner.id,
      role: "instructor",
      status: "accepted",
    })
    .onConflictDoNothing()

  // Seed doctor participant profile for user@lms.dev
  await db
    .insert(participantProfiles)
    .values({
      id: plain.id,
      profession: "Dokter Umum Layanan Primer",
      institutionName: "Puskesmas Jetis Kota Yogyakarta",
      strNumber: "3412345678901234",
      educationLevel: "Profesi Dokter (dr.)",
      dati2: "Kota Yogyakarta",
    })
    .onConflictDoNothing()

  // Enroll user@lms.dev as 'selected' student so course is immediately active
  await db
    .insert(enrollments)
    .values({
      id: generateId("enr"),
      userId: plain.id,
      courseId: driveCourseId!,
      status: "selected",
      enrollmentType: "free",
      approvedAt: new Date(),
    })
    .onConflictDoNothing()
  console.log(`  → enrolled ${plain.email} into course (status=selected)`)

  // Attach the canonical interactive deck
  await db
    .insert(slideDecks)
    .values({
      id: generateId("dck"),
      courseId: driveCourseId!,
      schemaVersion: 1,
      manifest: deckManifest,
    })
    .onConflictDoUpdate({
      target: slideDecks.courseId,
      set: { manifest: deckManifest, schemaVersion: 1, updatedAt: new Date() },
    })
  console.log(`  → interactive slide deck attached (${(deckManifest.modules as unknown[])?.length ?? "?"} modules)`)

  // Post-test evaluation quiz
  const [existingDeck] = await db.select().from(slideDecks).where(eq(slideDecks.courseId, driveCourseId!)).limit(1)
  if (existingDeck && !existingDeck.postTestQuizId) {
    const quizPages =
      (
        (deckManifest.modules as Array<Record<string, unknown>>)?.find((m) => m.id === "evaluasi")?.pages as Array<
          Record<string, unknown>
        >
      )?.filter((p) => p.type === "quiz") ?? []
    if (quizPages.length > 0) {
      const quiz = await createQuiz(driveCourseId!, {
        title: "Post-Test Evaluasi Klinis — DRIVE",
        description:
          "Evaluasi akhir pelatihan: 5 soal terstandar. Nilai kelulusan minimum 70%; percobaan tidak dibatasi (retake sesuai kebutuhan).",
        passingScore: 70,
        maxAttempts: 0,
        timeLimit: 0,
        shuffleQuestions: false,
        shuffleOptions: false,
        showResults: true,
        showCorrectAnswers: true,
      })
      for (const [index, page] of quizPages.entries()) {
        const options = (page.options as Array<{ letter: string; text: string }>) ?? []
        const correctLetter = page.correct as string
        const correctText = options.find((o) => o.letter === correctLetter)?.text ?? ""
        await createQuestion(quiz.id, {
          question: page.question as string,
          questionType: "single_choice",
          options: options.map((o) => ({ text: o.text })),
          correctAnswers: [correctText],
          points: Math.round(100 / quizPages.length),
          explanation: (page.explanation as string) ?? undefined,
          displayOrder: index,
        })
      }
      await db.update(slideDecks).set({ postTestQuizId: quiz.id }).where(eq(slideDecks.id, existingDeck.id))
      console.log(`  → post-test quiz linked to DRIVE deck (${quizPages.length} questions, ${quiz.id})`)
    }
  }

  // Ensure "Course cukup 1 saja" by removing any extra non-canonical courses
  const extraCourses = await db
    .select()
    .from(courses)
    .where(sql`${courses.id} != ${driveCourseId!}`)
  if (extraCourses.length > 0) {
    for (const extra of extraCourses) {
      await db.delete(courses).where(eq(courses.id, extra.id))
    }
    console.log(`  → cleaned up ${extraCourses.length} non-canonical courses (kept exactly 1 course)`)
  }

  // Clean up any stale unused institutions (e.g. former dummy "Institusi Seed")
  const staleInsts = await db
    .select()
    .from(institutions)
    .where(sql`${institutions.id} != ${institutionId!}`)
  if (staleInsts.length > 0) {
    for (const stale of staleInsts) {
      await db.delete(institutionOwnerships).where(eq(institutionOwnerships.institutionId, stale.id))
      await db.delete(institutions).where(eq(institutions.id, stale.id))
    }
    console.log(`  → cleaned up ${staleInsts.length} stale unused institutions`)
  }

  console.log(`\nSeeded. Sign in with any account, password: ${SEED_PASSWORD}`)
}

export async function resetAndSeedDatabase() {
  await db.execute(sql`
    TRUNCATE TABLE
      announcements,
      certificates,
      course_lessons,
      certificate_settings,
      course_instructors,
      accounts,
      enrollments,
      course_modules,
      courses,
      institution_requests,
      institution_ownerships,
      institutions,
      notifications,
      quizzes,
      platform_settings,
      quiz_questions,
      sessions,
      lesson_progress,
      verifications,
      users,
      quiz_attempts,
      learning_telemetry_logs,
      participant_profiles
    CASCADE;
  `)
  await seedDatabase()
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("seed.ts")) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
