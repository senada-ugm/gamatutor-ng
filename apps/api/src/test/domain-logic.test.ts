import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { isAnswerCorrect } from "../modules/quizzes/services/quizzes.service.js"
import { computeStatus, distanceMeters } from "../modules/attendance/services/attendance.service.js"
import { ALLOWED_TRANSITIONS } from "../modules/enrollments/services/enrollments.service.js"
import { detectMimeType, looksLikeText } from "../modules/uploads/services/uploads.service.js"

/**
 * Unit tests for the pure business logic — the decisions too small to
 * see in an E2E journey but wrong in expensive ways when they drift:
 * grading, geofencing, late thresholds, status
 * transitions, and content sniffing. These import the SERVICE modules
 * (dotenv-backed env loads at import), but only exercise functions with
 * no I/O — the DB is never touched.
 */

// ---------------------------------------------------------------------------
// Quiz grading (isAnswerCorrect) — server-side scoring for auto-gradable
// question types. A QuestionRow-shaped literal is enough; only the
// fields the function reads matter.
// ---------------------------------------------------------------------------
type GradingQuestion = Parameters<typeof isAnswerCorrect>[0]
function q(partial: Partial<GradingQuestion> & { questionType: GradingQuestion["questionType"] }): GradingQuestion {
  return {
    id: "qst_test",
    quizId: "qz_test",
    question: "?",
    options: [],
    correctAnswers: [],
    points: 1,
    displayOrder: 0,
    optionWeights: null,
    category: null,
    explanation: null,
    ...partial,
  } as GradingQuestion
}

describe("quiz grading — isAnswerCorrect", () => {
  it("single choice: exact match wins, wrong or empty loses", () => {
    const question = q({ questionType: "single_choice", options: [{ text: "Jakarta" }], correctAnswers: ["Jakarta"] })
    assert.equal(isAnswerCorrect(question, ["Jakarta"]), true)
    assert.equal(isAnswerCorrect(question, ["Bandung"]), false)
    assert.equal(isAnswerCorrect(question, []), false)
  })

  it("single choice compares exactly (multiple given answers also lose)", () => {
    const question = q({ questionType: "single_choice", options: [{ text: "Jakarta" }], correctAnswers: ["Jakarta"] })
    // the option text is authored; the player echoes it verbatim — no
    // normalization on this path, only short_answer normalizes
    assert.equal(isAnswerCorrect(question, ["  jakarta "]), false)
    assert.equal(isAnswerCorrect(question, ["Jakarta", "Jakarta"]), false)
  })

  it("multiple choice: every correct answer, no extras, order-free", () => {
    const question = q({
      questionType: "multiple_choice",
      options: [{ text: "a" }, { text: "b" }, { text: "c" }],
      correctAnswers: ["a", "b"],
    })
    assert.equal(isAnswerCorrect(question, ["b", "a"]), true)
    assert.equal(isAnswerCorrect(question, ["a"]), false)
    assert.equal(isAnswerCorrect(question, ["a", "b", "c"]), false)
  })

  it("short answer: trimmed + case-insensitive match (internal spacing is significant)", () => {
    const question = q({ questionType: "short_answer", correctAnswers: ["Republic of Indonesia"] })
    assert.equal(isAnswerCorrect(question, ["republic of indonesia"]), true)
    assert.equal(isAnswerCorrect(question, ["  REPUBLIC OF INDONESIA  "]), true)
    // normalize is trim+lowercase only — double spaces do NOT fold
    assert.equal(isAnswerCorrect(question, ["republic  of  indonesia"]), false)
    assert.equal(isAnswerCorrect(question, ["indonesia"]), false)
  })

  it("true/false grades like single choice over the fixed options", () => {
    const question = q({
      questionType: "true_false",
      options: [{ text: "Benar" }, { text: "Salah" }],
      correctAnswers: ["Benar"],
    })
    assert.equal(isAnswerCorrect(question, ["Benar"]), true)
    assert.equal(isAnswerCorrect(question, ["Salah"]), false)
  })

  it("essay never auto-grades", () => {
    const question = q({ questionType: "essay" })
    assert.equal(isAnswerCorrect(question, ["anything at all"]), false)
  })
})

// ---------------------------------------------------------------------------
// Attendance geofence + late threshold
// ---------------------------------------------------------------------------
describe("attendance geofence — distanceMeters", () => {
  it("same point is zero", () => {
    assert.equal(distanceMeters(-6.2, 106.816, -6.2, 106.816), 0)
  })

  it("known city-scale distance matches the great-circle value", () => {
    // Jakarta Monas -> Bandung Alun-Alun: ~119.6km great-circle
    const d = distanceMeters(-6.1754, 106.8272, -6.9218, 107.607)
    assert.ok(Math.abs(d - 119_600) < 1_000, `expected ~119.6km, got ${d}m`)
  })

  it("one arcsecond of latitude is ~31 meters", () => {
    const d = distanceMeters(0, 0, 1 / 3600, 0)
    assert.ok(Math.abs(d - 30.9) < 0.5, `expected ~30.9m, got ${d}m`)
  })
})

type SessionLike = Parameters<typeof computeStatus>[0]
function session(partial: Partial<SessionLike>): SessionLike {
  return {
    id: "att_test",
    courseId: "crs_test",
    title: "s",
    sessionDate: new Date(),
    sessionStatus: "active",
    verificationMethod: "code",
    lateThresholdMinutes: 15,
    ...partial,
  } as SessionLike
}

