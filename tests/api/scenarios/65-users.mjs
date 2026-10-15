import { check, eq, status } from "../lib/assert.mjs"

/**
 * Users (admin-only surface): listing/search, suspend with reason,
 * double-suspend conflict, and reactivation. Runs last — suspending the
 * user persona would interfere with every earlier scenario.
 */
export async function run(ctx) {
  console.log("\n== Users ==")
  const { admin, user, anon, ids } = ctx

  const list = status("admin lists users", await admin.get("/v1/users?pageSize=10"), 200)
  check("list is paginated with a total count", typeof list?.pagination?.totalCount === "number")
  status("admin filters by status=active", await admin.get("/v1/users?status=active"), 200)
  status("plain user cannot list accounts", await user.get("/v1/users"), 403)
  status("anon cannot list accounts", await anon.get("/v1/users"), 401)

  const got = status("admin fetches the user account", await admin.get(`/v1/users/${ids.userId}`), 200)
  eq("account is active before suspension", got?.data?.status, "active")

  const suspended = status(
    "admin suspends the user",
    await admin.post(`/v1/users/${ids.userId}/suspend`, { json: { reason: "journey test" } }),
    200
  )
  eq("status flips to suspended", suspended?.data?.status, "suspended")
  status(
    "double-suspend conflicts",
    await admin.post(`/v1/users/${ids.userId}/suspend`, { json: { reason: "again" } }),
    409
  )

  const reactivated = status("admin reactivates the user", await admin.post(`/v1/users/${ids.userId}/reactivate`), 200)
  eq("status returns to active", reactivated?.data?.status, "active")
  status("reactivating an active account conflicts", await admin.post(`/v1/users/${ids.userId}/reactivate`), 409)

  // Suspension revoked the user persona's Better Auth session — sign
  // them back in so later scenarios authenticate as the plain user
  // again.
  status(
    "user re-signs in after reactivation",
    await user.post("/api/auth/sign-in/email", {
      json: { email: "user@lms.dev", password: process.env.LMS_TEST_PASSWORD ?? "correcthorsebatterystaple" },
    }),
    200
  )
}
