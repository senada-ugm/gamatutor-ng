# DRIVE feedback, group B — the platform slice

| | |
|---|---|
| **Date** | 2026-10-13 |
| **Status** | Approved (user: "fix all issues, I follow all your recommendation") |
| **Source** | Tim DRIVE review notes 10, 11, 13, 15 (and persistence for 9) |
| **Builds on** | `2026-09-05-gamatutor-platform-design.md` (S1 + the parts of S2, S3 and S5 these notes need) and `2026-10-13-drive-feedback-a-design.md` |

---

## 1. What the notes need from a server

| # | Note | Needs |
|---|---|---|
| 10 | Certificate name from login, not typed | Accounts; the certificate takes the account's name and freezes it |
| 11 | Registration with full data | A registration form: full name, date of birth, profession, institution, province, city, email, phone, password |
| 13 | Multi-course, all Retina for now (DR, later AMD, DME) | A catalogue grouped by topic; courses published as immutable versions |
| 15 | Timestamps for study duration and access times | Every learner event stored with a timestamp; reports for time spent and when learners study; CSV export |
| 9 | Retake history | Attempt results survive a reload, so history is kept on the server |

Everything else in the platform spec (cohorts and join codes, SCORM import,
offline, instructor role, item analysis) stays deferred. None of the notes ask
for them.

## 2. Decisions

| Decision | Choice | Why |
|---|---|---|
| App | `apps/web`: Next.js 16 App Router, server components and server actions | The platform spec's stack |
| Database | Postgres via Drizzle. Dev and test use PGlite (Postgres in WASM, file or memory) | Real SQL with no Docker needed for development or CI. Production uses a real Postgres |
| Auth | Email and password, scrypt (`node:crypto`), sessions in a `sessions` table, an httpOnly cookie | DB sessions can be revoked; no auth library to fight Credentials-with-DB-sessions |
| Email verification | Required. The mailer is pluggable: SMTP when `SMTP_URL` is set, otherwise the link is logged | The platform spec requires it; no SMTP server exists yet |
| Roles | `admin`, `learner` | Instructor is deferred |
| Enrolment | Self-enrol from the catalogue | Cohorts and join codes are not asked for |
| Publishing | CLI: `pnpm course:publish content/<dir> --topic Retina` | No upload UI, as the platform spec says |
| Certificate | HTML certificate page with a serial and a public `/verify/{serial}` page; print to PDF from the browser | The same print flow as the current player; no PDF renderer |
| Time zone for reports | Asia/Jakarta (WIB) | The learners are in Indonesia |

## 3. Data model

```
users        id, email UNIQUE, password_hash, role, email_verified_at, created_at,
             full_name, birth_date, profession, institution, province, city, phone
sessions     id (sha256 of the token), user_id, expires_at, created_at
email_tokens id (sha256), user_id, purpose ('verify'), expires_at, used_at

topics       id, slug UNIQUE, title, sort
courses      id, slug UNIQUE, topic_id, title, status ('published'|'hidden'), created_at
course_versions id, course_id, version, manifest jsonb, storage_dir, published_at  -- immutable
enrolments   id, user_id, course_id, course_version_id, created_at, UNIQUE(user_id, course_id)

attempts     id, enrolment_id UNIQUE, started_at, last_seen_at, resume_state jsonb
events       id bigserial, attempt_id, user_id, course_id, occurred_at, received_at,
             verb, object_id, result jsonb, context jsonb, client_event_id uuid UNIQUE
results      id, attempt_id, attempt_no, score_raw, score_max, passed, completed_at
certificates id, enrolment_id UNIQUE, serial UNIQUE, issued_at, snapshot jsonb
```

This simplifies the platform spec in one place: one `attempts` row per
enrolment carries the resume state, and each evaluation attempt inside it is a
`results` row. That matches how the player now handles retakes (§A-6).

`events` is append-only. Ingest is idempotent on `client_event_id`
(`ON CONFLICT DO NOTHING`). `results` rows are written in the same transaction
as the `passed`/`failed` event that produces them.

## 4. Player integration

