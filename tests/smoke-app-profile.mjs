/**
 * Manual smoke script verifying participant-profile self-service (run
 * against live dev servers; not part of CI):
 *   pnpm --filter api dev          # CORS_ORIGIN=http://localhost:3030
 *   pnpm --filter app dev
 *   node tests/smoke-app-profile.mjs
 *
 * The seeded learner fills their own profile at /profile — scalars, the
 * two identity numbers, and one row in each of the three repeaters —
 * saves, and reloads to confirm it persisted. Then the seeded admin
 * reads the same profile over the API to confirm the identity numbers
 * come back masked for anyone but the owner.
 */
import { chromium } from "playwright"

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3030"
const API = process.env.SMOKE_API_URL ?? "http://localhost:8000"
const ADMIN = { email: "admin@lms.dev", password: "correcthorsebatterystaple" }
const LEARNER = { email: "user@lms.dev", password: "correcthorsebatterystaple" }
const STAMP = String(Date.now()).slice(-6)
const PHONE = `0812${STAMP}`
const KTP = `33720${STAMP}1234`
const SCHOOL = `SMK Smoke ${STAMP}`
const COMPANY = `PT Smoke ${STAMP}`
const CERT = `Sertifikat Smoke ${STAMP}`
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

await login(page, LEARNER)

// Each run authors one row per repeater, so start from a cleared
// profile — otherwise a second run edits the previous run's rows and
// appends beside them.
const sessionRes = await page.request.get(`${API}/api/auth/get-session`)
const learnerId = (await sessionRes.json())?.user?.id
if (!learnerId) throw new Error("could not resolve the learner's own id")
const resetRes = await page.request.patch(`${API}/v1/participant-profiles/${learnerId}`, {
  data: { education: [], experience: [], certifications: [] },
})
if (!resetRes.ok()) throw new Error(`profile reset failed: ${resetRes.status()}`)

// --- The account menu is the only way in ---
await page.getByRole("button", { name: "Menu Akun" }).click()
await page.getByRole("menuitem", { name: "Profil Saya" }).click()
await expect("the account menu reaches the profile page", async () => {
  await page.waitForURL("**/profile", { timeout: 10000 })
  await page.getByRole("heading", { name: "Profil Saya" }).waitFor({ timeout: 10000 })
})

// --- Scalars, including the two encrypted identity numbers ---
await page.locator("#profile-phone").fill(PHONE)
await page.locator("#profile-birthdate").fill("1998-04-12")
await page.locator("#profile-gender").selectOption("female")
await page.locator("#profile-marital").selectOption("single")
await page.locator("#profile-nationality").fill("Indonesia")
await page.locator("#profile-religion").selectOption("Islam")
await page.locator("#profile-education-level").selectOption("sma")
await page.locator("#profile-dati2").fill("Kota Surakarta")
await page.locator("#profile-about").fill("Peserta uji asap.")
await page.locator("#profile-address").fill("Jl. Slamet Riyadi 1")
await page.locator("#profile-ktp").fill(KTP)
await page.locator("#profile-bpjs").fill(`0001${STAMP}`)

// --- One row in each repeater ---
await page.getByRole("button", { name: "Tambah Pendidikan" }).click()
await page.locator("#edu-degree-0").fill("SMK")
await page.locator("#edu-school-0").fill(SCHOOL)
await page.locator("#edu-start-0").fill("2013")
await page.locator("#edu-end-0").fill("2016")

await page.getByRole("button", { name: "Tambah Pengalaman" }).click()
await page.locator("#exp-title-0").fill("Teknisi")
await page.locator("#exp-company-0").fill(COMPANY)
await page.locator("#exp-start-0").fill("2017")
await expect("ticking 'still working here' disables the end year", async () => {
  await page.getByText("Masih bekerja di sini").click()
  if (!(await page.locator("#exp-end-0").isDisabled())) throw new Error("end year stayed editable")
})

await page.getByRole("button", { name: "Tambah Sertifikasi" }).click()
await page.locator("#cert-name-0").fill(CERT)
await page.locator("#cert-issuer-0").fill("BNSP")
await page.locator("#cert-issued-0").fill("2020")

await page.getByRole("button", { name: "Simpan Profil" }).click()
await expect("saving the whole form succeeds", async () => {
  await page.getByText("Profil disimpan").waitFor({ timeout: 15000 })
})

