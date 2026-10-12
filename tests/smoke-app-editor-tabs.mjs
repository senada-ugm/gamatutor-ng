/**
 * Manual smoke script verifying the apps/app (Vite SPA) course editor's
 * remaining tabs (run against live dev servers; not part of CI):
 *   pnpm --filter api dev          # CORS_ORIGIN=http://localhost:3030
 *   pnpm --filter app dev
 *   node tests/smoke-app-editor-tabs.mjs
 * Signs in as the seeded admin, creates a PAID course through the UI,
 * then exercises Pembayaran (order -> confirm -> refund), Sertifikat
 * (signature with a real image upload, persisted across reload), and
 * Instruktur (invite an existing account -> active row -> remove).
 */
import { chromium } from "playwright"

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3030"
const API = process.env.SMOKE_API_URL ?? "http://localhost:8000"
const EMAIL = process.env.SMOKE_EMAIL ?? "admin@lms.dev"
const PASSWORD = process.env.SMOKE_PASSWORD ?? "correcthorsebatterystaple"
const COURSE_TITLE = `Smoke Editor Tabs ${Date.now()}`
const PRICE = 50000
const SIGNER_NAME = "Dr. Bambang Sutrisno"
const SIGNER_TITLE = "Ketua Lembaga"
const INVITE_EMAIL = "user@lms.dev"
// 1x1 transparent PNG — real magic bytes so the server's content sniffing
// accepts it for the certificate-signature (image-only) purpose.
const PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
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

await page.goto(`${BASE}/login`)
await page.locator("#email").fill(EMAIL)
await page.locator("#password").fill(PASSWORD)
await page.getByRole("button", { name: "Masuk", exact: true }).click()
await expect("login reaches the dashboard", async () => {
  await page.waitForURL("**/dashboard", { timeout: 8000 })
})

// --- Create a PAID course through the UI ---
await page.goto(`${BASE}/instructor/courses/new`, { timeout: 30000 })
await selectFirstInstitution(page)
await page.locator("#title").fill(COURSE_TITLE)
await page.locator("#price").fill(String(PRICE))
await page.getByRole("button", { name: "Buat Pelatihan" }).click()
await expect("paid course creation lands on the editor", async () => {
  await page.waitForURL(/\/instructor\/courses\/crs_[^/]+\/editor$/, { timeout: 8000 })
  await page.getByRole("heading", { name: COURSE_TITLE, exact: true }).waitFor({ timeout: 8000 })
})
const courseId = page.url().match(/\/courses\/(crs_[^/]+)\/editor/)?.[1]

// ================= PEMBAYARAN =================
const orderRes = await page.request.post(`${API}/v1/orders`, { data: { courseId } })
if (!orderRes.ok()) throw new Error(`order create failed: ${orderRes.status()} ${await orderRes.text()}`)

// Scoped to the editor's tab strip: the management sidebar carries a
// "Pembayaran" link of its own.
await page.getByRole("navigation").getByRole("link", { name: "Pembayaran" }).click()
await expect("payments tab shows the pending order", async () => {
  await page.getByText("Menunggu Pembayaran").waitFor({ timeout: 8000 })
  // id-ID currency renders "Rp 50.000" — assert the grouped digits only
  await page.getByText("50.000").waitFor({ timeout: 8000 })
})

await page.getByRole("button", { name: "Terima Pembayaran" }).click()
await page.locator("#payment-ref").fill("TRX-SMOKE-12345")
await page.getByRole("button", { name: "Konfirmasi Terima" }).click()
await expect("confirming receipt flips the order to Lunas", async () => {
  await page.getByText("Lunas", { exact: true }).waitFor({ timeout: 8000 })
})

await page.getByRole("button", { name: "Refund", exact: true }).click()
await expect("refunding flips the order to Dikembalikan", async () => {
  await page.getByText("Dikembalikan", { exact: true }).waitFor({ timeout: 8000 })
})

// ================= SERTIFIKAT =================
await page.getByRole("navigation").getByRole("link", { name: "Sertifikat", exact: true }).click()
await page.getByRole("button", { name: "+ Tambah Penandatangan" }).click()
await page.locator("#sig-name-1").fill(SIGNER_NAME)
await page.locator("#sig-title-1").fill(SIGNER_TITLE)
await page.setInputFiles('input[type="file"]', {
  name: "tanda-tangan.png",
  mimeType: "image/png",
  buffer: Buffer.from(PNG_BASE64, "base64"),
})
await expect("signature image uploads and previews", async () => {
  await page.getByRole("img", { name: "Tanda tangan" }).waitFor({ timeout: 15000 })
})

await page.getByRole("button", { name: "Simpan Perubahan" }).click()
await expect("certificate settings save", async () => {
  await page.getByText("Pengaturan sertifikat disimpan").waitFor({ timeout: 8000 })
})

await page.reload()
await expect("signatures persist across reload", async () => {
  // CardTitle renders as a div, not a heading role — match by text
  await page.getByText("Tanda Tangan Sertifikat").waitFor({ timeout: 8000 })
  const nameValue = await page.locator("#sig-name-1").inputValue()
  if (nameValue !== SIGNER_NAME) throw new Error(`signer name not persisted: "${nameValue}"`)
  await page.getByRole("img", { name: "Tanda tangan" }).waitFor({ timeout: 8000 })
})

// ================= INSTRUKTUR =================
// (direct URL: the editor's "Instruktur" tab name collides with the
// workspace nav's "Instruktur" button in role matching)
await page.goto(`${BASE}/instructor/courses/${courseId}/editor/instruktur`, { timeout: 30000 })
await page.getByRole("button", { name: "Undang Instruktur", exact: true }).click()
await page.locator("#instructor-email").fill(INVITE_EMAIL)
await page.getByRole("button", { name: "Kirim Undangan" }).click()
await expect("inviting an existing account adds an active instructor row", async () => {
  await page.getByText(INVITE_EMAIL).waitFor({ timeout: 8000 })
  await page.getByText("Aktif", { exact: true }).waitFor({ timeout: 8000 })
})

// Destructive actions confirm through the in-app AlertDialog now, not
// window.confirm — accept it by clicking the dialog's own action.
await page.getByRole("button", { name: "Hapus", exact: true }).click()
await page.locator('[data-slot="alert-dialog-content"]').getByRole("button", { name: "Hapus" }).click()
await expect("removing the instructor empties the list", async () => {
  await page.getByText("Belum ada instruktur tambahan").waitFor({ timeout: 8000 })
})

await browser.close()

if (failures > 0) {
  console.error(`\n${failures} FAILURE(S)`)
  process.exit(1)
}
console.log("\nALL PASS")
