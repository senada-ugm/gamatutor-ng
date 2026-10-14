/**
 * Smoke script verifying apps/app's unified GamaTutor-aligned landing page
 * and public certificate verification flow (run against live dev server):
 *   pnpm --filter api dev
 *   pnpm --filter app dev          # :3030
 *   node tests/smoke-app-landing.mjs
 */
import { chromium } from "playwright"

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3030"
const API = process.env.SMOKE_API_URL ?? "http://localhost:8000"
const ADMIN = { email: "admin@lms.dev", password: "correcthorsebatterystaple" }
const STAMP = Date.now()
let failures = 0

async function expect(name, fn) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (err) {
    failures++
    console.error(`FAIL ${name}: ${err.message}`)
  }
}

const browser = await chromium.launch(process.env.SMOKE_CHROMIUM ? { executablePath: process.env.SMOKE_CHROMIUM } : {})
const page = await browser.newPage()

// --- Seed: published course + certificate via API ---
const adminCtx = await browser.newContext()
const admin = await adminCtx.newPage()
await admin.goto(`${BASE}/login`)
await admin.locator("#email").fill(ADMIN.email)
await admin.locator("#password").fill(ADMIN.password)
await admin.getByRole("button", { name: "Masuk", exact: true }).click()
await admin.waitForURL("**/dashboard", { timeout: 8000 })

const insts = await (await admin.request.get(`${API}/v1/institutions?pageSize=1`)).json()
const institutionId = insts?.data?.[0]?.id

const courseRes = await admin.request.post(`${API}/v1/courses`, {
  data: {
    title: `Landing Test Retinopati ${STAMP}`,
    shortDescription: "Pelatihan skrining retinopati klinis terakreditasi.",
    institutionId,
    courseType: "online",
    isDisabilityFriendly: false,
    supportedDisabilityTypes: [],
  },
})
const courseId = (await courseRes.json()).data.id
await admin.request.post(`${API}/v1/courses/${courseId}/publish`)

// Create enrollment and graduate to auto-issue a certificate
await admin.request.post(`${API}/v1/enrollments`, { data: { courseId } })
const enrollments = await (await admin.request.get(`${API}/v1/enrollments?courseId=${courseId}&pageSize=10`)).json()
const enrollmentId = enrollments?.data?.[0]?.id
await admin.request.patch(`${API}/v1/enrollments/${enrollmentId}`, { data: { status: "selected" } })
const graduated = await (
  await admin.request.patch(`${API}/v1/enrollments/${enrollmentId}`, {
    data: { status: "graduated" },
  })
).json()
const certificateId = graduated?.data?.certificateId
const certRes = await admin.request.get(`${API}/v1/certificates/${certificateId}`)
const verificationCode = (await certRes.json())?.data?.verificationCode
await adminCtx.close()

// ================= ANONYMOUS VISITOR CHECKS =================

await page.goto(`${BASE}/`, { timeout: 30000 })

await expect("anonymous visitor stays on root route (no redirect away)", async () => {
  if (new URL(page.url()).pathname !== "/") throw new Error(`URL was ${page.url()}`)
})

await expect("landing header renders GamaTutor brand and eye icon mark", async () => {
  await page.getByText("DRIVE School").first().waitFor({ timeout: 8000 })
  await page.getByText("GamaTutor").first().waitFor({ timeout: 8000 })
  await page.getByText("👁").first().waitFor({ timeout: 8000 })
})

await expect("landing header contains Verifikasi Sertifikat link", async () => {
  const link = page.getByRole("link", { name: "Verifikasi Sertifikat" }).first()
  await link.waitFor({ timeout: 8000 })
})

await expect("hero renders clinical retinopathy title and description", async () => {
  await page.getByRole("heading", { name: "Pelatihan Skrining Retinopati Diabetika" }).waitFor({ timeout: 8000 })
  await page.getByText(/kursus daring untuk dokter layanan primer/i).waitFor({ timeout: 8000 })
})

await expect("hero action offers participant registration and Masuk is only in header", async () => {
  await page.getByRole("button", { name: "Daftar sebagai peserta" }).first().waitFor({ timeout: 8000 })
  // Masuk must only be in header
  await page.locator("header").getByRole("link", { name: "Masuk" }).waitFor({ timeout: 8000 })
  const heroMasuk = await page.locator("#hero").getByRole("button", { name: "Masuk" }).count()
  if (heroMasuk > 0) throw new Error("Masuk button should not be in hero")
  const badgeCount = await page.getByText("Terakreditasi SKP IDI").count()
  if (badgeCount > 0) throw new Error("Accreditation badge should be removed")
})

await expect("features section displays 3 GamaTutor clinical benefit cards", async () => {
  await page.getByText("Belajar sesuai waktu Anda").first().waitFor({ timeout: 8000 })
  await page.getByText("Simulasi grading").first().waitFor({ timeout: 8000 })
  await page.getByText("Sertifikat atas nama Anda").first().waitFor({ timeout: 8000 })
})

await expect("hero fundus lens allows interactive pin inspection", async () => {
  const pin1 = page.locator("button[aria-label='Temuan 1']")
  await pin1.waitFor({ timeout: 8000 })
  await pin1.click()
  await page.getByText("Perdarahan dot/blot").first().waitFor({ timeout: 8000 })
  await pin1.click()
})

await expect("Coba satu kasus dulu link has no arrow and scrolls to simulation", async () => {
  const tryLink = page.getByRole("link", { name: "Coba satu kasus dulu", exact: true })
  await tryLink.waitFor({ timeout: 8000 })
  await tryLink.click()
  await page.waitForTimeout(500)
  const sim = page.locator("#simulasi")
  await sim.waitFor({ state: "visible", timeout: 8000 })
})

