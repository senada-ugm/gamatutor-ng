import { check, eq, status } from "../lib/assert.mjs"

/**
 * Attendance: session lifecycle (create -> activate with code
 * verification -> check-in), the brute-force lockout on wrong codes,
 * manager-only privacy for verification fields, roster, and manual
 * records.
 */
export async function run(ctx) {
  console.log("\n== Attendance ==")
  const { admin, user, anon, ids } = ctx
  const sessionDate = new Date().toISOString().slice(0, 10) + "T08:00:00.000Z"

  const session = status(
    "admin creates session A",
    await admin.post(`/v1/courses/${ids.course}/attendance-sessions`, {
      json: { title: "Journey Session A", sessionDate },
    }),
    201
  )
  ids.sessionA = session?.data?.id
  const sessionB = status(
    "admin creates session B (lockout target)",
    await admin.post(`/v1/courses/${ids.course}/attendance-sessions`, {
      json: { title: "Journey Session B", sessionDate },
    }),
    201
  )
  ids.sessionB = sessionB?.data?.id

  status("admin lists the course's sessions", await admin.get(`/v1/courses/${ids.course}/attendance-sessions`), 200)
  status(
    "admin updates session A's title",
    await admin.patch(`/v1/attendance-sessions/${ids.sessionA}`, { json: { title: "Journey Session A (renamed)" } }),
    200
  )
  status("anon cannot list sessions", await anon.get(`/v1/courses/${ids.course}/attendance-sessions`), 401)

  const activated = status(
    "admin activates session A with code verification",
    await admin.post(`/v1/attendance-sessions/${ids.sessionA}/activate`, { json: { verificationMethod: "code" } }),
    200
  )
  const code = activated?.data?.verificationCode
  check("activated session exposes the code to the manager", /^\d{6}$/.test(code ?? ""))
  status(
    "admin activates session B",
    await admin.post(`/v1/attendance-sessions/${ids.sessionB}/activate`, { json: { verificationMethod: "code" } }),
    200
  )

  const asUser = status("user fetches session A", await user.get(`/v1/attendance-sessions/${ids.sessionA}`), 200)
  check(
    "verification code is manager-only (hidden from learners)",
    asUser ? asUser.data?.verificationCode === undefined : false
  )

  // lockout: five wrong codes trip the per-(session, user) attempt tracker
  let lockMessage = ""
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await user.post(`/v1/attendance-sessions/${ids.sessionB}/check-in`, { json: { code: "000000" } })
    check(`wrong code attempt ${attempt} is rejected`, res.status === 403, `got ${res.status}`)
    if (res.body?.error?.message) lockMessage = res.body.error.message
  }
  check("lockout message mentions the lock", /locked/i.test(lockMessage), lockMessage)

  // the real check-in on session A with the correct code
  const checkedIn = status(
    "user checks in to session A",
    await user.post(`/v1/attendance-sessions/${ids.sessionA}/check-in`, { json: { code } }),
    200
  )
  ids.attendanceUserId = checkedIn?.data?.userId
  const mine = status(
    "user reads their own record",
    await user.get(`/v1/attendance-sessions/${ids.sessionA}/my-record`),
    200
  )
  eq("my-record matches the check-in", mine?.data?.id, checkedIn?.data?.id)
  status(
    "anon cannot check in",
    await anon.post(`/v1/attendance-sessions/${ids.sessionA}/check-in`, { json: { code } }),
    401
  )

  // roster + manual records
  const roster = status(
    "admin reads the session roster",
    await admin.get(`/v1/attendance-sessions/${ids.sessionA}/roster`),
    200
  )
  check(
    "roster includes the enrolled user",
    roster?.data?.some((r) => r.user?.id === ids.userId)
  )
  const marked = status(
    "admin manually marks the user present",
    await admin.patch(`/v1/attendance-sessions/${ids.sessionA}/records/${ids.userId}`, { json: { status: "present" } }),
    200
  )
  eq("manual record status applied", marked?.data?.status, "present")
}
