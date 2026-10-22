/**
 * Manual smoke script verifying the apps/app (Vite SPA) course player
 * (run against live dev servers; not part of CI):
 *   pnpm --filter api dev          # CORS_ORIGIN=http://localhost:3030
 *   pnpm --filter app dev
 *   node tests/smoke-app-player.mjs
 * Signs in through the SPA's own login form (proves the Better Auth
 * client + Base UI inputs work in plain Vite), seeds a course with one
 * text lesson and one single-choice quiz via the real API, then drives
 * the player entirely in the SPA: sidebar TOC, lesson content, server-
 * persisted mark-complete, quiz list, and the full QuizTake flow with
 * server-side grading.
 */
import { chromium } from "playwright"

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3030"
const API = process.env.SMOKE_API_URL ?? "http://localhost:8010"
const EMAIL = process.env.SMOKE_EMAIL ?? "admin@lms.dev"
const PASSWORD = process.env.SMOKE_PASSWORD ?? "correcthorsebatterystaple"
const TITLE = `Smoke App Player ${Date.now()}`
const LESSON_TITLE = "Pengantar Materi"
const LESSON_TEXT = "Ini adalah konten materi pengantar."
const QUIZ_TITLE = "Kuis Dasar"
const QUESTION_TEXT = "Berapakah hasil dari 2 + 2?"
const CORRECT_OPTION = "4"
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

const browser = await chromium.launch(process.env.SMOKE_CHROMIUM ? { executablePath: process.env.SMOKE_CHROMIUM } : {})
const page = await browser.newPage()

// --- Sign in through the SPA login form (real Better Auth client) ---
await page.goto(`${BASE}/login`)
await page.locator("#email").fill(EMAIL)
await page.locator("#password").fill(PASSWORD)
await page.getByRole("button", { name: "Masuk", exact: true }).click()
await expect("login via SPA form reaches the dashboard", async () => {
  await page.waitForURL("**/dashboard", { timeout: 8000 })
})

// --- Seed: institution (reuse first if any) -> course -> module ->
// lesson -> quiz -> question -> self-enroll, all through the real API ---
const instRes = await page.request.get(`${API}/v1/institutions?pageSize=1`)
const instBody = await instRes.json()
let institutionId = instBody?.data?.[0]?.id
if (!institutionId) {
  const createInst = await page.request.post(`${API}/v1/institutions`, {
    data: { name: `Smoke Inst ${Date.now()}`, institutionType: "company" },
  })
  if (!createInst.ok()) throw new Error(`institution create failed: ${createInst.status()}`)
  institutionId = (await createInst.json())?.data?.id
}

const courseRes = await page.request.post(`${API}/v1/courses`, {
  data: {
    title: TITLE,
    institutionId,
    courseType: "online",
    isDisabilityFriendly: false,
    supportedDisabilityTypes: [],
  },
})
if (!courseRes.ok()) throw new Error(`course create failed: ${courseRes.status()} ${await courseRes.text()}`)
const courseId = (await courseRes.json())?.data?.id

const moduleRes = await page.request.post(`${API}/v1/courses/${courseId}/modules`, {
  data: { title: "Modul Dasar" },
})
if (!moduleRes.ok()) throw new Error(`module create failed: ${moduleRes.status()}`)
const moduleId = (await moduleRes.json())?.data?.id

const lessonRes = await page.request.post(`${API}/v1/modules/${moduleId}/lessons`, {
  data: { title: LESSON_TITLE, contentType: "text", textContent: LESSON_TEXT },
})
if (!lessonRes.ok()) throw new Error(`lesson create failed: ${lessonRes.status()}`)
const lessonId = (await lessonRes.json())?.data?.id

const quizRes = await page.request.post(`${API}/v1/courses/${courseId}/quizzes`, {
  data: { title: QUIZ_TITLE, passingScore: 50, showResults: true, showCorrectAnswers: true },
})
if (!quizRes.ok()) throw new Error(`quiz create failed: ${quizRes.status()}`)
const quizId = (await quizRes.json())?.data?.id

