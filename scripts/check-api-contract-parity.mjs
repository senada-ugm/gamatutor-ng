/**
 * Contract <-> API parity guard.
 *
 * Fails when either side drifts:
 *   1. an operation in the generated OpenAPI (packages/contracts) has no
 *      matching registered route in apps/api, or
 *   2. a registered apps/api route has no contract entry UNLESS it is on
 *      the INTENTIONAL_EXCLUSIONS list below.
 *
 * Run: node scripts/check-api-contract-parity.mjs   (after
 * `pnpm --filter @workspace/contracts build`; CI runs it that way).
 *
 * Route discovery is static: `app.<method>(<...>)` registrations plus
 * helper-loop registrations (`managerAction("/x/:id/pin", ...)` — any
 * call whose callee ends in "Action"). If a new helper pattern lands,
 * extend the scan rather than hardcoding its paths here.
 */
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")

/** Served-but-uncontracted routes, each with the spec that documents the
 *  exclusion (the spec-side note is what makes it intentional). */
const INTENTIONAL_EXCLUSIONS = new Map([
  ["POST /payments/webhook", "payments.tsp header — gateway callback, raw-body scope, no SDK client"],
  ["GET /uploads/{id}/file", "uploads.tsp header — byte serving with sniffed Content-Type"],
  ["POST /uploads/sweep", "uploads.tsp header — admin orphan-sweep trigger"],
  ["GET /v1/health", "health.tsp — SDK-prefix alias of the contracted /health"],
  [
    "GET /courses/{courseId}/participants/export",
    "reports.tsp header — operational CSV formatting of contracted report data",
  ],
  [
    "GET /institutions/{institutionId}/orders/export",
    "reports.tsp header — operational CSV formatting of institution order book",
  ],
])

// --- 1. contracted operations from the generated OpenAPI -------------------
const openapi = readFileSync(join(ROOT, "packages/contracts/tsp-output/openapi/3.1.0/openapi.yaml"), "utf8")
const contracted = new Set()
let currentPath = null
for (const line of openapi.split("\n")) {
  const pathMatch = line.match(/^  (\/\S+):/)
  if (pathMatch) {
    currentPath = pathMatch[1]
    continue
  }
  if (currentPath) {
    const methodMatch = line.match(/^    (get|post|patch|put|delete):/)
    if (methodMatch) contracted.add(`${methodMatch[1].toUpperCase()} ${currentPath}`)
    else if (/^  \S/.test(line)) currentPath = null
  }
}
if (contracted.size === 0) {
  console.error("No paths parsed from openapi.yaml — did the contracts build run?")
  process.exit(1)
}

// --- 2. served routes from apps/api registrations ---------------------------
const modulesDir = join(ROOT, "apps/api/src/modules")
const served = new Set()
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full)
    else if (entry.endsWith(".ts")) scan(full)
  }
}
function scan(file) {
  const text = readFileSync(file, "utf8")
  for (const m of text.matchAll(
    /app\.(get|post|patch|put|delete)\s*(?:<[^>]*(?:<[^>]*>)?[^>]*>)?\s*\(\s*\n?\s*"([^"]+)"/g
  )) {
    served.add(`${m[1].toUpperCase()} ${m[2]}`)
  }
  // helper-loop registrations: managerAction("/x/:id/pin", service.pin)
  for (const m of text.matchAll(/^\s*\w*Action\(\s*"([^"]+)"/gm)) {
    served.add(`POST ${m[1]}`)
  }
}
walk(modulesDir)
// health's bare + /v1 mounts live outside modules/
served.add("GET /health")
served.add("GET /v1/health")

// --- 3. compare --------------------------------------------------------------
const normalize = (entry) => entry.replace(/:[A-Za-z]+/g, "{}").replace(/\{[^}]+\}/g, "{}")
const contractedN = new Set([...contracted].map(normalize))
const servedN = new Map([...served].map((entry) => [normalize(entry), entry]))
const intentionalN = new Map([...INTENTIONAL_EXCLUSIONS].map(([entry, reason]) => [normalize(entry), reason]))

const missingInApi = [...contractedN].filter((entry) => !servedN.has(entry))
const undocumented = [...servedN.keys()].filter((entry) => !contractedN.has(entry) && !intentionalN.has(entry))

let failures = 0
for (const entry of missingInApi) {
  console.error(`CONTRACTED BUT NOT SERVED: ${entry}`)
  failures++
}
for (const entry of undocumented) {
  console.error(`SERVED BUT NOT CONTRACTED (and not on the intentional list): ${servedN.get(entry)}`)
  failures++
}
for (const [entry] of intentionalN) {
  if (!servedN.has(entry)) console.warn(`note: intentional exclusion ${entry} is not currently served`)
}

console.log(
  `\ncontracted: ${contracted.size} ops | served: ${served.size} routes | intentional exclusions: ${INTENTIONAL_EXCLUSIONS.size}`
)
if (failures > 0) {
  console.error(`\n${failures} PARITY FAILURE(S)`)
  process.exit(1)
}
console.log("PARITY OK — every contracted op is served; every extra route is an intentional exclusion")
