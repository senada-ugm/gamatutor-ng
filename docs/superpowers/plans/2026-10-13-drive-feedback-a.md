# DRIVE feedback group A — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship Tim DRIVE items 1–10, 12 and the audio seam for 14 in the player and `course.json`.

**Architecture:** Additive schema fields; a per-page narration session in the player drives reveal steps; completion gains an attempt loop; layout moves to a viewport-height, centered column. The S0 legacy-parity suites are retired at tag `s0-parity-final`.

**Tech Stack:** TypeScript, Zod, framework-free DOM player, Vitest + jsdom, esbuild, Playwright (visual check).

**Spec:** `docs/superpowers/specs/2026-10-13-drive-feedback-a-design.md`

## Global Constraints

- `schemaVersion` stays `1`; every new field is optional.
- `@gamatutor/tracking` stays DOM-free (enforced by `typecheck:isolation`).
- Player keeps zero third-party runtime dependencies.
- All learner-facing copy is Bahasa Indonesia.
- `pnpm verify` green at every commit.

## Review Focus

- Leaving a page mid-narration (→, ←, sidebar) must stop voice and timers — no step of page A appearing on page B. Test in Task 3.
- Speech refused / `speechSynthesis` missing / `audio.play()` rejected → timer fallback still reveals every step. Test in Task 3.
- Re-render of the same page (hotspot click, reveal) must not restart narration. Test in Task 3.
- Retake must not keep old quiz answers but must keep sidebar unlocked. Test in Task 6.
- LMS with empty `student_name` → no certificate, no crash. Test in Task 6.

---

### Task 1: Retire legacy parity

**Files:** delete `test/characterisation/{parity,scorm-parity,walkthroughs,harness,smoke}.test.ts`, `harness.ts`, `walkthroughs.ts`, `legacy-equivalent.ts`, `player-harness.ts` if unused, `tools/migrate-drive.ts`; modify `standalone.test.ts` (keep build-output checks only), `package.json` (drop `migrate:drive`), README.

- [ ] Delete, run `pnpm verify`, commit `test: retire S0 legacy parity (tag s0-parity-final)`.

### Task 2: Schema additions

**Files:** `packages/course-schema/src/schema.ts`, `test/schema.test.ts`.

**Produces:** `RevealStep.narration?: string`, `RevealStep.cue?: number`, `Content.audio?`, `Content.revealColumns?: 1|2`, `Cards.audio?`, `Hotspot.ordered?: boolean`, lesion `dx?/dy?: number`, `ImageGrading.title?/instruction?`, `Quiz.tag?`, `Course.completion?: { body?: string; certificateText?: string }`.

- [ ] Test: a page using each new field parses; `revealColumns: 3` rejects. Implement. Commit.

### Task 3: Narration session

**Files:** rewrite `packages/course-player/src/narration.ts`; test `packages/course-player/test/narration.test.ts`.

**Produces:**
```ts
interface Segment { text: string; step: number | null; cue?: number }
function segmentsFor(page: Page): Segment[]          // lead-in (step null) + one per reveal step
function splitSentences(text: string): string[]
function stepHoldMs(text: string): number            // clamp(words*400, 1500, 6000)
class NarrationSession {
  constructor(ctx: RenderContext, page: Page, onStep: (stepIdx: number) => void)
  start(): void; seekToStep(i: number): void; toggle(): void; stop(): void
  readonly engine: 'audio' | 'speech' | 'timer'; readonly playing: boolean
}
function autoNarrationEnabled(win): boolean / setAutoNarration(win, on)
```
Player (`index.ts`) keeps `session` + `sessionPageId`; starts a new one only when page id changes; `goNext` on a `reveal` calls `session.seekToStep`.

- [ ] Tests (fake timers + stub speechSynthesis/Audio): timer reveals steps in order; speech reveals step on its first sentence's `onstart`; speak throwing → timer; navigation stops session (no further onStep); rerender same page does not restart; audio `timeupdate` past cue reveals. Implement. Commit.

### Task 4: Content/cards/hotspot rendering + transcript panel

**Files:** `pages/content.ts`, `pages/cards.ts`, `pages/hotspot.ts`, `chrome/panels.ts`, `dom.ts`, `styles.css`; test `test/content.test.ts`.

- [ ] Tests: all steps rendered, unrevealed have `anim-pending`; ≥4 text steps → `.anim-stack.two-col`; `revealColumns:1` overrides; transcript panel renders `<ul>` for `•` lines and `<p>` per paragraph, and step narrations as bullets; ordered hotspot marks lowest unvisited pin `.next`. Implement. Commit.

### Task 5: Image grading arrows + wrong state; quiz wrong state

**Files:** `pages/image-grading.ts`, `pages/quiz.ts`, `nav.ts` (`gradingChoice`), `styles.css`; test `test/grading.test.ts`.

**Produces:** `badgePosition(l: {x,y,dx?,dy?}): {x:number;y:number}` (default 14% outward from centre, clamp 6–94).

- [ ] Tests: wrong choice → `.opt-row.wrong` + `.reasoning-box.is-wrong` with `Kurang tepat`; right → no `.is-wrong`; badge offset/clamp; SVG has one `line` per lesion; quiz wrong → `.is-wrong`. Implement. Commit.

### Task 6: Completion, retake, certificate name; SCORM

**Files:** `pages/completion.ts`, `nav.ts` (`attempts`, `resetAnswers`), `packages/tracking/src/{adapter,scorm12}.ts`; tests `packages/course-player/test/completion.test.ts`, `packages/tracking/test/scorm12.test.ts`.

**Produces:** `TrackingAdapter.learnerName?(): string | null`; `parseScormName("Herwanto, Guntur") === "Guntur Herwanto"`; `Outcome.success` → `passed/failed`; `terminate()` writes `cmi.core.session_time` `HHHH:MM:SS`.

- [ ] Tests: satisfaction prompt shown; "Belum" records attempt, clears answers, keeps `furthestModuleIdx`, lands on first page of module 1; "Ya" + passed + name → certificate with that name; no name → login notice and no input; failed → no certificate button; empty `student_name` → null. Implement. Commit.

### Task 7: Layout fit + centering

**Files:** `styles.css`, `chrome/shell.ts` (wrap body in `.page`, add auto-narration switch), `tools/build-standalone.ts`; Playwright script `tools/fit-check.mjs`.

- [ ] Build, run fit-check at 1366×768 and 1920×1080 across all pages; iterate CSS until zero overflow; save screenshots to scratch. Commit.

### Task 8: Content edits

**Files:** `content/drive-retinopati/course.json`, delete `content/drive-retinopati/assets/anatomi-mata/`, `deploy/landing/index.html` (remove 3D section).

- [ ] Instructions, ordered hotspot, transcripts with paragraphs/bullets, per-step narration, `completion` texts, lesion `dx/dy` after visual check. Rebuild, fit-check, walkthrough test on standalone build (MULAI → retake → certificate with stub LMS). Commit.

### Task 9: Final verify + review

- [ ] `pnpm verify`, axe, screenshots; one whole-branch review.
