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

Slice **S0 is complete**. The platform itself (S1 onward) is not built yet.

S0 turned the original single-file DRIVE course — 966 lines of hand-written
HTML, CSS and JavaScript — into a monorepo whose framework-free player renders
that course from data, and rebuilt the original SCORM package from that data.

| | |
|---|---|
| **Done** | Course schema + migrations, tracking contracts, the extracted player, the SCORM 1.2 adapter, and a standalone package build |
| **Not started** | Everything with a server: catalogue, accounts, cohorts, the event spine, gradebook, analytics, SCORM import, PWA |

See [the design spec](docs/superpowers/specs/2026-09-05-gamatutor-platform-design.md)
for the whole plan, and [the S0 plan](docs/superpowers/plans/2026-09-05-s0-monorepo-and-player-extraction.md)
for how this slice was built.

## Try it

Two courses are live:

- [DRIVE — Skrining Retinopati Diabetika](https://gamatutor.komunitech.id/courses/drive-retinopati/)
  — native, built from `content/`.
- [Dasar Algoritma](https://gamatutor.komunitech.id/courses/dasar-algoritma/)
  — a SCORM 1.2 package [SlideForge](https://slideforge.komunitech.id/) built
  from a PowerPoint deck, hosted verbatim.

To build the native one yourself:

```bash
pnpm install
pnpm build:standalone          # -> out/drive-retinopati/
```

Open `out/drive-retinopati/index.html` in a browser, or zip that folder and
upload it to any SCORM 1.2 LMS. It is generated entirely from
`content/drive-retinopati/course.json` plus the player.

## How the extraction is kept honest

`fixtures/legacy/index.html` is the **frozen original** and is never edited. A
characterisation suite drives it and the extracted player through the same
clicks in jsdom — with a seeded RNG, a frozen clock and a recording SCORM API —
and asserts they render identical HTML and make identical LMS calls, over eight
walkthroughs covering every page type and the full 62-click course.

The only sanctioned difference is accessibility: the player adds `tabindex`,
`role` and `aria-*` attributes the original lacked, so hotspot points and match
chips are keyboard-operable. The parity test strips exactly those attributes
and compares everything else strictly — anything else that differs is a bug.

Opening the frozen fixture directly in a browser shows broken images by design;
its assets moved to `content/drive-retinopati/assets/`. Use the built package.

## Layout

| Path | What |
|---|---|
| `packages/course-schema` | Zod schema + forward migrations for the native course format. No DOM. |
| `packages/tracking` | Statement types, `TrackingAdapter`, `NullAdapter`, `Scorm12Adapter`. No DOM. |
| `packages/course-player` | The runtime. Framework-free, zero third-party runtime dependencies. |
| `content/drive-retinopati` | The DRIVE course as `course.json` + assets. |
| `imported/` | SCORM packages from other tools, hosted verbatim. |
| `fixtures/legacy` | The frozen original, kept as the golden reference. |
| `tools/` | `migrate-drive.ts`, `build-standalone.ts`. |
| `test/characterisation` | The parity harness and walkthroughs. |
| `deploy/` | nginx vhost and landing page for the live host. |

## Development

```bash
pnpm verify     # lint + typecheck + 67 tests
pnpm test       # tests only
pnpm migrate:drive       # regenerate content/drive-retinopati/course.json
pnpm build:standalone    # regenerate out/drive-retinopati/
./tools/deploy.sh        # build and ship to gamatutor.komunitech.id
```

Deployment is documented in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — read the
shared-host warning there before changing anything nginx-related.

## Provenance

The DRIVE course content — text, images, narration, lesion coordinates and
questions — was extracted from `SAMPLE MIPA_Modul_DRIVE.pptx`. The platform is
built against published specifications only: ADL SCORM 1.2 and 2004, xAPI,
IMS Content Packaging, WCAG 2.1.
