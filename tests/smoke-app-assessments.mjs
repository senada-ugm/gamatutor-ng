/**
 * Manual smoke script verifying the standalone-assessment loop (run
 * against live dev servers; not part of CI):
 *   pnpm --filter api dev          # CORS_ORIGIN=http://localhost:3030
 *   pnpm --filter app dev
 *   node tests/smoke-app-assessments.mjs
 *
 * As admin: author a course-less assessment at /admin/assessments with
 * Likert questions carrying a RIASEC category and per-option weights.
 * As the seeded learner: take it at /assessments and confirm the result
 * renders the Holland report — the per-category scores the server has
 * always computed, and the "0/0 Lulus" header that must NOT appear over
 * an assessment that has no right answers.
 */
import { chromium } from "playwright"

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3030"
const ADMIN = { email: "admin@lms.dev", password: "correcthorsebatterystaple" }
const LEARNER = { email: "user@lms.dev", password: "correcthorsebatterystaple" }
const TITLE = `Smoke RIASEC ${Date.now()}`
// Weights descend so the top option is unambiguous: answering option A
// on all three makes R/I/S the Holland top-3 in a fixed order.
const QUESTIONS = [
  { text: "Saya senang memperbaiki mesin.", category: "R", options: ["Sangat setuju", "Netral", "Tidak setuju"] },
  { text: "Saya senang menganalisis data.", category: "I", options: ["Sangat setuju", "Netral", "Tidak setuju"] },
  { text: "Saya senang membantu orang lain.", category: "S", options: ["Sangat setuju", "Netral", "Tidak setuju"] },
]
const WEIGHTS = ["5", "3", "1"]
let failures = 0

async function expect(name, fn) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (err) {
    failures++
    console.error(`FAIL ${name}: ${err.message.split("\n")[0]}`)
  }
}

async function login(page, who) {
  await page.goto(`${BASE}/login`)
  await page.locator("#email").fill(who.email)
  await page.locator("#password").fill(who.password)
  await page.getByRole("button", { name: "Masuk", exact: true }).click()
  await page.waitForURL("**/dashboard", { timeout: 15000 })
}

const browser = await chromium.launch(process.env.SMOKE_CHROMIUM ? { executablePath: process.env.SMOKE_CHROMIUM } : {})
const page = await browser.newPage()

// ================= AS ADMIN: author the assessment =================
await login(page, ADMIN)

await page.goto(`${BASE}/admin/assessments`, { timeout: 30000 })
await expect("management sidebar reaches the admin assessments page", async () => {
  await page.getByRole("heading", { name: "Asesmen", exact: true }).first().waitFor({ timeout: 10000 })
})

await page.getByRole("button", { name: "Asesmen Baru" }).click()
await page.locator("#quiz-title").fill(TITLE)
await page.getByRole("button", { name: "Buat Asesmen" }).click()
await expect("creating opens the builder for the new assessment", async () => {
  await page.getByRole("button", { name: "Kembali ke Asesmen" }).waitFor({ timeout: 10000 })
})

for (const q of QUESTIONS) {
  await page.getByRole("button", { name: "Tambah Pertanyaan" }).click()
  await page.locator("#question-text").fill(q.text)
  await page.locator("#question-type").selectOption("likert")
  await page.locator("#question-category").fill(q.category)
  for (const [i, option] of q.options.entries()) {
    await page.getByPlaceholder(`Opsi ${String.fromCharCode(65 + i)}`).fill(option)
    await page.getByLabel(`Bobot opsi ${String.fromCharCode(65 + i)}`).fill(WEIGHTS[i])
  }
  // The form starts with four option rows; the unfilled one is dropped
  // on save (blank options are zipped out with their weights).
  await page.getByRole("button", { name: "Simpan Pertanyaan" }).click()
  await page.getByText(`${QUESTIONS.indexOf(q) + 1}. ${q.text}`).waitFor({ timeout: 10000 })
}

await expect("three Likert questions persist in the builder", async () => {
  await page.getByRole("heading", { name: "Pertanyaan (3)" }).waitFor({ timeout: 10000 })
})
await expect("the Likert type badge renders on the saved question", async () => {
  await page.getByText("Skala Likert").first().waitFor({ timeout: 5000 })
})

// ================= AS THE LEARNER: take it =================
await page.getByRole("button", { name: "Menu Akun" }).click()
await page.getByRole("menuitem", { name: "Keluar" }).click()
await page.waitForURL("**/login", { timeout: 10000 })
await login(page, LEARNER)

await page.goto(`${BASE}/assessments`, { timeout: 30000 })
await expect("the new assessment is listed for the learner", async () => {
  await page.getByText(TITLE).first().waitFor({ timeout: 10000 })
})

// The Item row is the only div holding an item-content child, so this
// scopes "Kerjakan" to the row carrying this run's title.
await page
  .locator('div:has(> [data-slot="item-content"])')
  .filter({ hasText: TITLE })
  .getByRole("button", { name: "Kerjakan" })
  .click()
await expect("the intro card drops the pass mark an assessment cannot have", async () => {
  await page.getByRole("button", { name: "Mulai Asesmen" }).waitFor({ timeout: 10000 })
  if ((await page.getByText("Nilai kelulusan").count()) > 0) throw new Error("assessment intro showed a pass mark")
})

await page.getByRole("button", { name: "Mulai Asesmen" }).click()
// An assessment runs one item at a time through the questionnaire
// primitive, so the counter tracks position rather than answered count.
const actions = page.locator('[data-slot="questionnaire-actions"]')
await expect("the run opens on the first item with no way back", async () => {
  await page.getByText("1/3").waitFor({ timeout: 10000 })
  await page.getByText(QUESTIONS[0].text).waitFor({ timeout: 5000 })
  if (await actions.getByRole("button", { name: "Sebelumnya" }).isVisible()) {
    throw new Error("the first item offered a Previous button")
  }
})

for (const [i, q] of QUESTIONS.entries()) {
  await page.getByText(`${i + 1}/3`).waitFor({ timeout: 10000 })
  await page.locator('[data-slot="questionnaire-choice"]').filter({ hasText: q.options[0] }).nth(i).click()
  if (i < QUESTIONS.length - 1) await actions.getByRole("button", { name: "Berikutnya" }).click()
}

await expect("the last item swaps Next for Submit", async () => {
  await page.getByText("3/3").waitFor({ timeout: 5000 })
  await actions.getByRole("button", { name: "Kirim Jawaban" }).waitFor({ timeout: 5000 })
  if (await actions.getByRole("button", { name: "Berikutnya" }).isVisible()) {
    throw new Error("the last item still offered a Next button")
  }
})

await actions.getByRole("button", { name: "Kirim Jawaban" }).click()
await expect("submitting renders the Holland report", async () => {
  await page.getByText("Hasil Asesmen").waitFor({ timeout: 15000 })
})
await expect("the report names each RIASEC category it scored", async () => {
  for (const code of ["R — Realistic", "I — Investigative", "S — Social"]) {
    await page.getByText(code).first().waitFor({ timeout: 5000 })
  }
})
await expect("no vacuous pass/fail verdict over an assessment", async () => {
  const verdicts = await page.getByText(/^(Lulus|Belum Lulus)$/).count()
  if (verdicts > 0) throw new Error(`assessment result showed a ${verdicts}x pass/fail badge`)
})

await browser.close()
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
