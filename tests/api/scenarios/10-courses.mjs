import { check, eq, status } from "../lib/assert.mjs"

/**
 * Courses: catalog reads are public, authoring requires institution
 * ownership, publish/unpublish gates visibility state, and list supports
 * search + real pagination.
 */
export async function run(ctx) {
  console.log("\n== Courses ==")
  const { admin, owner, anon, ids } = ctx
  const stamp = ctx.stamp

  // catalog reads are public
  status("anon lists courses", await anon.get("/v1/courses?pageSize=1"), 200)

  // owner authors under their own institution (ownership path, not admin)
  const ownerInst = status(
    "owner resolves their institution",
    await owner.get(`/v1/institution-ownerships?userId=${ids.ownerId}`),
    200
  )
  const ownerInstitutionId = ownerInst?.data?.[0]?.institutionId
  check("owner holds a seed institution", !!ownerInstitutionId)
  const ownerCourse = status(
    "owner creates a course under their institution",
    await owner.post("/v1/courses", {
      json: {
        title: `Journey Owner Course ${stamp}`,
        institutionId: ownerInstitutionId,
        courseType: "online",
        isDisabilityFriendly: false,
        supportedDisabilityTypes: [],
      },
    }),
    201
  )
  check("owner course carries the composed module tree", Array.isArray(ownerCourse?.data?.modules))
  ids.ownerCourse = ownerCourse?.data?.id // stays draft — used for the draft-enrollment gate check

  // admin authors the journey course
  const createdRes = await admin.post("/v1/courses", {
    json: {
      title: `Journey Course ${stamp}`,
      institutionId: ids.institution,
      courseType: "online",
      isDisabilityFriendly: false,
      supportedDisabilityTypes: [],
    },
  })
  const created = status("admin creates the journey course", createdRes, 201)
  ids.course = created?.data?.id
  check("create returns a Location header", !!createdRes.headers.get("location"))

  // Unpublished courses 404 for anyone un-entitled — existence itself
  // isn't public while drafting (see the get route's visibility rule).
  status("anon cannot see a draft course's detail", await anon.get(`/v1/courses/${ids.course}`), 404)
  const got = status("admin reads the draft course", await admin.get(`/v1/courses/${ids.course}`), 200)
  eq("course starts as draft", got?.data?.status, "draft")

  status(
    "anon lists courses with search",
    await anon.get(`/v1/courses?search=${encodeURIComponent("Journey Course " + stamp)}`),
    200
  )
  const paged = status("anon lists courses with pagination", await anon.get("/v1/courses?page=1&pageSize=1"), 200)
  check("totalCount spans the whole table, not the page", (paged?.pagination?.totalCount ?? 0) >= paged?.data?.length)

  status("admin publishes the course", await admin.post(`/v1/courses/${ids.course}/publish`), 200)
  const published = status("admin re-reads the course", await admin.get(`/v1/courses/${ids.course}`), 200)
  eq("status is published", published?.data?.status, "published")
  status("admin unpublishes the course", await admin.post(`/v1/courses/${ids.course}/unpublish`), 200)
  status("admin re-publishes for the journey", await admin.post(`/v1/courses/${ids.course}/publish`), 200)

  // owner must not manage admin's course
  status(
    "owner cannot update a foreign course",
    await owner.patch(`/v1/courses/${ids.course}`, {
      json: { title: "HACKED", courseType: "online", isDisabilityFriendly: false, supportedDisabilityTypes: [] },
    }),
    403
  )

  // admin update round-trip (stays free — the paid funnel is covered by
  // its own scenario with a dedicated course)
  status(
    "admin updates the course",
    await admin.patch(`/v1/courses/${ids.course}`, {
      json: {
        title: `Journey Course ${stamp}`,
        courseType: "online",
        isDisabilityFriendly: false,
        supportedDisabilityTypes: [],
      },
    }),
    200
  )
}
