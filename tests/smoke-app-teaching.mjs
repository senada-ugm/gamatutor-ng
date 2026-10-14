/**
 * Manual smoke script verifying the apps/app (Vite SPA) teaching tools
 * (run against live dev servers; not part of CI):
 *   pnpm --filter api dev          # CORS_ORIGIN=http://localhost:3030
 *   pnpm --filter app dev
 *   node tests/smoke-app-teaching.mjs
 * Signs in as the seeded admin and drives the editor's Kuis, Penilaian,
 * and Presensi tabs end to end: builds a quiz through the UI and takes
 * it in the player (server-graded pass), creates an assignment and
 * grades a submission through the UI, and activates an attendance
 * session through the UI then checks in from the player with the code
 * the UI displayed — proving the whole instructor/student loop.
 */
import { chromium } from "playwright"

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3030"
const API = process.env.SMOKE_API_URL ?? "http://localhost:8000"
const EMAIL = process.env.SMOKE_EMAIL ?? "admin@lms.dev"
const PASSWORD = process.env.SMOKE_PASSWORD ?? "correcthorsebatterystaple"
const TITLE = `Smoke Teaching ${Date.now()}`
const QUIZ_TITLE = "Kuis Akhir Modul"
const QUESTION_TEXT = "Ibukota Indonesia adalah?"
const CORRECT_OPTION = "Jakarta"
const WRONG_OPTION = "Bandung"
const ASSIGNMENT_TITLE = "Tugas Refleksi"
const ASSIGNMENT_ANSWER = "Refleksi saya tentang materi ini."
const SESSION_TITLE = "Pertemuan Sinkron"
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

await page.goto(`${BASE}/login`)
await page.locator("#email").fill(EMAIL)
await page.locator("#password").fill(PASSWORD)
await page.getByRole("button", { name: "Masuk", exact: true }).click()
await expect("login reaches the dashboard", async () => {
  await page.waitForURL("**/dashboard", { timeout: 8000 })
})

// --- Seed: institution -> course -> self-enroll (then select, so the
// attendance roster includes us) ---
let institutionId = (await (await page.request.get(`${API}/v1/institutions?pageSize=1`)).json())?.data?.[0]?.id
const courseRes = await page.request.post(`${API}/v1/courses`, {
  data: {
    title: TITLE,
    institutionId,
    courseType: "online",
    isDisabilityFriendly: false,
    supportedDisabilityTypes: [],
  },
})
if (!courseRes.ok()) throw new Error(`course create failed: ${courseRes.status()}`)
const courseId = (await courseRes.json()).data.id

const enrollRes = await page.request.post(`${API}/v1/enrollments`, { data: { courseId } })
const enrollmentId = (await enrollRes.json()).data.id
const selectRes = await page.request.patch(`${API}/v1/enrollments/${enrollmentId}`, { data: { status: "selected" } })
if (!selectRes.ok()) throw new Error(`select failed: ${selectRes.status()} ${await selectRes.text()}`)

// ================= KUIS: build through the UI =================
await page.goto(`${BASE}/instructor/courses/${courseId}/editor/kuis`, { timeout: 30000 })
await page.getByRole("button", { name: "Kuis Baru" }).click()
await page.locator("#quiz-title").fill(QUIZ_TITLE)
await page.getByRole("button", { name: "Buat Kuis", exact: true }).click()
await expect("quiz creation opens the builder", async () => {
  await page.getByText("Pertanyaan (0)").waitFor({ timeout: 8000 })
})

await page.getByRole("button", { name: "Tambah Pertanyaan" }).click()
await page.locator("#question-text").fill(QUESTION_TEXT)
await page.getByPlaceholder("Opsi A").fill(WRONG_OPTION)
await page.getByPlaceholder("Opsi B").fill(CORRECT_OPTION)
await page.locator("#question-points").fill("100")
// check the correct option: the checkbox immediately preceding the
// "Jakarta" option input
await page.getByPlaceholder("Opsi B").locator("xpath=preceding-sibling::span[1]").check()
await page.getByRole("button", { name: "Simpan Pertanyaan" }).click()
await expect("question persists with the correct option marked", async () => {
  await page.getByText(QUESTION_TEXT).waitFor({ timeout: 8000 })
  await page.getByText(CORRECT_OPTION, { exact: true }).first().waitFor({ timeout: 8000 })
  // The correct option carries a check icon (aria-label), not a text glyph.
  await page.getByLabel("Jawaban benar").waitFor({ timeout: 8000 })
})

