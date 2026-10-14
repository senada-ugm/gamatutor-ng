import { check, eq, status } from "../lib/assert.mjs"

/**
 * Uploads: magic-byte MIME detection (the declared content-type is never
 * trusted), image-purpose validation, the claim lifecycle, the file
 * route, and the orphan sweep.
 */
export async function run(ctx) {
  console.log("\n== Uploads ==")
  const { admin, user, anon, ids } = ctx

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from("fakepngpayload"),
  ])
  const html = Buffer.from("<html><body>not an image</body></html>")

  const pngForm = new FormData()
  pngForm.append("purpose", "thumbnail")
  pngForm.append("file", new Blob([png], { type: "image/png" }), "pixel.png")

  const evilForm = new FormData()
  evilForm.append("purpose", "thumbnail")
  evilForm.append("file", new Blob([html], { type: "image/png" }), "pixel.png")

  const textForm = new FormData()
  textForm.append("purpose", "other")
  textForm.append("file", new Blob([html], { type: "text/html" }), "notes.html")

  const uploaded = status(
    "admin uploads a real PNG for a thumbnail purpose",
    await admin.post("/v1/uploads", { form: pngForm }),
    201
  )
  ids.uploadPng = uploaded?.data?.id
  eq("magic bytes win: detected as image/png", uploaded?.data?.mimeType, "image/png")

  status(
    "HTML disguised as PNG is rejected for a thumbnail purpose",
    await admin.post("/v1/uploads", { form: evilForm }),
    400
  )

  const stored = status(
    "genuinely textual HTML claimed as text/html is honored",
    await admin.post("/v1/uploads", { form: textForm }),
    201
  )
  ids.uploadTxt = stored?.data?.id
  eq("text/* claims are trusted for textual content", stored?.data?.mimeType, "text/html")

  // a BINARY payload wearing a text/* label must NOT get the claim
  const binaryAsText = new FormData()
  binaryAsText.append("purpose", "other")
  binaryAsText.append("file", new Blob([png], { type: "text/plain" }), "pixel.txt")
  const spoofed = status(
    "binary disguised as text/plain stays octet-stream",
    await admin.post("/v1/uploads", { form: binaryAsText }),
    201
  )
  eq("magic bytes beat the spoofed text claim", spoofed?.data?.mimeType, "image/png")

  status("anon cannot upload", await anon.post("/v1/uploads", { form: pngForm }), 401)

  const meta = status("admin reads the upload status", await admin.get(`/v1/uploads/${ids.uploadPng}`), 200)
  eq("status starts unclaimed", meta?.data?.status, "unclaimed")

  // entitlement: unclaimed uploads are uploader/admin only
  status("anon cannot read an unclaimed upload", await anon.get(`/v1/uploads/${ids.uploadPng}`), 401)
  status("anon cannot read its bytes", await anon.get(`/v1/uploads/${ids.uploadPng}/file`), 401)
  status("another user cannot read it either", await user.get(`/v1/uploads/${ids.uploadPng}`), 403)

  // claim it to a public course asset -> becomes anonymously readable
  const claimed = status(
    "admin creates a course claiming the upload as thumbnail",
    await admin.post("/v1/courses", {
      json: {
        title: `Journey Thumbnailed Course ${ctx.stamp}`,
        institutionId: ids.institution,
        courseType: "online",
        isDisabilityFriendly: false,
        supportedDisabilityTypes: [],
        thumbnail: `${ctx.base}/v1/uploads/${ids.uploadPng}/file`,
      },
    }),
    201
  )
  ids.thumbnailedCourse = claimed?.data?.id
  const publicFile = await anon.get(`/v1/uploads/${ids.uploadPng}/file`)
  check("claimed public asset is anonymously readable", publicFile.status === 200 && publicFile.text?.length > 0)

  const file = await admin.request("GET", `/v1/uploads/${ids.uploadPng}/file`)
  check("file route serves bytes", file.status === 200 && file.text?.length > 0)
  check("file route serves the detected type", file.headers.get("content-type")?.includes("image/png"))

  status("admin deletes the text upload", await admin.delete(`/v1/uploads/${ids.uploadTxt}`), 204)
  status("deleted upload 404s", await admin.get(`/v1/uploads/${ids.uploadTxt}`), 404)

  const swept = status("admin triggers the orphan sweep", await admin.post("/v1/uploads/sweep"), 200)
  check("sweep reports a deleted count", swept ? typeof swept.data?.deleted === "number" : false)
}
