/**
 * Dev seed: creates one admin and one plain user through Better Auth's own
 * sign-up API (so password hashing matches real accounts), then flips the
 * admin's emailVerified/role directly in the DB — the one place a direct
 * write is correct, since bootstrapping the very first admin has no
 * authenticated admin session to call the real admin API with yet. Every
 * later admin action goes through the real API.
 */
import { eq, sql } from "drizzle-orm"
import { auth } from "../auth.js"
import { db } from "./index.js"
import { courses, institutionOwnerships, institutions } from "./app-schema.js"
import { generateId } from "../lib/response.js"
import { users } from "./auth-schema.js"
import { createCourse, publishCourse } from "../modules/courses/services/courses.service.js"
import { createLesson, createModule } from "../modules/course-content/services/course-content.service.js"
import type { LessonCreate } from "@workspace/contracts"

const SEED_PASSWORD = "correcthorsebatterystaple"

/** A handful of published courses so a fresh database has something to
 *  browse — a catalog with zero courses makes every list/detail/card
 *  surface look broken rather than just empty. Thumbnails are picsum.photos
 *  placeholders keyed by a stable seed string, so re-running this script
 *  always resolves to the same image per course instead of a random one. */
const SEED_COURSES: Array<{
  title: string
  shortDescription: string
  description: string
  level: "beginner" | "intermediate" | "advanced" | "expert"
  courseType: "online" | "offline" | "hybrid"
  price?: number
  thumbnailSeed: string
  modules: Array<{
    title: string
    lessons: Array<Pick<LessonCreate, "title" | "contentType" | "textContent" | "isPreview">>
  }>
}> = [
  {
    title: "Dasar-Dasar React untuk Pemula",
    shortDescription: "Pelajari fondasi React dari nol hingga siap kerja.",
    description: "Pelatihan ini membahas komponen, state, dan hooks dengan studi kasus nyata.",
    level: "beginner",
    courseType: "online",
    price: 250000,
    thumbnailSeed: "lms-react-dasar",
    modules: [
      {
        title: "Pengenalan React",
        lessons: [
          {
            title: "Apa itu React?",
            contentType: "text",
            textContent: "React adalah library UI berbasis komponen.",
            isPreview: true,
          },
          {
            title: "Menyiapkan proyek pertama",
            contentType: "text",
            textContent: "Instalasi dan struktur folder dasar.",
          },
        ],
      },
    ],
  },
  {
    title: "Manajemen Proyek Tingkat Lanjut",
    shortDescription: "Kelola proyek lintas tim dengan kerangka kerja yang teruji.",
    description: "Membahas perencanaan, risiko, dan eksekusi proyek untuk manajer berpengalaman.",
    level: "advanced",
    courseType: "hybrid",
    thumbnailSeed: "lms-manajemen-proyek",
    modules: [
      {
        title: "Perencanaan Proyek",
        lessons: [
          {
            title: "Menyusun ruang lingkup proyek",
            contentType: "text",
            textContent: "Teknik menetapkan scope yang realistis.",
            isPreview: true,
          },
        ],
      },
    ],
  },
  {
    title: "Digital Marketing untuk UMKM",
    shortDescription: "Strategi pemasaran digital dengan anggaran terbatas.",
    description: "Dari media sosial hingga iklan berbayar, disesuaikan untuk usaha kecil.",
    level: "intermediate",
    courseType: "offline",
    price: 150000,
    thumbnailSeed: "lms-digital-marketing",
    modules: [
      {
        title: "Media Sosial untuk Bisnis",
        lessons: [
          {
            title: "Memilih platform yang tepat",
            contentType: "text",
            textContent: "Menentukan platform sesuai target pasar.",
            isPreview: true,
          },
        ],
      },
    ],
  },
  {
    title: "Keselamatan Kerja di Lingkungan Industri",
    shortDescription: "Standar K3 dasar untuk pekerja lapangan.",
    description: "Pelatihan wajib mencakup identifikasi bahaya dan prosedur tanggap darurat.",
    level: "beginner",
    courseType: "offline",
    thumbnailSeed: "lms-k3-industri",
    modules: [
      {
        title: "Identifikasi Bahaya",
        lessons: [
          {
            title: "Jenis-jenis bahaya di tempat kerja",
            contentType: "text",
            textContent: "Bahaya fisik, kimia, dan ergonomis.",
            isPreview: true,
          },
        ],
      },
    ],
  },
]

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

  // A real, non-admin account holding a real institution ownership grant —
  // needed by smoke tests that exercise the institution_owner section
  // (deriveDefaultSection() requires a REAL ownership row now; admin can't
  // stand in for this since admin always outranks institution_owner in the
  // section priority). The seeded institution itself is a throwaway — the
  // owner-facing pages this unlocks are otherwise unaffected by its name.
  const owner = await upsertSeedUser("owner@lms.dev", "LMS Institution Owner")
  await db.update(users).set({ emailVerified: true }).where(eq(users.id, owner.id))
  const [existingOwnership] = await db
    .select()
    .from(institutionOwnerships)
    .where(eq(institutionOwnerships.userId, owner.id))
    .limit(1)
  let institutionId = existingOwnership?.institutionId
  if (!existingOwnership) {
    const [seededInstitution] = await db
      .insert(institutions)
      .values({
        id: generateId("ins"),
        name: "Institusi Seed (LMS Institution Owner)",
        institutionType: "swasta",
        logo: "https://picsum.photos/seed/lms-institusi-seed/200/200",
      })
      .returning()
    await db.insert(institutionOwnerships).values({
      id: generateId("own"),
      userId: owner.id,
      institutionId: seededInstitution!.id,
    })
    institutionId = seededInstitution!.id
    console.log(`  → ${owner.email} granted real ownership of ${seededInstitution!.name}`)
  } else {
    console.log(`  → ${owner.email} already owns an institution`)
  }

  const [existingCourse] = await db.select().from(courses).where(eq(courses.institutionId, institutionId!)).limit(1)
  if (!existingCourse) {
    for (const seedCourse of SEED_COURSES) {
      const created = await createCourse(
        {
          institutionId: institutionId!,
          title: seedCourse.title,
          shortDescription: seedCourse.shortDescription,
          description: seedCourse.description,
          thumbnail: `https://picsum.photos/seed/${seedCourse.thumbnailSeed}/800/450`,
          courseType: seedCourse.courseType,
          level: seedCourse.level,
          price: seedCourse.price,
          isDisabilityFriendly: false,
          supportedDisabilityTypes: [],
        },
        { id: owner.id, name: owner.name }
      )
      for (const seedModule of seedCourse.modules) {
        const module = await createModule(created.id, { title: seedModule.title })
        for (const lesson of seedModule.lessons) {
          await createLesson(module.id, lesson)
        }
      }
      await publishCourse(created.id, { id: owner.id })
    }
    console.log(`  → seeded ${SEED_COURSES.length} published courses under ${owner.email}'s institution`)
  } else {
    console.log(`  → courses already seeded for ${owner.email}'s institution`)
  }

  // --- Canonical DRIVE Program Seeding (FK-KMK UGM) ---
  const [existingUgm] = await db
    .select()
    .from(institutions)
    .where(eq(institutions.name, "Departemen Oftalmologi FK-KMK UGM"))
    .limit(1)

  let ugmId = existingUgm?.id
  if (!existingUgm) {
    const [ugm] = await db
      .insert(institutions)
      .values({
        id: generateId("ins"),
        name: "Departemen Oftalmologi FK-KMK UGM",
        institutionType: "pemerintah",
        logo: "/content/drive-retinopati/assets/v42_image1.png",
      })
      .returning()
    ugmId = ugm!.id
    await db.insert(institutionOwnerships).values({
      id: generateId("own"),
      userId: admin.id,
      institutionId: ugmId,
    })
    console.log(`  → created Departemen Oftalmologi FK-KMK UGM (${ugmId})`)
  }

  const [existingDriveCourse] = await db.select().from(courses).where(eq(courses.slug, "drive-retinopati")).limit(1)

  if (!existingDriveCourse) {
    const created = await createCourse(
      {
        institutionId: ugmId!,
        title: "DRIVE — Skrining Retinopati Diabetika untuk Dokter Layanan Primer",
        shortDescription:
          "Pelatihan interaktif skrining dan deteksi dini Retinopati Diabetika untuk dokter layanan primer berbasis pedoman klinis PERKENI, IDF, dan AAO.",
        description:
          "Modul 1: Pengenalan Diabetes Mellitus dan Retinopati Diabetika. Dilengkapi narasi klinis terstandar, visualisasi anatomi 2D, alur patofisiologi sequential, simulasi grading fundus, kuis evaluasi, dan penerbitan sertifikat kelulusan resmi.",
        thumbnail: "/content/drive-retinopati/assets/v42_image1.png",
        courseType: "online",
        level: "beginner",
        price: 0,
        isDisabilityFriendly: true,
        supportedDisabilityTypes: [],
      },
      { id: admin.id, name: admin.name }
    )

    // Ensure human-readable slug 'drive-retinopati' so route /courses/drive-retinopati always matches
    await db.update(courses).set({ slug: "drive-retinopati" }).where(eq(courses.id, created.id))

    const driveModules = [
      {
        title: "Pengantar & Overview Pelatihan",
        lessons: [
          {
            title: "Pengantar Program DRIVE & Cakupan Materi",
            contentType: "text" as const,
            textContent:
              "Selamat datang di Modul 1 Pelatihan Skrining Retinopati Diabetika dalam program DRIVE (Diabetic Retinopathy Initiatives). Modul ini membekali dokter layanan primer dengan pemahaman komprehensif mengenai diabetes mellitus dan komplikasinya di retina.",
            isPreview: true,
          },
        ],
      },
      {
        title: "Bab 1: Diabetes Mellitus",
        lessons: [
          {
            title: "Definisi, Epidemiologi, Klasifikasi, dan Komplikasi DM",
            contentType: "text" as const,
            textContent:
              "Membahas definisi DM menurut PERKENI 2021, data IDF Atlas 11th Ed 2025, patogenesis Egregious Eleven, kriteria diagnosis glukosa/HbA1c, dan komplikasi mikrovaskular.",
          },
        ],
      },
      {
        title: "Bab 2: Retinopati Diabetika",
        lessons: [
          {
            title: "Anatomi Mata, Definisi RD, Patofisiologi Sequential, dan Faktor Risiko",
            contentType: "text" as const,
            textContent:
              "Eksplorasi anatomi mata 2D, definisi RD, alur patofisiologi sequential 1-8, faktor risiko, dan latihan matching pair interaktif.",
          },
        ],
      },
      {
        title: "Bab 3: Skrining dan Tatalaksana RD",
        lessons: [
          {
            title: "Skrining FKTP, Natural History, Kriteria ECIM, dan Rujukan",
            contentType: "text" as const,
            textContent:
              "Konsep skrining vs deteksi dini, kriteria WHO ECIM, jadwal kontrol berkala, 4 pilar tatalaksana, dan peran dokter layanan primer.",
          },
        ],
      },
      {
        title: "Simulasi Grading Fundus & Evaluasi Akhir",
        lessons: [
          {
            title: "Simulasi Grading 5 Kasus Fundus & Standardized Clinical Post-Test",
            contentType: "text" as const,
            textContent:
              "Simulasi grading lesi fundus interaktif dengan penanda retikel non-obscuring dan post-test 5 soal terstandar untuk klaim sertifikat kelulusan.",
          },
        ],
      },
    ]

    for (const mod of driveModules) {
      const createdMod = await createModule(created.id, { title: mod.title })
      for (const les of mod.lessons) {
        await createLesson(createdMod.id, les)
      }
    }
    await publishCourse(created.id, { id: admin.id })
    console.log(`  → seeded canonical DRIVE course (${created.id}) with slug 'drive-retinopati'`)
  } else {
    console.log(`  → DRIVE course already exists (${existingDriveCourse.id})`)
  }

  console.log(`\nSeeded. Sign in with any account, password: ${SEED_PASSWORD}`)
}

export async function resetAndSeedDatabase() {
  await db.execute(sql`
    TRUNCATE TABLE
      announcements,
      assignments,
      certificates,
      course_lessons,
      attendance_sessions,
      certificate_settings,
      coupons,
      audit_log,
      course_instructors,
      attendance_records,
      accounts,
      enrollments,
      course_modules,
      courses,
      discussions,
      institution_requests,
      institution_ownerships,
      institutions,
      notifications,
      quizzes,
      platform_settings,
      quiz_questions,
      sessions,
      lesson_progress,
      orders,
      verifications,
      users,
      assignment_submissions,
      discussion_replies,
      quiz_attempts,
      wishlist_items,
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
