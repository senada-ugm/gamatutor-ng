/**
 * Converges an already-seeded database onto the shipped DRIVE deck.
 *
 *   tsx src/db/sync-drive-deck.ts
 *
 * seed.ts writes the deck only when it creates the course, so content
 * revisions (new transcripts, pages, images) would never reach a database
 * that has real learners. This replaces the deck manifest and refreshes the
 * post-test questions' explanations in place. Questions, options and answer
 * keys are left alone: past attempts were graded against them. Idempotent.
 */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { and, eq } from "drizzle-orm"
import { db } from "./index.js"
import { courses, quizQuestions, slideDecks } from "./app-schema.js"

const manifest = JSON.parse(
  readFileSync(fileURLToPath(new URL("./seed-data/drive-retinopati.deck.json", import.meta.url)), "utf-8")
) as { modules: Array<{ id: string; pages: Array<Record<string, unknown>> }> }

const [course] = await db.select().from(courses).where(eq(courses.slug, "drive-retinopati")).limit(1)
if (!course) {
  console.log("sync-drive-deck: no DRIVE course yet (the seed creates it); nothing to do")
  process.exit(0)
}

const [deck] = await db
  .update(slideDecks)
  .set({ manifest, schemaVersion: 1, updatedAt: new Date() })
  .where(eq(slideDecks.courseId, course.id))
  .returning()
if (!deck) {
  // A half-finished seed; re-seeding (not this script) builds the deck.
  console.log(`sync-drive-deck: DRIVE course ${course.id} has no slide deck; run the seed`)
  process.exit(0)
}
console.log(`sync-drive-deck: manifest updated (${manifest.modules.length} modules)`)

const quizPages = manifest.modules.find((m) => m.id === "evaluasi")?.pages.filter((p) => p.type === "quiz") ?? []
if (deck.postTestQuizId) {
  let updated = 0
  for (const page of quizPages) {
    const rows = await db
      .update(quizQuestions)
      .set({ explanation: page.explanation as string })
      .where(and(eq(quizQuestions.quizId, deck.postTestQuizId), eq(quizQuestions.question, page.question as string)))
      .returning({ id: quizQuestions.id })
    updated += rows.length
  }
  console.log(`sync-drive-deck: ${updated}/${quizPages.length} post-test explanations refreshed`)
}
process.exit(0)
