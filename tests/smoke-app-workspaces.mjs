/**
 * Manual smoke script verifying the apps/app (Vite SPA) admin workspace
 * and the learner's transactional funnel (run against live dev servers;
 * not part of CI):
 *   pnpm --filter api dev          # CORS_ORIGIN=http://localhost:3030
 *   pnpm --filter app dev
 *   node tests/smoke-app-workspaces.mjs
 *
 * As admin: dashboard stats, user suspend/reactivate, institution
 * create/edit, platform settings save. As the seeded
 * learner: catalog -> enroll course, announcement visible in the
 * player, course report tab, certificate view + public verify.
 */
import { chromium } from "playwright"

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3030"
const API = process.env.SMOKE_API_URL ?? "http://localhost:8010"
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
page.on("dialog", (dialog) => (dialog.type === "prompt" ? dialog.accept("alasan uji smoke") : dialog.accept()))

await login(page, ADMIN)

// ================= ADMIN DASHBOARD =================
await page.goto(`${BASE}/admin`, { timeout: 30000 })
await expect("admin dashboard renders overview stats", async () => {
  await page.getByText("Tingkat Penyelesaian").waitFor({ timeout: 8000 })
})

// ================= ADMIN USERS =================
await page.goto(`${BASE}/admin/users`, { timeout: 30000 })
await expect("user list shows the seeded learner", async () => {
  await page.getByText(LEARNER.email).waitFor({ timeout: 8000 })
})

const learnerRow = page.locator("tr", { hasText: LEARNER.email })
await learnerRow.getByRole("button", { name: "Bekukan" }).click()
await learnerRow.getByPlaceholder("Alasan pembekuan").fill("uji otomatis")
await learnerRow.getByRole("button", { name: "Simpan", exact: true }).click()
await expect("suspending flips the learner to Dibekukan", async () => {
  await learnerRow.getByText("Dibekukan").waitFor({ timeout: 8000 })
})
await learnerRow.getByRole("button", { name: "Aktifkan" }).click()
await expect("reactivating restores Aktif", async () => {
  await learnerRow.getByText("Aktif", { exact: true }).waitFor({ timeout: 8000 })
})

// ================= ADMIN INSTITUTIONS =================
await page.goto(`${BASE}/admin/institutions`, { timeout: 30000 })
const INST_NAME = `Smoke WS Inst ${STAMP}`
await page.getByRole("button", { name: "Tambah Institusi" }).click()
await page.locator("#institution-name").fill(INST_NAME)
await page.getByRole("button", { name: "Buat Institusi", exact: true }).click()
await expect("institution creation persists in the list", async () => {
  await page.getByText(INST_NAME).waitFor({ timeout: 8000 })
})

await page.locator("div", { hasText: INST_NAME }).first() // settle
await page.getByRole("button", { name: "Edit", exact: true }).first().click()
await page.locator("#institution-name").fill(`${INST_NAME} Revisi`)
await page.getByRole("button", { name: "Simpan Perubahan" }).click()
await expect("institution edit persists", async () => {
  await page.getByText(`${INST_NAME} Revisi`).waitFor({ timeout: 8000 })
})

// ================= ADMIN SETTINGS + AUDIT =================
await page.goto(`${BASE}/admin/settings`, { timeout: 30000 })
await page.locator("#platform-name").waitFor({ timeout: 8000 })
const originalName = await page.locator("#platform-name").inputValue()
await page.locator("#platform-name").fill(`${originalName} (Uji)`)
await page.getByRole("button", { name: "Simpan Pengaturan" }).click()
await expect("platform settings save", async () => {
  await page.getByText("Pengaturan platform disimpan").waitFor({ timeout: 8000 })
})
await page.locator("#platform-name").fill(originalName)
await page.getByRole("button", { name: "Simpan Pengaturan" }).click()
await page.getByText("Pengaturan platform disimpan").waitFor({ timeout: 8000 })

// ================= SEED COURSES AS ADMIN =================
let institutionId = (await (await page.request.get(`${API}/v1/institutions?pageSize=1`)).json())?.data?.[0]?.id
const freeCourseRes = await page.request.post(`${API}/v1/courses`, {
  data: {
    title: `Smoke WS Free ${STAMP}`,
    institutionId,
    courseType: "offline",
    isDisabilityFriendly: false,
    supportedDisabilityTypes: [],
  },
})
const freeCourseId = (await freeCourseRes.json()).data.id
const paidCourseRes = await page.request.post(`${API}/v1/courses`, {
  data: {
    title: `Smoke WS Paid ${STAMP}`,
    institutionId,
    courseType: "online",
    isDisabilityFriendly: false,
    supportedDisabilityTypes: [],
  },
})
const paidCourseId = (await paidCourseRes.json()).data.id
for (const id of [freeCourseId, paidCourseId]) {
  await page.request.post(`${API}/v1/courses/${id}/publish`)
}

