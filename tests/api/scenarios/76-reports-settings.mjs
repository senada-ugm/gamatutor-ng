import { check, eq, status } from "../lib/assert.mjs"

/**
 * Manager/admin analytics + platform configuration: course report,
 * admin overview, financial summary, platform settings round-trip.
 */
export async function run(ctx) {
  console.log("\n== Reports & Platform Settings ==")
  const { admin, user, anon, ids } = ctx

  const report = status("admin reads the course report", await admin.get(`/v1/courses/${ids.course}/report`), 200)
  check("report lists participants", (report?.data?.participants ?? []).length >= 1)
  check(
    "report carries attendance aggregates",
    typeof report?.data?.participants?.[0]?.attendance?.sessionsCount === "number"
  )
  status("plain user cannot read the course report", await user.get(`/v1/courses/${ids.course}/report`), 403)

  const instReport = status(
    "admin reads the institution report",
    await admin.get(`/v1/institutions/${ids.institution}/report`),
    200
  )
  check("institution report carries course aggregates", Array.isArray(instReport?.data?.byCourse))
  status(
    "plain user cannot read the institution report",
    await user.get(`/v1/institutions/${ids.institution}/report`),
    403
  )

  const ordersCsv = await admin.get(`/v1/institutions/${ids.institution}/orders/export`)
  check("institution orders export returns CSV", ordersCsv.status === 200)

  const overview = status("admin reads the platform overview", await admin.get("/v1/admin/overview"), 200)
  check("overview counts users", (overview?.data?.totalUsers ?? 0) >= 3)
  status("plain user cannot read the overview", await user.get("/v1/admin/overview"), 403)
  const financial = status("admin reads the financial summary", await admin.get("/v1/admin/financial-summary"), 200)
  check("financial summary counts the refunded order", (financial?.data?.refundedOrders ?? 0) >= 1)

  const settings = status("admin reads platform settings", await admin.get("/v1/platform-settings"), 200)
  const originalName = settings?.data?.platformName
  const patched = status(
    "admin updates platform settings",
    await admin.patch("/v1/platform-settings", { json: { platformName: `Journey ${ctx.stamp}` } }),
    200
  )
  eq("platform name patched", patched?.data?.platformName, `Journey ${ctx.stamp}`)
  const restored = status(
    "admin restores platform settings",
    await admin.patch("/v1/platform-settings", { json: { platformName: originalName } }),
    200
  )
  eq("platform name restored", restored?.data?.platformName, originalName)
  status(
    "plain user cannot patch settings",
    await user.patch("/v1/platform-settings", { json: { platformName: "HACKED" } }),
    403
  )

  // Maintenance mode is ENFORCED: business routes 503 for non-admins,
  // admins bypass, and the auth + health surfaces stay up.
  const flags = status("admin reads current flags", await admin.get("/v1/platform-settings"), 200)
  const wasOn = flags?.data?.maintenanceMode === true
  if (!wasOn) {
    status(
      "admin enables maintenance mode",
      await admin.patch("/v1/platform-settings", { json: { maintenanceMode: true } }),
      200
    )
  }
  status("health stays up during maintenance", await anon.get("/health"), 200)
  // the auth surface stays up (session read through Better Auth, which
  // is exempt) — no extra sign-in here: the internal rate limiter counts
  // them and the journey already signs in its personas
  const sessionOk = await user.get("/api/auth/get-session")
  check("auth stays up during maintenance", sessionOk.status === 200)
  status("business routes 503 for non-admins", await user.get("/v1/courses?pageSize=1"), 503)
  status("admins bypass maintenance", await admin.get("/v1/courses?pageSize=1"), 200)
  if (!wasOn) {
    status(
      "admin disables maintenance mode",
      await admin.patch("/v1/platform-settings", { json: { maintenanceMode: false } }),
      200
    )
    status("business routes recover", await user.get("/v1/courses?pageSize=1"), 200)
  }
}