describe("attendance — computeStatus (present vs late)", () => {
  it("no configured start time means any check-in is present", () => {
    assert.equal(computeStatus(session({ startTime: null }), new Date("2026-01-01T23:59:00")), "present")
  })

  // wallClockMinutes reads the BUSINESS_TIMEZONE (Asia/Jakarta, UTC+7,
  // no DST) — build instants with that explicit offset so the test is
  // independent of the runner's local timezone.
  const atJakarta = (h: number, m: number) =>
    new Date(`2026-01-01T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+07:00`)

  it("check-in before start + threshold is present", () => {
    assert.equal(computeStatus(session({ startTime: "09:00", lateThresholdMinutes: 15 }), atJakarta(9, 10)), "present")
  })

  it("check-in past start + threshold is late (server clock, not client)", () => {
    assert.equal(computeStatus(session({ startTime: "09:00", lateThresholdMinutes: 15 }), atJakarta(9, 16)), "late")
    // exactly at the boundary is still present (strictly-greater rule)
    assert.equal(computeStatus(session({ startTime: "09:00", lateThresholdMinutes: 15 }), atJakarta(9, 15)), "present")
  })
})

// ---------------------------------------------------------------------------
// Enrollment workflow — the transition matrix IS the funnel law.
// ---------------------------------------------------------------------------
describe("enrollment transitions — ALLOWED_TRANSITIONS", () => {
  it("walks the happy path: registered -> interviewed -> selected -> graduated", () => {
    const path = ["registered", "interviewed", "selected", "graduated"] as const
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i] as keyof typeof ALLOWED_TRANSITIONS
      const to = path[i + 1] as (typeof ALLOWED_TRANSITIONS)[keyof typeof ALLOWED_TRANSITIONS][number]
      assert.ok(ALLOWED_TRANSITIONS[from].includes(to), `${from} -> ${to} must be allowed`)
    }
  })

  it("no state skips the funnel straight to graduation", () => {
    assert.ok(!ALLOWED_TRANSITIONS.registered.includes("graduated"))
    assert.ok(!ALLOWED_TRANSITIONS.interviewed.includes("graduated"))
  })

  it("graduated is terminal (except idempotent self)", () => {
    assert.deepEqual(ALLOWED_TRANSITIONS.graduated, ["graduated"])
  })

  it("canceled/failed can re-enter the funnel via registered", () => {
    assert.ok(ALLOWED_TRANSITIONS.canceled.includes("registered"))
    assert.ok(ALLOWED_TRANSITIONS.failed.includes("registered"))
  })

  it("every state allows idempotent re-submission of itself", () => {
    for (const from of Object.keys(ALLOWED_TRANSITIONS) as Array<keyof typeof ALLOWED_TRANSITIONS>) {
      assert.ok(ALLOWED_TRANSITIONS[from].includes(from), `${from} must include itself`)
    }
  })
})

// ---------------------------------------------------------------------------
// Upload content sniffing — magic bytes beat claims, text claims need
// textual bytes, everything else degrades.
// ---------------------------------------------------------------------------
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const sniff = (header: Buffer, ext: string, claimed?: string, fullRead?: Buffer) =>
  detectMimeType(header, ext, { claimedMimeType: claimed, fullRead: fullRead ?? Buffer.alloc(0) })

describe("upload sniffing — detectMimeType / looksLikeText", () => {
  it("magic bytes identify PNG/JPEG/PDF/ZIP", () => {
    assert.equal(sniff(PNG, ".png"), "image/png")
    assert.equal(sniff(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), ".jpg"), "image/jpeg")
    assert.equal(sniff(Buffer.from("%PDF-1.4"), ".pdf"), "application/pdf")
    assert.equal(
      sniff(Buffer.from([0x50, 0x4b, 0x03, 0x04]), ".docx"),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
  })

  it("OOXML containers refine by extension; a bare zip stays application/zip", () => {
    assert.equal(
      sniff(Buffer.from([0x50, 0x4b, 0x03, 0x04]), ".xlsx"),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert.equal(sniff(Buffer.from([0x50, 0x4b, 0x03, 0x04]), ".zip"), "application/zip")
  })

  it("magic bytes beat a contradictory claim (PNG claiming text/plain is image/png)", () => {
    assert.equal(sniff(PNG, ".txt", "text/plain", PNG), "image/png")
  })

  it("a text/* claim is honored when the bytes are genuinely textual", () => {
    const text = Buffer.from("hello plain world", "utf-8")
    assert.equal(sniff(text, ".txt", "text/plain", text), "text/plain")
    assert.equal(sniff(Buffer.from("<html></html>"), ".html", "text/html", Buffer.from("<html></html>")), "text/html")
  })

  it("binary bytes wearing a text/* claim degrade to octet-stream", () => {
    const binary = Buffer.concat([Buffer.from("looks fine then \x00\x01\x02 binary")])
    assert.equal(sniff(binary, ".txt", "text/plain", binary), "application/octet-stream")
  })

  it("invalid UTF-8 fails looksLikeText even without NUL bytes", () => {
    assert.equal(looksLikeText(Buffer.from([0xff, 0xfe, 0xfd])), false)
  })

  it("unknown binary without a text claim is octet-stream", () => {
    assert.equal(sniff(Buffer.from([0x01, 0x02, 0x03, 0x04]), ".bin"), "application/octet-stream")
  })
})
