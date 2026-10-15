# STRATEGIC & PHASED IMPLEMENTATION BLUEPRINT: DRIVE-LEARN LMS (FK-KMK UGM)

> **Project:** DRIVE-Learn Interactive LMS Platform  
> **Partnership:** PT Tekno Global Infotama & Department of Ophthalmology, FK-KMK UGM  
> **Contract Reference:** Cooperation Agreement No. 001/PKS-TGI/VIII/2026 & 818/UN.1/FK-KMK.2/MT2/KS/2026  
> **Contract Value:** IDR 35,000,000 (Fixed Price, Non-VAT/Non-PKP)  
> **Timeline:** 16 Calendar Weeks (4 Months)  
> **Lead Software Architect & Tech Lead:** Ariefan Dipokusumo Wibowo, S.Kom., M.Cs.
> **Last Updated:** 2026-10-15 — Phase 5 rescoped to a single-tenant frontend over retained backend multi-tenancy (full collapse kept as a deferred fallback)

---

## 1. Executive Summary & Critical Context

The customer is the **Department of Ophthalmology, Faculty of Medicine, Public Health, and Nursing (FK-KMK) Universitas Gadjah Mada (DRIVE Program Team)**, led by **Prof. dr. Muhammad Bayu Sasongko, M.Epi., Ph.D., Sp.M**. This project delivers a targeted, specialized interactive e-learning platform for **Diabetic Retinopathy (DR) Screening tailored for Primary Care Doctors (Puskesmas & Pratama Clinics)** across Indonesia.

This is **not a generic bloated university LMS** burdened with forum threads, semester timetabling, or heavy campus RFID check-ins. It is an ultra-focused clinical delivery system:
1. High-yield medical training on diabetic retinopathy via lightweight 2D interactive slides.
2. Clinical fundus image grading simulation (microaneurysms, hard exudates, hemorrhages, neovascularization) with exact visual arrow feedback.
3. Strict standardized evaluation funnel: Pre-Test &rarr; Interactive Modules & Fundus Simulation &rarr; Post-Test &rarr; Retake Remediation &rarr; Automated Anti-Tamper Certification.
4. Append-only learning telemetry & analytics: per-slide dwell duration, interaction timestamps, and clinical grading attempts exported as raw CSV for FK-KMK clinical research publication.

---

## 2. 2D vs. 3D Eye Anatomy Clarification (Review Item #2)

Review note #2 explicitly states:
> **"Untuk anatomi mata saat ini yang akan digunakan hanya 2D saja"**  
> *(For eye anatomy, currently only 2D will be used)*

### Architectural Decision:
1. **Pragmatic Reality:** The customer explicitly designated **2D only** for this production release. Forcing a full 3D WebGL engine right now is a terrible idea: no calibrated 3D medical mesh has been provided by FK-KMK, bundle size would spike by 15MB+, and remote Puskesmas laptops running old Celerons/i3s would choke and freeze.
2. **Future-Proof Architectural Slot:** The `EyeAnatomyViewer` component is designed with a pluggable contract:
   ```ts
   interface EyeAnatomyViewerProps {
     mode?: "2d" | "3d"; // defaults to "2d"
     points: AnatomyPoint[];
     onSelectPoint: (point: AnatomyPoint) => void;
   }
   ```
   The platform defaults to an ultra-lean, responsive **Interactive 2D SVG Hotspot Stage** (<50KB, instant paint, zero lag). Whenever the DRIVE team delivers an approved `.glb` / `.gltf` 3D eye model, the `<ThreeEyeCanvas />` adapter drops right in without restructuring player layouts or scoring engines.

---

## 3. End-to-End LMS Lifecycle (10 Pillars from Registration to Certificate)

```mermaid
flowchart TD
    subgraph S1 ["1. Doctor Onboarding"]
        Reg["Full Doctor Registration\n(/register)"] --> Verify["Email Verification\n(SMTP / Mailpit)"]
        Verify --> Login["Protected Session & RBAC\n(Better Auth)"]
    end

    subgraph S2 ["2. Discovery & Enrollment"]
        Login --> Cat["Course Catalog\n(/courses)"]
        Cat --> Det["Course Details\n(/courses/:id)"]
        Det --> Enr["Instant Enrollment (Free Primary Care)\nStatus: Selected / Active"]
    end

    subgraph S3 ["3. Workspace & Player"]
        Enr --> Dash["Learner Dashboard (/dashboard)\nProgress Bar % & Resume Learning"]
        Dash --> Player["Course Player (/learn/:id)\nSidebar Outline & Green Checkmarks"]
        Player --> Lessons["31 Interactive Slides:\nClean Transcripts, 2D/3D Anatomy, 2-Col Audio List"]
    end

    subgraph S4 ["4. Evaluation & Remediation"]
        Lessons --> Fundus["Fundus Simulation Cases 1-5\nArrow Lesion Pins & Red Wrong Answer Box"]
        Fundus --> PostTest["Post-Test (70% Passing Grade)\nInstant Auto-Grading"]
        PostTest --> RetakeCheck{"Satisfied with Score?"}
        RetakeCheck -->|Retake Module| Player
        RetakeCheck -->|Satisfied & Passed| GradStatus["Status: Graduated"]
    end

    subgraph S5 ["5. Certification & Verification"]
        GradStatus --> IssueCert["Automated DB Certificate Minting\n(Locked Auth Name, Serial No, QR Code)"]
        IssueCert --> ViewCert["Print / Save PDF\n(/certificates/:id)"]
        ViewCert --> PubVerify["Public QR Verification\n(/certificates/verify)"]
    end

    subgraph S6 ["6. Admin & Clinical Research"]
        Lessons -.->|Slide Duration & Timestamps| TelemetryDB[("PostgreSQL: Telemetry Logs")]
        TelemetryDB --> AdminConsole["Admin Console & CSV Export\n(FK-KMK Research Data)"]
    end
```