- `createPlayer` gains `initialState?: Partial<PlayerState>` and calls
  `adapter.saveState?(state)` after every render that changed page or answers.
  The adapter debounces it.
- `PlatformAdapter` (in `apps/web`, browser side) batches statements and POSTs
  them every 5 s, on `visibilitychange`, and with `sendBeacon` on `pagehide`.
  It sends a `heartbeat` statement every 60 s while the tab is visible, so
  reading time is measurable. `learnerName()` returns the account's name.
  `issueCertificate()` POSTs and returns the certificate URL.
- `Verb` gains `heartbeat`. Unknown verbs are stored, never rejected.
- The completion screen uses `adapter.issueCertificate` when present: the server
  checks that the latest result passed, issues or returns the certificate, and
  the player navigates to `/sertifikat/{serial}`. Without it (SCORM), the
  in-player certificate stays.
- Course assets are served by `/c/{versionId}/assets/...`, which checks
  enrolment before streaming from the version's storage directory.

## 5. Pages (Bahasa Indonesia)

| Path | Who | What |
|---|---|---|
| `/` | everyone | Landing; links to Masuk/Daftar and the catalogue |
| `/daftar`, `/masuk`, `/keluar`, `/verifikasi` | everyone | Registration (note 11), login, logout, email verification |
| `/kursus` | learner | Catalogue grouped by topic, with each course's state (belum mulai, berjalan, lulus) |
| `/kursus/{slug}` | learner | Course detail; "Mulai" enrols and opens the player |
| `/belajar/{slug}` | enrolled | The player, resumed where the learner left off |
| `/sertifikat/{serial}` | owner | Printable certificate |
| `/verify/{serial}` | public | What the certificate says, and whether it is genuine |
| `/profil` | learner | View and edit profile; the name on an issued certificate does not change |
| `/admin` | admin | Courses and learner counts |
| `/admin/kursus/{slug}` | admin | Learner table and time reports (note 15) |
| `/admin/kursus/{slug}/export/{events|peserta}.csv` | admin | CSV exports |

## 6. Time reports (note 15)

Computed from `events`, all in WIB:

- **Per learner:** first access, last access, number of sessions, total active
  time, attempts, latest score, passed, certificate.
- **Active time:** the sum of gaps between consecutive events in one attempt,
  each gap capped at 5 minutes. Heartbeats keep a reading learner "active".
  A session ends after a gap longer than 30 minutes.
- **When learners study:** a weekday × hour heatmap of active minutes, plus
  daily active learners over the last 30 days.
- **Per module:** median active minutes per module, taken from each event's
  page id.
- **CSV:** raw events (timestamp WIB and UTC, learner, profession, institution,
  verb, page, result) and the per-learner summary.

## 7. Security

- Passwords: scrypt (N=16384, r=8, p=1, 64-byte key) with a random 16-byte salt,
  compared in constant time.
- Session token: 32 random bytes; only its SHA-256 is stored; the cookie is
  `HttpOnly; SameSite=Lax; Secure` in production; 30 days, sliding.
- Login and registration are rate-limited per IP and per email (in memory, which
  is enough for one process).
- Server actions check the session and the role on every call. Event ingest
  only accepts events for the caller's own attempt.
- Profile fields are validated with Zod; dates of birth must be in the past and
  the learner at least 17.

## 8. Deployment

The app runs as one Node process (`next start`) behind the existing nginx,
with Postgres on the same host. This shared host needs a database and a
systemd unit. Both are written as scripts and docs (`deploy/web/`) but **not
executed**: provisioning a database on the shared box is the owner's call. The
static SCORM build stays available for use in other LMSs.

## 9. Testing

- Unit: password hashing, session tokens, time-report maths (gaps, caps,
  sessions, WIB bucketing), CSV escaping, and registration validation.
- Integration on PGlite: register → verify → login → enrol → ingest events
  (idempotent replay) → result → certificate → verify page data; and an admin
  report over a seeded event log.
- E2E (Playwright, against `next start` with PGlite): register, verify through
  the logged link, take DRIVE to the end, certificate shows the registered name,
  and admin sees the learner with non-zero time.
