import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { ConflictError, ForbiddenError, NotFoundError, handleError } from "../lib/errors.js"
import { dataResponse, generateId, pagedResponse } from "../lib/response.js"
import { ilikeContains } from "../lib/search.js"
import { extractUploadIdFromUrl } from "../modules/uploads/services/uploads.service.js"
import { assertWithinTimeLimit } from "../modules/quizzes/services/quizzes.service.js"

describe("API Core Utilities & Security Helpers", () => {
  describe("generateId", () => {
    it("generates cryptographic hex-based prefixed IDs", () => {
      const id1 = generateId("usr")
      const id2 = generateId("usr")
      assert.match(id1, /^usr_[0-9a-f]{24}$/)
      assert.match(id2, /^usr_[0-9a-f]{24}$/)
      assert.notEqual(id1, id2)
    })
  })

  describe("search sanitization", () => {
    it("escapes SQL LIKE wildcards % and _ and \\", () => {
      assert.equal(ilikeContains("100%"), "%100\\%%")
      assert.equal(ilikeContains("user_name"), "%user\\_name%")
      assert.equal(ilikeContains("test\\query"), "%test\\\\query%")
      assert.equal(ilikeContains("normal search"), "%normal search%")
    })
  })

  describe("response envelope formatting", () => {
    it("formats dataResponse with requestId and ISO timestamp", () => {
      const res = dataResponse({ hello: "world" }, "req_123")
      assert.deepEqual(res.data, { hello: "world" })
      assert.equal(res.meta.requestId, "req_123")
      assert.ok(!Number.isNaN(Date.parse(res.meta.timestamp)))
    })

    it("formats pagedResponse with accurate pagination bounds", () => {
      const items = [{ id: "1" }, { id: "2" }]
      const res = pagedResponse(items, 15, "req_456", { page: 2, pageSize: 2 })
      assert.equal(res.data.length, 2)
      assert.equal(res.pagination.page, 2)
      assert.equal(res.pagination.pageSize, 2)
      assert.equal(res.pagination.totalCount, 15)
      assert.equal(res.pagination.totalPages, 8)
      assert.equal(res.pagination.hasNext, true)
      assert.equal(res.pagination.hasPrevious, true)
    })
  })

  describe("error envelope handling", () => {
    it("maps NotFoundError to 404 with standard envelope", () => {
      const err = new NotFoundError("Course", "crs_999")
      const { statusCode, body } = handleError(err, "req_err")
      assert.equal(statusCode, 404)
      assert.equal(body.error.code, "notFound")
      assert.equal(body.error.message, "Course with id 'crs_999' not found")
      assert.equal(body.error.requestId, "req_err")
    })

    it("maps ConflictError to 409", () => {
      const err = new ConflictError("Resource already exists")
      const { statusCode, body } = handleError(err, "req_err2")
      assert.equal(statusCode, 409)
      assert.equal(body.error.code, "conflict")
      assert.equal(body.error.requestId, "req_err2")
    })

    it("maps ForbiddenError to 403", () => {
      const err = new ForbiddenError("Forbidden access")
      const { statusCode, body } = handleError(err, "req_err3")
      assert.equal(statusCode, 403)
      assert.equal(body.error.code, "forbidden")
      assert.equal(body.error.requestId, "req_err3")
    })
  })

  describe("quiz time limit", () => {
    const started = new Date("2026-01-01T00:00:00.000Z")
    const at = (msAfterStart: number) => new Date(started.getTime() + msAfterStart)
    const FIVE_MIN = 5 * 60_000

    it("passes when no limit is configured", () => {
      assert.doesNotThrow(() => assertWithinTimeLimit(started, null, at(3_600_000)))
      assert.doesNotThrow(() => assertWithinTimeLimit(started, 0, at(3_600_000)))
    })

    it("passes inside the limit and inside the grace window", () => {
      assert.doesNotThrow(() => assertWithinTimeLimit(started, 5, at(FIVE_MIN - 1_000)))
      assert.doesNotThrow(() => assertWithinTimeLimit(started, 5, at(FIVE_MIN + 5_000)))
    })

    it("rejects after the limit plus the grace window", () => {
      assert.throws(() => assertWithinTimeLimit(started, 5, at(FIVE_MIN + 11_000)), /time limit/i)
    })
  })

  describe("uploads helper", () => {
    it("strictly extracts upload ID from valid /v1/uploads/:id/file URLs", () => {
      const valid = "http://localhost:8010/v1/uploads/upl_a1b2c3d4e5f6/file"
      assert.equal(extractUploadIdFromUrl(valid), "upl_a1b2c3d4e5f6")

      const invalidPath = "http://localhost:8010/v1/courses/upl_123/file"
      assert.equal(extractUploadIdFromUrl(invalidPath), null)

      assert.equal(extractUploadIdFromUrl(null), null)
      assert.equal(extractUploadIdFromUrl("not-a-url"), null)
    })
  })
})
