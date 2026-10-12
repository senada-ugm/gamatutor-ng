/**
 * Contract -> API -> frontend coverage report.
 *
 * check-api-contract-parity.mjs guards the first hop (every contracted
 * op is served, every served route is contracted). This reports the
 * second: which served endpoints anything actually CALLS, from apps/app
 * and apps/web.
 *
 * A report, not a guard — it never exits non-zero. An endpoint with no
 * caller is a fact to look at, not automatically a bug: some exist for
 * an API consumer we don't ship, some are UI that was never built. The
 * point is to make the difference visible rather than let it drift
 * silently.
 *
 * Detection is static, so it is deliberately conservative about the two
 * ways a path can be computed rather than literal — see expandTemplate
 * and DYNAMIC_ACTIONS. If a new call idiom lands (a third API helper, a
 * new dispatch shape), extend the scan; a false "no caller" here is
 * worse than no report at all.
 *
 * Run: node scripts/report-frontend-coverage.mjs
 *      (after `pnpm --filter @workspace/contracts build`)
 */
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")
const norm = (e) =>
  e
    .replace(/:[A-Za-z]+/g, "{}")
    .replace(/\{[^}]+\}/g, "{}")
    .replace(/\/$/, "")

// --- contracted ops, with their tag (domain) -------------------------------
const openapi = readFileSync(join(ROOT, "packages/contracts/tsp-output/openapi/3.1.0/openapi.yaml"), "utf8")
const ops = []
let cur = null,
  pending = null
for (const line of openapi.split("\n")) {
  const pm = line.match(/^  (\/\S+):/)
  if (pm) {
    cur = pm[1]
    continue
  }
  if (!cur) continue
  const mm = line.match(/^    (get|post|patch|put|delete):/)
  if (mm) {
    pending = { method: mm[1].toUpperCase(), path: cur, tag: "?" }
    ops.push(pending)
    continue
  }
  const tm = line.match(/^\s+- (\w[\w-]*)\s*$/)
  if (tm && pending && pending.tag === "?") pending.tag = tm[1]
  if (/^  \S/.test(line)) {
    cur = null
    pending = null
  }
}

// --- served routes ---------------------------------------------------------
const served = new Set()
;(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e)
    if (statSync(f).isDirectory()) walk(f)
    else if (e.endsWith(".ts")) {
      const t = readFileSync(f, "utf8")
      for (const m of t.matchAll(
        /app\.(get|post|patch|put|delete)\s*(?:<[^>]*(?:<[^<>]*(?:<[^<>]*>)?[^<>]*>)?[^>]*>)?\s*\(\s*\n?\s*"([^"]+)"/g
      ))
        served.add(`${m[1].toUpperCase()} ${m[2]}`)
      for (const m of t.matchAll(/^\s*\w*Action\(\s*"([^"]+)"/gm)) served.add(`POST ${m[1]}`)
    }
  }
})(join(ROOT, "apps/api/src/modules"))
served.add("GET /health")
served.add("GET /v1/health")
const servedN = new Set([...served].map(norm))

// --- frontend calls --------------------------------------------------------
function collect(dir, exts = [".ts", ".tsx"]) {
  const out = []
  ;(function walk(d) {
    for (const e of readdirSync(d)) {
      const f = join(d, e)
      if (statSync(f).isDirectory()) {
        if (e !== "node_modules") walk(f)
      } else if (exts.some((x) => e.endsWith(x))) out.push(f)
    }
  })(dir)
  return out
}
/**
 * A template path is not a literal. `${id}` is a parameter, but
 * `${publish ? "publish" : "unpublish"}` is a *choice between two real
 * endpoints* — collapsing it to `{}` would report both as uncalled. So:
 * expand every interpolation that contains string literals into one
 * variant per literal, and only then strip the query string (splitting
 * on "?" first would also cut `${session?.id}` in half).
 */
