/**
 * Post-processes the generated OpenAPI document so Scalar (and any other
 * OpenAPI renderer) can show a neat, documented section per tag.
 *
 * The TypeSpec openapi3 emitter in this toolchain emits bare tag names —
 * there is no @tagDoc decorator available — so this build step injects a
 * short presentation description under each tag and is idempotent (a tag
 * that already has a description is left untouched). Runs as part of
 * `pnpm --filter @workspace/contracts build`, between tsp compile and
 * openapi-ts. Never hand-edit tsp-output; rebuild instead.
 */
import { readFileSync, writeFileSync } from "node:fs"

const FILE = new URL("../tsp-output/openapi/3.1.0/openapi.yaml", import.meta.url)

const DESCRIPTIONS = {
  Health: "Service liveness probe.",
  Courses: "Course catalog: authoring, publishing, and retrieval. Creating and editing requires institution ownership.",
  "Course Content": "Module and lesson authoring inside a course, plus learner lesson-progress tracking.",
  "Course Instructors": "Per-course instructor roster: invites, roles, and removal.",
  Enrollments:
    "Learner enrollment lifecycle (registered → interviewed → selected → graduated) and participant profiles.",
  Attendance: "Attendance sessions with code/QR verification, geofenced check-in, and record keeping.",
  Quizzes: "Quiz and question authoring, learner attempts and grading, plus platform-wide assessments.",
  Assignments: "Assignment authoring, learner submissions, and grading.",
  Discussions: "Per-course discussion threads, replies, and moderation (pin/close/resolve).",
  Certificates: "Certificate issuance and public verification by code.",
  "Certificate Settings": "Per-course certificate template: signature list configuration.",
  References: "Platform lookup/master data — public reads for form dropdowns, admin writes.",
  Uploads: "General file uploads with claim/release lifecycle and orphan sweep.",
  Institutions: "Institution registration (admin-direct) and profile management.",
  "Institution Requests":
    "Self-service institution registration queue — any signed-in account submits, admins approve or reject.",
  "Institution Ownerships": "Ownership grants linking accounts to the institutions they administer.",
  Users: "Platform user administration: listing, search, suspension. Admin-only.",
  "Audit Log": "Append-only trail of privileged administrative actions.",
}

let text = readFileSync(FILE, "utf8")
let injected = 0

// Only touch the top-level `tags:` block (it ends where `paths:` starts).
const tagsStart = text.indexOf("\ntags:\n")
const pathsStart = text.indexOf("\npaths:\n")
if (tagsStart !== -1 && pathsStart !== -1 && tagsStart < pathsStart) {
  const lines = text.slice(tagsStart, pathsStart).split("\n")
  const out = []
  let tagName = null
  let tagIndent = ""
  let tagHasDescription = false
  for (const line of lines) {
    const nameMatch = line.match(/^(\s*)- name: (.+?)\s*$/)
    if (nameMatch) {
      if (tagName !== null && !tagHasDescription && DESCRIPTIONS[tagName]) {
        out.push(`${tagIndent}  description: ${JSON.stringify(DESCRIPTIONS[tagName])}`)
        injected++
      }
      tagName = nameMatch[2].replace(/^["']|["']$/g, "")
      tagIndent = nameMatch[1]
      tagHasDescription = false
      out.push(line)
      continue
    }
    if (tagName !== null && /^\s+description:/.test(line)) {
      tagHasDescription = true // idempotent rerun
    }
    out.push(line)
  }
  // trailing tag (last entry before the block ends)
  if (tagName !== null && !tagHasDescription && DESCRIPTIONS[tagName]) {
    out.push(`${tagIndent}  description: ${JSON.stringify(DESCRIPTIONS[tagName])}`)
    injected++
  }
  text = text.slice(0, tagsStart) + out.join("\n") + text.slice(pathsStart)
}

writeFileSync(FILE, text)
console.log(`enrich-tags: ${injected} tag description(s) injected`)