### Pillar Breakdown:
1. **Medical Identity & Onboarding (`/register`):** Collects full professional doctor credentials: Full Name with Medical Titles, Date of Birth, Clinical Profession (Primary Care Puskesmas Doctor, Clinic Doctor, Specialist, Resident), Institution/Clinic Name, Active WhatsApp/Phone, and Medical License / STR Number (Review #11).
2. **Catalog & Instant Enrollment:** Course discovery at `/courses` and overview at `/courses/$courseId`. For primary care doctors, enrollment is free and immediately sets `enrollments.status = 'selected'` with `progress = 0%`.
3. **Adaptive Learner Dashboard (`/dashboard`):** Real-time percentage progress bar, one-click *Resume Learning* linking directly to the last active slide, and immediate certificate claim link upon graduation.
4. **Interactive Course Player (`/learn/$courseId`):** Centered viewport-clamped container (`max-h-[calc(100vh-4.5rem)]`) preventing vertical scroll fatigue (Reviews #3 & #12). Modular sidebar outline with green completion checkmarks (`LessonCheck`).
5. **Clinical Fundus Simulation (Module 4):** Five interactive retinal fundus cases. Microaneurysm/hemorrhage lesions tagged with **SVG Arrow Pointers** with offset labels so lesions remain 100% visible (Review #7). Incorrect options turn **CRIMSON RED** (`bg-red-500/15 border-red-500 text-red-700`) while correct options turn green with medical rationale (Review #8).
6. **Assessment Engine (Pre & Post-Test):** 5-question baseline Pre-Test and 5-question competency Post-Test with automated grading and a 70% passing threshold.
7. **Completion, Score Confirmation & Retake Option:** Results summary displaying Pre-Test vs Post-Test comparison. Features the exact prompt: *"Are you satisfied with your score?"* and an unrestricted **Retake Module** button available to all participants (Review #9).
8. **Automated Anti-Tamper Certificate Minting:** Once passed and confirmed, the system flips enrollment to `graduated` and mints the certificate row atomically. **Recipient name is strictly locked to `users.name` from the authenticated session**—zero freeform text inputs, preventing credential spoofing (Review #10).
9. **Print PDF & Public QR Verification:** Rendered on `/certificates/$certificateId` as an official A4 landscape card with `@media print` stylesheets. Anyone (Health Office, Medical Association) can verify validity at `/certificates/verify?code=...` without logging in.
10. **Research Telemetry & Instructor Console:** Background beacon logs per-slide dwell times (`durationSeconds`, `enteredAt`, `exitedAt`) into `learning_telemetry_logs` (Review #15). The admin console provides a one-click raw CSV export for FK-KMK statistical research.

---

## 4. Comprehensive Per-Page & Per-Feature Curriculum Blueprint

The entire DRIVE-Learn curriculum consists of **6 Modules and 33 Interactive Slides/Pages** (numbered 1–32, with a second page on slide 17):

| No | Page ID | Slide | Type | Title / Topic | Specific Interactive Features |
|:--:|:---|:---:|:---:|:---|:---|
| 1 | `pengantar-p1` | 1 | `hero` | Course Launch: DR Screening for Primary Care | Clinical hero banner, voiceover welcome, Start CTA |
| 2 | `pengantar-p2` | 2 | `content` | Syllabus & Module Scope | 3 core pillars (DM, DR, Screening), formatted transcript |
| 3 | `modul1-p1` | 3 | `divider` | Chapter 1: Diabetes Mellitus | Chapter transition banner & introductory audio |
| 4 | `modul1-p2` | 4 | `content` | What is Diabetes Mellitus? | Multi-paragraph definition, Egregious Eleven modal |
| 5 | `modul1-p3` | 5 | `cards` | DM Prevalence & Case Projections | 3-column stats cards: Global numbers & Indonesia #5 rank |
| 6 | `modul1-p4` | 6 | `content` | DM Classification by Etiology | 4 etiologies (Type 1, Type 2, Gestational, Specific/MODY) |
| 7 | `modul1-p5` | 7 | `content` | **Risk Factors of Diabetes Mellitus** | **2-Column Grid + Audio-synced auto-reveal for 10 items (Reviews #5 & #6)** |
| 8 | `modul1-p6` | 8 | `content` | DM Diagnostic Criteria | PERKENI standard matrix (FPG, OGTT, HbA1c, RPG) |
| 9 | `modul1-p7` | 9 | `content` | Glucose & HbA1c Classification | Color-coded interpretation matrix (Normal to Diabetic) |
| 10 | `modul1-p8` | 10 | `content` | Diabetes Mellitus Complications | Microvascular (Retinopathy, Nephropathy) vs Macrovascular |
| 11 | `modul2-p1` | 11 | `divider` | Chapter 2: Diabetic Retinopathy | Chapter transition banner |
| 12 | `modul2-p2` | 12 | `hotspot` | **Interactive Eye Anatomy** | **2D SVG Hotspot Stage (11 points) + Pluggable 3D slot (Review #2)** |
| 13 | `modul2-p3` | 13 | `cards` | What is Diabetic Retinopathy? | Clinical summary card on retinal microvascular damage |
| 14 | `modul2-p4` | 14 | `content` | Diabetic Retinopathy Spectrum | Progression from NPDR to Proliferative DR (PDR) |
| 15 | `modul2-p5` | 15 | `hotspot` | **DR Pathophysiology Step 1-8** | **Explicit Instruction Banner + Sequential 1-to-8 Pulse Guide (Review #4)** |
| 16 | `modul2-p6` | 16 | `cards` | Clinical Symptoms of DR | Clinical warning: early stage is 100% asymptomatic |
| 17 | `modul2-p7` | 17 | `content` | Risk Factors of Diabetic Retinopathy | Duration of DM, glycemic control, hypertension, nephropathy |
| 18 | `modul2-p8` | 17b | `match` | Risk Factor Matching Game | Interactive drag-and-drop & touch pairing game |
| 19 | `modul3-p1` | 18 | `divider` | Chapter 3: Screening & Management | Chapter transition banner |
| 20 | `modul3-p2` | 19 | `content` | Visual Acuity & Referral Pathway | Snellen chart exam & FKTP-to-Ophthalmologist referral algorithm |
| 21 | `modul4-p1` | 20 | `divider` | Chapter 4: Fundus Grading Simulation | Simulation transition banner |
| 22 | `modul4-p2` | 21 | `image-grading` | Simulation Case 1: Normal Retina | High-res fundus, contrast adjustment, normal reasoning |
| 23 | `modul4-p3` | 22 | `image-grading` | **Simulation Case 2: Dot/Blot NPDR** | **SVG Arrow Markers (Review #7) + Red Wrong Answer Box (Review #8)** |
| 24 | `modul4-p4` | 23 | `image-grading` | Simulation Case 3: Moderate NPDR | Multiple microaneurysms detection with arrow pointers |
| 25 | `modul4-p5` | 24 | `image-grading` | Simulation Case 4: Macular Edema | Hard exudates around fovea with arrow pointers |
| 26 | `modul4-p6` | 25 | `image-grading` | Simulation Case 5: Proliferative DR | Disc neovascularization (NVD) detection with arrow pointers |
| 27 | `evaluasi-p1` | 26 | `divider` | Pre & Post Evaluation Assessment | Intro to 5 standardized doctor competency questions |
| 28 | `evaluasi-p2` | 27 | `quiz` | Q1: Diabetic Retinopathy Definition | Multiple choice clinical item with auto-grading |
| 29 | `evaluasi-p3` | 28 | `quiz` | Q2: Rescreening Interval for Normal Fundus | Periodic screening interval guidelines (1-2 years) |
| 30 | `evaluasi-p4` | 29 | `quiz` | Q3: Ischemia & VEGF Mediator | Pathophysiology of retinal ischemia triggering VEGF |
| 31 | `evaluasi-p5` | 30 | `quiz` | Q4: Screening vs Early Detection | Concept of screening asymptomatic target populations |
| 32 | `evaluasi-p6` | 31 | `quiz` | Q5: Primary Care Doctor Clinical Role | FKTP doctor boundaries vs vitreoretinal surgery |
| 33 | `selesai` | 32 | `completion` | **Graduation, Retake & Certification** | **Score satisfaction prompt & Retake (Review #9) + Locked Name Certificate (Review #10)** |

---

## 5. Implementation State by Package (verified 2026-10-15)

### 1. `packages/ui` (Design Tokens & Theming) — DONE
- DRIVE clinical colors are merged into the custom theme (Tailwind v4 / shadcn tokens, `packages/ui/src/styles/globals.css`); the SPA landing/workspace chrome already renders on it.

### 2. `apps/api` (Database & Backend Services) — core DONE, gaps below
- `participantProfiles` already carries `profession`, `institutionName`, `strNumber`, `phone`, `birthDate` (+ education/experience/certifications JSONB) — served at `/participant-profiles`.
- `learningTelemetryLogs` table exists (`enteredAt`, `exitedAt`, `durationSeconds`, `audioListenedSeconds`, `interactedElements`, `sessionId`), fed by `POST /telemetry/events` (view/heartbeats from `use-slide-telemetry`) and exported via `GET /reports/telemetry/export` (CSV, joined with participant profession/institution/STR for FK-KMK research).
- **Remaining gaps:** no aggregate telemetry endpoint (in-app charts are mocked client-side → Task 3.1); uploads service accepts images only — no PDF/PPT/Word/video/audio magic-byte detection or purposes (→ Task 2.1).

### 3. `apps/app` (Frontend Application & Player Components) — player DONE, gaps below
- `routes/register.tsx` collects full doctor metadata (name+titles, DOB, phone, profession, instansi, provinsi/kabupaten, STR) — review #11.
- `clinical-fundus-grading.tsx` renders **SVG arrow pointers** (lesions never covered) and **crimson-red wrong-answer boxes** — reviews #7–8.
- `interactive-slide-viewer.tsx` supports fit-to-screen viewport, 2-column audio-synced auto-reveal lists, sequential 1–8 pulse guide, paragraph transcripts + audio narration bar, 2D anatomy stage — reviews #1, #3–6, #12.
- The satisfaction prompt + retake and locked-name certificate claim live in `clinical-quiz-runner.tsx` (there is no separate `completion-retake-card.tsx`) — reviews #9–10.
- **Remaining gaps:** generic (non-DRIVE) lesson player renders `text`/`video` only — `audio`/`document` lessons hit an `EmptyState` (→ Task 2.3); the content editor's document/video fields are URL-only text inputs with no upload (→ Task 2.2); the registration profile is staged through `localStorage` and PATCHed on first login with failures swallowed — silent data-loss path (→ Task 2.5); the DRIVE course content is a hardcoded TS module selected by a course-title heuristic, not server-managed content (→ Tasks 4.1–4.2).

---

## 6. Phased Execution Schedule (Aligned with 4 PKS Milestones)

| Phase / Milestone | Deliverables Scope | Duration | Weight | Value (IDR) |
|---|---|:---:|:---:|---:|
| **Milestone 1 (Down Payment)** | SRS Document, Medical Design Tokens, Telemetry & Multi-Course DB Schema, 33-Slide Wireframes | Weeks 1 - 4 | 30% | IDR 10,500,000 |
| **Milestone 2** | Full Doctor Registration, Centered Fit-to-Screen Player, Module 1-2 Slide Engine, 2-Col Audio List, Audio Narration Bar | Weeks 5 - 8 | 30% | IDR 10,500,000 |
| **Milestone 3** | Fundus Grader (Arrow Pins & Red Error Box), Pre/Post Evaluation Engine, Retake Trigger, Locked Name Certificate, Telemetry Logging & CSV Export | Weeks 9 - 12 | 25% | IDR 8,750,000 |
| **Milestone 4 (Final)** | UAT with FK-KMK DRIVE Team, Dedicated Cloud VPS Deployment (Ubuntu 2 vCPU / 8 GB RAM / NVMe), 2 Online Training Sessions, User Manual & Final BAST | Weeks 13 - 16 | 15% | IDR 5,250,000 |
| **TOTAL** | **Full Completion of All PKS No. 001/PKS-TGI/VIII/2026 Deliverables** | **16 Weeks** | **100%** | **IDR 35,000,000** |

### 6.1 Task Checklist & Update Convention

> **How to use this checklist:** it is the single source of execution truth. Mark a task `- [x]` **immediately after completing it**, appending the completion date (and commit hash when handy). Statuses: `[ ]` pending · `[x]` done · `[~]` in progress · `[-]` dropped (state the reason). Tasks are ordered so each phase lands independently green (`pnpm validate` + parity script + smoke suites).

**Guiding rule (from the 2026-10-15 audit):** the PKS contracts three pillars — auth/RBAC, course & content management, interactive learning + quiz/assessment. Everything else is only justified by an explicit review note. The platform currently serves ~22 API modules where the contract justifies ~10; Phases 1–6 close that gap.

#### Phase 0 — Audit & Housekeeping
- [x] 0.1 Replace auth page background with customer-provided artwork (`apps/app/public/images/eyeball-auth-bg.jpg`, referenced by `auth-page.tsx:47`) — 2026-10-15
- [x] 0.2 Scope audit vs PKS Pasal 3 + review CSV: full endpoint/feature inventory, removal candidates, gap list (source of Phases 1–6) — 2026-10-15
- [x] 0.3 Delete unused auth background alternates (`abstract-eye-auth-bg.jpg`, `indonesia-auth-bg.jpg`, `ophthalmologist-auth-bg.jpg`) — 2026-10-15
- [x] 0.4 Purge stale `references`-domain comments (`app-schema.ts` auditLog header, `audit.tsp` header) — the domain no longer exists anywhere — 2026-10-15 (only the `app-schema.ts` block existed; `audit.tsp` had none)

#### Phase 1 — Out-of-Scope Removals (safe, mechanical)
Nothing in the PKS or the 15 review notes asks for commerce, classroom attendance, psychometric assessments, or a forum. Removal order per domain: frontend routes/components → contracts `.tsp` → regenerate (`pnpm --filter @workspace/contracts build`) → API module + Drizzle tables + migration → reports/seed/smoke-test references → parity script green → `pnpm validate`.

- [x] 1.1 **Payments & commerce**: remove `routes/orders.tsx`, `routes/wishlist.tsx`, `components/composed/payments/*` (payments panel, coupon manager, order badge), `enroll-panel.tsx` checkout/coupon funnel (keep instant free `POST /enrollments`), editor tabs `editor-payments.tsx`/`editor-coupons.tsx`, `routes/institution/orders.tsx`, admin financial widgets + `/admin/financial-summary`, `lib/format.ts` `formatRupiah`; API `modules/payments`, `modules/wishlist`, `lib/stripe.ts`, `coupons`/`orders` tables, `courses.price` + `Enrollment.isPaid` (both contract-marked "Mockup-only"), paid-order gates in `course-access.ts`/`certificates.service.ts`/`enrollments.service.ts`; contracts `payments.tsp`, `wishlist.tsp` + financial-summary/institution-report money fields; parity exclusions `POST /payments/webhook` + institution orders CSV; reports money aggregates; `PAYMENT_*` env vars + coupon rate-limit tier; seed + smoke tests (`workspaces`, `institution`, `editor-tabs`) — 2026-10-15
- [x] 1.2 **Attendance (QR + geofence)**: remove `routes/learn/attendance.tsx`, `routes/attendance-display.tsx`, `components/composed/attendance/*`, `attendance-manager.tsx` + `editor-attendance.tsx`, deps `jsqr`/`qrcode`; API `modules/attendance`, `attendanceSessions`/`attendanceRecords` tables (migration 0007), `ATTENDANCE_*`/`BUSINESS_TIMEZONE` env vars, attendance columns in course report (`AttendanceSummary`, `totalSessions`) + `CourseReportPanel` H/T/A columns; contracts `attendance.tsp` + `EnrolledStudentAttendance`; seed + smoke tests (`teaching`, `player-tabs`) — 2026-10-15
- [x] 1.3 **Standalone assessments** (`/assessments`, `/admin/assessments`, RIASEC-style): remove routes + `QuizManager` assessment scope; drop the quizzes `courseId = null` branch, per-category scoring (`category`, `optionWeights`, `categoryScores`, `reportMeta`, `computeCategoryScores`/`computeReportMeta`, the `likert` question type), and the `assertCanManage/AttemptAssessment` helpers (migration 0008) — verified no remaining consumer; smoke suite `smoke-app-assessments.mjs` deleted — 2026-10-15
- [x] 1.4 **Discussions**: remove `routes/learn/discussions.tsx`, `components/composed/discussions/*`, player nav link; API `modules/discussions`, `discussions`/`discussionReplies` tables (migration 0009); contracts `discussions.tsp`; seed + smoke tests (`player-tabs` discussion journey) — 2026-10-15
- [x] 1.5 **Post-removal hygiene**: contracts regenerated, `node scripts/check-api-contract-parity.mjs` green (94 contracted ops · 101 served routes · 7 exclusions), `pnpm validate` green (15/15 tasks), API unit tests 35/35, migrations 0006–0009 applied against local Postgres, `/dev/reset-seed` verified, and all 10 apps/app Playwright smoke suites re-run green in a browser (workspaces, institution, editor-tabs, teaching, player-tabs, account, landing, password, profile, player) — AGENTS.md module map refreshed — 2026-10-15

**Phase 1 complete.** Served surface shrank from ~117 contracted ops to 94; four whole domains (payments+wishlist, attendance, discussions, standalone assessments) and the Course.price / Enrollment.isPaid mockup fields are gone. One behavior change to note for the team: with `price` removed, **all online courses now enroll instantly as `selected`** — the paid-course `registered`-until-confirmed path no longer exists.

#### Phase 2 — PKS Gap Closure (contracted features, additive)
- [x] 2.1 **Upload service extensions**: magic-byte detection + purposes for `document` (PDF/PPT/Word), `video`, `audio` in `uploads.service.ts`; size caps per kind (document 25MB, audio 50MB, video 200MB, default 10MB — multipart ceiling raised to the video cap, per-purpose cap re-checked post-stream); legacy OLE2 doc/ppt/xls, MP4 ftyp, WebM/MKV, MP3/WAV/OGG/FLAC sniffing; 5 new unit tests + live round-trip verified (video/document uploads accepted, mismatched bytes rejected per purpose) — 2026-10-15
- [x] 2.2 **Content editor uploads**: new `LessonMediaUpload` atom (single-file adaptation of the upload-widget pattern — the assignment `FileUploadWidget` is multi-file by design) wired into `content-editor.tsx` for document/audio/video lessons with real upload progress and pre-save delete; external-URL input kept as the alternative for YouTube/Vimeo; server-side claim/release lifecycle for lesson media URLs added to `course-content.service.ts` (create claims under the course, update swaps release+claim, delete releases) — verified live: unclaimed → claimed on save → unclaimed on clear — 2026-10-15
- [x] 2.3 **Generic lesson player rendering**: new `media-renderers.tsx` player atoms — `AudioLessonPlayer` (native `<audio controls>`) and `DocumentLessonViewer` (PDF inline via `<iframe>` + Unduh PDF; PPT/Word/Excel as a download card, mime resolved from the upload's server-sniffed metadata) wired into `routes/learn/lesson.tsx`; verified in a real browser against uploaded mp3/pdf/mp4 lessons — 2026-10-15
- [x] 2.4 **Video streaming check + Range support**: the uploads byte route now advertises `Accept-Ranges: bytes` and answers single-part Range requests (206 + `Content-Range`, open-ended and clamped ends, 416 on unsatisfiable), backed by a `readStoredFileRange` storage adapter (S3 Range param / fs createReadStream start-end); verified with curl for full/206/416 paths — without this, browsers buffered whole media files and re-downloaded on every seek — 2026-10-15
- [x] 2.5 **Registration atomicity (guaranteed-retry variant)**: new `lib/pending-profile.ts` owns the staged clinical profile as a retry queue — login success AND dashboard mount both attempt the PATCH (the email-verification link auto-signs-in without ever passing through the login page, which the old first-login-only sync missed entirely), failures keep the staged copy instead of deleting it, and removal is idempotent against the upsert endpoint. Verified in a browser: sync lands on login, a blocked PATCH keeps the copy, and the dashboard mount retries to success after recovery — 2026-10-15

**Phase 2 complete.** The PKS's "upload materi teks interaktif & dokumen (PDF, PPT, Word) dengan browser preview, integrasi video streaming" clause is now served end to end: instructors upload real media into lessons (with the claim/orphan lifecycle), and learners get inline PDF preview, native audio/video streaming with HTTP Range seeking, and download cards for Office formats.

#### Phase 3 — Real Learning Analytics (Review #15)
- [x] 3.1 **Aggregate telemetry endpoint**: `GET /courses/{courseId}/telemetry-summary` contracted in `telemetry.tsp` (`CourseTelemetrySummary`: total + median per-participant dwell, activeParticipants, 7×24 WIB heatmap (168 cells, Monday-first day-major), zero-filled 30-day trend with daily distinct learners, per-participant rows with events + lastActiveAt), computed in three grouped queries in the telemetry service; WIB bucketing via the double `at time zone 'UTC' at time zone 'Asia/Jakarta'` conversion (the columns are UTC-naive timestamps — a single conversion shifts the wrong way); manager-gated like the course report — verified live: totals/median/heatmap/trend math against seeded events, and 200/403/401 gates — 2026-10-15
- [x] 3.2 **Replace mocked report visuals**: `course-report-panel.tsx` now queries `/courses/{id}/telemetry-summary` — heatmap renders the real 7×24 WIB dwell matrix (minutes), the 30-day trend charts real daily distinct learners (keyed by date), the "Median Waktu" card shows the computed median + active participant count (no more hardcoded "48 menit"), and the participants table gains a "Waktu Belajar" column from the per-participant rows; both charts show a proper empty state before any telemetry exists — verified in a browser against the seeded 2200s dataset (median 18 menit, populated WIB cell, today's trend bar, column present) — 2026-10-15
- [x] 3.3 **Admin dashboard study-time widgets**: `AdminOverview` gains a `studyTime` block (total dwell, 30-day dwell, distinct 30-day learners — one grouped query in `getAdminOverview`), rendered as a "Waktu Belajar Platform" card where the financial summary used to live — verified in a browser (seeded 2200s shows as 0,6 jam) and the workspaces smoke re-run green — 2026-10-15

**Phase 3 complete.** Review note #15 ("data timestamp ditarik untuk analisis lama belajar dan waktu yang sering modulnya diakses") is now served with real data end to end: the raw per-slide telemetry the player already emits feeds a contracted aggregate endpoint, the instructor's report shows the real heatmap/trend/median/per-participant study time (every mocked visual replaced), and the admin dashboard carries platform-wide study-time stats. The research CSV export remains for FK-KMK's own analysis.

#### Phase 4 — Multi-Course Readiness (Review #13) & Server-Side Post-Test
- [x] 4.1 **Server-managed slide content**: new `slide_decks` table (one per course, migration 0010) with contracted `GET`/`PUT /courses/{courseId}/slide-deck` (manifest deliberately opaque `Record<unknown>` — its shape stays owned by the player's `course-types.ts`, with `schemaVersion` for consumer refusal; optional `postTestQuizId` for 4.3); GET gated to managers + active participants (404 when the course teaches plain lessons), PUT manager-only; the 986-line `drive-retinopati-data.ts` was dumped verbatim to `apps/api/src/db/seed-data/drive-retinopati.deck.json` and the seed upserts it onto the DRIVE course idempotently — verified live: 7 modules / 39 pages served from the DB, 404 for deckless courses, 200/401/403 gates — 2026-10-15
- [x] 4.2 **Kill the title heuristic**: `routes/learn/lesson.tsx` now resolves the interactive player by fetching `GET /courses/{courseId}/slide-deck` (cached per course, 404 = generic lesson content) and casting the manifest with a `schemaVersion === 1` guard that falls back to plain content for unknown versions; the hardcoded `drive-retinopati-data.ts` module is deleted from the app (it lives in seed data now); verified in a browser — the decked DRIVE course renders "Slide 1 / 39" from the server manifest, and the player smoke suite re-run green for the generic path — 2026-10-15
- [x] 4.3 **Server-side post-test**: the seed derives a real Quiz from the deck manifest's evaluasi pages (5 single-choice questions × 20 points, passingScore 70, `maxAttempts = 0`, showResults/showCorrectAnswers) and links it via `slide_decks.post_test_quiz_id`; `ClinicalQuizRunner` now starts an attempt and submits through the quiz engine (letters mapped to option text, questions joined by text), with the server's score/pass driving the result screen, lesson completion, and the certificate-claim gate — the review-#9 satisfaction prompt and unlimited retake (each retake = a fresh server attempt) are preserved, and decks without a linked quiz keep local fallback scoring — verified in a browser: deliberate-fail run graded 20% server-side, retake graded 100% with the claim button, and `quiz_attempts` recorded both runs — 2026-10-15
- [x] 4.4 **Minimum authoring path for new courses**: new `DeckUploadCard` in the editor's Konten tab — JSON manifest import with client-side shape validation (`schemaVersion` + non-empty `modules`), installed-state display (schema version, module count, post-test linkage), and replace support; assets are referenced by URL inside the manifest (public content paths or upload URLs). Verified in a browser: a minimal AMD-style deck JSON uploaded through the UI onto a fresh course rendered immediately in the player — the DRIVE team can add follow-up courses without code changes — 2026-10-15

**Phase 4 complete.** The interactive course is now data, not code: the deck ships as a server-managed manifest per course, the player resolves it by courseId (title heuristic deleted), the post-test is graded and recorded by the real quiz engine with unlimited retakes, and instructors import new deck manifests through the editor — the planned AMD/DME follow-up courses need a JSON file, a thumbnail, and zero deploys.

#### Phase 5 — Single-Tenant Frontend (backend multi-tenancy retained)
The PKS names exactly three roles (Admin, Instruktur, Dokter Peserta) and one customer, so the *user-facing* platform must read as single-tenant: no institution switcher, no self-service institution requests, no "which institution?" chrome. The **backend keeps the full multi-tenant model** (institutions table, ownership grants, request queue, `course-access.ts` gates) untouched — decided 2026-10-15 as the low-risk cut:

- **Zero backend churn** — no schema migration, no contract edits (parity stays green), no access-gate rewrite, no data re-seed beyond one platform-settings default.
- **Permissions unchanged** — ownership stays the enforced authority; nothing becomes less secure.
- **Reversible** — if a second institution ever materializes (another faculty, a GamaTutor sibling), the model already supports it; only the removed UI would need rebuilding.
- **A strict subset of the full collapse** — if the deeper trim is ever wanted, everything here is exactly the prep (see the fallback note below).

Rules of execution: **delete, never hide** (hidden UI is dead code), and keep the admin console's institutions page as the ops escape hatch for ownership grants and the request queue.

- [x] 5.1 **Remove the tenant-switching UI**: deleted `InstitutionSwitcher`, `lib/authoring-institution.ts` (localStorage scope + `useAuthoringScope`), and the sidebar's "Cakupan Institusi" card + "Per Institusi" hints; new `lib/institution-ownership.ts` exports `useMyInstitution()` (first ownership grant, admin fallback to the first registered institution, `undefined`-while-loading distinct from `null`) consumed by `InstitutionScoped` (no picker gate — resolves directly), the instructor index (single-institution course list), and `/instructor/courses/new`; the dashboard's "Institusi Saya" section moved into this commit (it was coupled to the deleted scope API). Verified in a browser: no Institusi Saya, no switcher card, owner overview resolves FK-KMK UGM directly, course creation names the resolved institution — 2026-10-15
- [x] 5.2 **Remove the self-service institution surfaces**: deleted the `/institution-requests` route + the "Ajukan Institusi" menu item (the dashboard's "Institusi Saya" section moved into 5.1 — it was coupled to the deleted scope API); `allowInstitutionRequests` now defaults `false` in both the column default (migration 0011) and the platform-settings seed constants, so the dormant API matches the removed UI — verified live: the setting reads false post-reseed and `POST /institution-requests` answers "the institution request form is currently closed". The admin `/admin/institutions` page stays as the ops escape hatch — 2026-10-15
- [x] 5.3 **Smoke + hygiene**: `smoke-app-institution.mjs` rewritten to run against the account's resolved institution (the UI reports on the first ownership grant, so the suite creates its courses under that one instead of a fresh institution the UI would never resolve to); `smoke-app-account.mjs` dropped the self-service request→approval→owner journey (the product no longer offers it — admin-granted institutions are covered by the workspaces suite; `smoke-app-editor-tabs`' institution-picker helper no-ops safely with the switcher gone); six regression suites re-run green (institution, account, editor-tabs, workspaces, teaching, player); AGENTS.md refreshed — 2026-10-15

**Fallback (deferred, only if ever needed): full backend collapse.** The original invasive variant — rip out `institution-ownerships`/`institution-requests` modules + contracts + tables, move `course-access.ts` gates to admin | instructor-membership, keep one seeded `institutions` row as the display-name source, rewrite ownership-based smokes, regenerate contracts. Everything in 5.1–5.3 is a prerequisite of this anyway; do not attempt it without a concrete second-institution-negative reason (maintenance cost alone hasn't justified it).

**Phase 5 complete.** The platform now reads single-tenant end to end — one resolved institution per account, no switcher, no self-service requests (closed server-side too) — while the backend's multi-tenant model, ownership-based permissions, and the admin institutions escape hatch are fully intact. The full backend collapse stays a documented, deferred fallback.

#### Phase 6 — Optional Trims (each pending confirmation; default = keep)
- [x] 6.1 **Assignments domain removed**: `modules/assignments` + `assignments.tsp` + `assignments`/`assignment_submissions` tables (migration 0012) + `Enrollment.completedAssignments` + the upload service's assignment-attachment entitlement; frontend loses the editor Penilaian tab, the player Tugas routes/nav, the assignment components, and the now-orphaned multi-file `FileUploadWidget`; essays remain gradeable through the quiz engine's `pending_review` queue. `smoke-app-player-tabs.mjs` deleted (it was entirely assignment-driven; quizzes/announcements tabs are covered by the player/teaching/workspaces suites), `smoke-app-teaching.mjs` keeps quiz + essay-queue coverage — 2026-10-15
- [ ] 6.2 Announcements + notifications email fanout (candidate: keep in-app only, drop transactional email)
- [ ] 6.3 Audit log module
- [ ] 6.4 Enrollment funnel simplification (drop the `interviewed` stage → enrolled/graduated/failed)
- [ ] 6.5 Multi-instructor management (`/instruktur` tab, invites, co-instructor roles) → single instructor per course

### 6.2 Review Note Disposition (verified 2026-10-15)

| # | Note (abridged) | Status | Evidence / Remaining work |
|:--:|---|---|---|
| 1 | Transcript readability | ✅ Implemented | `transcript-viewer.tsx` + per-page `transcript`; future tweaks are content-data edits |
| 2 | 2D-only anatomy | ✅ Implemented | `eye-anatomy-viewer.tsx` 2D SVG stage; 3D slot reserved, not built (correct) |
| 3 | Centered layout | ✅ Implemented | viewport-clamped player container |
| 4 | Clearer slide instructions | ✅ Implemented | instruction banner + sequential 1–8 pulse guide (`sequential-hotspot-viewer.tsx`) |
| 5 | Auto-reveal synced to narration | ✅ Implemented | `animated-reveal-list.tsx`, cue-time based |
| 6 | Two-column item lists | ✅ Implemented | slide 7 grid layout |
| 7 | Arrows instead of circle markers | ✅ Implemented | `clinical-fundus-grading.tsx` SVG arrows, offset labels |
| 8 | Red wrong-answer box | ✅ Implemented | crimson styling on incorrect selections |
| 9 | Satisfaction prompt + retake for all | ✅ Implemented (client-side) | `clinical-quiz-runner.tsx:146-171`; server-side persistence → Task 4.3 |
| 10 | Certificate name from login | ✅ Implemented | `certificates.service.ts:111` from `users.name`; no freeform input anywhere |
| 11 | Richer registration fields | ✅ Implemented | `register.tsx` + `participant_profiles`; atomicity gap → Task 2.5 |
| 12 | Fit-to-screen typography | ✅ Implemented | player viewport clamp, no vertical scroll |
| 13 | Multi-course (AMD, DME) readiness | ⚠ Partial | hardcoded TS content + title heuristic → Tasks 4.1–4.4 |
| 14 | DRIVE-recorded voiceover | ◻ Infra ready | per-slide mp3 pipeline shipped; final audio awaited from DRIVE team |
| 15 | Timestamp / study-duration analytics | ⚠ Partial | telemetry collection + research CSV real; in-app heatmap/trend/median are client-side mocks → Tasks 3.1–3.3 |

---

## 7. Verification & Testing Plan

1. **Automated Contracts & Quality Gates:**
   ```powershell
   node scripts/check-api-contract-parity.mjs
   pnpm --filter api typecheck
   pnpm --filter app typecheck
   pnpm format:check
   ```
2. **Clinical Usability Verification:**
   - **Slide 7 Auto-Reveal:** Verify 2-column layout and sequential unrolling synced to audio.
   - **Slide 12 Anatomy 2D/3D Slot:** Confirm 2D SVG hotspots load instantly without Three.js errors.
   - **Slide 15 Pathophysiology 1-to-8:** Verify explicit guidance and pulse sequential click guide.
   - **Module 4 Arrow Markers & Red Box:** Verify that clicking the wrong answer highlights the card in red and that arrow pins point to lesions without covering them.
   - **Post-Test Retake & Certification:** Pass post-test &rarr; confirm retake dialog works &rarr; claim certificate &rarr; verify recipient name is automatically locked to logged-in user &rarr; test print-ready layout &rarr; scan public QR verification code at `/certificates/verify` without login.
   - **Research CSV Export:** Download telemetry report from admin console &rarr; verify per-slide dwell seconds and timestamps are accurately recorded.
