# LMS Monorepo — Agent Guide

## Repo structure

```
apps/
  app/              - React/Vite SPA (TanStack Router + Query) — THE
                      authenticated product: player, instructor workspace,
                      admin workspace, transactional catalog, notifications.
                      All API calls go through src/lib/api.ts (the hey-api
                      SDK's path interpolation is broken in Vite).
  web/              - TanStack Start SSR site — MARKETING ONLY: landing,
                      catalog (?q= server-side search), course detail, and
                      the public /certificates/verify page. No auth, no
                      session: every Masuk/Daftar CTA hands off to
                      APP_ORIGIN (apps/app) via lib/env.ts; /login and
                      /register meta-refresh there. Data comes from
                      src/lib/server-api.ts (public server fns, no cookie
                      forwarding needed anymore).
  api/              - Fastify backend, real Postgres via Drizzle (health,
                      institutions, users, courses, course-content,
                      course-instructors, enrollments, attendance,
                      certificates, certificate-settings, discussions,
                      quizzes, assignments, uploads, payments,
                      notifications, announcements, reports, references,
                      wishlist, platform-settings, audit — contract/API
                      parity enforced by scripts/check-api-contract-parity.mjs)
packages/
  contracts/        - TypeSpec API contracts (source of truth for shapes)
  ui/               - Shared UI: shadcn primitives + authored composed blocks (@workspace/ui)
  eslint-config/    - Shared ESLint configs
  typescript-config/ - Shared tsconfig bases
```

## Formatting

- **`pnpm format` formats the whole repo in one pass from the root**
  (`prettier --write .`), and `pnpm format:check` is the read-only
  counterpart that CI runs. Run it from the root: the per-package
  `format` scripts exist for targeted use but can't see files no
  workspace owns (`tests/`, `scripts/`, root configs).

- **printWidth is 120**, matching how the code was actually authored —
  99% of lines already fit, and what doesn't is unbreakable (template
  literal HTML, long import lists). It was 80 in config while nothing had
  ever been formatted at 80, so the first `pnpm format` anyone ran would
  have rewritten the entire repo.

- **Every package script passes `--ignore-path ../../.prettierignore`.**
  Prettier only auto-discovers an ignore file in the directory it runs
  from, and turbo runs each package script with that package as cwd — so
  without the flag `pnpm --filter ui format` sees no ignore list and
  rewrites all 59 shadcn registry files. Ignore patterns resolve relative
  to the ignore file's own directory, so root-relative paths in
  `.prettierignore` work correctly from any package.

- **Generated output is never formatted** (`packages/contracts/gen/` and
  `tsp-output/`, `apps/api/drizzle/`, `apps/api/src/db/auth-schema.ts`,
  `apps/web/src/routeTree.gen.ts`) — same never-hand-edit rule as
  everywhere else; regenerating discards any reformatting. Markdown is
  excluded too: Prettier's markdown printer flattens the continuation
  lines of these hand-wrapped docs.

- There is no `turbo format` task. Formatting mutates files and the old
  task declared no `outputs`, so a cache hit would have skipped the write
  entirely. Turbo fans out the read-only `format:check` instead, which
  `validate` depends on.

## apps/app — Component conventions

- Any custom component we write — whether a small shared atom (a badge,
  a file-upload widget) or a full composed block (an assignment manager,
  a course editor) — lives under `apps/app/src/components/composed/<domain>/`
  (e.g. `components/composed/courses/`). Sub-pieces used only within one
  domain go in that domain's `_atoms/` subfolder. Atoms reused **across**
  multiple domains (an assignment submission badge) go in
  `components/composed/_shared/` instead — prefer a shadcn primitive from
  `packages/ui` over a custom atom whenever one fits. Shared page chrome
  lives in `components/composed/workspace/`; the chrome-less player's
  shell in `components/composed/player/`.

