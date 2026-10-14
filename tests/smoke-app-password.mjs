/**
 * Manual smoke script verifying apps/app's self-service password
 * recovery (run against live dev servers; not part of CI):
 *   pnpm --filter api dev          # CORS_ORIGIN=http://localhost:3030
 *   pnpm --filter app dev
 *   node tests/smoke-app-password.mjs
 *
 * The API runs without RESEND_API_KEY, so the reset email falls back to
 * the API console — this test reads the log the dev server writes
 * (/tmp/api-dev.log or API_LOG env) to recover the tokenized link, the
 * same trick the registration journey historically used. The seeded
 * user's password is restored at the end so other suites stay stable.
 */
import { chromium } from "playwright"
import { readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3030"
// os.tmpdir(), not "/tmp": on Windows the dev server's shell redirect
// writes to %TEMP% (Git Bash's /tmp), while a literal "/tmp" resolves to
// a stale C:	mp for Node — silently the wrong file.
const API_LOG = process.env.SMOKE_API_LOG ?? join(tmpdir(), "api-dev.log")
const EMAIL = "user@lms.dev"
const ORIGINAL_PASSWORD = "correcthorsebatterystaple"
const NEW_PASSWORD = "smoke-reset-password-1"
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

function extractResetLink(afterBytes) {
  const log = readFileSync(API_LOG, "utf-8")
  const tail = afterBytes ? log.slice(afterBytes) : log
  const links = [...tail.matchAll(/https?:\/\/[^\s"<>]+\/api\/auth\/reset-password\/[^\s"<>]+/g)]
  return links.length ? links[links.length - 1][0] : null
}

const browser = await chromium.launch(process.env.SMOKE_CHROMIUM ? { executablePath: process.env.SMOKE_CHROMIUM } : {})
const page = await browser.newPage()

// --- Step 1: request the reset link through the UI ---
await page.goto(`${BASE}/login`)
await page.getByRole("link", { name: "Lupa kata sandi?" }).click()
await expect("forgot-password page renders from the login link", async () => {
  await page.getByText("Lupa Kata Sandi").first().waitFor({ timeout: 8000 })
})

const logBytes = readFileSync(API_LOG, "utf-8").length
await page.locator("#email").fill(EMAIL)
await page.getByRole("button", { name: "Kirim Tautan Pemulihan" }).click()
await expect("request shows the neutral sent state", async () => {
  await page.getByText(/tautan pemulihan telah dikirim/i).waitFor({ timeout: 8000 })
})

let link = null
for (let i = 0; i < 30 && !link; i++) {
  await page.waitForTimeout(500)
  link = extractResetLink(logBytes)
}
if (!link) throw new Error("reset link not found in the API console log")

// --- Step 2: pull the token straight out of the emailed link ---
// (Better Auth's GET callback validates it and 302s to our SPA with
// ?token=; following that redirect inside the page trips CORS, and the
// token is identical either way.)
const token = link.match(/reset-password\/([a-zA-Z0-9]+(?:%3A%2F%2F)?)/)?.[1] ?? new URL(link).pathname.split("/").pop()
if (!token) throw new Error(`no token in the link: ${link}`)

await page.goto(`${BASE}/reset-password?token=${encodeURIComponent(token)}`, { timeout: 30000 })
await expect("reset page renders with the token", async () => {
  await page.getByText("Atur Kata Sandi Baru").first().waitFor({ timeout: 8000 })
})

await page.locator("#password").fill(NEW_PASSWORD)
await page.locator("#confirm").fill(NEW_PASSWORD)
await page.getByRole("button", { name: "Simpan Kata Sandi Baru" }).click()
await expect("saving redirects back to login", async () => {
  await page.waitForURL("**/login", { timeout: 8000 })
})

// --- Step 3: sign in with the NEW password ---
await page.locator("#email").fill(EMAIL)
await page.locator("#password").fill(NEW_PASSWORD)
await page.getByRole("button", { name: "Masuk", exact: true }).click()
await expect("sign-in works with the new password", async () => {
  await page.waitForURL("**/dashboard", { timeout: 8000 })
})

// --- Step 4: restore the seeded password for the other suites ---
const logBytes2 = readFileSync(API_LOG, "utf-8").length
await page.getByRole("button", { name: "Menu Akun" }).click()
await page.getByRole("menuitem", { name: "Keluar" }).click()
await page.waitForURL((url) => url.pathname === "/" || url.pathname === "", { timeout: 8000 })
await page.goto(`${BASE}/forgot-password`)
await page.locator("#email").fill(EMAIL)
await page.getByRole("button", { name: "Kirim Tautan Pemulihan" }).click()
await page.getByText(/tautan pemulihan telah dikirim/i).waitFor({ timeout: 8000 })
let link2 = null
for (let i = 0; i < 30 && !link2; i++) {
  await page.waitForTimeout(500)
  link2 = extractResetLink(logBytes2)
}
if (!link2) throw new Error("second reset link not found")
const token2 = new URL(link2).pathname.split("/").pop()
await page.goto(`${BASE}/reset-password?token=${encodeURIComponent(token2)}`, { timeout: 30000 })
await page.getByText("Atur Kata Sandi Baru").first().waitFor({ timeout: 8000 })
await page.locator("#password").fill(ORIGINAL_PASSWORD)
await page.locator("#confirm").fill(ORIGINAL_PASSWORD)
await page.getByRole("button", { name: "Simpan Kata Sandi Baru" }).click()
await expect("original password restored", async () => {
  await page.waitForURL(/\/login/, { timeout: 8000 })
  await page.locator("#email").fill(EMAIL)
  await page.locator("#password").fill(ORIGINAL_PASSWORD)
  await page.getByRole("button", { name: "Masuk", exact: true }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 8000 })
})

await browser.close()

if (failures > 0) {
  console.error(`\n${failures} FAILURE(S)`)
  process.exit(1)
}
console.log("\nALL PASS")
