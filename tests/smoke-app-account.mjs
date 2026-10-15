/**
 * Manual smoke script verifying apps/app's learner account surface (run
 * against live dev servers; not part of CI):
 *   pnpm --filter api dev          # CORS_ORIGIN=http://localhost:3030
 *   pnpm --filter app dev
 *   node tests/smoke-app-account.mjs
 * Covers my-learning: the learner enrolls in a seeded free course and
 * the dashboard lists it with a Lanjutkan Belajar entry. (The
 * self-service institution request journey was removed with the
 * single-tenant frontend — PLANS Phase 5; institutions are admin-granted
 * and covered by the workspaces/institution suites.)
 */
import { chromium } from "playwright"

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3030"
const API = process.env.SMOKE_API_URL ?? "http://localhost:8000"
const ADMIN = { email: "admin@lms.dev", password: "correcthorsebatterystaple" }
const LEARNER = { email: "user@lms.dev", password: "correcthorsebatterystaple" }
const STAMP = Date.now()
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
    courseType: "offline",
    isDisabilityFriendly: false,
    supportedDisabilityTypes: [],
  },
})
const courseId = (await courseRes.json()).data.id
await page.request.post(`${API}/v1/courses/${courseId}/publish`)

// ================= LEARNER: my-learning + request flow =================
await page.getByRole("button", { name: "Menu Akun" }).click()
await page.getByRole("menuitem", { name: "Keluar" }).click()
await page.waitForURL((url) => url.pathname === "/" || url.pathname === "", { timeout: 8000 })
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
await browser.close()

if (failures > 0) {
  console.error(`\n${failures} FAILURE(S)`)
  process.exit(1)
}
console.log("\nALL PASS")