- Routes are code-based in `src/router.tsx` (no routeTree.gen.ts).
  A pathless `id: "workspace"` layout guards the session in `beforeLoad`
  and renders nothing itself; beneath it the tree forks into **three
  shells**:
  - `id: "learner"` -> `WorkspaceShell`, a top nav. Dashboard, catalog,
    course detail, wishlist, orders, assessments, certificates,
    notifications, institution requests.
  - `id: "management"` -> `ManagementShell`, a sidebar. `/instructor/**`
    and `/admin/**`. The sidebar header carries the institution scope
    (see lib/authoring-institution.ts), and its groups mean something:
    everything above "Platform" is scoped by that switcher, everything
    under it is admin-wide and ignores the scope.
  - `/learn/**` stays outside the guard's shells entirely, chrome-less,
    with the player's own sidebar.

  A learner's path is catalog -> course -> player and the player owns a
  sidebar, so a second persistent rail there would be chrome tax on every
  page; management has a scope and a growing set of destinations, so it
  gets the rail. Don't collapse the two back into one shell without
  resolving that.

  In route components, read params with
  `useParams({ from: "<full route id>" })` — pathless layouts add their
  id to the chain (e.g.
  `/workspace/management/instructor/courses/$courseId/editor`,
  `/workspace/learner/courses/$courseId`), while `Link to=` uses the
  clean URL.

- Editor tabs are sub-routes under `/instructor/courses/$courseId/editor/*`;
  the layout fetches the course once into a context and tabs invalidate
  the shared `["course", id]` query.

## packages/ui — shadcn exclusions

- `packages/ui/src/components/` is **excluded from lint, typecheck and
  formatting** (enforced in packages/ui's eslint.config.ts, tsconfig.json
  and the root .prettierignore). Lint errors in shadcn's own registry code
  aren't ours to fix given the never-hand-edit rule, and reformatting it
  would just be discarded by the next `shadcn add --overwrite`. Any real
  breakage from an overwrite will surface at build time in the consuming
  app instead.
- `packages/ui/src/hooks/`, `src/lib/`, `src/styles/`, and `src/composed/`
  are still linted and typechecked — those are files we author.
- Authored shared UI goes in `packages/ui/src/composed/`, exported as
  `@workspace/ui/composed/<name>` (wrappers around primitives live there,
  never as edits to the primitive).
## packages/contracts — TypeSpec API contracts

- `packages/contracts/spec/` is the **single source of truth for API
  shapes** (TypeSpec 1.15.0). Layout: `spec/main.tsp` declares the
  `@service namespace Lms`, `spec/shared/common.tsp` carries the standard
  response envelopes and query params (adapted from the VAMIOS vamios-core
  standard — `DataResponse<T>`, `PagedResponse<T>`, `ErrorResponse`, etc.),
  and one domain file per resource area (`spec/institutions.tsp`). Domain
  files must declare their contents inside `namespace Lms { ... }` —
  interfaces outside the service namespace emit no paths.

- Every operation returns a standard envelope: `DataResponse<T>` for single
  resources, `PagedResponse<T>` for lists (spread `...PageParams`,
  `...OrderByParam`, `...SearchParam` on list ops), `ErrorResponse` on
  failure. Create ops return `{201, Location header, DataResponse}`. No
  bare resource arrays or ad-hoc error models.

- After any spec edit run `pnpm --filter @workspace/contracts build` to
  regenerate the pipeline: TypeSpec → OpenAPI 3.1
  (`tsp-output/openapi/3.1.0/openapi.yaml`) → hey-api output in `gen/`
  (`types.gen.ts` TS types, `zod.gen.ts` runtime schemas, `sdk.gen.ts` +
  `client.gen.ts` a typed fetch SDK). All generated output is committed but
  **never hand-edited** — regenerate instead. NOTE: hey-api wipes its
  output dir on every run, so `gen/` must stay separate from `src/`.

- Consumers import named types from `@workspace/contracts/domain` (the
  authored re-export layer), never from `gen/` directly. The generic
  envelopes are authored there (`ContractDataResponse<T>`,
  `ContractPagedResponse<T>`) because OpenAPI inlines generics per path.
  Generated artifacts are also exported as subpaths: `@workspace/contracts`
  (all types), `/zod` (runtime schemas — used by apps/api preValidation),
  `/sdk`, `/client`, `/openapi` (raw YAML).

- `apps/api` is the Fastify backend (skeleton adapted from vamios-core):
  `pnpm dev:api` boots it on :8000, docs at `/docs`. Modules live under
  `apps/api/src/modules/<name>/{index,routes/,services/}`; route handlers
  are typed against the generated response types and validate
  bodies/queries with the generated Zod schemas via `src/lib/validation.ts`.
  Errors always emit the `Common.ErrorResponse` envelope. `institutions` and
  `users` still serve in-memory fixtures; `courses`/`course-instructors`/
  `enrollments`/`references` have contracts but no serving module yet — add
  each domain's `apps/api/src/modules/<name>/` alongside its `.tsp` when
  that happens, so contract and serving skeleton land together.

