import { check, eq, status } from "../lib/assert.mjs"

/**
 * Cross-cutting reads: batched user capabilities (the admin panel's
  badge source), the instructor's own assignment list, and the
  participant self-profile update.
 */
export async function run(ctx) {
  console.log("\n== Capabilities & Profiles ==")
  const { admin, owner, user, anon, ids } = ctx

  const caps = status(
    "admin batches user capabilities",
    await admin.get(`/v1/users/user-capabilities?userIds=${ids.adminId},${ids.ownerId},${ids.userId}`),
    200
  )
  const byUser = new Map((caps?.data ?? []).map((c) => [c.userId, c]))
  eq("three capability rows returned", caps?.data?.length, 3)
  check("owner holds institution ownerships", (byUser.get(ids.ownerId)?.ownedInstitutionIds ?? []).length >= 1)
  status(
    "plain user cannot batch capabilities",
    await user.get(`/v1/users/user-capabilities?userIds=${ids.userId}`),
    403
  )

  const mine = status("owner lists their instructor assignments", await owner.get("/v1/course-instructors/mine"), 200)
  check("mine returns a list", Array.isArray(mine?.data))

  // password recovery endpoints are live (the emailed link's delivery is
  // env-gated; here we prove the request succeeds and a bad token is refused)
  status(
    "user requests a password reset",
    await user.post("/api/auth/request-password-reset", {
      json: { email: "user@lms.dev", redirectTo: "http://localhost:3030/reset-password" },
    }),
    200
  )
  status(
    "reset with a bogus token is refused",
    await anon.post("/api/auth/reset-password", {
      json: { newPassword: "not-the-real-token", token: "bogus-token" },
    }),
    400
  )

  const profile = status(
    "user updates their participant profile",
    await user.patch(`/v1/participant-profiles/${ids.userId}`, {
      json: { about: `Journey profile ${ctx.stamp}`, phone: "081200000000" },
    }),
    200
  )
  eq("about persisted", profile?.data?.about, `Journey profile ${ctx.stamp}`)
  const reread = status("user re-reads their profile", await user.get(`/v1/participant-profiles/${ids.userId}`), 200)
  eq("phone persisted", reread?.data?.phone, "081200000000")

  const batchProfiles = status(
    "admin batches participant profiles",
    await admin.get(`/v1/participant-profiles?userIds=${ids.userId}`),
    200
  )
  check("batch profiles returns an array", Array.isArray(batchProfiles?.data))

  // attempt reset: managers can delete an attempt outright (e.g. a
  // learner stuck in a stale in-progress attempt)
  const quiz = status(
    "admin creates a throwaway quiz",
    await admin.post(`/v1/courses/${ids.course}/quizzes`, {
      json: { title: `Journey Reset Quiz ${ctx.stamp}`, maxAttempts: 1 },
    }),
    201
  )
  const attempt = status("user starts an attempt", await user.post(`/v1/quizzes/${quiz?.data?.id}/attempts`), 201)
  status("max-attempts reached blocks a second start", await user.post(`/v1/quizzes/${quiz?.data?.id}/attempts`), 409)

  // the essay grading queue: scope=all lists EVERY participant's
  // attempts with display names — managers only
  const allAttempts = status(
    "admin lists all attempts (grading queue)",
    await admin.get(`/v1/quizzes/${quiz?.data?.id}/attempts?scope=all`),
    200
  )
  check(
    "queue carries the attempt owner",
    (allAttempts?.data ?? []).some((a) => a.user?.email === "user@lms.dev")
  )
  const ownAttempts = status(
    "default scope stays the caller's own",
    await user.get(`/v1/quizzes/${quiz?.data?.id}/attempts`),
    200
  )
  check(
    "learner sees only their own attempts",
    (ownAttempts?.data ?? []).every((a) => a.userId === ids.userId)
  )
  status(
    "learner cannot request the full queue",
    await user.get(`/v1/quizzes/${quiz?.data?.id}/attempts?scope=all`),
    403
  )

  status("plain user cannot reset an attempt", await user.delete(`/v1/quiz-attempts/${attempt?.data?.id}`), 403)
  status("admin resets the attempt", await admin.delete(`/v1/quiz-attempts/${attempt?.data?.id}`), 204)
  status("user can start again after the reset", await user.post(`/v1/quizzes/${quiz?.data?.id}/attempts`), 201)
}
