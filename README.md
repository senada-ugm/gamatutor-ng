# GamaTutor

**Live: <https://gamatutor.komunitech.id>**

An e-learning **delivery** platform for one organisation running many courses.
It hosts two kinds of content — a rich native interactive format, and imported
SCORM 1.2 / 2004 packages — then enrols learners, tracks them, grades them and
reports on them.

It is the companion to [SlideForge](../SLIDEFORGE), which owns *authoring*:
SlideForge turns a `.pptx` into a standards-compliant package, GamaTutor
delivers it.

```
   SlideForge  ──[ SCORM / xAPI package ]──▶  GamaTutor
   (authoring)                                (delivery)
```

**GamaTutor is not an authoring tool** — there is no course builder UI, content
arrives as an upload. **It is not a general LMS** — no forums, wiki, timetable,
attendance or finance module.

## Status

| | |
|---|---|
| **S0** | Course schema, tracking contracts, the extracted player, SCORM 1.2 adapter, standalone package build |
| **Tim DRIVE review, group A** | Player and content revisions: narration that brings items in as it speaks, two-column lists, readable transcripts, clearer instructions, arrows to lesions, red wrong answers, retake with a satisfaction prompt, certificate name from the login, one-screen layout — [spec](docs/superpowers/specs/2026-10-13-drive-feedback-a-design.md) |
| **Group B — the platform** (`apps/web`) | Registration with full profile, email-verified login, topic-grouped catalogue with immutable course versions, the player with server-side resume and events, certificates in the account name with public verification, admin study-time reports and CSV — [spec](docs/superpowers/specs/2026-10-13-drive-feedback-b-platform-design.md) |
| **Not started** | Cohorts and join codes, SCORM import, item analysis, offline/PWA |

See [the platform design](docs/superpowers/specs/2026-09-05-gamatutor-platform-design.md)
for the whole plan.

## Try it

- **The platform:** <https://gamatutor.komunitech.id/daftar> — register, then
  take DRIVE from the catalogue.
- [DRIVE as a SCORM build](https://gamatutor.komunitech.id/courses/drive-retinopati/)
  — the same course packaged for any SCORM 1.2 LMS (public preview here, no
  tracking or certificate).
- [Dasar Algoritma](https://gamatutor.komunitech.id/courses/dasar-algoritma/)
  — a SCORM 1.2 package [SlideForge](https://slideforge.komunitech.id/) built
  from a PowerPoint deck, hosted verbatim.

To build the native one yourself:

```bash
pnpm install
pnpm build:standalone          # -> out/drive-retinopati/ (SCORM package)

# the platform, with an in-process Postgres (PGlite) in apps/web/.data
pnpm web course:publish ../../content/drive-retinopati --topic retina --topic-title Retina
GT_ADMIN_PASSWORD=<12+ chars> pnpm web admin:create admin@example.id
pnpm web build && pnpm web start   # http://localhost:3100
```

Open `out/drive-retinopati/index.html` in a browser, or zip that folder and
upload it to any SCORM 1.2 LMS. It is generated entirely from
`content/drive-retinopati/course.json` plus the player.

## How the extraction was kept honest

During S0, a characterisation suite drove the frozen original
(`fixtures/legacy/index.html`) and the extracted player through the same clicks
in jsdom and asserted identical HTML and identical SCORM calls. That suite was
retired once Tim DRIVE asked for visible changes on most pages; the last
parity-green commit is tagged `s0-parity-final`. `course.json` is now the
source of truth, and the fixture stays only as a historical record.

## Layout

| Path | What |
|---|---|
| `packages/course-schema` | Zod schema + forward migrations for the native course format. No DOM. |
| `packages/tracking` | Statement types, `TrackingAdapter`, `NullAdapter`, `Scorm12Adapter`. No DOM. |
| `packages/course-player` | The runtime. Framework-free, zero third-party runtime dependencies. |
| `content/drive-retinopati` | The DRIVE course as `course.json` + assets. |
| `imported/` | SCORM packages from other tools, hosted verbatim. |
| `fixtures/legacy` | The frozen original (historical; see `s0-parity-final`). |
| `apps/web` | The platform: Next.js 16, Drizzle, Postgres (PGlite in development). |
| `tools/` | `build-standalone.ts`, `fit-check.py`, `deploy.sh`, `deploy-web.sh`. |
| `test/build` | Standalone build and full-course walkthrough. |
| `deploy/` | nginx vhost and landing page for the live host. |

## Development

```bash
pnpm verify     # lint + typecheck + tests
pnpm test       # tests only
# the platform's database tests on a real, empty Postgres (production's driver):
GT_TEST_DATABASE_URL=postgres://user:pass@127.0.0.1:5432/empty pnpm vitest run apps/web
pnpm build:standalone    # regenerate out/drive-retinopati/
./tools/deploy-web.sh    # ship the platform to gamatutor.komunitech.id
./tools/deploy.sh        # ship static courses, landing page, nginx vhost
```

Deployment is documented in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — read the
shared-host warning there before changing anything nginx-related.

## Provenance

The DRIVE course content — text, images, narration, lesion coordinates and
questions — was extracted from `SAMPLE MIPA_Modul_DRIVE.pptx`. The platform is
built against published specifications only: ADL SCORM 1.2 and 2004, xAPI,
IMS Content Packaging, WCAG 2.1.