- **Real auth is live** (`apps/api/src/auth.ts`): Better Auth v1.7 with
  email/password, email verification (`src/lib/email.ts` — real Resend send
  when `RESEND_API_KEY` is set, otherwise logs the verification link to the
  console), Google social login (wired, inert until `GOOGLE_CLIENT_ID`/
  `GOOGLE_CLIENT_SECRET` are set), and the admin plugin (`role` field —
  `user`/`admin`, matching `UserRole` — plus ban/unban as the backing store
  for `AccountStatus`). Backed by a dedicated Postgres database
  (`DATABASE_URL`, separate from the parent solokerja app's DB) via Drizzle
  — schema at `apps/api/src/db/auth-schema.ts`, regenerate with
  `npx auth@1.7.1 generate --config src/auth.ts --output src/db/auth-schema.ts`
  after any plugin/config change (NOT the deprecated `@better-auth/cli`
  package — the CLI moved to the `auth` package at matching versions), then
  `pnpm --filter api db:generate` (commit the generated `drizzle/` migration) then `pnpm --filter api db:migrate`. `pnpm --filter api db:seed` creates one
  admin (`admin@lms.dev`) and one plain user (`user@lms.dev`), password
  `correcthorsebatterystaple` for both — the seeded accounts are what the smoke suites sign in as. Mounted in Fastify at `/api/auth/*` via `better-auth/node`'s
  `toNodeHandler` in its own encapsulated plugin scope (needs the raw
  request body, so it removes the JSON content-type parser in that scope
  only) — that scope also sets CORS headers by hand on the raw response,
  since `reply.hijack()` bypasses `@fastify/cors`'s normal header-staging
  entirely. No contracts modeled for auth endpoints — Better Auth ships its
  own OpenAPI surface; `packages/contracts` stays the source of truth only
  for LMS business resources.

- **Contract/API parity is enforced in CI**: `node scripts/
  check-api-contract-parity.mjs` (run after the contracts build) fails if
  a contracted operation has no serving route, or a registered route has
  no contract entry. The ONLY sanctioned uncontracted routes are the
  five on the script's INTENTIONAL_EXCLUSIONS list (payments webhook,
  upload byte-serving, upload sweep, the /v1/health alias, participants
  CSV export) — each is documented in its spec file's header, which is
  what makes it "intentional". Adding a route without a contract entry,
  or a spec op without a route, must either fix the drift or add a
  documented exclusion.

- **Institutions has a real end-to-end admin flow**: `InstitutionsApi.create`
  (institutions.tsp) lets an admin directly register an institution —
  granting them ownership immediately (`apps/api/src/modules/institutions/
  services/institutions.service.ts`'s `createInstitution`, gated by
  `apps/api/src/lib/require-admin.ts`), skipping the pending-request/
  approval flow entirely. `registeredInstitutions`/`institutionOwnerships`
  now live in real Drizzle tables (`apps/api/src/db/app-schema.ts`,
  separate from the Better-Auth-CLI-owned `db/auth-schema.ts` — same
  never-hand-edit-generated-files split as `packages/contracts`). The
  registration-*request* queue (`institution-requests.routes.ts`) is still
  in-memory fixtures — only its *result* (approving a request) writes to
  the real `institutions` table, so the request queue itself and the
  admin-direct-create path are on different data sources today. apps/app:
  

