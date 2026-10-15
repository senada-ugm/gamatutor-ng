# API journey tests (HTTP tier)

Pure-HTTP end-to-end tests: no browser, no mocks — real requests against
the running dev stack, one cookie-jar **persona** at a time, walking a
complete user journey and asserting the auth/ownership matrix on the way.

```
tests/api/
  run.mjs            orchestrator: personas → scenarios (journey order) → coverage assertion
  api-journey.sh     repo-root wrapper:  bash tests/api-journey.sh
  lib/
    http.mjs         persona client (cookie jar, JSON/FormData) + coverage recording
    personas.mjs     signs in admin@ / owner@ / user@lms.dev via Better Auth
    assert.mjs       check/status/eq helpers with PASS/FAIL log + summary
    coverage.mjs     contract operation set (from /openapi.json) + coverage report
  scenarios/         one module per domain, named NN-<domain>.mjs, run in filename order
```

## Run

```sh
pnpm dev                                   # API :8000 + web :3000 (API must be up)
bash tests/api-journey.sh                  # or: node tests/api/run.mjs
pnpm test:api                              # same via the root package script
```

Env knobs: `API_BASE_URL` (default `http://localhost:8000`),
`LMS_TEST_PASSWORD` (default the seed password), `API_LOG_FILE` unused here —
email verification journeys stay in the Playwright suites.

## What it covers

- **Journey**: institution registration → course authoring (owner + admin
  paths) → content tree → enrollment workflow (self-enroll →
  select → graduate → auto-issued certificate → public verification) →
  quiz attempts with server-side grading → uploads (magic-byte MIME
  detection, purpose validation), user suspension.
- **Auth matrix per surface**: anonymous → 401, wrong role → 403,
  cross-user reads → 403/filtered, conflicts → 409, validation → 400.
- **Coverage guarantee**: every request is normalized (`/enrollments/
  enr_abc…` → `/enrollments/{*}`) and compared against the served
  `/openapi.json` operation set — the run fails if any contract operation
  was never exercised.

Not here (deliberately): email-verification journeys (need the API console
log — covered by `tests/smoke-registration-request-journey.mjs`) and UI
behavior (covered by the other `tests/smoke-*.mjs` Playwright suites).

Fixtures are timestamped and accumulate in the dev DB; nothing is cleaned
up by design.

## CI

`.github/workflows/ci.yml` runs this suite on every push/PR: a Postgres 17
service container is provisioned, `db:migrate` + `db:seed` prepare it, the API
boots via `tsx` with only `DATABASE_URL` and `BETTER_AUTH_SECRET` set, and
`pnpm test:api` runs against it (plus lint/typecheck/unit tests in a
sibling job). Same command works locally against the dev stack.
