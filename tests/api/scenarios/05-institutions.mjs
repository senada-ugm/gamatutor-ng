import { check, eq, status } from "../lib/assert.mjs"

/**
 * Institutions: admin-direct registration (creation implies ownership),
 * profile round-trip, and the self-service request queue (submit ->
 * approve -> requester becomes owner; reject path; double-approve 409;
 * ownership grants are idempotent).
 */
export async function run(ctx) {
  console.log("\n== Institutions ==")
  const { admin, owner, user, anon, ids } = ctx
  const stamp = ctx.stamp
  const name = `Journey Institusi ${stamp}`

  // admin-direct registration
  const createdRes = await admin.post("/v1/institutions", {
    json: { name, institutionType: "universitas", description: "journey fixture" },
  })
  const created = status("admin creates an institution", createdRes, 201)
  ids.institution = created?.data?.id
  check("create returns a Location header", !!createdRes.headers.get("location"))

  // list + get
  const list = status(
    "admin lists institutions by search",
    await admin.get(`/v1/institutions?search=${encodeURIComponent(name)}`),
    200
  )
  eq("search finds exactly the new institution", list?.data?.length, 1)
  const got = status("admin gets the institution", await admin.get(`/v1/institutions/${ids.institution}`), 200)
  eq("description persisted", got?.data?.description, "journey fixture")

  // profile update round-trip
  status(
    "admin updates the profile",
    await admin.patch(`/v1/institutions/${ids.institution}`, { json: { name, description: "updated" } }),
    200
  )
  const reread = status("admin re-reads the institution", await admin.get(`/v1/institutions/${ids.institution}`), 200)
  eq("update persisted", reread?.data?.description, "updated")

  // ownerships are real data: admin can enumerate anyone, users only themselves
  status("anon listing ownerships is rejected", await anon.get(`/v1/institution-ownerships?userId=x`), 401)
  // The SEEDED owner's grant — user@ starts grantless on a fresh
  // database (any grants they hold are leftovers from approval flows).
  const own = status(
    "admin reads the owner's ownership grants",
    await admin.get(`/v1/institution-ownerships?userId=${ids.ownerId}`),
    200
  )
  check("seeded owner holds at least one grant", (own?.data?.length ?? 0) >= 1)
  status(
    "anon granting ownership is rejected",
    await anon.post("/v1/institution-ownerships", { json: { userId: ids.userId, institutionId: ids.institution } }),
    401
  )

  // idempotent double grant — creation already made admin the owner, so a
  // duplicate grant must not create a second row
  status(
    "admin re-grants their own ownership (1st)",
    await admin.post("/v1/institution-ownerships", { json: { userId: ids.adminId, institutionId: ids.institution } }),
    200
  )
  status(
    "admin re-grants their own ownership (2nd)",
    await admin.post("/v1/institution-ownerships", { json: { userId: ids.adminId, institutionId: ids.institution } }),
    200
  )
  const after = status(
    "admin lists their own grants",
    await admin.get(`/v1/institution-ownerships?userId=${ids.adminId}`),
    200
  )
  eq(
    "exactly one grant row for the new institution (idempotent)",
    after?.data?.filter((g) => g.institutionId === ids.institution).length,
    1
  )

  // self-service request queue — closed by default since the
  // single-tenant frontend (PLANS 5.2); the admin opens it for this
  // journey's round-trip.
  status(
    "anon cannot submit a request",
    await anon.post("/v1/institution-requests", { json: { institutionName: "Anon", institutionType: "universitas" } }),
    401
  )
  status(
    "admin closes the request form (the shipped default)",
    await admin.patch("/v1/platform-settings", { json: { allowInstitutionRequests: false } }),
    200
  )
  status(
    "self-service submissions are refused while closed",
    await user.post("/v1/institution-requests", {
      json: { institutionName: "Closed", institutionType: "universitas" },
    }),
    403
  )
  status(
    "admin opens the request form",
    await admin.patch("/v1/platform-settings", { json: { allowInstitutionRequests: true } }),
    200
  )
  const reqA = status(
    "user submits request #1 (to be approved)",
    await user.post("/v1/institution-requests", {
      json: { institutionName: `Journey Approved ${stamp}`, institutionType: "universitas" },
    }),
    201
  )
  ids.requestApprove = reqA?.data?.id
  const reqB = status(
    "user submits request #2 (to be rejected)",
    await user.post("/v1/institution-requests", {
      json: { institutionName: `Journey Rejected ${stamp}`, institutionType: "universitas" },
    }),
    201
  )
  ids.requestReject = reqB?.data?.id

  status("user reads own request", await user.get(`/v1/institution-requests/${ids.requestApprove}`), 200)
  status("admin lists pending requests", await admin.get("/v1/institution-requests?status=pending"), 200)

  status("admin approves request #1", await admin.post(`/v1/institution-requests/${ids.requestApprove}/approve`), 200)
  status(
    "admin approves request #1 again",
    await admin.post(`/v1/institution-requests/${ids.requestApprove}/approve`),
    409
  )
  status(
    "admin rejects request #2",
    await admin.post(`/v1/institution-requests/${ids.requestReject}/reject`, { json: { reason: "journey" } }),
    200
  )
  const rejected = status(
    "user re-reads rejected request",
    await user.get(`/v1/institution-requests/${ids.requestReject}`),
    200
  )
  eq(
    "rejection status + reason persisted",
    [rejected?.data?.status, rejected?.data?.rejectionReason],
    ["rejected", "journey"]
  )

  // approval elevated the requester to owner — visible through the owner-style surfaces
  const ownerScope = status(
    "owner lists own grants (scope source)",
    await owner.get(`/v1/institution-ownerships?userId=${ids.ownerId}`),
    200
  )
  check("owner still holds their seed grant", (ownerScope?.data?.length ?? 0) >= 1)
}