await expect("interactive 5-case simulation functions end to end", async () => {
  const sim = page.locator("#simulasi")
  await sim.getByRole("heading", { name: "Coba simulasi grading" }).waitFor({ timeout: 8000 })
  await sim.getByText("Kasus 1 dari 5").waitFor({ timeout: 8000 })
  await sim.getByRole("button", { name: "Tidak ada retinopati diabetika" }).click()
  await sim.getByText("Tepat.").waitFor({ timeout: 8000 })
  await sim.getByRole("button", { name: "Kasus berikutnya" }).click()

  await sim.getByText("Kasus 2 dari 5").waitFor({ timeout: 8000 })
  await sim.getByRole("button", { name: "Retinopati diabetika", exact: true }).click()
  await sim.getByText("Tepat.").waitFor({ timeout: 8000 })
  await sim.getByRole("button", { name: "Hard exudate" }).first().waitFor({ timeout: 8000 })
})

await expect("burden and sequenced path sections render clinical content", async () => {
  await page.getByText(/20,4 juta/i).waitFor({ timeout: 8000 })
  const materi = page.locator("#materi")
  await materi.getByRole("heading", { name: "Isi kursus" }).waitFor({ timeout: 8000 })
  await materi.getByRole("heading", { name: "Diabetes mellitus" }).waitFor({ timeout: 8000 })
  await materi.getByRole("heading", { name: "Retinopati diabetika" }).waitFor({ timeout: 8000 })
  await materi.getByRole("heading", { name: "Skrining dan tatalaksana" }).waitFor({ timeout: 8000 })
  await materi.getByRole("heading", { name: "Simulasi grading" }).waitFor({ timeout: 8000 })
  await materi.getByRole("heading", { name: "Evaluasi" }).waitFor({ timeout: 8000 })
})

await expect("catalogue section renders published courses", async () => {
  await page.getByText(`Landing Test Retinopati ${STAMP}`).first().waitFor({ timeout: 8000 })
})

await expect("footer renders GamaTutor attribution", async () => {
  await page
    .getByText(/DRIVE School · Pelatihan Skrining Retinopati Diabetika · Diselenggarakan di platform GamaTutor/i)
    .waitFor({ timeout: 8000 })
})

await expect("close banner offers Daftar & mulai kursus with no arrow and square corners", async () => {
  const closeBtn = page.getByRole("button", { name: "Daftar & mulai kursus" })
  await closeBtn.waitFor({ timeout: 8000 })
  const classes = await closeBtn.getAttribute("class")
  if (!classes?.includes("rounded-none")) {
    throw new Error(`expected rounded-none on closeBtn, got ${classes}`)
  }
  const svgCount = await closeBtn.locator("svg").count()
  if (svgCount !== 0) {
    throw new Error(`expected no svg icon inside closeBtn, found ${svgCount}`)
  }
})

// ================= PUBLIC CERTIFICATE VERIFICATION =================

await page.getByRole("link", { name: "Verifikasi Sertifikat" }).first().click()
await page.waitForURL("**/certificates/verify", { timeout: 8000 })

await expect("public certificate verify page renders without authentication", async () => {
  await page.getByText("Verifikasi Sertifikat Resmi").first().waitFor({ timeout: 8000 })
  await page.locator("input[name='code']").waitFor({ timeout: 8000 })
})

await page.locator("input[name='code']").fill(verificationCode)
await page.getByRole("button", { name: "Verifikasi" }).click()

await expect("verification validates the official certificate and shows Sah badge", async () => {
  await page.getByText("Sah", { exact: true }).waitFor({ timeout: 8000 })
  await page.getByText("Sertifikat Terverifikasi Asli", { exact: false }).waitFor({ timeout: 8000 })
  await page.getByText("LMS Admin").first().waitFor({ timeout: 8000 })
  await page.getByText(`Landing Test Retinopati ${STAMP}`).first().waitFor({ timeout: 8000 })
})

// ================= AUTHENTICATED USER CHECKS =================

const userContext = await browser.newContext()
const userPage = await userContext.newPage()
await userPage.goto(`${BASE}/login`)

await expect("login page renders clinical eyeball split background image", async () => {
  const bgImg = userPage.locator("img[src='/images/eyeball-auth-bg.jpg']")
  await bgImg.waitFor({ timeout: 8000 })
})

await userPage.locator("#email").fill(ADMIN.email)
await userPage.locator("#password").fill(ADMIN.password)
await userPage.getByRole("button", { name: "Masuk", exact: true }).click()
await userPage.waitForURL("**/dashboard", { timeout: 8000 })

// Go to root landing page as authenticated user
await userPage.goto(`${BASE}/`, { timeout: 30000 })

await expect("authenticated user visiting root stays on landing page", async () => {
  if (new URL(userPage.url()).pathname !== "/") throw new Error(`URL was ${userPage.url()}`)
})

await expect("authenticated landing header displays Dasbor, Profil, and Keluar", async () => {
  await userPage.getByRole("link", { name: "Dasbor" }).first().waitFor({ timeout: 8000 })
  await userPage.getByRole("link", { name: "Profil" }).first().waitFor({ timeout: 8000 })
  await userPage.getByRole("button", { name: "Keluar" }).first().waitFor({ timeout: 8000 })
})

await expect("authenticated hero displays Lanjutkan belajar and Buka Dasbor", async () => {
  await userPage.getByRole("button", { name: "Lanjutkan belajar" }).first().waitFor({ timeout: 8000 })
  await userPage.getByRole("button", { name: "Buka Dasbor" }).first().waitFor({ timeout: 8000 })
})

await userContext.close()
await browser.close()

if (failures > 0) {
  console.error(`\n${failures} FAILURE(S)`)
  process.exit(1)
}
console.log("\nALL PASS")