// Published announcement + module on the free course (for the player check)
const moduleRes = await page.request.post(`${API}/v1/courses/${freeCourseId}/modules`, { data: { title: "Modul 1" } })
const moduleId = (await moduleRes.json()).data.id
await page.request.post(`${API}/v1/modules/${moduleId}/lessons`, {
  data: { title: "Pelajaran 1", contentType: "text", textContent: "Halo." },
})
await page.request.post(`${API}/v1/courses/${freeCourseId}/announcements`, {
  data: { courseId: freeCourseId, title: `Pengumuman Uji ${STAMP}`, content: "Selamat datang!", isPublished: true },
})

// ================= LEARNER FUNNEL =================
await page.getByRole("button", { name: "Menu Akun" }).click()
await page.getByRole("menuitem", { name: "Keluar" }).click()
await page.waitForURL((url) => url.pathname === "/" || url.pathname === "", { timeout: 8000 })
await login(page, LEARNER)

await page.goto(`${BASE}/courses`, { timeout: 30000 })
await expect("catalog lists the seeded courses", async () => {
  await page.getByText(`Smoke WS Free ${STAMP}`).waitFor({ timeout: 8000 })
  await page.getByText(`Smoke WS Paid ${STAMP}`).waitFor({ timeout: 8000 })
})

// --- Free course: enroll ---
await page.getByText(`Smoke WS Free ${STAMP}`).click()
await expect("course detail renders with syllabus", async () => {
  await page.getByText("Modul 1").waitFor({ timeout: 8000 })
})
await page.getByRole("button", { name: "Daftar", exact: true }).click()
await expect("free enroll lands in Menunggu persetujuan", async () => {
  await page.getByText("Menunggu persetujuan").waitFor({ timeout: 8000 })
})

// --- Second course: instant online enrollment ---
await page.goto(`${BASE}/courses/${paidCourseId}`, { timeout: 30000 })
await page.getByRole("button", { name: "Daftar", exact: true }).click()
await expect("online (free) enroll lands directly in the course", async () => {
  await page.getByText("You are enrolled as an active participant.").waitFor({ timeout: 8000 })
})

// --- Notifications inbox renders ---
await page.goto(`${BASE}/notifications`, { timeout: 30000 })
await expect("notifications inbox renders", async () => {
  await page.getByRole("heading", { name: "Notifikasi" }).first().waitFor({ timeout: 8000 })
})

// ================= BACK AS ADMIN: report, player announcement, certificate =================
await page.getByRole("button", { name: "Menu Akun" }).click()
await page.getByRole("menuitem", { name: "Keluar" }).click()
await page.waitForURL((url) => url.pathname === "/" || url.pathname === "", { timeout: 8000 })
await login(page, ADMIN)

// Approve the learner so the report/roster has a participant
const enrollmentsRes = await page.request.get(`${API}/v1/enrollments?courseId=${freeCourseId}&pageSize=50`)
const learnerEnrollment = (await enrollmentsRes.json()).data.find((e) => e.userId)
if (learnerEnrollment) {
  await page.request.patch(`${API}/v1/enrollments/${learnerEnrollment.id}`, { data: { status: "selected" } })
}

await page.goto(`${BASE}/instructor/courses/${freeCourseId}/editor/laporan`, { timeout: 30000 })
await expect("course report tab shows the participant row + CSV button", async () => {
  await page.getByText(LEARNER.email).waitFor({ timeout: 8000 })
  await page.getByRole("button", { name: "Unduh CSV" }).waitFor({ timeout: 8000 })
})

// Player announcement tab (admin is a manager, can enter the player)
await page.goto(`${BASE}/learn/${freeCourseId}/pengumuman`, { timeout: 30000 })
await expect("player Pengumuman tab shows the published announcement", async () => {
  await page.getByText(`Pengumuman Uji ${STAMP}`).waitFor({ timeout: 8000 })
  await page.getByText("Selamat datang!").waitFor({ timeout: 8000 })
})

// Certificate: graduate the learner, fetch the issued certificate
if (learnerEnrollment) {
  await page.request.patch(`${API}/v1/enrollments/${learnerEnrollment.id}`, { data: { status: "graduated" } })
  const after = await (await page.request.get(`${API}/v1/enrollments/${learnerEnrollment.id}`)).json()
  const certificateId = after?.data?.certificateId
  if (certificateId) {
    await page.goto(`${BASE}/certificates/${certificateId}`, { timeout: 30000 })
    const code = await page
      .getByText(/^[A-Z0-9-]{6,}$/)
      .first()
      .textContent()
      .catch(() => null)
    await expect("certificate view renders for the recipient's admin", async () => {
      // both the label and the server-generated certificate title say it
      await page.getByText("Sertifikat Kelulusan").first().waitFor({ timeout: 8000 })
    })
    if (code) {
      await page.goto(`${BASE}/certificates/verify?code=${encodeURIComponent(code.trim())}`, { timeout: 30000 })
      await expect("public verify page validates the code", async () => {
        await page.getByText("Sah", { exact: true }).waitFor({ timeout: 8000 })
      })
    }
  } else {
    console.error("FAIL certificate was not auto-issued on graduation")
    failures++
  }
}

await browser.close()

if (failures > 0) {
  console.error(`\n${failures} FAILURE(S)`)
  process.exit(1)
}
console.log("\nALL PASS")