// --- Take the built quiz in the player; grading is server-side ---
await page.goto(`${BASE}/learn/${courseId}/quizzes`, { timeout: 30000 })
await expect("player quiz list shows the built quiz", async () => {
  await page.getByText(QUIZ_TITLE).waitFor({ timeout: 8000 })
})
await page.getByText(QUIZ_TITLE).click()
await page.getByRole("button", { name: "Mulai Kuis" }).click()
await page.getByText(QUESTION_TEXT).waitFor({ timeout: 8000 })
await page.getByText(CORRECT_OPTION, { exact: true }).click()
await page.getByRole("button", { name: "Kirim Jawaban" }).click()
await expect("quiz built in the editor grades as a pass in the player", async () => {
  await page.getByText("100/100").waitFor({ timeout: 8000 })
  await page.getByText("Lulus", { exact: true }).waitFor({ timeout: 8000 })
})

// ================= PENILAIAN: create + grade through the UI =================
await page.goto(`${BASE}/instructor/courses/${courseId}/editor/penilaian`, { timeout: 30000 })
await page.getByRole("button", { name: "Tugas Baru" }).click()
await page.locator("#assignment-title").fill(ASSIGNMENT_TITLE)
await page.locator("#assignment-instructions").fill("Tuliskan refleksi singkat.")
await page.getByRole("button", { name: "Buat Tugas", exact: true }).click()
await expect("assignment creation persists in the list", async () => {
  await page.getByText(ASSIGNMENT_TITLE).waitFor({ timeout: 8000 })
})

// Submit through the API as the enrolled admin (the student submit flow
// is already covered by smoke-app-player-tabs), then grade in the UI.
const listRes = await page.request.get(`${API}/v1/courses/${courseId}/assignments?pageSize=50`)
const assignmentId = (await listRes.json()).data.find((a) => a.title === ASSIGNMENT_TITLE)?.id
if (!assignmentId) throw new Error("assignment id not found")
const submitRes = await page.request.post(`${API}/v1/assignments/${assignmentId}/submissions`, {
  data: { content: ASSIGNMENT_ANSWER },
})
if (!submitRes.ok()) throw new Error(`submission failed: ${submitRes.status()}`)

await page.reload()
// exact: the editor's "Penilaian" tab also contains "nilai" as a substring
await page.getByRole("button", { name: "Nilai", exact: true }).click()
await expect("grading queue shows the submission as Dikumpulkan", async () => {
  // "Dikumpulkan" also prefixes the submitted-at line — badge is exact
  await page.getByText("Dikumpulkan", { exact: true }).waitFor({ timeout: 8000 })
})

await page.getByRole("button", { name: "Periksa" }).click()
await expect("expanding reveals the submission content", async () => {
  await page.getByText(ASSIGNMENT_ANSWER).waitFor({ timeout: 8000 })
})
await page.locator("#grade-feedback").fill("Refleksi yang baik.")
await page.locator(`#score-100`).fill("90")
await page.getByRole("button", { name: "Simpan Nilai" }).click()
await expect("grading saves the score and flips the badge to Dinilai", async () => {
  await page.getByText("Dinilai", { exact: true }).waitFor({ timeout: 8000 })
  await page.getByText("90/100").waitFor({ timeout: 8000 })
})

// ================= PRESENSI: create + activate + check-in loop =================
await page.goto(`${BASE}/instructor/courses/${courseId}/editor/presensi`, { timeout: 30000 })
await page.getByRole("button", { name: "Sesi Baru" }).click()
await page.locator("#session-title").fill(SESSION_TITLE)
const now = new Date()
const pad = (n) => String(n).padStart(2, "0")
await page
  .locator("#session-date")
  .fill(
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
  )
await page.getByRole("button", { name: "Buat Sesi", exact: true }).click()
await expect("session creation persists as Menunggu", async () => {
  await page.getByText(SESSION_TITLE).waitFor({ timeout: 8000 })
  await page.getByText("Menunggu", { exact: true }).waitFor({ timeout: 8000 })
})

await page.getByRole("button", { name: "Kelola", exact: true }).click()
await page.locator("#activate-method").selectOption("code")
await page.getByRole("button", { name: "Aktifkan Sesi" }).click()
await expect("activation displays the live check-in code", async () => {
  await page.getByText("Kode check-in saat ini").waitFor({ timeout: 8000 })
})
const code = await page.locator("p.font-mono").first().textContent()
if (!code || !/^\d{6}$/.test(code.trim())) throw new Error(`unexpected code rendered: ${code}`)

