/**
 * Manual smoke script verifying the apps/web (TanStack Start) marketing
 * site (run against live dev servers; not part of CI):
 *   pnpm --filter api dev          # CORS_ORIGIN=http://localhost:3030
 *   pnpm --filter app dev          # :3030 (SPA handoff target)
 *   pnpm --filter web dev          # :3020
 *   node tests/smoke-web-marketing.mjs
 *
 * Seeds a published course + a graduated learner's certificate as
 * admin, then checks the SSR surfaces as an anonymous visitor: landing
 * renders with real featured courses, the catalog lists and
 * server-side-searches (?q=), the course detail shows the syllabus and
 * hands off to the SPA for enrollment, /login meta-refreshes to the
 * SPA, and the public certificate verify page validates a real code.
 * Everything is asserted on server-rendered HTML (JS-disabled context)
 * to prove the SSR claim.
 */
import { chromium } from "playwright"

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3020"
const SPA = process.env.SMOKE_SPA_URL ?? "http://localhost:3030"
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
    console.error(`FAIL ${name}: ${err.message.split("\n")[0]}`)
  }
}

const browser = await chromium.launch(process.env.SMOKE_CHROMIUM ? { executablePath: process.env.SMOKE_CHROMIUM } : {})
// JS disabled: every assertion below must hold on server-rendered HTML.
const page = await browser.newPage({ javaScriptEnabled: false })

// --- Seed: published course + certificate, as admin (API only) ---
const adminCtx = await browser.newContext()
const admin = await adminCtx.newPage()
await admin.goto(`${SPA}/login`)
await admin.locator("#email").fill(ADMIN.email)
await admin.locator("#password").fill(ADMIN.password)
await admin.getByRole("button", { name: "Masuk", exact: true }).click()
await admin.waitForURL("**/dashboard", { timeout: 8000 })

let institutionId = (await (await admin.request.get(`${API}/v1/institutions?pageSize=1`)).json())?.data?.[0]?.id
const courseRes = await admin.request.post(`${API}/v1/courses`, {
  data: {
    title: `Smoke Marketing ${STAMP}`,
    shortDescription: "Pelatihan uji halaman publik.",
    institutionId,
    courseType: "online",
    isDisabilityFriendly: false,
    supportedDisabilityTypes: [],
  },
})
const courseId = (await courseRes.json()).data.id
await admin.request.post(`${API}/v1/courses/${courseId}/publish`)
const moduleRes = await admin.request.post(`${API}/v1/courses/${courseId}/modules`, { data: { title: "Modul Publik" } })
await admin.request.post(`${API}/v1/modules/${(await moduleRes.json()).data.id}/lessons`, {
  data: { title: "Pelajaran Pembuka", contentType: "text", textContent: "Halo." },
})

// Certificate fixture: self-enroll -> select -> graduate (auto-issues)
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
if (!certificateId)
  throw new Error(`graduation did not auto-issue a certificate: ${JSON.stringify(graduated?.data?.status)}`)
const certRes = await admin.request.get(`${API}/v1/certificates/${certificateId}`)
const verificationCode = (await certRes.json())?.data?.verificationCode
await adminCtx.close()

// ================= ANONYMOUS SSR ASSERTIONS =================

await page.goto(`${BASE}/`, { timeout: 30000 })
await expect("landing renders server-side with the featured course", async () => {
  await page.getByText("Pelatihan kerja dari institusi mitra resmi").waitFor({ timeout: 8000 })
  await page.getByText(`Smoke Marketing ${STAMP}`).waitFor({ timeout: 8000 })
})
await expect("landing header links Masuk to the SPA", async () => {
  const href = await page.getByRole("link", { name: "Masuk" }).first().getAttribute("href")
  if (href !== `${SPA}/login`) throw new Error(`Masuk href was ${href}`)
})

await page.goto(`${BASE}/courses`, { timeout: 30000 })
await expect("catalog lists the published course server-side", async () => {
  await page.getByText(`Smoke Marketing ${STAMP}`).waitFor({ timeout: 8000 })
})

await page.goto(`${BASE}/courses?q=zzz-no-match-${STAMP}`, { timeout: 30000 })
await expect("server-side search filters results via ?q=", async () => {
  await page.getByText("Tidak ada pelatihan yang cocok", { exact: false }).waitFor({ timeout: 8000 })
})

await page.goto(`${BASE}/courses/${courseId}`, { timeout: 30000 })
await expect("course detail shows syllabus and enrollment handoff", async () => {
  await page.getByText("Modul Publik").waitFor({ timeout: 8000 })
  await page.getByRole("link", { name: "Daftar Sekarang" }).waitFor({ timeout: 8000 })
})
await expect("detail CTA points into the SPA's transactional funnel", async () => {
  const href = await page.getByRole("link", { name: "Daftar Sekarang" }).getAttribute("href")
  if (href !== `${SPA}/courses/${courseId}`) throw new Error(`CTA href was ${href}`)
})

// Assert on raw HTML — the meta refresh would navigate away before
// any DOM query could run (browsers honor it without JS).
const loginHtml = await page.request.get(`${BASE}/login`).then((r) => r.text())
await expect("/login meta-refreshes to the SPA login", async () => {
  if (!loginHtml.includes(`url=${SPA}/login`)) throw new Error("refresh target missing from HTML")
})

await page.goto(`${BASE}/certificates/verify?code=${encodeURIComponent(verificationCode)}`, { timeout: 30000 })
await expect("public verify validates the certificate server-side", async () => {
  await page.getByText("Sah", { exact: true }).waitFor({ timeout: 8000 })
  // The verify card shows the recipient's NAME and the course title
  await page.getByText("LMS Admin").first().waitFor({ timeout: 8000 })
  await page.getByText(`Smoke Marketing ${STAMP}`).waitFor({ timeout: 8000 })
})

await browser.close()

if (failures > 0) {
  console.error(`\n${failures} FAILURE(S)`)
  process.exit(1)
}
console.log("\nALL PASS")