- **Courses has a real end-to-end create/edit/browse flow, narrowly**:
  `CoursesApi.create`/`update` (courses.tsp) back a new `apps/api/src/
  modules/courses/` module — real Drizzle `courses` table
  (`app-schema.ts`), `instructor`/`modules` stored as JSONB (no separate
  module/lesson tables yet — matches the mockup's own local-state-only
  module authoring). Creating/updating requires a signed-in session that
  either owns the target institution or is an admin
  (`lib/require-session.ts` + `courses.service.ts`'s
  `assertCanManageInstitution` — an *ownership* check, not an admin-only
  gate like institutions' create, since any institution owner can author
  their own courses). `CourseCreate`/`CourseUpdate` deliberately don't
  match `Course` field-for-field: `slug` (generated from `title`),
  `instructor` (the session user), `status` (defaults `"draft"`), and
  `modules` (starts `[]`) aren't collected by `CourseForm` today, so
  they're server-derived, not writable; `level`/`language` are optional
  too (form doesn't collect them either) and fall back to `"beginner"`/
  `"id"` on create, left untouched on update. apps/app:
  `components/composed/courses/course-form.tsx` exports
  `toCourseWritePayload()` to map its UI-shaped `CourseFormValues` (string
  inputs for numbers/dates, `""` for unset selects) onto the contract's
  writable shape; `/instructor/courses/new` resolves which institution to
  author under via a real `institutionOwnershipsApiListByUser` call
  (**not** `lib/mock/institution-ownerships.ts` — that mock file is still
  what `lib/session.ts`'s `deriveDefaultSection()` reads, a known
  ownership-derivation gap, see below) and picks the first grant (no
  institution-picker UI — matches the plan's one-admin-one-institution
  verification scope, not a hard product assumption); `/instructor/
  courses/[courseId]/edit` fetches/updates via the real SDK. The public
  catalog (`course-catalog.tsx`, `/courses`), the course detail page
  (`/courses/[courseId]`), and every `CourseList` consumer (admin's
  per-institution course list, the owner's, and the instructor's own
  "Kelola Pelatihan") are also real now — `coursesApiList`/`coursesApiGet`
  + `institutionsApiList`/`institutionsApiGet` for the display name
  (`CourseCard`/`CourseDetail`/`CourseList` all take an optional
  `institutionName` prop, pre-resolved by the real-data callers; they fall
  back to the old `getInstitutionNameForCourse()` mock lookup for any
  caller that doesn't pass one, e.g. `landing-page.tsx`/`student-home.tsx`,
  which are intentionally left on mock "featured courses" — out of scope).
  The owner's per-institution course list route also swapped its
  `isOwnerOfInstitution()` mock access gate for a real
  `institutionOwnershipsApiListByUser` check (admins bypass it).
  **Superseded:** the "CourseEditor's Info tab is still mock" gap described
  here is now closed — see the "CourseEditor & CoursePlayer are real
  end-to-end" bullet below.

- **General file uploads: immediate-upload-on-select with a
  claim/orphan-sweep lifecycle, course thumbnails as the first caller.**
  `packages/contracts/spec/uploads.tsp`'s `UploadsApi` (`create` modeled
  as `multipart/form-data` via `@multipartBody`/`HttpPart<File>` — the
  spike worked cleanly, no fallback needed; `get`/`delete` are plain
  JSON). `POST /uploads/sweep` is deliberately **not** in the contract —
  an operational endpoint, same precedent as Better Auth's own routes
  (see the institutions bullet above on why auth mechanics stay outside
  `packages/contracts`). Backend: `apps/api/src/modules/uploads/` (new
  `uploads` Drizzle table in `app-schema.ts`; files live on local disk
  under gitignored `apps/api/storage/` — this sandbox has no cloud
  storage credentials, same "real integration behind an env-gated
  adapter, safe local fallback otherwise" pattern as Resend/Google OAuth
  in `env.ts`). `@fastify/multipart` is `fastify-plugin`-wrapped (no own
  encapsulation scope), so it's registered inside the same scoped
  sub-plugin as the upload routes (`modules/uploads/index.ts`), mirroring
  `app.ts`'s `mountAuth()`. Bytes are served back over a hand-rolled
  `GET /uploads/:id/file` route, not `@fastify/static` — the server must
  always send its own DB-recorded, validated `Content-Type` (never the
  client's claimed mimetype; `noSniff: true` is global in
  `plugins/security-headers.ts`) and must 404 once a file is swept.
  Lifecycle: an upload starts `unclaimed`; the entity that ends up
  referencing its URL (e.g. a course's `thumbnail`) "claims" it on save
  (`courses.service.ts`'s `createCourse`/`updateCourse`, via
  `uploads.service.ts`'s `extractUploadIdFromUrl` — a strict path-pattern
  match, not a substring check); replacing that reference "releases" the
  old upload back to `unclaimed` so it doesn't leak forever as
  permanently-claimed-but-unreferenced. A background sweep
  (`startUploadSweep`/`stopUploadSweep`, hooked to Fastify's
  `onReady`/`onClose` in `app.ts` rather than a bare module-scope
  `setInterval`) deletes anything still `unclaimed` past
  `UPLOAD_ORPHAN_TTL_HOURS` (default 24, env-overridable for testing),
  keyed off `releasedAt ?? createdAt`; the check cadence is clamped to
  1 min–1 hour independently of the TTL so a short test TTL doesn't spin
  a near-zero-delay interval — `POST /uploads/sweep` (admin-only) triggers
  an immediate check for that case. apps/app: `lib/uploads.ts`'s
  `uploadFile()` hand-rolls `XMLHttpRequest` rather than using the
  generated `uploadsApiCreate` SDK function — the generated client is
  fetch-based with no upload-progress events, and `xhr.upload.onprogress`
  is what gives real byte-level progress. (the thumbnail upload panel) no longer fakes persistence with
  `URL.createObjectURL` — it uploads on file-select, shows real progress,
  cancels a superseded in-flight upload, deletes an upload it created
  this session if the user replaces or removes it before submitting (an
  already-claimed thumbnail from a loaded course is left alone — the
  server-side release-on-update path handles that when Save is actually
  clicked), and only calls `onChange(url)` once the upload completes (not
  optimistically on file-select).

- **Capability derivation is real across the board.** the adaptive dashboard's capability sections decide which nav chrome
  shows: `admin > institution_owner > instructor > student`. Ownership
  reads `lib/institution-ownership.ts` (read-through cache over
  `institutionOwnershipsApiListByUser`); instructor status reads
  `lib/instructor-status.ts` (same read-through-cache shape over
  `GET /course-instructors/mine`) — both exist because plain sync
  functions (post-login redirect, href defaults) can't await, the app has
  no React Context, and (pre-Query) no data-fetching library. New data
  surfaces should prefer TanStack Query (`components/query-provider.tsx`,
  mounted in the root layout) and reach for the hand-rolled caches only
  from sync-only call sites; `app-shell.tsx` warms both caches for
  whichever shelled page is showing.
  - **Why a whole extra module for this** (`lib/institution-ownership.ts`,
    not just swapping the mock import): this app has no React Context, no
    data-fetching library (SWR/React Query), and no server-side session
    cache — session state is a nanostore, read either reactively
    (`useCurrentUser()`) or as a synchronous snapshot
    (`getCurrentUser()`). `deriveDefaultSection()` and
    `lib/routes.ts`'s `routes.dashboard()` default param are *plain
    functions*, some called outside any component (the post-login
    redirect, href defaults) — they can't `await` a real fetch. The new
    module is a small read-through cache: `getOwnedInstitutionIdsSync`
    returns whatever's cached (`[]` before the first fetch resolves) and
    fires a background fetch; `useOwnedInstitutionIds` is the same thing
    as a hook that re-renders once that fetch lands (returns `undefined`
    while unresolved — distinct from `[]`, so gating code (`notFound()`
    for a non-owner) doesn't 404 a real owner during the loading window);
    `getOwnedInstitutionIdsAsync`/`deriveDefaultSectionAsync` await it
    outright, used only by `login-form.tsx`'s post-signin redirect, the
    one call site where getting the very first render right matters.
    `components/composed/_shared/app-shell.tsx` calls the hook once
    (result unused) purely to warm the cache for whichever shelled page
    is currently showing, since `routes.dashboard()`'s sync path can only
    read whatever's already cached. Note: this file needs its own
    `"use client"` — `session.ts`/`routes.ts` are reachable from Server
    Components (e.g. `app/(marketing)/page.tsx` via `landing-page.tsx`),
    and a bare `import { useEffect, useReducer } from "react"` in a
    module on that path fails the build (`next build` errors: "You're
    importing a module that depends on useEffect into a React Server
    Component module").
  - **`owned-institution-list.tsx` is now real** (fixed while getting the
    owner-persona smoke test back to green — it was the one thing blocking
    a real owner from reaching ANY owner-shell page beyond a blank
    dashboard): it used to filter `mockInstitutionOwnerships` by
    `user?.id`, which a real Better-Auth-minted account id can never
    match, so a genuine owner's dashboard silently showed an empty state
    regardless of what they actually owned. Now reads real
    `useOwnedInstitutionIds()` + `institutionsApiGet`/`coursesApiList` per
    owned institution — shared by the owner dashboard and the "Institusi
    Saya" list page. Course-instructor counts were dropped from its
    ministat tiles rather than kept as a permanent, misleading "0" —
    that domain still has no real per-course data to report (see below).
  - **Resolved (Lane A)**: the admin user-management panel is fully real
    now (usersApiList + one `GET /user-capabilities` batch per page for
    the ownership/instructor badges + real suspend/reactivate), and the
    coupons list reads real institutions for its name column.
    **Superseded:**
    `course-editor.tsx`'s `canManageCourseInstructors()` and its
    `getCourseById()`-based course resolution (previously 404ing on any
    real `crs_`-prefixed course) are both fixed now — see the
    "CourseEditor & CoursePlayer are real end-to-end" bullet below. The
    self-service institution-*request* flow used to attribute requests to
    a fake id instead of the real session user — **that's now fixed**, see
    the next bullet.

- **Self-service institution requests are real end to end: anyone can
  register, request an institution, and become its owner once an admin
  approves — no admin UI action needed to grant ownership by hand.**
  `institution_requests` is a real Drizzle table now (`app-schema.ts`,
  `requestedByUser`'s display name/email joined from Better Auth's `user`
  table at read time rather than denormalized, so it can't go stale).
  `POST /institution-requests` requires `requireSession` (any signed-in
  account, not admin — this *is* the "everyone can request" behavior) and
  attributes the request to the real caller; `approve`/`reject` require
  `requireAdmin` (previously **completely ungated** — a real gap, not
  just a mock one, fixed alongside the Postgres migration).
  `list`/`get` force non-admins to only ever see their own requests,
  regardless of what `requestedByUserId` they pass — added a
  `requestedByUserId` filter to `InstitutionRequestsApi.list` for this.
  apps/app: `institution-request-form.tsx` (`/account/institutions/new`,
  the student-facing "Ajukan Institusi" form) and
  `institution-admin-list.tsx`'s pending-review section (`/admin/
  institutions`) both call the real SDK now, replacing
  `lib/mock/institutions-admin.ts`'s `submitInstitutionRequest`/
  `approveInstitutionRequest`/`getPendingInstitutionRequests`.
  `app-shell.tsx`'s admin "Institusi" nav badge (pending-request count)
  was **frozen at whatever it was when the module first loaded** — it
  lived in a module-level `NAV_CONFIG` object literal, not recomputed per
  render; turned into a `getNavConfig(pendingCount)` function called from
  the component body with a real fetched count.
  **Also newly wired while verifying this**: `register-form.tsx` was
  entirely fake (a `setTimeout` + toast, no account ever created) —
  discovered because "everyone can register" doesn't hold without it. Now
  calls `authClient.signUp.email()` for real; since `auth.ts` requires
  email verification before a session exists, it redirects to `/login`
  with a "check your email" message rather than a dashboard. Verified the
  complete loop in a browser: register a brand-new account → pull its
  verification link from apps/api's console-fallback log (no
  `RESEND_API_KEY` set locally) → verify → sign in for real → submit a
  request → sign in as the seeded admin → approve it → confirm the
  original account now really owns the institution and lands on
  `/institution_owner`. Committed as
  `tests/smoke-registration-request-journey.mjs`.

- **CourseEditor & CoursePlayer are real end-to-end.** Both surfaces used
  to be 100% mock: `course-editor.tsx` (`/instructor/courses/[courseId]/
  editor`) resolved the course via `lib/mock/courses.ts`'s `getCourseById()`
  (404s on any real `crs_`-prefixed id) and every one of its 9 tabs
  read/wrote local `useState`; `CoursePlayer` (`/learn/[courseId]/**`) was
  the same story for lesson progress, quizzes, assignments, attendance,
  and discussions. Both now resolve the real course via `coursesApiGet`
  and every tab/route is real. Six domains got built from scratch — schema
  → `.tsp` → `apps/api` module → frontend wiring, in this order, each
  verified via Playwright before the next started:
  - **Course content** (`course-content.tsp`): `course_modules`/
    `course_lessons`/`lesson_progress` tables, replacing the `courses.modules`
    JSONB blob — `courses.service.ts`'s `toCourse()` now composes `modules`
    by querying these tables instead of reading a column, so the `Course`
    response shape is unchanged for existing consumers.
    `CourseContentEditor` (Konten tab) does real create/update/delete/
    reorder; `CoursePlayer` seeds `completedLessonIds` from
    `lessonProgressApiList` and persists mark-complete via
    `lessonProgressApiComplete`/`Uncomplete`.
  - **Course instructors**: `course-instructors.tsp` (already contracted,
    unserved) now has a real `apps/api` module. `course-editor.tsx`'s
    `canManageInstructors` check was rebuilt off real
    `useOwnedInstitutionIds()` + `role === "admin"` — fixing a real bug
    where non-admin owners never passed the old mock-array check.
  - **Enrollments**: `enrollments.tsp` (already contracted, unserved) now
    served, plus per-action routes matching ParticipantsPanel's distinct
    buttons (`/interview`, `/select`, `/fail`, `/graduate`, `/cancel`).
    `graduate` auto-issues a certificate (see below).
  - **Attendance, with real QR + geolocation** — not a simulated
    check-in button. `attendance_sessions`/`attendance_records` tables;
    a session's geofence (`latitude`/`longitude`/`radiusMeters`) is
    independent of its `verificationMethod` (`none | code | qr`) — if
    coordinates are configured, check-in requires the client's own
    coordinates and the server enforces a haversine-distance check
    regardless of method. apps/app carries the jsqr dep for this:
    `qrcode` (instructor side — `AttendancePanel`/`QRDisplay` render the
    session's `qrToken` as a scannable image via `QRCode.toDataURL`) and
    `jsqr` (student side — `AttendanceCheckIn` opens the camera via
    `getUserMedia`, draws frames to an offscreen `<canvas>`, and decodes
    with `jsQR`; falls back to manual 6-digit code entry, the default
    input mode, if the session doesn't support/require the camera).
    `codeExpirySeconds`/`qrTokenExpiresAt` bound how long a generated
    code/token stays valid; `lateThresholdMinutes` drives
    present-vs-late computation server-side (`computeStatus()` in
    `attendance.service.ts`) — never client-side, since the client's
    clock isn't trusted for this.
  - **Certificates + certificate settings**: server stores structured
    metadata only (number, verification code, signatures, custom fields)
    — no server-side PDF pipeline; the existing client-side
    `certificate-template.tsx` keeps doing all rendering plus browser
    print/export, just fed by `certificatesApiGet`/`Verify` now instead of
    a mock lookup. `certificate_settings` is its own table (one domain,
    one module, not a JSONB column bolted onto `courses`).
    `QuizQuestion.correctAnswers` and `AttendanceSession.verificationCode`/
    `qrToken` all use the same pattern for a field that must never reach
    an unauthorized caller: one model, one optional field marked
    `@visibility(Lifecycle.Read)`, populated server-side only when the
    caller is authorized — never a separate "public" vs "authoring" model
    variant.
  - **Discussions**: `discussions.tsp` — pin/close/resolve gated by
    `assertCanManageCourse` OR the original author; create/reply gated by
    enrollment (managers bypass). `DiscussionThread` is **self-sufficient**
    — it fetches its own data and owns its mutations directly via SDK
    calls, rather than relying on parent-supplied callback props; this
    pattern (also used by `QuizTake`) was adopted after discovering the
    old mock version's callback props were declared but never actually
    wired by the parent page, so the buttons silently did nothing.
  - **Quizzes**: `quizzes.tsp` — `single_choice | multiple_choice |
    true_false | short_answer | essay`. Grading is always server-side
    (`isAnswerCorrect()`/`submitAttempt()` in `quizzes.service.ts`), never
    client-side — `QuizTake`'s local answer-checking helpers exist only to
    highlight correct/incorrect in the post-result breakdown, not to
    compute the score. An attempt containing an essay question lands in
    `pending_review` until an instructor grades it via a dedicated
    endpoint (`QuizAttemptApi.grade`).
  - **Assignments**: `assignments.tsp` — resubmission rule is "overwrite
    until graded": a `submitted` submission can be freely overwritten, but
    once `graded`, a new submission is rejected (409) until the instructor
    explicitly reopens it (`AssignmentSubmissionApi.reopen`, flips status
    to `returned`) — see `submitAssignment()` in `assignments.service.ts`.
    Resubmitting always clears the prior `score`/`feedback`/`gradedAt`.
    Attachments reuse the general upload lifecycle
    (`claimUpload`/`releaseUpload`) via the same
    `reconcileXUploads(ownerId, oldList, newIds)` diff-and-claim helper
    used by certificate signature uploads.

  New shared permission helpers, `apps/api/src/lib/course-access.ts`:
  `assertCanManageCourse` (broad — admin, institution owner, or active
  course-instructor; used by content/quiz/assignment/attendance/
  certificate/discussion-moderation routes), `assertCanManageCourseInstructors`
  (narrow — admin-or-institution-owner only, invite/remove/role-change
  routes), `assertIsEnrolledParticipant` (requires a non-canceled/failed
  enrollment row; used by every student-facing CoursePlayer mutation —
  mark-lesson-complete, quiz attempts, assignment submission, attendance
  check-in — managers bypass it automatically).

  Test coverage: `tests/smoke-course-content-contract.mjs`,
  `smoke-attendance-contract.mjs`, `smoke-certificates-contract.mjs`,
  `smoke-discussions-contract.mjs`, `smoke-quizzes-contract.mjs`,
  `smoke-assignments-contract.mjs` (new), plus
  `smoke-courses-contract.mjs`/`smoke-course-instructors-contract.mjs`/
  `smoke-enrollments-contract.mjs` (rewritten off the now-closed mock
  course-id gap — see above).

- Frontend types always come from `@workspace/contracts/domain` — import
  the `ContractX` aliases rather than restating shapes, so contract drift
  is a typecheck error, not a code-review catch. `Lifecycle.Read` fields
  surface as `readonly` in TS — replace objects, don't mutate those fields.

- Scope discipline: only model resources that exist in the product today.
  Adding a model here is an API design decision, not filler.

- **Role vs membership (the load-bearing rule):** `UserRole` is the
  account's global trust tier and gates ONLY platform administration
  (`admin`) — it has exactly two values, `user` and `admin`. Every course-
  or institution-scoped capability — teaching a course, owning an
  institution, being enrolled — is a membership row (join of user ×
  resource: `CourseInstructor`, `InstitutionOwnership`, `Enrollment`),
  never a role value. A user can own an institution, teach a different
  course, and be enrolled as a learner in a third — simultaneously; each
  capability is checked against its own join (`isInstructor(userId)`,
  `getOwnedInstitutionIds(userId)`), never against `role`. **A
  scoped-feature gate that reads `role` is a bug** — read the membership
  instead. Never add scoped values ("institution_owner", "instructor") to
  `UserRole`. The web app's session has a separate `AppSection` type
  (`student | instructor | institution_owner | admin`) for which chrome/nav
  is showing — that's a navigation detail, not an account attribute, and
  is not the same thing as `UserRole`.

- Known Windows quirk: do not add `using TypeSpec;` to spec files — it makes
  every std builtin ambiguous in this setup. `Lifecycle`/`@visibility`
  resolve via the http lib import alone.

## Import paths

| What | Import from |
|---|---|
| shadcn primitive | `@workspace/ui/components/<name>` |
| shared utils (`cn`) | `@workspace/ui/lib/utils` |
| shared hooks | `@workspace/ui/hooks/<name>` |
| shared CSS | `@workspace/ui/globals.css` |
| app-level composed block | `@/components/composed/<domain>/<name>` |
| app-level hook | `@/hooks/<name>` |

## Scripts

Run from the monorepo root:

| Command | What it does |
|---|---|
| `pnpm dev` | Start all apps' dev servers via turbo |
| `pnpm build` | Build all packages |
| `pnpm lint` | ESLint across all packages |
| `pnpm typecheck` | `tsc --noEmit` across all packages |
| `pnpm validate` | `lint` + `typecheck` + `format:check` in one shot (use before committing) |
| `pnpm format` | Prettier over the whole repo, one pass from the root |
| `pnpm format:check` | The read-only counterpart CI runs; fails on unformatted files |
| `node scripts/check-api-contract-parity.mjs` | Guard: every contracted op is served, every route is contracted (CI) |
| `node scripts/report-frontend-coverage.mjs` | Report: which served endpoints apps/app and apps/web actually call |

Run scoped with `pnpm --filter web <script>` or `pnpm --filter @workspace/ui <script>`.

## Design system conventions

- Status is always a `Badge` with a semantic color className, never a raw `<span>`.
- Progress is always the shadcn `Progress` component, never a hand-rolled `<div style={{width}}>`.
- Every page uses `<PageHeader>` from `components/composed/_shared/page-header.tsx`
  instead of hand-rolled headers.
- Empty states use `<EmptyState>` from `components/composed/_shared/empty-state.tsx`
  (apps/app) — plain empty `<p>`s are a review nit.
- No per-app `components/ui/` may exist — all shadcn primitives live in
  `packages/ui`. If `shadcn add` puts files elsewhere, move them to the package.
- Page content is constrained to `max-w-7xl` on large screens: wrap page-level
  content in a `mx-auto max-w-7xl` container (with `px-4`/`md:px-6` gutters).
  Exceptions only for deliberate full-bleed or marketing layouts (e.g. the
  landing page's narrower `max-w-6xl`/`max-w-5xl` sections).
- Base UI gotchas (primitives here are Base UI, not Radix — old shadcn snippets
  need translating):
  - `asChild` doesn't exist. Use `render={<YourElement />}` and pass content as
    children instead.
  - `DropdownMenuLabel` must be wrapped in `<DropdownMenuGroup>` — a group
    label without its group throws "MenuGroupContext is missing".
  - `<Button render={<Link …/>}>` needs `nativeButton={false}`, or it warns
    about losing native button semantics.
  - `Select`'s `onValueChange` receives `string | null`, not `string`.
