/**
 * Manual smoke script verifying the apps/app (Vite SPA) instructor
 * workspace (run against live dev servers; not part of CI):
 *   pnpm --filter api dev          # CORS_ORIGIN=http://localhost:3030
 *   pnpm --filter app dev
 *   node tests/smoke-app-instructor.mjs
 * Signs in as the seeded admin and drives the full authoring loop
 * through the SPA: create course -> add module + lesson (Konten tab) ->
 * edit details (Detail tab) -> self-enroll via API and run the Peserta
 * tab's workflow actions (Terima -> Luluskan) -> publish. Finishes by
 * confirming the player actually renders the authored content.
 */
import { chromium } from "playwright"

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3030"
const API = process.env.SMOKE_API_URL ?? "http://localhost:8010"
const EMAIL = process.env.SMOKE_EMAIL ?? "admin@lms.dev"
const PASSWORD = process.env.SMOKE_PASSWORD ?? "correcthorsebatterystaple"
const COURSE_TITLE = `Smoke Instructor ${Date.now()}`
const COURSE_TITLE_EDITED = `${COURSE_TITLE} (Revisi)`
const MODULE_TITLE = "Modul Pengantar"
const LESSON_TITLE = "Materi Perkenalan"
const LESSON_TEXT = "Selamat datang di pelatihan ini."
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

/** An admin's authoring scope defaults to "Semua institusi", which is a
 *  listing scope, not a place a course can be created — the create form
 *  stays gated until a real institution is picked. That gate is the
 *  point: this page used to resolve an unpicked scope to whichever
 *  institution the API returned first. */
async function selectFirstInstitution(page) {
  const trigger = page.getByRole("button", { name: /Semua institusi/ })
  // The scope resolves asynchronously, so settle first: an unresolved
  // scope renders neither the gate nor the form, and checking too early
  // reads as "no gate".
  await Promise.race([trigger.first().waitFor({ timeout: 10000 }), page.locator("#title").waitFor({ timeout: 10000 })])
  if ((await trigger.count()) === 0) return
  await trigger.first().click()
  await page.getByRole("menuitem").nth(1).click()
  await page.locator("#title").waitFor({ timeout: 8000 })
}

const browser = await chromium.launch(process.env.SMOKE_CHROMIUM ? { executablePath: process.env.SMOKE_CHROMIUM } : {})
const page = await browser.newPage()

// --- Sign in through the SPA login form ---
await page.goto(`${BASE}/login`)
await page.locator("#email").fill(EMAIL)
await page.locator("#password").fill(PASSWORD)
await page.getByRole("button", { name: "Masuk", exact: true }).click()
await expect("login reaches the dashboard with workspace shell", async () => {
  await page.waitForURL("**/dashboard", { timeout: 8000 })
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Instruktur" })
    .waitFor({ timeout: 8000 })
    .catch(() => {})
  await page.getByRole("button", { name: "Menu Akun" }).waitFor({ timeout: 8000 })
})

// --- Instructor course list -> create form ---
await page.goto(`${BASE}/instructor`, { timeout: 30000 })
await expect("instructor course list renders", async () => {
  await page.getByRole("heading", { name: "Kelola Pelatihan" }).waitFor({ timeout: 8000 })
})

await page.getByRole("button", { name: "Buat Pelatihan" }).click()
await expect("create form renders", async () => {
  await page.waitForURL("**/instructor/courses/new", { timeout: 8000 })
  await page.getByRole("heading", { name: "Buat Pelatihan" }).waitFor({ timeout: 8000 })
})

await selectFirstInstitution(page)
await page.locator("#title").fill(COURSE_TITLE)
await page.locator("#shortDescription").fill("Pelatihan uji coba alur instruktur.")
await page.locator("#participantQuota").fill("25")
await page.getByRole("button", { name: "Buat Pelatihan" }).click()
await expect("creating a course lands on the editor (Detail tab, Draf)", async () => {
  await page.waitForURL(/\/instructor\/courses\/crs_[^/]+\/editor$/, { timeout: 8000 })
  await page.getByRole("heading", { name: COURSE_TITLE, exact: true }).waitFor({ timeout: 8000 })
  await page.getByText("Draf", { exact: true }).waitFor({ timeout: 8000 })
})
const courseId = page.url().match(/\/courses\/(crs_[^/]+)\/editor/)?.[1]
if (!courseId) throw new Error("courseId not parsed from editor URL")

