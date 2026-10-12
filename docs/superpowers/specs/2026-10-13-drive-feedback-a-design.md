# DRIVE feedback, group A — player and content revisions

| | |
|---|---|
| **Date** | 2026-10-13 |
| **Status** | Approved (user accepted every recommendation in the brainstorm) |
| **Source** | Tim DRIVE review notes, items 1–15 |
| **Scope** | Items 1–10 and 12 in the player and `course.json`, plus the audio seam for item 14 |
| **Out of scope** | Items 11, 13 (catalogue), 15 (storage/analysis), which need the platform (S1–S5) and get their own spec |

---

## 1. Why this ends S0's parity freeze

S0 proved the extraction by asserting the player renders byte-identical HTML to
the frozen original. Tim DRIVE now asks for visible changes on almost every page
type, so that guarantee has done its job. The last parity-green commit is tagged
`s0-parity-final`; the legacy-comparison suites (`parity`, `scorm-parity`, the
legacy half of `standalone`, `walkthroughs`, `harness`, `smoke`) and
`legacyEquivalent` are deleted. `fixtures/legacy/` stays as a historical record.
`tools/migrate-drive.ts` is deleted too: `course.json` is now the source of
truth and re-running the migration would wipe every later edit.

Replacement net: behaviour tests per feature in `packages/course-player/test`,
a full-course jsdom walkthrough on the standalone build, and a Playwright
fit-to-screen check (§9).

## 2. Decisions

| # | Note | Decision |
|---|---|---|
| 1 | Readable transcript | Transcripts render as paragraphs and bullets, not one block |
| 2 | 2D anatomy only | The 3D embed page leaves the course and the landing page; `embed` stays a page type |
| 3 | Centered layout | Page content sits in a centered column; short pages center vertically |
| 4 | Clearer instructions | Every interactive page states the exact action; ordered hotspots highlight the next number |
| 5 | Items appear with narration | Narration autoplays on entry; reveal steps appear when narration reaches them; timer fallback |
| 6 | Lists in two columns | Text/icon reveal lists of ≥ 4 items render in two column-major columns |
| 7 | Arrows, not circles, on lesions | Numbered badge offset away from the lesion with an arrow pointing at it |
| 8 | Wrong answer is red | Wrong choice and its feedback box turn red in image grading and quiz |
| 9 | Satisfied with score? Retake | Prompt after the post-test for everyone; "no" restarts the modules, last attempt counts |
| 10 | Certificate name from login | Name comes from the LMS (`cmi.core.student_name`); no manual input; without a login, no certificate |
| 12 | No scrolling | Every page fits a 1366×768 viewport; phones may scroll vertically |
| 14 | Recorded voiceover | Pages may carry an `audio` file and steps a `cue` second; the player prefers it over speech synthesis |

## 3. Schema changes (`course-schema`, still `schemaVersion: 1`, all additive)

```ts
RevealStep += { narration?: string; cue?: number }     // text spoken / second in audio
Content    += { audio?: string; revealColumns?: 1 | 2 }
Cards      += { audio?: string }
Hotspot    += { ordered?: boolean }
Lesion     += { dx?: number; dy?: number }              // badge offset, % of image
ImageGrading += { title?: string; instruction?: string }
Quiz       += { tag?: string }
Course     += { completion?: { body?: string; certificateText?: string } }
```

`transcript` keeps its meaning (the text of the narration) but may now contain
blank-line paragraph breaks and `•` bullets. For a reveal page the spoken script
is `transcript` (the lead-in) followed by each step's `narration`; the
transcript panel shows the lead-in as paragraphs and the step narrations as a
bullet list, so there is one source of truth.

