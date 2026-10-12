/**
 * Dev seed: creates one admin and one plain user through Better Auth's own
 * sign-up API (so password hashing matches real accounts), then flips the
 * admin's emailVerified/role directly in the DB — the one place a direct
 * write is correct, since bootstrapping the very first admin has no
 * authenticated admin session to call the real admin API with yet. Every
 * later admin action goes through the real API.
 */
import { eq } from "drizzle-orm"
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

async function main() {
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

  console.log(`\nSeeded. Sign in with any account, password: ${SEED_PASSWORD}`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
