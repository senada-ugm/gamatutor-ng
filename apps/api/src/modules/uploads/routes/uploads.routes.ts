import type { UploadsApiCreateResponse, UploadsApiGetResponse } from "@workspace/contracts"
import type { FastifyInstance } from "fastify"
import { BadRequestError } from "../../../lib/errors.js"
import { requireAdmin } from "../../../lib/require-admin.js"
import { getOptionalSession, requireSession } from "../../../lib/require-session.js"
import { dataResponse } from "../../../lib/response.js"
import { readStoredFile } from "../../../lib/storage.js"
import * as service from "../services/uploads.service.js"

/**
 * Registered inside modules/uploads/index.ts's scoped sub-plugin, which is
 * where @fastify/multipart is registered too — see that file's comment
 * for why (it's fastify-plugin-wrapped and doesn't create its own scope).
 */
export function uploadsRoutes(app: FastifyInstance) {
  app.post("/uploads", async (request, reply): Promise<UploadsApiCreateResponse> => {
    const user = await requireSession(request)

    let purpose: string | undefined
    let created: Awaited<ReturnType<typeof service.storeUpload>> | undefined

    // @fastify/multipart's module augmentation of FastifyRequest is
    // present in the plugin's types but stopped merging into the
    // request type after the latest fastify bump — re-apply it locally.
    for await (const part of (
      request as import("fastify").FastifyRequest & {
        parts(): AsyncIterableIterator<import("@fastify/multipart").Multipart>
      }
    ).parts()) {
      if (part.type === "field" && part.fieldname === "purpose") {
        purpose = String(part.value)
        continue
      }
      if (part.type === "file" && part.fieldname === "file") {
        if (!purpose) {
          // Field order matters to busboy — the client must send
          // `purpose` before `file`, or we hit this with nothing to
          // tag the upload with. Drain the stream so the request
          // doesn't hang, then report the real problem.
          await part.file.resume()
          throw new BadRequestError("The `purpose` field must be sent before `file`")
        }
        created = await service.storeUpload({ purpose, part, uploadedByUserId: user.id })
        continue
      }
      if (part.type === "file") {
        // An unexpected file field — drain it so the request doesn't hang.
        await part.file.resume()
      }
    }

    if (!created) throw new BadRequestError("No `file` part was found in the request")

    reply.status(201)
    return dataResponse(created, request.id)
  })

  app.get<{ Params: { id: string } }>("/uploads/:id", async (request): Promise<UploadsApiGetResponse> => {
    const viewer = await getOptionalSession(request)
    return dataResponse(await service.getUploadStatusForViewer(request.params.id, viewer), request.id)
  })

  /** Hand-rolled bytes route rather than @fastify/static: the server must
   *  always send its own DB-recorded, validated Content-Type (never the
   *  client's claimed mimetype — noSniff is set globally in
   *  plugins/security-headers.ts) and must 404 once a file is swept. */
  app.get<{ Params: { id: string } }>("/uploads/:id/file", async (request, reply) => {
    const viewer = await getOptionalSession(request)
    const file = await service.getUploadFileForViewer(request.params.id, viewer)
    reply.header("Content-Type", file.mimeType)
    reply.header("Content-Disposition", `inline; filename="${encodeURIComponent(file.originalFilename)}"`)
    return reply.send(await readStoredFile(file.storageKey))
  })

  app.delete<{ Params: { id: string } }>("/uploads/:id", async (request, reply) => {
    const user = await requireSession(request)
    await service.deleteUpload(request.params.id, user)
    return reply.status(204).send()
  })

  /** Not part of the TypeSpec contract — an operational endpoint, same
   *  precedent as Better Auth's own routes (see institutions.tsp's doc
   *  comment on why auth mechanics live outside packages/contracts).
   *  Triggers an immediate sweep on top of the automatic interval;
   *  useful for ops and for testing with a low UPLOAD_ORPHAN_TTL_HOURS. */
  app.post("/uploads/sweep", async (request) => {
    await requireAdmin(request)
    const deleted = await service.sweepOrphanedUploads()
    return dataResponse({ deleted }, request.id)
  })
}