// --- Konten tab: module + lesson authoring ---
await page.getByRole("link", { name: "Konten" }).click()
await expect("content tab shows the empty state", async () => {
  await page.getByText("Belum ada modul").waitFor({ timeout: 8000 })
})

await page.getByRole("button", { name: "+ Tambah Modul" }).click()
await page.locator("#module-title").fill(MODULE_TITLE)
await page.getByRole("button", { name: "Tambah Modul", exact: true }).click()
await expect("module persists and appears", async () => {
  await page.getByText(MODULE_TITLE).waitFor({ timeout: 8000 })
})

await page.getByRole("button", { name: "+ Tambah Materi" }).click()
await page.locator("#lesson-title").fill(LESSON_TITLE)
await page.locator("#lesson-text").fill(LESSON_TEXT)
await page.getByRole("button", { name: "Simpan Materi" }).click()
await expect("lesson persists and appears in the module", async () => {
  await page.getByText(LESSON_TITLE).waitFor({ timeout: 8000 })
  await page.getByText("1 materi").waitFor({ timeout: 8000 })
})

// --- Detail tab: edit + save ---
await page.getByRole("link", { name: "Detail" }).click()
await page.locator("#title").fill(COURSE_TITLE_EDITED)
await page.getByRole("button", { name: "Simpan Perubahan" }).click()
await expect("editing details updates the editor header", async () => {
  await page.getByRole("heading", { name: COURSE_TITLE_EDITED, exact: true }).waitFor({ timeout: 8000 })
})

// --- Peserta tab: roster + workflow actions ---
// Self-enroll via API (admin is a course manager, bypassing the
// published/registration-window gates).
const enrollRes = await page.request.post(`${API}/v1/enrollments`, { data: { courseId } })
if (!enrollRes.ok()) throw new Error(`enroll failed: ${enrollRes.status()} ${await enrollRes.text()}`)

// Scoped to the editor's tab strip: the management sidebar carries a
// "Peserta" link of its own.
await page.getByRole("navigation").getByRole("link", { name: "Peserta" }).click()
await expect("participant roster shows the enrollee as Terdaftar", async () => {
  await page.getByText("Terdaftar").first().waitFor({ timeout: 8000 })
  await page.getByText("1 pendaftar").waitFor({ timeout: 8000 })
})

// Click the row to open the participant detail dialog
await page.locator("table tbody tr").first().click()
await page.getByRole("button", { name: "Terima" }).click()
await expect("accepting moves the enrollment to Peserta", async () => {
  await page.locator('[data-slot="dialog-content"]').getByText("Peserta", { exact: true }).waitFor({ timeout: 8000 })
})

await page.getByRole("button", { name: "Luluskan" }).click()
await expect("graduating marks the participant Lulus (certificate auto-issued server-side)", async () => {
  await page.getByText("Lulus", { exact: true }).first().waitFor({ timeout: 8000 })
})
await page.getByRole("button", { name: "Tutup" }).click()

// --- Publish ---
await page.getByRole("link", { name: "Detail" }).click()
await page.getByRole("button", { name: "Terbitkan" }).click()
await expect("publishing flips the badge to Diterbitkan", async () => {
  await page.getByText("Diterbitkan", { exact: true }).waitFor({ timeout: 8000 })
})

// --- The player renders what was authored ---
await page.goto(`${BASE}/learn/${courseId}`, { timeout: 30000 })
await expect("player sidebar renders the authored module + lesson", async () => {
  await page.getByRole("heading", { name: COURSE_TITLE_EDITED }).first().waitFor({ timeout: 8000 })
  await page.getByRole("complementary").getByText(LESSON_TITLE).waitFor({ timeout: 8000 })
  await page.getByRole("complementary").getByText("0 dari 1 pelajaran selesai").waitFor({ timeout: 8000 })
})

await browser.close()

if (failures > 0) {
  console.error(`\n${failures} FAILURE(S)`)
  process.exit(1)
}
console.log("\nALL PASS")
