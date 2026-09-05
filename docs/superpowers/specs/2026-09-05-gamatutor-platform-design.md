# GamaTutor — Delivery Platform Design

| | |
|---|---|
| **Date** | 2026-09-05 |
| **Status** | Approved, pre-implementation |
| **Repo** | `GamaTutor` (was `drive-course-rebuilt`) |
| **Companion to** | `SLIDEFORGE` — the PowerPoint → SCORM authoring engine |

---

## 1. What this is

GamaTutor is a **standalone e-learning delivery platform** for a single
organisation running many courses. It hosts two kinds of content:

- **Native courses** — the rich, JSON-driven interactive format the DRIVE
  retinopathy course already uses (hotspots, drag-match, image grading).
- **Imported packages** — SCORM 1.2 / 2004 zips produced by SlideForge or any
  other authoring tool.

It enrols learners into cohorts, tracks them, grades them, certifies them, and
reports on them.

**It is not an authoring tool.** SlideForge owns authoring. GamaTutor has no
course builder UI. Content arrives as an upload.

**It is not a general LMS.** No forums, no wiki, no timetable, no attendance,
no finance module, no plugin architecture, no marketplace.

### Relationship to SlideForge

Two deliberately separate products, coupled by a file format:

```
   SlideForge  ──[ SCORM / xAPI package ]──▶  GamaTutor
   (authoring)                                (delivery)
```

Two runtimes coexist, and that is intentional and accepted: GamaTutor's own
player renders native courses, while SlideForge's player runs inside imported
packages in a sandboxed iframe. That is not a fork of SlideForge's player — it
is an LMS playing third-party content, which SlideForge's own ground truth
(`docs/plans/25-learn-ground-truth.md`) requires of any delivery platform.

GamaTutor's player implements three interaction types SlideForge does not have
(`hotspot`, `match`, `image-grading`). If SlideForge ever wants them, this is
where the working implementation lives.

---

## 2. Decisions taken

| Decision | Choice | Rejected alternative |
|---|---|---|
| Relationship to SlideForge | Standalone platform, SCORM interop only | Merging into SlideForge as "Learn" |
| Scale | One organisation, many courses, real roles | Multi-tenant SaaS; single-program |
| Stack | Next.js + Postgres, TypeScript monorepo | .NET 10; Laravel; BaaS |
| Content sources | Upload native bundles AND SCORM zips | In-browser builder; SCORM-only |
| Identity | Email accounts + cohort join codes | Campus SSO; anonymous link+name |
| Runtime | Extracted framework-free player + append-only event spine | Relational-first tracking; RSC-rendered pages |

The runtime choice is load-bearing. Analytics and offline both want a
client-side player and an append-only event stream; a relational-first design
pays for both twice.

---

## 3. Repository shape

```
apps/web/                    Next.js App Router — the platform
packages/course-schema/      Zod schema + forward migrations for the native format
packages/course-player/      framework-free renderer, extracted from index.html
packages/scorm-host/         SCORM 1.2/2004 API shim + CMI to statement translation
packages/tracking/           xAPI statement builders + TrackingAdapter interface
content/drive-retinopati/    course.json + assets/   (DRIVE, as data)
tools/build-standalone.ts    course.json + assets + player -> single-file SCORM package
fixtures/legacy/index.html   the original 966-line course, frozen as golden reference
out/                         generated standalone packages
docs/superpowers/specs/      this document
```

pnpm workspaces, mirroring SlideForge's conventions so the two repos feel
related.

### What happens to the existing course

1. The `course-data` script block becomes `content/drive-retinopati/course.json`.
2. The renderer JS becomes `packages/course-player`.
3. The original `index.html` moves to `fixtures/legacy/` and is **never
   deleted** — it is the golden reference the extraction is tested against.
4. `tools/build-standalone.ts` regenerates `index.html` + `imsmanifest.xml`
   into `out/`, so GamaTutor still emits the SCORM package it started as.

The platform and the standalone package render from one player and one course
file. There is no second copy of anything.

---

## 4. The native course format

`@gamatutor/course-schema` owns it: a Zod schema, a `schemaVersion` field, and
a forward-migration chain — one migration per version bump, so a bundle
authored last year still loads.

### Page types

| Type | Purpose |
|---|---|
| `hero` | course opener |
| `divider` | chapter break |
| `content` | body text, optional image/video, optional `reveal_steps` |
| `cards` | stat / definition grid, optional trailing image |
| `hotspot` | image + labelled points + cover masks |
| `match` | drag-drop pairing, with click-to-place touch fallback |
| `image-grading` | image + options + findings revealed after answering |
| `quiz` | multiple choice + explanation |
| `video` | video with poster and captions |

