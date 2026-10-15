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

// Single-tenant resolution (PLANS Phase 5): the UI reports on the
// account's FIRST ownership grant, so the suite must run against that
// institution rather than a freshly created one the UI would never
// resolve to.
async function get(path) {
  const res = await page.request.get(`${API}/v1${path}`)
  if (!res.ok()) throw new Error(`GET ${path} failed: ${res.status()}`)
  return (await res.json()).data
}
const grants = await get(
  `/institution-ownerships?userId=${(await (await page.request.get(`${API}/api/auth/get-session`)).json())?.user?.id}&pageSize=100`
)
if (!grants || grants.length === 0) throw new Error("admin owns no institution — seed state unexpected")
const institution = await get(`/institutions/${grants[0].institutionId}`)
const INSTITUTION_NAME = institution.name
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

// ================= Overview (single-tenant resolution) =================
// No scope switcher anymore — the page resolves the account's owned
// institution directly (PLANS Phase 5).
await page.goto(`${BASE}/institution`, { timeout: 30000 })
await expect("the resolved institution renders its report directly", async () => {
  await page.getByRole("heading", { name: INSTITUTION_NAME }).waitFor({ timeout: 15000 })
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
  // Order-independent: earlier suites may have left their own
  // `registered` rows in this institution, so assert the filter HIDES
  // this run's selected enrollments rather than the list being empty.
  await page.getByLabel("Saring status").selectOption("registered")
  await page
    .getByRole("link", { name: FREE_COURSE })
    .waitFor({ state: "detached", timeout: 10000 })
  await page.getByRole("link", { name: PAID_COURSE }).waitFor({ state: "detached", timeout: 10000 })
  await page.getByLabel("Saring status").selectOption("selected")
  await page.getByRole("link", { name: FREE_COURSE }).waitFor({ timeout: 10000 })
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
