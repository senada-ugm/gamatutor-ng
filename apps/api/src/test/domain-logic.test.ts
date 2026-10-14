import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { isAnswerCorrect } from "../modules/quizzes/services/quizzes.service.js"
import { ALLOWED_TRANSITIONS } from "../modules/enrollments/services/enrollments.service.js"
import { detectMimeType, looksLikeText } from "../modules/uploads/services/uploads.service.js"

/**
 * Unit tests for the pure business logic — the decisions too small to
 * see in an E2E journey but wrong in expensive ways when they drift:
 * grading, status transitions, and content sniffing. These import the SERVICE modules
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