Changes from today's implicit format:

- **`fundus` becomes `image-grading`.** The type is general; retinal images are
  content, not schema.
- **`{ video: true }` becomes a `video` page type** with `{ src, poster,
  captions? }`. Today it is hardcoded to `assets/visus.mp4` inside a reveal
  step.
- **Every module and page carries a stable string id.** Tracking is currently
  keyed on `modIdx + '-' + pageIdx`. Inserting a page silently repoints every
  analytics record and every resume bookmark at the wrong content. Stable ids
  cost nothing now and cannot be added retroactively.
- **Pages carry `graded: boolean`; the course carries `passingScore`.** Today
  the five `quiz` pages are implicitly the graded set. That works for one
  course.
- **The course carries `assessment.mode`** — see §6.

### Bundle format

A zip with `course.json` at the root and an `assets/` directory beside it.

---

## 5. The player

`@gamatutor/course-player` — framework-free, zero runtime dependencies, no
React. It runs identically inside the Next.js app, inside a standalone SCORM
package, and inside a service-worker-cached shell.

```ts
createPlayer({ mount, course, adapter, capabilities })
```

`@gamatutor/tracking` defines the seam:

```ts
interface TrackingAdapter {
  init(): Promise<ResumeState | null>
  emit(statement: Statement): void      // fire-and-forget; the adapter queues
  commit(): Promise<void>
  finish(outcome: Outcome): Promise<void>
}
```

Three implementations:

- `PlatformAdapter` — POSTs to GamaTutor, backs the offline outbox.
- `Scorm12Adapter` — for the standalone build; this is the code already in
  `index.html`.
- `NullAdapter` — instructor preview, records nothing.

Statements are xAPI-2.0-shaped from the start: `launched`, `experienced`,
`interacted`, `answered`, `completed`, `passed`, `failed`, `terminated`.

Capability flags let one player serve every context without forking:

```ts
{ narration: 'webspeech' | 'audio' | 'off',
  resume: boolean,
  certificate: boolean,
  offline: boolean,
  grading: 'client' | 'server' }
```

---

## 6. Data model

Single tenant — no tenant column anywhere. Postgres with Drizzle; the
projection queries are analytical and want real SQL.

### Identity and catalogue

```
users            id, email, password_hash?, name,
                 role ('admin'|'instructor'|'learner'), email_verified_at
courses          id, slug, title, kind ('native'|'scorm'), status, owner_id
course_versions  id, course_id, version, schema_version, manifest jsonb,
                 storage_key, published_at            -- IMMUTABLE
cohorts          id, course_version_id, name, join_code,
                 starts_at, ends_at, passing_score
enrolments       id, cohort_id, user_id, role_in_cohort
                 unique(cohort_id, user_id)
```

**Authentication is email + password with mandatory verification.** Auth.js
with a Credentials provider over these tables; sessions in Postgres, not JWTs,
so an admin can revoke one. `password_hash` is nullable purely so an OIDC or
magic-link identity can attach to the same row later without a migration — v1
issues no passwordless logins.

**Asset storage sits behind a small `Storage` interface** with two
implementations: the local filesystem in development, and S3-compatible object
storage in production. Nothing outside that interface knows which is in use.
Course assets and extracted SCORM packages are served through a route that
checks enrolment before streaming, never by a public bucket URL.

**`course_versions` is immutable and a cohort pins exactly one.** Re-uploading
a course creates a new version; in-flight attempts keep rendering what the
learner started, and last semester's analytics stay meaningful. Without this,
every content edit silently corrupts historical data.

### The spine

```
attempts   id, enrolment_id, course_version_id, started_at, last_seen_at,
           completed_at, outcome, score_raw, score_max, resume_state jsonb
events     id bigserial, attempt_id, occurred_at, received_at, verb,
           object_id, result jsonb, context jsonb,
           client_event_id uuid UNIQUE               -- APPEND-ONLY
```

`events` is the truth. `attempts` is its mutable head — score, outcome and
resume bookmark are maintained by a projection that runs **in the same
transaction as the insert**, so there is no eventual-consistency window in the
gradebook.

`client_event_id UNIQUE` with `ON CONFLICT DO NOTHING` is what makes the
offline outbox safe: replaying a batch is a no-op.

