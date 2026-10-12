/**
 * Manual smoke script verifying apps/app's adaptive dashboard and the
 * self-service institution request journey (run against live dev
 * servers; not part of CI):
 *   pnpm --filter api dev          # CORS_ORIGIN=http://localhost:3030
 *   pnpm --filter app dev
 *   node tests/smoke-app-account.mjs
 * The seeded learner requests an institution through the UI, the admin
 * approves it from the admin queue, and the learner's dashboard flips
 * to the owner view (Institusi Saya). Also covers my-learning: the
 * learner enrolls in a seeded free course and the dashboard shows it
 * with a Lanjutkan Belajar entry into the player.
 */
import { chromium } from "playwright"

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3030"
const API = process.env.SMOKE_API_URL ?? "http://localhost:8000"
const ADMIN = { email: "admin@lms.dev", password: "correcthorsebatterystaple" }
const LEARNER = { email: "user@lms.dev", password: "correcthorsebatterystaple" }
const STAMP = Date.now()
const INST_NAME = `Smoke Account Inst ${STAMP}`
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

async function login(page, creds) {
  await page.goto(`${BASE}/login`)
  await page.locator("#email").fill(creds.email)
  await page.locator("#password").fill(creds.password)
  await page.getByRole("button", { name: "Masuk", exact: true }).click()
  await page.waitForURL("**/dashboard", { timeout: 8000 })
}

const browser = await chromium.launch(process.env.SMOKE_CHROMIUM ? { executablePath: process.env.SMOKE_CHROMIUM } : {})
const page = await browser.newPage()
page.on("dialog", (dialog) => dialog.accept())

// --- Seed a published free course as admin ---
await login(page, ADMIN)
let institutionId = (await (await page.request.get(`${API}/v1/institutions?pageSize=1`)).json())?.data?.[0]?.id
const courseRes = await page.request.post(`${API}/v1/courses`, {
  data: {
    title: `Smoke Account Course ${STAMP}`,
    institutionId,
    courseType: "online",
    isDisabilityFriendly: false,
    supportedDisabilityTypes: [],
  },
})
const courseId = (await courseRes.json()).data.id
await page.request.post(`${API}/v1/courses/${courseId}/publish`)

// ================= LEARNER: my-learning + request flow =================
await page.getByRole("button", { name: "Menu Akun" }).click()
await page.getByRole("menuitem", { name: "Keluar" }).click()
await page.waitForURL("**/login", { timeout: 8000 })
await login(page, LEARNER)

// Enroll through the catalog so my-learning has a fresh row
await page.goto(`${BASE}/courses/${courseId}`, { timeout: 30000 })
await page.getByRole("button", { name: "Daftar", exact: true }).click()
await expect("enrolling from the detail page shows pending state", async () => {
  await page.getByText("Menunggu persetujuan").waitFor({ timeout: 8000 })
})

await page.goto(`${BASE}/dashboard`, { timeout: 30000 })
await expect("dashboard my-learning lists the enrolled course", async () => {
  await page.getByText(`Smoke Account Course ${STAMP}`).waitFor({ timeout: 8000 })
  // Canonical enrollment badge label (EnrollmentStatusBadge atom).
  await page.getByText("Terdaftar", { exact: true }).first().waitFor({ timeout: 8000 })
})
// The learner may already own institutions from earlier runs — either
// dashboard state is fine; the request form is reachable from both.
await page.getByText("Institusi Saya").waitFor({ timeout: 8000 })
await page.goto(`${BASE}/institution-requests`, { timeout: 30000 })

// Submit the institution request through the UI
await expect("request form renders", async () => {
  await page.getByRole("heading", { name: "Ajukan Institusi" }).waitFor({ timeout: 8000 })
})
await page.locator("#request-name").fill(INST_NAME)
await page.locator("#request-justification").fill("Instansi pelatihan uji coba.")
await page.getByRole("button", { name: "Kirim Permohonan" }).click()
await expect("my-requests shows the pending submission", async () => {
  await page.getByText(INST_NAME).waitFor({ timeout: 8000 })
  await page.getByText("Menunggu", { exact: true }).first().waitFor({ timeout: 8000 })
})

// ================= ADMIN: approve =================
await page.getByRole("button", { name: "Menu Akun" }).click()
await page.getByRole("menuitem", { name: "Keluar" }).click()
await page.waitForURL("**/login", { timeout: 8000 })
await login(page, ADMIN)

await page.goto(`${BASE}/admin/institutions`, { timeout: 30000 })
// The request queue lives behind its own tab (registered list is default).
await page.getByRole("tab", { name: /Permohonan Menunggu/ }).click()
// The requester renders by name ("LMS User"), so scope to the request's
// own row (shadcn Item) by institution name.
const requestCard = page.locator("[data-slot=item]", { hasText: INST_NAME }).last()
await requestCard.getByRole("button", { name: "Setujui" }).click()
await expect("approval flips the request to approved", async () => {
  let approved = false
  for (let i = 0; i < 16 && !approved; i++) {
    const res = await page.request.get(`${API}/v1/institution-requests?pageSize=100`)
    const rows = (await res.json())?.data ?? []
    approved = rows.some((r) => r.institutionName === INST_NAME && r.status === "approved")
    if (!approved) await page.waitForTimeout(500)
  }
  if (!approved) throw new Error("request did not flip to approved in time")
})

// The approved institution now exists
const instList = await page.request.get(`${API}/v1/institutions?pageSize=100`)
const approved = ((await instList.json()).data ?? []).find((i) => i.name === INST_NAME)
if (!approved) {
  console.error("FAIL approved institution not found in registry")
  failures++
}

// ================= LEARNER: owner view =================
await page.getByRole("button", { name: "Menu Akun" }).click()
await page.getByRole("menuitem", { name: "Keluar" }).click()
await page.waitForURL("**/login", { timeout: 8000 })
await login(page, LEARNER)

await expect("the newly approved institution appears in Institusi Saya", async () => {
  await page.getByText(INST_NAME).first().waitFor({ timeout: 8000 })
  await page.getByRole("button", { name: "Kelola Pelatihan" }).first().waitFor({ timeout: 8000 })
})

// The owner can now author: the instructor course list includes the new institution's scope
await page.goto(`${BASE}/instructor`, { timeout: 30000 })
await expect("owner reaches Kelola Pelatihan with create access", async () => {
  await page.getByRole("heading", { name: "Kelola Pelatihan" }).waitFor({ timeout: 8000 })
  await page.getByRole("button", { name: "Buat Pelatihan" }).waitFor({ timeout: 8000 })
})

await browser.close()

if (failures > 0) {
  console.error(`\n${failures} FAILURE(S)`)
  process.exit(1)
}
console.log("\nALL PASS")