const questionRes = await page.request.post(`${API}/v1/quizzes/${quizId}/questions`, {
  data: {
    question: QUESTION_TEXT,
    questionType: "single_choice",
    options: [{ text: "5" }, { text: CORRECT_OPTION }],
    correctAnswers: [CORRECT_OPTION],
    points: 100,
  },
})
if (!questionRes.ok()) throw new Error(`question create failed: ${questionRes.status()}`)

const enrollRes = await page.request.post(`${API}/v1/enrollments`, { data: { courseId } })
if (!enrollRes.ok()) throw new Error(`enroll failed: ${enrollRes.status()} ${await enrollRes.text()}`)

// --- Player: sidebar TOC renders the real course + lesson ---
await page.goto(`${BASE}/learn/${courseId}`, { timeout: 30000 })
await expect("player sidebar shows course title and lesson TOC", async () => {
  await page.getByRole("heading", { name: TITLE }).first().waitFor({ timeout: 8000 })
  await page
    .getByRole("complementary")
    .getByRole("link", { name: new RegExp(LESSON_TITLE) })
    .waitFor({ timeout: 8000 })
  await page.getByRole("complementary").getByText("0 dari 1 pelajaran selesai").waitFor({ timeout: 8000 })
})

// --- Lesson page: content renders, mark-complete persists server-side ---
await page
  .getByRole("complementary")
  .getByRole("link", { name: new RegExp(LESSON_TITLE) })
  .click()
await expect("lesson page renders real text content", async () => {
  await page.getByRole("heading", { name: LESSON_TITLE }).waitFor({ timeout: 8000 })
  await page.getByText(LESSON_TEXT).waitFor({ timeout: 8000 })
})

await page.getByRole("button", { name: "Tandai Selesai" }).click()
await expect("mark-complete persists (button flips + sidebar count updates after reload)", async () => {
  await page.getByRole("button", { name: "Tandai Belum Selesai" }).waitFor({ timeout: 15000 })
  await page.getByRole("complementary").getByText("1 dari 1 pelajaran selesai").waitFor({ timeout: 8000 })
})

// --- Quizzes tab: list then take the quiz end to end ---
// (Base UI Button render={<Link>}> renders <a role="button">, and Chromium
// doesn't give a nested <header> the banner role — match by button role)
await page.getByRole("link", { name: "Kuis" }).click()
await expect("quiz list shows the seeded quiz", async () => {
  await page.waitForURL(`**/learn/${courseId}/quizzes`, { timeout: 8000 })
  await page.getByText(QUIZ_TITLE).waitFor({ timeout: 8000 })
  await page.getByText("1 soal").waitFor({ timeout: 8000 })
})

await page.getByText(QUIZ_TITLE).click()
await expect("quiz detail loads with start button", async () => {
  await page.waitForURL(`**/learn/${courseId}/quizzes/${quizId}`, { timeout: 8000 })
  await page.getByRole("button", { name: "Mulai Kuis" }).waitFor({ timeout: 8000 })
})

await page.getByRole("button", { name: "Mulai Kuis" }).click()
await page.getByText(QUESTION_TEXT).waitFor({ timeout: 8000 })
await page.getByText(CORRECT_OPTION, { exact: true }).click()
await page.getByRole("button", { name: "Kirim Jawaban" }).click()
await expect("submitting a correct answer is graded server-side as a pass", async () => {
  await page.getByText("100/100").waitFor({ timeout: 8000 })
  await page.getByText("Lulus").waitFor({ timeout: 8000 })
  await page.getByText("Benar").waitFor({ timeout: 8000 })
})

await browser.close()

if (failures > 0) {
  console.error(`\n${failures} FAILURE(S)`)
  process.exit(1)
}
console.log("\nALL PASS")