// Roster shows us (selected enrollment) as not yet checked in
await expect("roster lists the selected participant", async () => {
  await page.getByText("Belum check-in").waitFor({ timeout: 8000 })
})

// --- Check in from the player with the code the UI displayed ---
await page.goto(`${BASE}/learn/${courseId}/attendance`, { timeout: 30000 })
await page.getByPlaceholder("Masukkan 6-digit kode").fill(code.trim())
await page.getByRole("button", { name: "Check-In", exact: true }).click()
await expect("player check-in with the instructor-displayed code succeeds", async () => {
  await page.getByText(/Anda sudah tercatat hadir/i).waitFor({ timeout: 8000 })
})

// --- Roster reflects it ---
await page.goto(`${BASE}/instructor/courses/${courseId}/editor/presensi`, { timeout: 30000 })
await page.getByRole("button", { name: "Kelola", exact: true }).click()
await expect("roster shows the check-in record", async () => {
  await page.getByText("Hadir", { exact: true }).first().waitFor({ timeout: 8000 })
})

// ================= ESSAY GRADING QUEUE (Kuis tab) =================
// A quiz with an essay question: the learner (admin self, enrolled)
// submits via API, then the instructor grades it through the new UI.
await page.goto(`${BASE}/instructor/courses/${courseId}/editor/kuis`, { timeout: 30000 })
await page.getByRole("button", { name: "Kuis Baru" }).click()
await page.locator("#quiz-title").fill("Kuis Esai Refleksi")
await page.getByRole("button", { name: "Buat Kuis", exact: true }).click()
await page.getByText("Pertanyaan (0)").waitFor({ timeout: 8000 })
// the builder is internal state (no URL change) — resolve the id via the API
const essayQuizId = (
  await (await page.request.get(`${API}/v1/courses/${courseId}/quizzes?pageSize=50`)).json()
).data.find((q) => q.title === "Kuis Esai Refleksi")?.id
if (!essayQuizId) throw new Error("essay quiz not found via API")

await page.getByRole("button", { name: "Tambah Pertanyaan" }).click()
await page.locator("#question-text").fill("Tuliskan refleksi Anda tentang pelatihan ini.")
await page.locator("#question-type").selectOption("essay")
await page.locator("#question-points").fill("10")
await page.getByRole("button", { name: "Simpan Pertanyaan" }).click()
await expect("essay question persists in the builder", async () => {
  await page.getByText("Tuliskan refleksi Anda tentang pelatihan ini.").waitFor({ timeout: 8000 })
})

// learner submits an essay attempt via the API (admin session = enrolled manager)
const essayStart = await page.request.post(`${API}/v1/quizzes/${essayQuizId}/attempts`)
if (!essayStart.ok()) throw new Error(`essay attempt start failed: ${essayStart.status()}`)
const essayAttemptId = (await essayStart.json()).data.id
const essayQuestionId = (await (await page.request.get(`${API}/v1/quizzes/${essayQuizId}`)).json()).data.questions[0].id
const essaySubmit = await page.request.post(`${API}/v1/quiz-attempts/${essayAttemptId}/submit`, {
  data: { answers: { [essayQuestionId]: ["Pelatihan ini sangat membantu."] } },
})
if (!essaySubmit.ok()) throw new Error(`essay submit failed: ${essaySubmit.status()}`)

await page.getByRole("button", { name: "Periksa Percobaan" }).click()
await expect("grading queue lists the pending essay attempt", async () => {
  await page.getByText("Menunggu Penilaian", { exact: true }).waitFor({ timeout: 8000 })
})

await page.getByRole("button", { name: "Nilai", exact: true }).click()
await expect("expanding shows the learner's essay answer", async () => {
  await page.getByText("Pelatihan ini sangat membantu.").waitFor({ timeout: 8000 })
})
await page.locator(`#essay-score-${essayQuestionId}`).fill("8")
await page.getByRole("button", { name: "Simpan Nilai", exact: true }).click()
await expect("grading the essay flips the attempt to Dinilai with the score", async () => {
  await page.getByText("Dinilai", { exact: true }).waitFor({ timeout: 8000 })
  await page.getByText("8/10").waitFor({ timeout: 8000 })
})

await browser.close()

if (failures > 0) {
  console.error(`\n${failures} FAILURE(S)`)
  process.exit(1)
}
console.log("\nALL PASS")