// --- It is actually stored, not just in local state ---
await page.reload()
await expect("scalars persist across reload", async () => {
  await page.locator("#profile-phone").waitFor({ timeout: 10000 })
  const phone = await page.locator("#profile-phone").inputValue()
  if (phone !== PHONE) throw new Error(`phone came back as ${phone}`)
  const level = await page.locator("#profile-education-level").inputValue()
  if (level !== "sma") throw new Error(`education level came back as ${level}`)
})
await expect("the owner reads their own KTP number in full", async () => {
  const ktp = await page.locator("#profile-ktp").inputValue()
  if (ktp !== KTP) throw new Error(`owner saw ${ktp}`)
})
await expect("all three repeaters persist their row", async () => {
  if ((await page.locator("#edu-school-0").inputValue()) !== SCHOOL) throw new Error("education row missing")
  if ((await page.locator("#exp-company-0").inputValue()) !== COMPANY) throw new Error("experience row missing")
  if ((await page.locator("#cert-name-0").inputValue()) !== CERT) throw new Error("certification row missing")
})
await expect("an ongoing role stores no end year", async () => {
  if ((await page.locator("#exp-end-0").inputValue()) !== "") throw new Error("end year survived the ongoing flag")
})

// --- A different account only ever sees the masked tail ---
await page.getByRole("button", { name: "Menu Akun" }).click()
await page.getByRole("menuitem", { name: "Keluar" }).click()
await page.waitForURL((url) => url.pathname === "/" || url.pathname === "", { timeout: 10000 })
await login(page, ADMIN)

await expect("an admin reading the same profile gets the masked tail", async () => {
  const usersRes = await page.request.get(`${API}/v1/users?pageSize=100`)
  const users = (await usersRes.json())?.data ?? []
  const learner = users.find((u) => u.email === LEARNER.email)
  if (!learner) throw new Error("seeded learner not found in the user list")
  const res = await page.request.get(`${API}/v1/participant-profiles/${learner.id}`)
  if (!res.ok()) throw new Error(`profile read failed: ${res.status()}`)
  const profile = (await res.json()).data
  if (profile.ktpNumber === KTP) throw new Error("admin read the KTP number in full")
  if (!profile.ktpNumber?.endsWith(KTP.slice(-4))) throw new Error(`masked value was ${profile.ktpNumber}`)
  if (profile.phone !== PHONE) throw new Error("non-identity fields should not be masked")
})

await expect("the batch read resolves a roster page in one call", async () => {
  const usersRes = await page.request.get(`${API}/v1/users?pageSize=100`)
  const users = (await usersRes.json())?.data ?? []
  const ids = users.slice(0, 5).map((u) => u.id)
  const res = await page.request.get(`${API}/v1/participant-profiles?userIds=${ids.join(",")}`)
  if (!res.ok()) throw new Error(`batch read failed: ${res.status()}`)
  const batch = (await res.json()).data
  if (batch.length !== ids.length) throw new Error(`asked for ${ids.length} profiles, got ${batch.length}`)
  const learner = batch.find((p) => p.email === LEARNER.email)
  if (!learner) throw new Error("the seeded learner was not in the batch")
  if (learner.ktpNumber === KTP) throw new Error("the batch leaked the KTP number in full")
  if (!learner.ktpNumber?.endsWith(KTP.slice(-4))) throw new Error(`masked value was ${learner.ktpNumber}`)
})
await expect("the caller's own row comes back unmasked in a batch", async () => {
  const sessionRes = await page.request.get(`${API}/api/auth/get-session`)
  const adminId = (await sessionRes.json())?.user?.id
  const res = await page.request.get(`${API}/v1/participant-profiles?userIds=${adminId}`)
  const rows = (await res.json()).data
  if (rows.length !== 1 || rows[0].id !== adminId) throw new Error("the caller could not read their own row")
})
await expect("an account with no claim on the ids gets an empty batch", async () => {
  await page.getByRole("button", { name: "Menu Akun" }).click()
  await page.getByRole("menuitem", { name: "Keluar" }).click()
  await page.waitForURL((url) => url.pathname === "/" || url.pathname === "", { timeout: 10000 })
  await login(page, LEARNER)
  const usersRes = await page.request.get(`${API}/v1/users?pageSize=100`)
  if (usersRes.ok()) throw new Error("the learner should not be able to list users at all")
  // The learner manages nothing, so every id but their own is dropped.
  const res = await page.request.get(`${API}/v1/participant-profiles?userIds=${learnerId},usr_does_not_exist`)
  const rows = (await res.json()).data
  if (rows.length !== 1 || rows[0].id !== learnerId)
    throw new Error(`expected only the caller's own row, got ${rows.length}`)
})

await browser.close()
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