### Derived projections

Both rebuildable from `events` alone:

```
page_progress       attempt_id, page_id, first_seen_at, ms_spent, completed
question_responses  attempt_id, page_id, interaction_id, response,
                    correct, attempt_no, answered_at
```

`question_responses` is the entire basis for item analysis. `page_progress` is
the drop-off funnel. Start with indexed queries; add materialised views only
when a real cohort makes something slow.

### Certificates

```
certificates  id, attempt_id UNIQUE, serial, issued_at, revoked_at,
              snapshot jsonb
```

`snapshot` freezes learner name, course title, score and date at issue time, so
a later profile edit cannot retroactively rewrite a certificate someone already
showed an employer. Public verification at `/verify/{serial}`,
unauthenticated, showing only what is on the certificate.

### Assessment integrity

DRIVE grades in the browser: correct answers and explanations ship inside
`course.json`. That is right for formative training and wrong for anything
credit-bearing — and a gradebook export plus verifiable certificates points at
credit. So the schema carries `assessment.mode` per course from day one:

- **`formative`** — today's behaviour, instant feedback, answers client-side.
  Default.
- **`secured`** — graded pages served without `correct`/`explanation`;
  responses POST to the server, which grades and returns feedback.

**v1 builds `formative` and only wires the seam for `secured`.** The player
needs the `grading: 'client' | 'server'` capability either way, and
retrofitting that seam later means touching every question type. Building the
secured path itself waits for the first course that needs it.

---

## 7. Playing imported SCORM safely

Import: upload zip → parse `imsmanifest.xml` → resolve the default
organisation's SCO href → extract to storage under
`courses/{courseId}/{versionId}/` → create an immutable `course_versions` row
holding the parsed manifest.

Playback is the hard part. SCORM content finds its LMS by walking
`window.parent` for a global `API` (1.2) or `API_1484_11` (2004) — the exact
loop at `fixtures/legacy/index.html:254`. That works only **same-origin**. But
an imported package is arbitrary third-party JavaScript, and same-origin means
it can read the session cookie and `localStorage`.

**Solution: serve package content from a separate origin and bridge over
`postMessage`.**

A content route on a distinct host (`content.<domain>`, or a `sandbox` iframe
with `allow-scripts` and *not* `allow-same-origin`) serves the extracted files.
When it serves `text/html`, it stream-injects one script into `<head>` defining
a local `API` / `API_1484_11` whose methods proxy to the parent by
`postMessage`. The package finds an API in its own frame immediately and never
knows the difference. Nothing is mutated at rest — the injection is a
serving-time transform.

The parent validates the message origin and translates:

| SCORM CMI | Becomes |
|---|---|
| `cmi.core.lesson_status` | `completed` / `passed` / `failed` statement |
| `cmi.core.score.raw` / `.min` / `.max` | `result.score` on the outcome statement |
| `cmi.core.lesson_location` | resume bookmark on `attempts` |
| `cmi.suspend_data` | `attempts.resume_state` |
| `cmi.interactions.n.*` | `answered` statements |

That last row is the payoff: an imported package that reports interactions
lands in the same `question_responses` table as a native course, so one
gradebook and one item analysis cover both content kinds.

### Explicitly out of scope

**SCORM 2004 sequencing and navigation (`imsss` rules).** That is a genuine
rule interpreter and a project of its own. v1 supports single-SCO packages and
simple linear multi-SCO ordering, and **rejects packages carrying sequencing
rules at import time with a clear message** rather than playing them wrongly.

---

## 8. Analytics, gradebook, certificates

All projections over `events`. No new plumbing.

**Instructor analytics** (per cohort, per course version):

- Completion funnel — attempts reaching each page, in course order.
- Median time on page.
- Item analysis per question — p-value, distractor distribution, and
  discrimination index (top 27% vs bottom 27% by total score).
- **Per-hotspot discovery rate** — which points learners actually opened. This
  is the number SCORM throws away, and the strongest argument for keeping a
  native format.
- First-try correctness for `match` and `image-grading`.

**Gradebook:** learners × graded pages × total × outcome, per cohort. XLSX and
CSV export including attempt history. `cohorts.passing_score` overrides the
course default.

**Certificates:** issued idempotently on the transition to `passed` (unique on
`attempt_id`). Rendered with `@react-pdf/renderer` rather than headless Chrome
— Chrome on serverless is a tax with no return here. QR encodes
`/verify/{serial}`.

---

## 9. Offline and PWA

