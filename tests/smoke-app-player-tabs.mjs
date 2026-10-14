/**
 * Manual smoke script verifying the apps/app (Vite SPA) player's three
 * remaining tabs (run against live dev servers; not part of CI):
 *   pnpm --filter api dev          # CORS_ORIGIN=http://localhost:3030
 *   pnpm --filter app dev
 *   node tests/smoke-app-player-tabs.mjs
 * Signs in as the seeded admin, seeds a course + assignment via the
 * real API, then drives everything through the SPA: assignment submit
 * (text + a real file upload) and grade-view with the graded-
 * resubmission block.
 */
import { chromium } from "playwright"

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3030"
const API = process.env.SMOKE_API_URL ?? "http://localhost:8000"
const EMAIL = process.env.SMOKE_EMAIL ?? "admin@lms.dev"
const PASSWORD = process.env.SMOKE_PASSWORD ?? "correcthorsebatterystaple"
const TITLE = `Smoke App Tabs ${Date.now()}`
const ASSIGNMENT_TITLE = "Tugas Esai Pembuka"
const ASSIGNMENT_ANSWER = "Ini jawaban saya untuk tugas ini."
const ATTACHMENT_NAME = "smoke-answer.pdf"
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

// --- Sign in through the SPA login form ---
await page.goto(`${BASE}/login`)
await page.locator("#email").fill(EMAIL)
await page.locator("#password").fill(PASSWORD)
await page.getByRole("button", { name: "Masuk", exact: true }).click()
await expect("login reaches the dashboard", async () => {
  await page.waitForURL("**/dashboard", { timeout: 8000 })
})

// --- Seed: institution -> course -> assignment + attendance session ---
const instRes = await page.request.get(`${API}/v1/institutions?pageSize=1`)
const instBody = await instRes.json()
let institutionId = instBody?.data?.[0]?.id
if (!institutionId) {
  const createInst = await page.request.post(`${API}/v1/institutions`, {
    data: { name: `Smoke Inst ${Date.now()}`, institutionType: "company" },
  })
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

const assignmentRes = await page.request.post(`${API}/v1/courses/${courseId}/assignments`, {
  data: {
    title: ASSIGNMENT_TITLE,
    instructions: "Jelaskan pemahaman Anda tentang materi pembuka.",
    maxScore: 100,
    // The server re-sniffs magic bytes and never trusts the client's
    // declared type, so only types it can detect from content (PDF,
    // images, OOXML) can pass this check — text/plain always lands as
    // application/octet-stream and would be rejected.
    allowedFileTypes: ["application/pdf"],
    maxFileSize: 1024 * 1024,
    maxFiles: 3,
  },
})
if (!assignmentRes.ok())
  throw new Error(`assignment create failed: ${assignmentRes.status()} ${await assignmentRes.text()}`)
const assignmentId = (await assignmentRes.json())?.data?.id

// ================= ASSIGNMENTS =================
await page.goto(`${BASE}/learn/${courseId}/assignments`, { timeout: 30000 })
await expect("assignment list shows the seeded assignment", async () => {
  await page.getByText(ASSIGNMENT_TITLE).waitFor({ timeout: 8000 })
})

await page.getByText(ASSIGNMENT_TITLE).click()
await expect("assignment detail shows instructions", async () => {
  await page.waitForURL(`**/learn/${courseId}/assignments/${assignmentId}`, { timeout: 8000 })
  await page.getByText("Jelaskan pemahaman Anda tentang materi pembuka.").waitFor({ timeout: 8000 })
})

// Real file upload through the widget's hidden input — a real PDF (magic
// bytes), so the server's content-sniffing type check passes it.
await page.setInputFiles('input[type="file"]', {
  name: ATTACHMENT_NAME,
  mimeType: "application/pdf",
  buffer: Buffer.from(
    "%PDF-1.4\n%smoke test attachment\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF"
  ),
})
await expect("file uploads and lands in the attachment list", async () => {
  await page.getByRole("button", { name: `Hapus ${ATTACHMENT_NAME}` }).waitFor({ timeout: 15000 })
})

await page.locator("#content").fill(ASSIGNMENT_ANSWER)
await page.getByRole("button", { name: "Kirim Tugas" }).click()
await expect("submitting shows the submission card with answer + attachment", async () => {
  await page.getByText("Pengumpulan Anda").waitFor({ timeout: 8000 })
  // The answer also stays in the resubmit form's textarea after
  // invalidation, so don't demand uniqueness here.
  await page.getByText(ASSIGNMENT_ANSWER).first().waitFor({ timeout: 8000 })
  await page.getByRole("link", { name: ATTACHMENT_NAME }).waitFor({ timeout: 8000 })
})

// Grade server-side as admin, then confirm the SPA reflects it and blocks resubmission
const submissionsRes = await page.request.get(`${API}/v1/assignments/${assignmentId}/submissions?pageSize=10`)
const submissionsBody = await submissionsRes.json()
const submissionId = submissionsBody?.data?.[0]?.id
if (!submissionId) throw new Error("submission not found via GET /assignments/{id}/submissions")
const gradeRes = await page.request.post(`${API}/v1/assignment-submissions/${submissionId}/grade`, {
  data: { score: 85, feedback: "Jawaban bagus, lanjutkan." },
})
if (!gradeRes.ok()) throw new Error(`grade failed: ${gradeRes.status()}`)

await page.reload()
await expect("graded submission shows score + feedback and blocks resubmission", async () => {
  // one combined assertion — bare "85" substring-collides with other
  // numbers on the page in some states
  await page.getByText("Nilai: 85").first().waitFor({ timeout: 8000 })
  await page.getByText("Jawaban bagus, lanjutkan.").waitFor({ timeout: 8000 })
  await page.getByText(/sudah dinilai/i).waitFor({ timeout: 8000 })
})

await browser.close()

if (failures > 0) {
  console.error(`\n${failures} FAILURE(S)`)
  process.exit(1)
}
console.log("\nALL PASS")
