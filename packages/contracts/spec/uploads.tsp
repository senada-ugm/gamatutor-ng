import "@typespec/http";
import "@typespec/rest";

import "./shared/common.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using Lms.Common;

/**
 * General-purpose file upload domain: immediate-upload-on-select with a
 * claim/orphan lifecycle. Any feature that needs a file (course
 * thumbnails first, more callers later) uploads through this one service
 * instead of rolling its own multipart handling.
 *
 * Lifecycle: a POST here creates an `unclaimed` row and stores the file.
 * When a caller saves an entity that references the returned `url` (e.g.
 * a course's `thumbnail`), that entity's service call "claims" the
 * upload (status -> `claimed`). If the reference later changes, the OLD
 * upload is "released" back to `unclaimed` so it re-enters the orphan
 * pool. A background sweep deletes any upload still `unclaimed` past a
 * TTL, so a file the user picked but never actually submitted doesn't
 * leak forever.
 *
 * Two operational routes live OUTSIDE this contract, deliberately:
 * GET /uploads/{id}/file (byte serving — always sends the DB-recorded
 * sniffed Content-Type, never the client's claim, and 404s swept files)
 * and POST /uploads/sweep (admin-triggered orphan check on top of the
 * automatic interval). Neither belongs in a client SDK.
 */
namespace Lms {
  enum UploadStatus {
    unclaimed: "unclaimed";
    claimed: "claimed";
  }

  model Upload {
    @key
    id: ResourceId;

    /** Caller-supplied tag for what this file is for, e.g.
     *  "course-thumbnail" — free-form, not an enum, so new callers don't
     *  need a contract change just to start uploading. */
    purpose: string;

    @visibility(Lifecycle.Read)
    originalFilename: string;

    @visibility(Lifecycle.Read)
    mimeType: string;

    @visibility(Lifecycle.Read)
    sizeBytes: int64;

    /** Where the uploaded bytes can be fetched back from
     *  (`GET /uploads/{id}/file`). This is the value callers store on
     *  their own entity (e.g. Course.thumbnail) to reference the file. */
    @visibility(Lifecycle.Read)
    url: string;

    @visibility(Lifecycle.Read)
    status: UploadStatus;

    @visibility(Lifecycle.Read)
    createdAt: utcDateTime;
  }

  @route("/uploads")
  @tag("Uploads")
  interface UploadsApi {
    /**
     * Uploads a file immediately on client-side selection, ahead of the
     * surrounding form's submit. Modeled here as `multipart/form-data`
     * for documentation and validation purposes, but apps/web does NOT
     * use the generated SDK client for this call — that client is
     * fetch-based with no upload-progress events, so the web app
     * hand-rolls an XMLHttpRequest against this same route instead (see
     * apps/web/lib/uploads.ts). Field order matters to the server's
     * multipart parser: send `purpose` before `file`.
     */
    @post
    create(
      @header contentType: "multipart/form-data",
      @multipartBody body: {
        purpose: HttpPart<string>;
        file: HttpPart<File>;
      }
    ): {
      @statusCode statusCode: 201;
      @body body: DataResponse<Upload>;
    } | ErrorResponse;

    /** Status lookup — e.g. to confirm an upload wasn't already swept. */
    /** Reads an upload's metadata. Entitlement: uploader, admin, anyone
     *  for publicly rendered assets (course thumbnails, certificate
     *  signatures), and submitter/course-managers for assignment
     *  attachments. */
    @get
    get(@path id: ResourceId): DataResponse<Upload> | ErrorResponse;

    /** Explicit user-initiated cancel (e.g. "Hapus Gambar" before the
     *  surrounding form is submitted) — deletes the file and row right
     *  away instead of waiting for the orphan sweep. */
    @delete
    delete(@path id: ResourceId): {
      @statusCode statusCode: 204;
    } | ErrorResponse;
  }
}
