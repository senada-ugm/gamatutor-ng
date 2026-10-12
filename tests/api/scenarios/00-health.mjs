import { check, eq, status } from "../lib/assert.mjs"

export async function run(ctx) {
  console.log("\n== Health ==")
  const res = status("GET /health", await ctx.anon.get("/health"), 200)
  eq("health status is ok", res?.data?.status, "ok")
  check("health timestamp parses", !Number.isNaN(Date.parse(res?.data?.timestamp ?? "")))
}
