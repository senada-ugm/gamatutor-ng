/**
 * API journey test runner: pure-HTTP end-to-end scenarios across all four
 * personas (anonymous / user / owner / admin), executed in journey order
 * against a running dev stack, with a final assertion that every
 * operation in the served OpenAPI contract was exercised at least once.
 *
 * Prerequisites:
 *   - Postgres up, schema pushed, DB seeded (pnpm --filter api db:seed)
 *   - API running (pnpm --filter api dev, default http://localhost:8000)
 *
 * Run:  node tests/api/run.mjs   (or bash tests/api-journey.sh)
 */
import { bootstrap } from "./lib/personas.mjs"
import { createCoverage, loadContractOps } from "./lib/coverage.mjs"
import { summary } from "./lib/assert.mjs"

import * as health from "./scenarios/00-health.mjs"
import * as institutions from "./scenarios/05-institutions.mjs"
import * as courses from "./scenarios/10-courses.mjs"
import * as courseContent from "./scenarios/15-course-content.mjs"
import * as courseInstructors from "./scenarios/20-course-instructors.mjs"
import * as enrollments from "./scenarios/25-enrollments.mjs"
import * as quizzes from "./scenarios/35-quizzes.mjs"
import * as certificates from "./scenarios/50-certificates.mjs"
import * as uploads from "./scenarios/60-uploads.mjs"
import * as users from "./scenarios/65-users.mjs"
import * as notifications from "./scenarios/73-notifications.mjs"
import * as announcements from "./scenarios/74-announcements.mjs"
import * as reportsSettings from "./scenarios/76-reports-settings.mjs"
import * as capabilitiesProfiles from "./scenarios/77-capabilities-profiles.mjs"

const SCENARIOS = [
  ["health", health],
  ["institutions", institutions],
  ["courses", courses],
  ["course content", courseContent],
  ["course instructors", courseInstructors],
  ["enrollments", enrollments],
  ["quizzes", quizzes],
  ["certificates", certificates],
  ["uploads", uploads],
  ["users", users],
  ["notifications", notifications],
  ["announcements", announcements],
  ["reports & settings", reportsSettings],
  ["capabilities & profiles", capabilitiesProfiles],
]

const base = process.env.API_BASE_URL ?? "http://localhost:8000"

// preflight — fail fast with an actionable hint
try {
  const res = await fetch(base + "/health")
  if (!res.ok) throw new Error(`status ${res.status}`)
} catch {
  console.error(`API is not reachable at ${base} — start the dev stack first:  pnpm dev  (or pnpm --filter api dev)`)
  process.exit(1)
}

const coverage = createCoverage()
const personas = await bootstrap({ base, coverage })
console.log(`Journey personas signed in (admin/owner/user) — stamp ${new Date().toISOString()}`)

const ctx = { base, coverage, stamp: Date.now(), ...personas }
for (const [name, scenario] of SCENARIOS) {
  await scenario.run(ctx)
}

const contractOps = await loadContractOps(base)
const { missing } = coverage.report(contractOps)

const checksOk = summary()
if (missing.length > 0) {
  console.error(`\nCONTRACT COVERAGE GAPS — ${missing.length} operation(s) never exercised:`)
  for (const op of missing) console.error(`  - ${op}`)
}
console.log(`\nCoverage: ${contractOps.size - missing.length}/${contractOps.size} contract operations exercised`)

process.exit(checksOk && missing.length === 0 ? 0 : 1)