function expandTemplate(raw) {
  let variants = [raw]
  for (let guard = 0; guard < 6; guard++) {
    const next = []
    let changed = false
    for (const v of variants) {
      const m = v.match(/\$\{([^{}]*)\}/)
      if (!m) {
        next.push(v)
        continue
      }
      changed = true
      const literals = [...m[1].matchAll(/["'`]([^"'`]*)["'`]/g)].map((x) => x[1])
      const subs = literals.length > 0 ? literals : ["{}"]
      for (const sub of subs) next.push(v.slice(0, m.index) + sub + v.slice(m.index + m[0].length))
    }
    variants = next
    if (!changed) break
  }
  return variants.map((v) => v.split("?")[0]).filter((v) => v.startsWith("/"))
}

/**
 * A path can also be lifted into a local binding rather than written at
 * the call site — a component parameterised over two collections holds
 * `const collectionPath = scope.kind === "course" ? \`/courses/${id}/quizzes\` : "/assessments"`.
 * Both endpoints are literal, just one hop away, so collect those
 * bindings per file and substitute them back before expanding. Without
 * this the whole surface behind such a binding reads as uncalled.
 */
function pathBindings(text) {
  const bindings = new Map()
  for (const m of text.matchAll(/\bconst\s+(\w+)\s*=\s*([^\n]+)/g)) {
    const [, name, rhs] = m
    const literals = [...rhs.matchAll(/[`"']((?:\/|\$\{)[^`"']*)[`"']/g)].map((x) => x[1])
    if (literals.length > 0) bindings.set(name, literals)
  }
  return bindings
}

const appCalls = new Set()
let bindings = new Map()
const resolveBindings = (raw) => {
  const hit = raw.match(/^\$\{(\w+)\}(.*)$/)
  if (!hit) return [raw]
  const candidates = bindings.get(hit[1])
  return candidates ? candidates.map((c) => c + hit[2]) : [raw]
}
const addApp = (method, raw) =>
  resolveBindings(raw).forEach((one) => expandTemplate(one).forEach((pth) => appCalls.add(`${method} ${pth}`)))
for (const f of collect(join(ROOT, "apps/app/src"))) {
  const t = readFileSync(f, "utf8")
  bindings = pathBindings(t)
  for (const m of t.matchAll(/api(?:Get|GetPaged)\s*(?:<[^<>]*(?:<[^<>]*>)?[^<>]*>)?\s*\(\s*`([^`]+)`/g))
    addApp("GET", m[1])
  for (const m of t.matchAll(/api(?:Get|GetPaged)\s*(?:<[^<>]*(?:<[^<>]*>)?[^<>]*>)?\s*\(\s*"([^"]+)"/g))
    addApp("GET", m[1])
  for (const m of t.matchAll(
    /apiSend\s*(?:<[^<>]*(?:<[^<>]*>)?[^<>]*>)?\s*\(\s*"(POST|PATCH|PUT|DELETE)"\s*,\s*`([^`]+)`/g
  ))
    addApp(m[1], m[2])
  for (const m of t.matchAll(
    /apiSend\s*(?:<[^<>]*(?:<[^<>]*>)?[^<>]*>)?\s*\(\s*"(POST|PATCH|PUT|DELETE)"\s*,\s*"([^"]+)"/g
  ))
    addApp(m[1], m[2])
  // The path handed over as a bare binding rather than written inline.
  // Wrapped back into an interpolation so it takes the same resolve path
  // a leading `${binding}` in a template would.
  for (const m of t.matchAll(
    /apiSend\s*(?:<[^<>]*(?:<[^<>]*>)?[^<>]*>)?\s*\(\s*"(POST|PATCH|PUT|DELETE)"\s*,\s*([A-Za-z_$][\w$]*)\s*[,)]/g
  ))
    addApp(m[1], "${" + m[2] + "}")
  // lib/uploads.ts hand-rolls XHR for byte-level progress, so it never
  // goes through apiSend.
  for (const m of t.matchAll(/xhr\.open\(\s*"(GET|POST|PATCH|PUT|DELETE)"\s*,\s*[`"][^`"]*\/v1([^`"]+)[`"]/g))
    addApp(m[1], m[2])
  // Raw fetch, which carries its method in the options object rather
  // than in the call position an API helper would use.
  for (const m of t.matchAll(/fetch\(\s*`\$\{API_URL\}\/v1([^`]+)`\s*(?:,\s*\{([^}]*)\})?/g)) {
    const method = m[2]?.match(/method:\s*"(GET|POST|PATCH|PUT|DELETE)"/)?.[1] ?? "GET"
    addApp(method, m[1])
  }
}
/** Runtime-dispatched action segments: a union type picks the segment,
 *  so no literal appears at the call site. Listed here so the endpoints
 *  they reach aren't reported as dead. */
const DYNAMIC_ACTIONS = {
  "POST /announcements/{}/{}": ["publish", "pin", "unpin"],
  "POST /discussions/{}/{}": ["pin", "unpin", "resolve", "unresolve", "close", "reopen"],
}
for (const [pattern, actions] of Object.entries(DYNAMIC_ACTIONS)) {
  if (appCalls.has(pattern) || [...appCalls].some((c) => norm(c) === pattern)) {
    appCalls.delete(pattern)
    for (const c of [...appCalls]) {
      if (norm(c) === pattern) appCalls.delete(c)
    }
    const base = pattern.replace(/\/\{\}$/, "")
    for (const a of actions) appCalls.add(`${base}/${a}`)
  }
}
const appN = new Set([...appCalls].map(norm))

const webCalls = new Set()
for (const f of collect(join(ROOT, "apps/web/src"))) {
  const t = readFileSync(f, "utf8")
  for (const m of t.matchAll(/fetch\(\s*`\$\{VITE_API_URL\}\/v1([^`]+)`/g))
    expandTemplate(m[1]).forEach((pth) => webCalls.add(`GET ${pth}`))
}
const webN = new Set([...webCalls].map(norm))

// --- report ----------------------------------------------------------------
const byTag = new Map()
for (const op of ops) {
  const key = `${op.method} ${op.path}`
  const n = norm(key)
  const row = { ...op, served: servedN.has(n), app: appN.has(n), web: webN.has(n) }
  const domain = op.path.split("/")[1] || "root"
  row.tag = domain
  if (!byTag.has(domain)) byTag.set(domain, [])
  byTag.get(domain).push(row)
}
let tot = 0,
  srv = 0,
  inApp = 0,
  inWeb = 0,
  orphan = []
console.log(
  "DOMAIN".padEnd(26),
  "OPS".padStart(4),
  "SERVED".padStart(7),
  "APP".padStart(5),
  "WEB".padStart(5),
  "  GAPS"
)
for (const [tag, rows] of [...byTag].sort((a, b) => a[0].localeCompare(b[0]))) {
  const s = rows.filter((r) => r.served).length
  const a = rows.filter((r) => r.app).length
  const w = rows.filter((r) => r.web).length
  tot += rows.length
  srv += s
  inApp += a
  inWeb += w
  const gaps = rows.filter((r) => r.served && !r.app && !r.web).length
  console.log(
    tag.padEnd(26),
    String(rows.length).padStart(4),
    String(s).padStart(7),
    String(a).padStart(5),
    String(w).padStart(5),
    gaps ? `  ${gaps}` : ""
  )
  for (const r of rows) if (r.served && !r.app && !r.web) orphan.push(`${r.tag}: ${r.method} ${r.path}`)
}
console.log("-".repeat(50))
console.log(
  "TOTAL".padEnd(26),
  String(tot).padStart(4),
  String(srv).padStart(7),
  String(inApp).padStart(5),
  String(inWeb).padStart(5)
)
console.log(`\nSERVED BUT NO FRONTEND CALLER (${orphan.length}):`)
for (const o of orphan) console.log("  " + o)
console.log(`\napps/app distinct endpoint calls: ${appN.size}`)
console.log(`apps/web distinct endpoint calls: ${webN.size}`)
const unmatched = [...appN].filter((c) => !ops.some((o) => norm(`${o.method} ${o.path}`) === c))
console.log(`\napp calls with NO contract match (${unmatched.length}):`)
for (const u of unmatched.sort()) console.log("  " + u)
