/**
 * Minimal persona-scoped HTTP client for the API journey tests.
 *
 * A "persona" is a cookie jar: sign in once via Better Auth and every
 * later request rides that session — the same HTTP surface a browser
 * sees, without a browser. Every request is recorded into the coverage
 * tracker (see coverage.mjs) so the runner can assert the journey touched
 * every contract operation.
 */

/** Normalizes a concrete request path to the OpenAPI path template:
 *  `/enrollments/enr_0c6f...` -> `/enrollments/{*}` so actual calls can be
 *  compared against contract paths (whose params have names like {id}). */
export function normalizePath(path) {
  return path
    .split("?")[0]
    .replace(/^\/v1(?=\/)/, "") // contract paths are published without the /v1 mount prefix
    .replace(/\{[^/}]+\}/g, "{*}")
    .replace(/\/[a-z]{2,5}_[0-9a-f]{12,}/gi, "/{*}")
}

export function createClient({ base, cookies = new Map(), label = "client", coverage, origin }) {
  async function request(method, path, { json, form } = {}) {
    const headers = {}
    if (origin) headers.origin = origin // Better Auth's CSRF check requires the web-app origin
    if (cookies.size > 0) {
      headers.cookie = [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ")
    }
    let body
    if (form) {
      body = form // FormData sets its own content-type + boundary
    } else if (json !== undefined) {
      headers["content-type"] = "application/json"
      body = JSON.stringify(json)
    }

    const res = await fetch(base + path, { method, headers, body, redirect: "manual" })

    // Better Auth sets the session cookie on sign-in — keep the jar warm.
    for (const cookie of res.headers.getSetCookie?.() ?? []) {
      const pair = cookie.split(";")[0]
      const eq = pair.indexOf("=")
      if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
    }

    coverage?.record(method, path)

    const text = await res.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = null // binary/stream endpoints (e.g. the upload file route)
    }
    return { status: res.status, body: data, text, headers: res.headers }
  }

  return {
    label,
    request,
    get: (path, opts) => request("GET", path, opts),
    post: (path, opts) => request("POST", path, opts),
    patch: (path, opts) => request("PATCH", path, opts),
    delete: (path, opts) => request("DELETE", path, opts),
  }
}