- App shell and player bundle precached by the service worker.
- **Course assets cached only on an explicit per-course "Download for
  offline"** — DRIVE ships an mp4, and silently pulling video over a metered
  connection is hostile.
- Outbox: an IndexedDB queue of statements keyed by `client_event_id`, flushed
  on `online` and via Background Sync where available, with periodic retry
  otherwise.
- Resume: `attempts.resume_state` is authoritative server-side, mirrored
  locally.
- Two devices at once is a non-event — append-only plus idempotent ingest means
  the head projection simply recomputes.
- **Offline covers native courses only.** Imported SCORM assumes a live,
  synchronous API and will not get one.

---

## 10. Error handling

- **Ingest is idempotent and tolerant.** Unknown verbs are stored, not
  rejected, so an older client never loses data to a newer schema. A malformed
  batch returns 400 with per-event errors; the client drops only the bad ones.
- **Imports validate fully before any row is written.** Native bundles are
  Zod-parsed and migrated; SCORM manifests are parsed, sequencing-checked, and
  the entry file confirmed to exist. Failure leaves no `course_versions` row
  and no orphaned storage.
- **A render error on one page must not kill the course.** Per-page error
  boundary with report-and-skip.
- Rate-limit login and join-code redemption.

---

## 11. Testing

**The extraction is the risky part, so it gets the strongest net.** A
characterisation suite runs scripted walkthroughs against the frozen
`fixtures/legacy/index.html` and against the extracted player, asserting
identical rendered DOM and identical SCORM API calls. This is written *before*
the extraction, not after.

Beyond that:

- Schema migrations — a golden fixture per version, each asserted to migrate
  forward to current.
- Statement translation — CMI element in, statement out. Pure, table-driven.
- Projections — event log in, expected projection out. Pure functions.
- Ingest idempotency — replay a batch twice, assert one row.
- Version pinning — edit a course, assert an in-flight attempt is unaffected.
- E2E (Playwright) — join code → complete DRIVE → pass → certificate → verify
  URL; and import a SCORM package → play → score lands in the gradebook.
- **Accessibility, WCAG 2.1 AA**, matching SlideForge's bar. The current
  drag-drop `match` is keyboard-hostile and `hotspot` points are not
  keyboard-reachable at all. Both are fixed during extraction, and axe runs
  over every page type.

---

## 12. Build order

Seven slices, each independently shippable.

| Slice | Contents | Ships |
|---|---|---|
| **S0** | pnpm monorepo, `course-schema`, `course-player` extracted against the characterisation suite, DRIVE as `course.json`, `build-standalone.ts` | The current SCORM package, regenerated from data |
| **S1** | Next.js app, Postgres, Drizzle, accounts, roles, admin bootstrap | Log in, see an empty catalogue |
| **S2** | Catalogue, native bundle upload, immutable versions, cohorts + join codes, enrolment, native delivery, event spine, resume | **A real class can take DRIVE** |
| **S3** | Graded pages, passing rules, gradebook, XLSX/CSV export, certificates, `/verify/{serial}` | Credit-bearing training |
| **S4** | SCORM import, separate content origin, postMessage API bridge, CMI translation, import validation | SlideForge packages run here |
| **S5** | Funnel, time-on-page, item analysis, hotspot discovery | The thing SCORM cannot do |
| **S6** | Service worker, per-course offline download, IndexedDB outbox, background sync | Usable on a phone on 3G |

**S2 goes in front of a real cohort before S3–S6 are built.** This mirrors
SlideForge's own reality check (`docs/plans/39-learn-reality-check.md`), which
says to ship the delivery path to one lecturer and let their reaction choose
what comes next.

Each slice gets its own implementation plan. **The first plan covers S0 only** —
the monorepo and the player extraction — because every later slice consumes the
packages it produces, and because the characterisation suite it establishes is
what makes the rest safe to build.

---

## 13. Deferred, with the seam already in place

| Deferred | Seam that exists on day one |
|---|---|
| Server-side secured grading | `assessment.mode`, `grading` capability |
| Campus SSO (OIDC) | `users` has no password-required constraint |
| LTI 1.3 tool | Immutable `course_versions` + `attempts` map cleanly to LTI resource links |
| xAPI LRS endpoint | `events` is already 2.0-shaped |
| SCORM 2004 sequencing | Rejected at import with a clear message, not silently mishandled |
| Multi-tenancy | Not seamed. A deliberate one-way door — revisit only with a second organisation in hand |