DRIVE-specific strings currently hard-coded in the player (completion blurb,
certificate description, grading heading, "Pre/Post Test" tag, "Slide N dari
PPTX asli") move into `course.json` with neutral player defaults. This is the
first step towards item 13.

## 4. Narration director (items 5, 14)

A new `narration.ts` owns one **session per page visit**. The player starts a
session when the current page id changes, never on a re-render, so revealing a
step does not restart the voice.

A session is a list of **segments**: `[lead-in, step1, step2, …]`. Three
engines play them, chosen per page:

1. **Audio** — `page.audio` present. One `<audio>` element; on `timeupdate`
   every step whose `cue` has passed is revealed.
2. **Speech** — Web Speech available and narration on. Segments are split into
   sentences (long utterances stall `onend` in Chrome) and queued; when a step's
   first sentence starts, that step is revealed.
3. **Timer** — narration off or unsupported. Steps appear one by one, each held
   for `clamp(words × 0.4 s, 1.5 s, 6 s)`.

Revealing goes through the existing `state.revealCounts`, so `nextTarget` and
the → button work unchanged: → reveals the next step at once and the session
seeks to that step's segment.

The speak button becomes a play/pause toggle (`🔊 Putar narasi` / `⏸ Jeda`). A
header switch **Narasi otomatis** (default on, remembered in `localStorage`
inside try/catch) turns autoplay off. Autoplay relies on the browser's sticky
user activation, which the hero's MULAI click provides. If `play()` or
`speak()` is refused, the session falls back to the timer engine.

Leaving the page, the sidebar, or the completion screen stops the session.

## 5. Page changes

- **Content with reveal (5, 6).** All steps render from the start. Unrevealed
  ones are `visibility:hidden` so the layout never jumps. Text and icon-row
  steps with ≥ 4 items use a two-column grid filled column-major
  (`grid-auto-flow: column`), so a–e sit on the left and f–j on the right.
  `revealColumns` overrides this. The hint reads
  `Bagian muncul mengikuti narasi (3/10) · klik → untuk mempercepat`.
- **Hotspot (4).** `ordered: true` adds a pulse to the lowest unvisited number.
  Other numbers stay clickable. Placeholder: `Klik nomor 1 untuk memulai.`
- **Image grading (4, 7, 8).** `state.gradingChoice[pageId]` stores the chosen
  option, so the wrong option gets `.wrong` and the feedback box `.is-wrong`
  (red, `✗ Kurang tepat.`). Lesion markers become an SVG overlay with one arrow
  per lesion and a numbered badge placed at the lesion plus `(dx, dy)`. The
  default is 14% outward from the image centre, clamped to 6–94%. Clicking the
  badge reveals the label next to the badge, never on the lesion.
- **Quiz (8).** The feedback box uses `.is-wrong` when the answer is wrong.
- **Transcript panel (1).** Rendered with the same body formatter as page text.

## 6. Completion, retake, certificate (9, 10)

The completion screen shows the score, the percentage, and pass or fail against
`course.passingScore`, then asks **"Apakah Anda sudah puas dengan nilai Anda?"**:

- **Ya** — passed: go to the certificate if a learner name is known. Otherwise
  show `Sertifikat diterbitkan setelah Anda masuk (login) ke platform.` Not
  passed: show that the certificate requires a passing score, and keep the
  retake button.
- **Belum, ulangi pelatihan** — record the attempt, reset every answer
  (quiz, grading, match, hotspot, reveal), keep `furthestModuleIdx`, and go to
  the first page of the first content module.

`state.attempts: { raw, max, at }[]` is shown as a short history list. The
certificate uses the last attempt. `adapter.finish()` runs on every completion,
so an LMS records the latest score. SCORM also gets `lesson_status`
`passed`/`failed` and a `cmi.core.session_time` on terminate (useful for item 15
inside an LMS).

`TrackingAdapter` gains an optional `learnerName(): string | null`.
`Scorm12Adapter` reads `cmi.core.student_name` and turns `"Last, First"` into
`"First Last"`. `NullAdapter` returns null. The name input is removed.

## 7. Layout (3, 12)

- `.app` is `height: 100dvh`. The card fills it, and only `.card-body` may
  scroll, which on desktop it must not need to.
- `.card-body > .page` is a centered column (`max-width: 1080px`, `margin: auto`)
  that is also vertically centered when short.
- Type and media scale with the viewport height: body text
  `clamp(13px, 1.9vh, 16px)`, and images, hotspot stage and fundus capped by
  `vh`. The hotspot stage's width follows its height so the percentage pins
  stay aligned.
- Below 760px wide everything is single-column and vertical scroll is allowed.

## 8. Content edits (`course.json`)

- Drop `modul2-anatomi-3d` and the copied `assets/anatomi-mata/`. The landing
  page's 3D section is removed as well.
- Rewrite instructions: anatomy, `Klik setiap nomor (1–17) …`; pathophysiology,
  `Klik nomor secara berurutan 1–8 untuk mengetahui patofisiologi retinopati
  diabetika.` with `ordered: true`; match; grading; and quiz.
- Split `modul1-p5`, `modul2-p7` and `modul3-p2` transcripts into a lead-in plus
  per-step `narration`. Add paragraph breaks and bullets to every long
  transcript.
- Give lesions `dx/dy` where the default offset would collide.

## 9. Testing

- Unit: narration segmenting and the timer engine (fake timers); retake reset;
  grading wrong state; lesion offset clamp; transcript formatting; SCORM name
  parsing and `passed`/`failed`.
- Walkthrough: the standalone build in jsdom, from MULAI → evaluation →
  "belum puas" → retake → "puas" → certificate, with a stub LMS that provides a
  name.
- Visual: a Playwright script that opens every page at 1366×768 and 1920×1080
  and fails if `.card-body` overflows, plus screenshots for review.
- axe over every page type, as before.
