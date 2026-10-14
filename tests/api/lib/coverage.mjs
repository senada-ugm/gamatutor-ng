/**
 * Contract coverage: loads the served OpenAPI document, derives the full
 * operation set (METHOD + normalized path), and lets the client record
 * which operations the journey actually touched. The runner fails if any
 * contract operation was never exercised — a new endpoint without a
 * journey scenario can't sneak in untested.
 */
import { normalizePath } from "./http.mjs"

export async function loadContractOps(base) {
  const res = await fetch(base + "/openapi.json")
  if (!res.ok) throw new Error(`GET /openapi.json failed: ${res.status}`)
  const spec = await res.json()
  const methods = new Set(["get", "post", "patch", "delete", "put"])
  const ops = new Set()
  for (const [path, pathOps] of Object.entries(spec.paths ?? {})) {
    for (const method of Object.keys(pathOps)) {
      if (methods.has(method)) ops.add(method.toUpperCase() + " " + normalizePath(path))
    }
  }
  return ops
}

export function createCoverage() {
  const called = new Set()
  return {
    record(method, path) {
      // skip non-contract surfaces: Better Auth, docs, the served spec
      if (/^\/(api\/|docs|openapi\.json)/.test(path)) return
      called.add(method.toUpperCase() + " " + normalizePath(path))
    },
    report(contractOps) {
      const missing = [...contractOps].filter((op) => !called.has(op)).sort()
      return { called: called.size, missing }
    },
  }
}
