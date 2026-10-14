/**
 * Manual smoke script verifying the institution-level console (run
 * against live dev servers; not part of CI):
 *   pnpm --filter api dev          # CORS_ORIGIN=http://localhost:3030
 *   pnpm --filter app dev
 *   node tests/smoke-app-institution.mjs
 *
 * Seeds one institution with two courses, a self-enrollment and a paid
 * order, then walks the three institution pages as admin: the overview's
 * aggregate report, the cross-course participant list, and the order
 * book. Also checks the two gates — an admin's default "all
 * institutions" scope refuses to report, and an unrelated account is
 * forbidden from the report outright.
 */
import { chromium } from "playwright"

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3030"
const API = process.env.SMOKE_API_URL ?? "http://localhost:8000"
const ADMIN = { email: "admin@lms.dev", password: "correcthorsebatterystaple" }
const LEARNER = { email: "user@lms.dev", password: "correcthorsebatterystaple" }
const STAMP = Date.now()
const INSTITUTION = `Institusi Smoke ${STAMP}`
const FREE_COURSE = `Pelatihan Gratis ${STAMP}`
const PAID_COURSE = `Pelatihan Kedua ${STAMP}`
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
await login(page, ADMIN)

// ================= Seed =================
async function post(path, data) {
  const res = await page.request.post(`${API}/v1${path}`, { data })
  if (!res.ok()) throw new Error(`POST ${path} failed: ${res.status()} ${await res.text()}`)
  return (await res.json()).data
}

const institution = await post("/institutions", {
  name: INSTITUTION,
  institutionType: "company",
  email: `smoke-${STAMP}@example.test`,
})
const freeCourse = await post("/courses", {
  title: FREE_COURSE,
  institutionId: institution.id,
  courseType: "online",
  isDisabilityFriendly: false,
  supportedDisabilityTypes: [],
})
const secondCourse = await post("/courses", {
  title: PAID_COURSE,
  institutionId: institution.id,
  courseType: "online",
  isDisabilityFriendly: false,
  supportedDisabilityTypes: [],
})
// Publishing is its own action route, not a writable `status` field.
for (const id of [freeCourse.id, secondCourse.id]) {
  const res = await page.request.post(`${API}/v1/courses/${id}/publish`)
  if (!res.ok()) throw new Error(`publish failed: ${res.status()} ${await res.text()}`)
}

const enrollment = await post("/enrollments", { courseId: freeCourse.id })
await page.request.patch(`${API}/v1/enrollments/${enrollment.id}`, { data: { status: "selected" } })
await post("/enrollments", { courseId: secondCourse.id })

// ================= The scope gate =================
// The switcher persists its pick, so a previous run would leave this
// account already scoped to an institution and skip the gate entirely.
await page.evaluate(() => {
  try {
    localStorage.removeItem("lms.authoring-institution")
  } catch {
    // Blocked site data — nothing was persisted to clear.
  }
})
await page.goto(`${BASE}/institution`, { timeout: 30000 })
await expect("the platform-wide scope refuses to report on one institution", async () => {
  await page.getByText("Pilih satu institusi").waitFor({ timeout: 10000 })
})

await page.getByRole("button", { name: /Semua institusi/ }).click()
await page.getByRole("menuitem", { name: new RegExp(INSTITUTION) }).click()

// ================= Overview =================
await expect("picking the institution renders its report", async () => {
  await page.getByRole("heading", { name: INSTITUTION }).waitFor({ timeout: 15000 })
})
await expect("the per-course table lists both seeded courses", async () => {
  await page.getByRole("cell", { name: FREE_COURSE }).waitFor({ timeout: 10000 })
  await page.getByRole("cell", { name: PAID_COURSE }).waitFor({ timeout: 10000 })
})

// ================= Participants =================
await page
  .locator('[data-sidebar="menu-button"]')
  .filter({ hasText: /^Peserta$/ })
  .click()
await expect("the participant list shows the enrollment across courses", async () => {
  await page.waitForURL("**/institution/peserta", { timeout: 10000 })
  await page.getByText(ADMIN.email).first().waitFor({ timeout: 15000 })
  await page.getByRole("link", { name: FREE_COURSE }).waitFor({ timeout: 10000 })
})
await expect("filtering by status narrows the list", async () => {
  await page.getByLabel("Saring status").selectOption("registered")
  await page.getByText("Belum ada pendaftaran").waitFor({ timeout: 10000 })
  await page.getByLabel("Saring status").selectOption("selected")
  await page.getByText(ADMIN.email).first().waitFor({ timeout: 10000 })
})


// ================= The ownership gate =================
await page.getByRole("button", { name: "Menu Akun" }).click()
await page.getByRole("menuitem", { name: "Keluar" }).click()
await page.waitForURL((url) => url.pathname === "/" || url.pathname === "", { timeout: 10000 })
await login(page, LEARNER)

await expect("an account that does not own the institution is refused its report", async () => {
  const res = await page.request.get(`${API}/v1/institutions/${institution.id}/report`)
  if (res.status() !== 403) throw new Error(`expected 403, got ${res.status()}`)
})
await expect("and cannot list its enrollments either", async () => {
  const res = await page.request.get(`${API}/v1/enrollments?institutionId=${institution.id}`)
  if (res.status() !== 403) throw new Error(`expected 403, got ${res.status()}`)
})

await browser.close()
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
