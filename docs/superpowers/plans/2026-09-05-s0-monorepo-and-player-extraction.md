# GamaTutor S0 — Monorepo and Player Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single 966-line `index.html` DRIVE course into a pnpm monorepo whose framework-free player renders the same course from data, proven identical by a characterisation suite, and rebuild the original SCORM package from that data.

**Architecture:** Three packages with hard boundaries — `@gamatutor/course-schema` (Zod schema + migrations, no DOM), `@gamatutor/tracking` (statement types + adapters, no DOM), `@gamatutor/course-player` (the renderer, DOM only, zero runtime dependencies). The original file is frozen at `fixtures/legacy/index.html` and every extraction task is gated by a jsdom walkthrough that drives the legacy file and the new player through the same clicks and asserts identical `#contentCard` HTML and identical SCORM API calls.

**Tech Stack:** TypeScript 5.6 (strict), pnpm 10 workspaces, Vitest 2 + jsdom, Zod 3, esbuild (player bundle + standalone build), ESLint 9 + Prettier. No React, no framework, no runtime dependencies inside `course-player`.

**Spec:** `docs/superpowers/specs/2026-09-05-gamatutor-platform-design.md`

## Global Constraints

- Node `>=22`. `packageManager: "pnpm@10.14.0"`. Matches SlideForge.
- TypeScript `strict: true` **and** `noUncheckedIndexedAccess: true`. ESLint warnings fail the build.
- `@gamatutor/course-player` has **zero runtime dependencies**. No React, no framework, no npm package in its `dependencies`. Dev dependencies are fine.
- `@gamatutor/course-schema` and `@gamatutor/tracking` have **zero DOM references**. They must run in plain Node.
- Default course language is `id-ID`. All user-facing strings in the DRIVE course stay in Indonesian, verbatim — this is a refactor, not a rewrite.
- `fixtures/legacy/index.html` is **frozen**. No task may edit it. It is the golden reference.
- **Behaviour parity is the acceptance criterion for Tasks 6–15.** If the extracted player renders different HTML than the legacy file for the same clicks, the extraction is wrong — not the test.
- Task 16 is the **only** task permitted to change golden output, and it does so deliberately with a re-baseline.
- `passingScore` lands in the schema in Task 4 but **nothing reads it in S0**. Pass/fail is slice S3. The player reports raw score only, exactly as the legacy file does.

---

## File Structure

```
package.json                                  workspace root, scripts
pnpm-workspace.yaml
tsconfig.base.json
vitest.config.ts
eslint.config.mjs
.prettierrc.json

fixtures/legacy/index.html                    FROZEN golden reference (was ./index.html)
fixtures/legacy/imsmanifest.xml               FROZEN (was ./imsmanifest.xml)

content/drive-retinopati/course.json          generated in Task 5, committed
content/drive-retinopati/assets/              23 files (was ./assets/)

packages/tracking/
  src/statement.ts        Statement, Verb, ResumeState, Outcome, statement()
  src/adapter.ts          TrackingAdapter interface, NullAdapter
  src/scorm12.ts          Scorm12Adapter
  src/index.ts
  test/statement.test.ts
  test/scorm12.test.ts

packages/course-schema/
  src/types.ts            Course, Module, Page union, RevealStep
  src/schema.ts           Zod schemas
  src/migrate.ts          migrateCourse(raw) -> Course
  src/index.ts
  test/schema.test.ts
  test/migrate.test.ts

packages/course-player/
  src/index.ts            createPlayer, RenderContext
  src/nav.ts              PlayerState, createState, goNext/goPrev decisions (pure)
  src/scoring.ts          scoreCourse (pure)
  src/dom.ts              esc, mount helpers
  src/narration.ts        Web Speech wrapper
  src/chrome/shell.ts     cardShell, wireFooterNav
  src/chrome/sidebar.ts   renderSidebar
  src/pages/hero.ts
  src/pages/divider.ts
  src/pages/content.ts    content + animated (reveal_steps)
  src/pages/cards.ts
  src/pages/hotspot.ts
  src/pages/match.ts
  src/pages/image-grading.ts
  src/pages/quiz.ts
  src/pages/video.ts
  src/pages/completion.ts completion screen + certificate
  src/styles.css          extracted from the legacy <style> block
  test/nav.test.ts
  test/scoring.test.ts

test/characterisation/
  harness.ts              jsdom legacy loader, seeded RNG, frozen clock, SCORM recorder
  player-harness.ts       loadPlayer() — created in Task 6, once the player exists
  walkthroughs.ts         named click scripts
  parity.test.ts          legacy vs player, per walkthrough

tools/build-standalone.ts inlines player + css + course.json -> out/<id>/index.html
out/                      generated, gitignored
```

Boundaries: `course-schema` and `tracking` never import `course-player`. `course-player` imports both. `tools/` imports all three. The characterisation harness imports nothing from the packages except through their public entry points.

---

### Task 1: Workspace skeleton and the frozen fixture

**Files:**
- Create: `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, `vitest.config.ts`, `eslint.config.mjs`, `.prettierrc.json`
- Move: `index.html` → `fixtures/legacy/index.html`; `imsmanifest.xml` → `fixtures/legacy/imsmanifest.xml`; `assets/` → `content/drive-retinopati/assets/`
- Modify: `.gitignore`
- Test: `test/characterisation/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `pnpm test`; the frozen fixture at `fixtures/legacy/index.html`.

- [ ] **Step 1: Move the existing files**

```bash
mkdir -p fixtures/legacy content/drive-retinopati
git mv index.html fixtures/legacy/index.html
git mv imsmanifest.xml fixtures/legacy/imsmanifest.xml
git mv assets content/drive-retinopati/assets
```

The legacy file references `assets/...` relatively, which is now a broken path on disk. **That is intentional and harmless:** jsdom does not load subresources, so every characterisation test behaves identically. A browser-runnable copy comes from `pnpm build:standalone` in Task 15. Do not "fix" the paths in the frozen file.

- [ ] **Step 2: Create the workspace files**

`pnpm-workspace.yaml`:

```yaml
packages:
  - 'packages/*'
```

`package.json`:

```json
{
  "name": "gamatutor",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.14.0",
  "engines": { "node": ">=22" },
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc -b",
    "test": "vitest run",
    "test:watch": "vitest",
    "verify": "pnpm lint && pnpm typecheck && pnpm test"
  },
  "devDependencies": {
    "@eslint/js": "^9.15.0",
    "@types/node": "^22.9.0",
    "eslint": "^9.15.0",
    "jsdom": "^25.0.1",
    "prettier": "^3.3.3",
    "tsx": "^4.23.12",
    "typescript": "^5.6.3",
    "typescript-eslint": "^8.15.0",
    "vitest": "^2.1.5"
  }
}
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "declaration": true,
    "composite": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true
  }
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/*/test/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
```

`.prettierrc.json`:

```json
{ "singleQuote": true, "printWidth": 100, "semi": true, "trailingComma": "all" }
```

`eslint.config.mjs`:

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['out/**', 'fixtures/legacy/**', '**/dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
);
```

Append to `.gitignore`:

```
node_modules/
out/
dist/
*.tsbuildinfo
```

- [ ] **Step 3: Write the failing smoke test**

`test/characterisation/smoke.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

describe('frozen legacy fixture', () => {
  it('boots in jsdom and renders the first page', () => {
    const html = readFileSync('fixtures/legacy/index.html', 'utf8');
    const dom = new JSDOM(html, { runScripts: 'dangerously' });
    const card = dom.window.document.getElementById('contentCard');
    expect(card).not.toBeNull();
    expect(card!.innerHTML).toContain('Pelatihan Skrining Retinopati Diabetika');
  });

  it('renders one sidebar entry per module', () => {
    const html = readFileSync('fixtures/legacy/index.html', 'utf8');
    const dom = new JSDOM(html, { runScripts: 'dangerously' });
    const steps = dom.window.document.querySelectorAll('#stepList .step');
    expect(steps.length).toBe(7);
  });
});
```

- [ ] **Step 4: Run it and verify it fails**

Run: `pnpm install && pnpm vitest run test/characterisation/smoke.test.ts`
Expected before the move: FAIL, `ENOENT: fixtures/legacy/index.html`. After Steps 1–2 it should PASS. If the module count assertion fails, read the module list in the fixture and correct the expected number — do not change the fixture.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: pnpm workspace skeleton, freeze legacy course as fixture"
```

---

### Task 2: The characterisation harness

This is the safety net every later task depends on. It must remove all three sources of nondeterminism: `Math.random` (the match page shuffles), `Date` (the certificate prints today's date), and the missing SCORM API.

**Files:**
- Create: `test/characterisation/harness.ts`, `test/characterisation/walkthroughs.ts`
- Test: `test/characterisation/harness.test.ts`

**Interfaces:**
- Consumes: `fixtures/legacy/index.html`.
- Produces:
  - `type ScormCall = { method: string; args: string[] }`
  - `type Step = { click: string } | { clickText: string } | { setValue: [string, string] }`
  - `type Snapshot = { step: number; label: string; card: string }`
  - `loadLegacy(): Promise<Harness>` where `Harness = { window: Window; document: Document; scorm: ScormCall[]; }`
  - `runWalkthrough(h: Harness, steps: Step[]): Snapshot[]`
  - `normalise(html: string): string`

- [ ] **Step 1: Write the failing harness test**

`test/characterisation/harness.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadLegacy, runWalkthrough, normalise } from './harness.js';

describe('characterisation harness', () => {
  it('is deterministic across two loads of the same fixture', async () => {
    const a = await loadLegacy();
    const b = await loadLegacy();
    const steps = [{ click: '#nextBtn' }, { click: '#nextBtn' }, { click: '#nextBtn' }];
    expect(runWalkthrough(a, steps)).toEqual(runWalkthrough(b, steps));
  });

  it('records SCORM calls made during boot', async () => {
    const h = await loadLegacy();
    expect(h.scorm.map((c) => c.method)).toContain('LMSInitialize');
  });

  it('normalise collapses whitespace but keeps state classes', () => {
    expect(normalise('<div   class="anim-step anim-in" >\n  x </div>')).toBe(
      '<div class="anim-step anim-in"> x </div>',
    );
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: `pnpm vitest run test/characterisation/harness.test.ts`
Expected: FAIL with "Cannot find module './harness.js'".

- [ ] **Step 3: Write the harness**

`test/characterisation/harness.ts`:

```ts
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

export type ScormCall = { method: string; args: string[] };

export type Step =
  | { click: string }
  | { clickText: string }
  | { setValue: [selector: string, value: string] };

export type Snapshot = { step: number; label: string; card: string };

export interface Harness {
  window: Window & typeof globalThis;
  document: Document;
  scorm: ScormCall[];
}

/** Deterministic LCG. Same seed => same sequence, in legacy and in the new player. */
export function seededRandom(seed = 42): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** A SCORM 1.2 API that records instead of storing. */
export function recordingScormApi(sink: ScormCall[]): Record<string, unknown> {
  const record =
    (method: string, ret: string) =>
    (...args: unknown[]) => {
      sink.push({ method, args: args.map(String) });
      return ret;
    };
  return {
    LMSInitialize: record('LMSInitialize', 'true'),
    LMSFinish: record('LMSFinish', 'true'),
    LMSGetValue: (name: string) => {
      sink.push({ method: 'LMSGetValue', args: [name] });
      return name === 'cmi.core.lesson_status' ? 'not attempted' : '';
    },
    LMSSetValue: record('LMSSetValue', 'true'),
    LMSCommit: record('LMSCommit', 'true'),
    LMSGetLastError: () => '0',
    LMSGetErrorString: () => '',
    LMSGetDiagnostic: () => '',
  };
}

const FROZEN_NOW = new Date('2026-09-05T09:00:00.000Z');

/** Install everything nondeterministic BEFORE the page's own scripts run. */
export function installDeterminism(window: Window & typeof globalThis, scorm: ScormCall[]): void {
  const rng = seededRandom();
  window.Math.random = rng;
  (window as unknown as { API: unknown }).API = recordingScormApi(scorm);
  window.alert = () => {};
  const RealDate = window.Date;
  class FrozenDate extends RealDate {
    constructor(...args: ConstructorParameters<typeof Date>) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      super(...(args.length ? (args as any) : [FROZEN_NOW.getTime()]));
    }
    static override now(): number {
      return FROZEN_NOW.getTime();
    }
  }
  (window as unknown as { Date: unknown }).Date = FrozenDate;
}

export async function loadLegacy(): Promise<Harness> {
  const html = readFileSync('fixtures/legacy/index.html', 'utf8');
  const scorm: ScormCall[] = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    beforeParse(window) {
      installDeterminism(window as unknown as Window & typeof globalThis, scorm);
    },
  });
  const window = dom.window as unknown as Window & typeof globalThis;
  return { window, document: window.document, scorm };
}

export function normalise(html: string): string {
  return html
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .replace(/\s+>/g, '>')
    .trim();
}

function click(document: Document, selector: string): void {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`walkthrough: no element matches ${selector}`);
  el.click();
}

function clickText(document: Document, text: string): void {
  const all = Array.from(document.querySelectorAll<HTMLElement>('#contentCard *'));
  const el = all.find((e) => e.textContent?.trim() === text);
  if (!el) throw new Error(`walkthrough: no element with exact text "${text}"`);
  el.click();
}

export function runWalkthrough(h: Harness, steps: Step[]): Snapshot[] {
  const card = () => normalise(h.document.getElementById('contentCard')?.innerHTML ?? '');
  const out: Snapshot[] = [{ step: 0, label: 'initial', card: card() }];
  steps.forEach((step, i) => {
    let label: string;
    if ('click' in step) {
      click(h.document, step.click);
      label = `click ${step.click}`;
    } else if ('clickText' in step) {
      clickText(h.document, step.clickText);
      label = `clickText ${step.clickText}`;
    } else {
      const [selector, value] = step.setValue;
      const el = h.document.querySelector<HTMLInputElement>(selector);
      if (!el) throw new Error(`walkthrough: no input matches ${selector}`);
      el.value = value;
      label = `setValue ${selector}`;
    }
    out.push({ step: i + 1, label, card: card() });
  });
  return out;
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm vitest run test/characterisation/harness.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Define the named walkthroughs**

`test/characterisation/walkthroughs.ts`. Each later task turns on one more of these. Keep them in this file so parity tests stay declarative.

```ts
import type { Step } from './harness.js';

const next = { click: '#nextBtn' } as const;
const prev = { click: '#prevBtn' } as const;

/** Task 6: hero + divider + sidebar + nav chrome. */
export const openingWalkthrough: Step[] = [next, next, prev, next, next];

/** Task 7: content pages, including reveal_steps and the video step. */
export const contentWalkthrough: Step[] = [
  next, next, next, next,            // into modul1 content
  next, next, next, next, next,      // through reveal_steps on faktor risiko
  next, next, next, next,
];

/** Task 8: cards pages. */
export const cardsWalkthrough: Step[] = [
  { click: '#stepList .step[data-idx="1"]' }, next, next, next,
];

/** Task 9: hotspot points and masks. */
export const hotspotWalkthrough: Step[] = [
  { click: '#stepList .step[data-idx="2"]' }, next,
  { click: '#hotspotStage .hotspot-point[data-i="0"]' },
  { click: '#hotspotStage .hotspot-point[data-i="5"]' },
  { click: '#hotspotStage .hotspot-point[data-i="0"]' },
];

/** Task 10: match, click-to-place path (drag is not available in jsdom). */
export const matchWalkthrough: Step[] = [
  { click: '#stepList .step[data-idx="2"]' },
  next, next, next, next, next, next,
  { click: '#matchLeft .match-chip[data-id="durasi"]' },
  { click: '#matchRight .match-zone[data-id="durasi"]' },
  { click: '#matchLeft .match-chip[data-id="hipertensi"]' },
  { click: '#matchRight .match-zone[data-id="glikemik"]' },
];

/** Task 11: image-grading (was fundus) — answer, then reveal lesion pins. */
export const gradingWalkthrough: Step[] = [
  { click: '#stepList .step[data-idx="4"]' }, next,
  { click: '#optList .opt[data-val="0"]' },
  next,
  { click: '#optList .opt[data-val="1"]' },
];

/** Task 12: quiz — answering gates the next button. */
export const quizWalkthrough: Step[] = [
  { click: '#stepList .step[data-idx="5"]' }, next,
  next,                                            // blocked until answered
  { click: '#quizOptList .opt[data-letter="C"]' },
  { click: '#quizSubmitBtn' },
  next,
];

/**
 * Task 13 + 14 + 15: the whole course end to end, finishing at the certificate.
 * Deliberately a stub until Task 13, which derives the full click sequence
 * mechanically (see Task 13 Step 1) rather than guessing it. Nothing before
 * Task 13 imports this.
 */
export const fullWalkthrough: Step[] = [...openingWalkthrough];
```

> **Note for the executor:** the selectors above (`.hotspot-point[data-i]`, `.match-chip[data-id]`, `.opt[data-val]`, `.opt[data-letter]`) are read off the legacy renderers at `fixtures/legacy/index.html:609-863`. Before relying on one, confirm it against the fixture; if a selector is wrong the walkthrough throws a clear "no element matches" error naming it. Fix the selector, never the fixture.

- [ ] **Step 6: Commit**

```bash
git add test/characterisation
git commit -m "test: deterministic characterisation harness for the legacy course"
```

---

### Task 3: `@gamatutor/tracking`

Pure types and a null adapter. No DOM, no network. `Scorm12Adapter` arrives in Task 14. The spec's third implementation, `PlatformAdapter`, belongs to slice S2 — it needs an API to POST to — so it is deliberately absent here.

**Files:**
- Create: `packages/tracking/package.json`, `tsconfig.json`, `src/statement.ts`, `src/adapter.ts`, `src/index.ts`
- Test: `packages/tracking/test/statement.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Verb = 'launched' | 'experienced' | 'interacted' | 'answered' | 'completed' | 'passed' | 'failed' | 'terminated'`
  - `interface Score { raw: number; min: number; max: number }`
  - `interface Statement { verb: Verb; objectId: string; result?: { response?: string; success?: boolean; score?: Score }; context?: Record<string, unknown>; timestamp: string }`
  - `interface ResumeState { moduleId: string; pageId: string; data?: Record<string, unknown> }`
  - `interface Outcome { completed: boolean; success?: boolean; score?: Score }`
  - `interface TrackingAdapter { init(): Promise<ResumeState | null>; emit(s: Statement): void; commit(): Promise<void>; finish(o: Outcome): Promise<void> }`
  - `function statement(verb: Verb, objectId: string, extra?: Omit<Statement, 'verb' | 'objectId' | 'timestamp'>): Statement`
  - `class NullAdapter implements TrackingAdapter` — with a public readonly `sent: Statement[]` so tests can inspect it.

- [ ] **Step 1: Write the failing test**

`packages/tracking/test/statement.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NullAdapter, statement } from '../src/index.js';

describe('statement', () => {
  it('stamps verb, object and an ISO timestamp', () => {
    const s = statement('experienced', 'modul1-p2');
    expect(s.verb).toBe('experienced');
    expect(s.objectId).toBe('modul1-p2');
    expect(Number.isNaN(Date.parse(s.timestamp))).toBe(false);
  });

  it('carries a result through unchanged', () => {
    const s = statement('answered', 'evaluasi-p2', {
      result: { response: 'C', success: true },
    });
    expect(s.result).toEqual({ response: 'C', success: true });
  });
});

describe('NullAdapter', () => {
  it('records emitted statements and resumes nothing', async () => {
    const a = new NullAdapter();
    expect(await a.init()).toBeNull();
    a.emit(statement('launched', 'drive-retinopati'));
    await a.commit();
    await a.finish({ completed: true, score: { raw: 4, min: 0, max: 5 } });
    expect(a.sent.map((s) => s.verb)).toEqual(['launched']);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: `pnpm vitest run packages/tracking`
Expected: FAIL, "Cannot find module '../src/index.js'".

- [ ] **Step 3: Write the implementation**

`packages/tracking/package.json`:

```json
{
  "name": "@gamatutor/tracking",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": { "typecheck": "tsc -b" }
}
```

`packages/tracking/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": ".", "lib": ["ES2022"] },
  "include": ["src", "test"]
}
```

`packages/tracking/src/statement.ts`:

```ts
export type Verb =
  | 'launched'
  | 'experienced'
  | 'interacted'
  | 'answered'
  | 'completed'
  | 'passed'
  | 'failed'
  | 'terminated';

export interface Score {
  raw: number;
  min: number;
  max: number;
}

export interface Statement {
  verb: Verb;
  objectId: string;
  result?: { response?: string; success?: boolean; score?: Score };
  context?: Record<string, unknown>;
  timestamp: string;
}

export interface ResumeState {
  moduleId: string;
  pageId: string;
  data?: Record<string, unknown>;
}

export interface Outcome {
  completed: boolean;
  success?: boolean;
  score?: Score;
}

export function statement(
  verb: Verb,
  objectId: string,
  extra: Omit<Statement, 'verb' | 'objectId' | 'timestamp'> = {},
): Statement {
  return { verb, objectId, timestamp: new Date().toISOString(), ...extra };
}
```

`packages/tracking/src/adapter.ts`:

```ts
import type { Outcome, ResumeState, Statement } from './statement.js';

export interface TrackingAdapter {
  init(): Promise<ResumeState | null>;
  emit(s: Statement): void;
  commit(): Promise<void>;
  finish(o: Outcome): Promise<void>;
}

/** Records nothing anywhere. Used for instructor preview and in tests. */
export class NullAdapter implements TrackingAdapter {
  readonly sent: Statement[] = [];
  async init(): Promise<ResumeState | null> {
    return null;
  }
  emit(s: Statement): void {
    this.sent.push(s);
  }
  async commit(): Promise<void> {}
  async finish(_o: Outcome): Promise<void> {}
}
```

`packages/tracking/src/index.ts`:

```ts
export * from './statement.js';
export * from './adapter.js';
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm vitest run packages/tracking`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/tracking
git commit -m "feat(tracking): statement types, TrackingAdapter interface, NullAdapter"
```

---

### Task 4: `@gamatutor/course-schema` — the v1 schema

**Files:**
- Create: `packages/course-schema/package.json`, `tsconfig.json`, `src/types.ts`, `src/schema.ts`, `src/index.ts`
- Test: `packages/course-schema/test/schema.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `CourseSchema` (Zod), `parseCourse(raw: unknown): Course`, and the exported TS types `Course`, `Module`, `Page`, `RevealStep`, `HotspotPoint`, `MatchPair`, `QuizOption`.

Page ids are strings. Module ids are strings. Both are required in v1 — see Task 5 for how they are generated for DRIVE.

- [ ] **Step 1: Write the failing test**

`packages/course-schema/test/schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseCourse } from '../src/index.js';

const minimal = {
  schemaVersion: 1,
  id: 'demo',
  title: 'Demo',
  language: 'id-ID',
  brand: { name: 'Demo School', mark: 'D' },
  passingScore: 0.6,
  assessment: { mode: 'formative' },
  modules: [
    { id: 'm1', label: 'Modul 1', pages: [{ id: 'm1-p1', type: 'divider', title: 'BAB 1' }] },
  ],
};

describe('parseCourse', () => {
  it('accepts a minimal valid course', () => {
    expect(parseCourse(minimal).id).toBe('demo');
  });

  it('rejects a page with no id', () => {
    const bad = structuredClone(minimal);
    delete (bad.modules[0]!.pages[0] as Record<string, unknown>).id;
    expect(() => parseCourse(bad)).toThrow();
  });

  it('rejects an unknown page type', () => {
    const bad = structuredClone(minimal);
    (bad.modules[0]!.pages[0] as Record<string, unknown>).type = 'fundus';
    expect(() => parseCourse(bad)).toThrow();
  });

  it('accepts a completion module with no pages', () => {
    const ok = structuredClone(minimal);
    ok.modules.push({ id: 'selesai', label: 'Selesai', completion: true, pages: [] } as never);
    expect(parseCourse(ok).modules).toHaveLength(2);
  });

  it('accepts all three reveal step shapes', () => {
    const ok = structuredClone(minimal);
    ok.modules[0]!.pages.push({
      id: 'm1-p2',
      type: 'content',
      reveal_steps: [
        { texts: ['a', 'b'] },
        { image: 'assets/x.png', title: 't', body: 'b' },
        { video: { src: 'assets/v.mp4', poster: 'assets/v.jpg' } },
      ],
    } as never);
    expect(parseCourse(ok).modules[0]!.pages).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: `pnpm vitest run packages/course-schema`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the schema**

Add `"zod": "^3.23.8"` to `packages/course-schema/package.json` dependencies. Package name `@gamatutor/course-schema`, same shape as the tracking package.json, and a `tsconfig.json` with `"lib": ["ES2022"]` (no DOM).

`packages/course-schema/src/schema.ts`:

```ts
import { z } from 'zod';

const RevealStepSchema = z.union([
  z.object({ texts: z.array(z.string()).min(1) }),
  z.object({ image: z.string(), title: z.string().optional(), body: z.string().optional() }),
  z.object({ video: z.object({ src: z.string(), poster: z.string().optional() }) }),
]);

const base = { id: z.string().min(1), slide: z.number().int().optional() };

const HeroSchema = z.object({ ...base, type: z.literal('hero'), title: z.string(), body: z.string().optional() });

const DividerSchema = z.object({
  ...base,
  type: z.literal('divider'),
  kicker: z.string().optional(),
  title: z.string(),
});

const ContentSchema = z.object({
  ...base,
  type: z.literal('content'),
  kicker: z.string().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
  transcript: z.string().optional(),
  image: z.string().optional(),
  imageLayout: z.literal('below').optional(),
  imageCaption: z.string().optional(),
  reveal_steps: z.array(RevealStepSchema).optional(),
});

const CardsSchema = z.object({
  ...base,
  type: z.literal('cards'),
  kicker: z.string().optional(),
  title: z.string().optional(),
  intro: z.string().optional(),
  transcript: z.string().optional(),
  columns: z.number().int().min(1).max(4).optional(),
  cards: z.array(
    z.object({
      big: z.string().optional(),
      title: z.string().optional(),
      body: z.string(),
      dark: z.boolean().optional(),
    }),
  ),
  trailingImage: z.string().optional(),
  trailingCaption: z.string().optional(),
  trailingNote: z.string().optional(),
});

const HotspotSchema = z.object({
  ...base,
  type: z.literal('hotspot'),
  kicker: z.string().optional(),
  title: z.string(),
  intro: z.string().optional(),
  image: z.string(),
  points: z.array(
    z.object({ x: z.number(), y: z.number(), label: z.string(), body: z.string() }),
  ),
  masks: z
    .array(z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }))
    .optional(),
});

const MatchSchema = z.object({
  ...base,
  type: z.literal('match'),
  kicker: z.string().optional(),
  title: z.string(),
  intro: z.string().optional(),
  pairs: z.array(z.object({ id: z.string(), left: z.string(), right: z.string() })).min(2),
});

const ImageGradingSchema = z.object({
  ...base,
  type: z.literal('image-grading'),
  level: z.string().optional(),
  image: z.string(),
  options: z.array(z.string()).min(2),
  correct: z.string(),
  reasoning: z.string(),
  lesions: z.array(z.object({ x: z.number(), y: z.number(), label: z.string() })),
});

const QuizSchema = z.object({
  ...base,
  type: z.literal('quiz'),
  graded: z.boolean().default(true),
  question: z.string(),
  options: z.array(z.object({ letter: z.string(), text: z.string() })).min(2),
  correct: z.string(),
  explanation: z.string(),
});

const VideoSchema = z.object({
  ...base,
  type: z.literal('video'),
  title: z.string().optional(),
  src: z.string(),
  poster: z.string().optional(),
  captions: z.string().optional(),
});

export const PageSchema = z.discriminatedUnion('type', [
  HeroSchema,
  DividerSchema,
  ContentSchema,
  CardsSchema,
  HotspotSchema,
  MatchSchema,
  ImageGradingSchema,
  QuizSchema,
  VideoSchema,
]);

export const ModuleSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  completion: z.boolean().optional(),
  pages: z.array(PageSchema),
});

export const CourseSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  title: z.string(),
  language: z.string().default('id-ID'),
  brand: z.object({ name: z.string(), mark: z.string() }),
  passingScore: z.number().min(0).max(1),
  assessment: z.object({ mode: z.enum(['formative', 'secured']) }),
  modules: z.array(ModuleSchema).min(1),
});
```

`packages/course-schema/src/types.ts`:

```ts
import type { z } from 'zod';
import type { CourseSchema, ModuleSchema, PageSchema } from './schema.js';

export type Course = z.infer<typeof CourseSchema>;
export type Module = z.infer<typeof ModuleSchema>;
export type Page = z.infer<typeof PageSchema>;
export type PageOfType<T extends Page['type']> = Extract<Page, { type: T }>;
```

`packages/course-schema/src/index.ts`:

```ts
import { CourseSchema } from './schema.js';
import type { Course } from './types.js';

export * from './schema.js';
export * from './types.js';

export function parseCourse(raw: unknown): Course {
  return CourseSchema.parse(raw);
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm vitest run packages/course-schema`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/course-schema
git commit -m "feat(course-schema): v1 Zod schema for the native course format"
```

---

### Task 5: The v0 → v1 migration, and DRIVE as data

The legacy JSON has no version, no ids, `fundus` instead of `image-grading`, and a bare `{ video: true }` reveal step. This task converts it once, deterministically, and commits the result.

**Do not** hoist the video reveal step into a standalone `video` page. That would change the page count and break every walkthrough. The `video` page type exists for future courses; DRIVE keeps its reveal step, only reshaped to `{ video: { src, poster } }`.

**Files:**
- Create: `packages/course-schema/src/migrate.ts`, `packages/course-schema/test/migrate.test.ts`, `tools/migrate-drive.ts`
- Create (generated, committed): `content/drive-retinopati/course.json`

**Interfaces:**
- Consumes: `parseCourse` from Task 4.
- Produces: `migrateCourse(raw: unknown, meta: CourseMeta): Course` where
  `interface CourseMeta { id: string; title: string; brand: { name: string; mark: string }; passingScore: number; language?: string }`

Id rules, applied in order and asserted by test:
- Module id = the legacy `key` (`pengantar`, `modul1`, … `selesai`).
- Page id = `` `${moduleId}-p${pageIndex + 1}` `` — 1-based, in source order.
- The module whose legacy key is `selesai` gets `completion: true`.

- [ ] **Step 1: Write the failing test**

`packages/course-schema/test/migrate.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { migrateCourse } from '../src/migrate.js';

const META = {
  id: 'drive-retinopati',
  title: 'DRIVE — Skrining Retinopati Diabetika untuk Dokter Layanan Primer',
  brand: { name: 'DRIVE School', mark: '👁' },
  passingScore: 0.6,
};

/** Pull the raw JSON straight out of the frozen fixture. */
function legacyRaw(): unknown {
  const html = readFileSync('fixtures/legacy/index.html', 'utf8');
  const m = html.match(
    /<script id="course-data" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!m?.[1]) throw new Error('course-data block not found in the frozen fixture');
  return JSON.parse(m[1]);
}

describe('migrateCourse', () => {
  it('produces a schema-valid v1 course', () => {
    const c = migrateCourse(legacyRaw(), META);
    expect(c.schemaVersion).toBe(1);
    expect(c.modules).toHaveLength(7);
  });

  it('assigns deterministic module and page ids', () => {
    const c = migrateCourse(legacyRaw(), META);
    expect(c.modules[0]!.id).toBe('pengantar');
    expect(c.modules[0]!.pages[0]!.id).toBe('pengantar-p1');
    expect(c.modules[1]!.pages[2]!.id).toBe('modul1-p3');
  });

  it('renames fundus to image-grading', () => {
    const c = migrateCourse(legacyRaw(), META);
    const types = c.modules.flatMap((m) => m.pages.map((p) => p.type));
    expect(types).toContain('image-grading');
    expect(types).not.toContain('fundus');
  });

  it('reshapes the bare video reveal step without changing page count', () => {
    const raw = legacyRaw() as { modules: { key: string; pages: unknown[] }[] };
    const before = raw.modules.find((m) => m.key === 'modul3')!.pages.length;
    const c = migrateCourse(raw, META);
    const modul3 = c.modules.find((m) => m.id === 'modul3')!;
    expect(modul3.pages).toHaveLength(before);
    const page = modul3.pages[1]!;
    if (page.type !== 'content' || !page.reveal_steps) throw new Error('expected reveal steps');
    expect(page.reveal_steps.at(-1)).toEqual({
      video: { src: 'assets/visus.mp4', poster: 'assets/visus_poster.jpg' },
    });
  });

  it('flags the completion module', () => {
    const c = migrateCourse(legacyRaw(), META);
    expect(c.modules.at(-1)).toMatchObject({ id: 'selesai', completion: true, pages: [] });
  });

  it('marks every quiz page graded', () => {
    const c = migrateCourse(legacyRaw(), META);
    const quizzes = c.modules.flatMap((m) => m.pages).filter((p) => p.type === 'quiz');
    expect(quizzes).toHaveLength(5);
    expect(quizzes.every((q) => q.type === 'quiz' && q.graded)).toBe(true);
  });

  it('is idempotent — migrating twice gives the same course', () => {
    const once = migrateCourse(legacyRaw(), META);
    expect(migrateCourse(once, META)).toEqual(once);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: `pnpm vitest run packages/course-schema/test/migrate.test.ts`
Expected: FAIL, "Cannot find module '../src/migrate.js'".

- [ ] **Step 3: Write the migration**

`packages/course-schema/src/migrate.ts`:

```ts
import { parseCourse } from './index.js';
import type { Course } from './types.js';

export interface CourseMeta {
  id: string;
  title: string;
  brand: { name: string; mark: string };
  passingScore: number;
  language?: string;
}

const LEGACY_VIDEO = { src: 'assets/visus.mp4', poster: 'assets/visus_poster.jpg' } as const;

type Raw = Record<string, unknown>;

function migrateRevealStep(step: Raw): Raw {
  if (step['video'] === true) return { video: { ...LEGACY_VIDEO } };
  return step;
}

function migratePage(page: Raw, moduleId: string, index: number): Raw {
  const out: Raw = { ...page, id: page['id'] ?? `${moduleId}-p${index + 1}` };
  if (out['type'] === 'fundus') out['type'] = 'image-grading';
  if (out['type'] === 'quiz') {
    out['graded'] = true;
    delete out['index'];
    delete out['total'];
  }
  if (Array.isArray(out['reveal_steps'])) {
    out['reveal_steps'] = (out['reveal_steps'] as Raw[]).map(migrateRevealStep);
  }
  return out;
}

/**
 * Convert the unversioned legacy course JSON to schema v1. Idempotent: a v1
 * course passed back in comes out unchanged.
 */
export function migrateCourse(raw: unknown, meta: CourseMeta): Course {
  const src = raw as Raw;
  const modules = (src['modules'] as Raw[]).map((m) => {
    const id = String(m['id'] ?? m['key']);
    const pages = (m['pages'] as Raw[]).map((p, i) => migratePage(p, id, i));
    const out: Raw = { id, label: String(m['label']), pages };
    if (id === 'selesai' || m['completion'] === true) out['completion'] = true;
    return out;
  });

  return parseCourse({
    schemaVersion: 1,
    id: meta.id,
    title: meta.title,
    language: meta.language ?? 'id-ID',
    brand: meta.brand,
    passingScore: meta.passingScore,
    assessment: { mode: 'formative' },
    modules,
  });
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm vitest run packages/course-schema`
Expected: PASS, 12 tests total across both schema files. If the "7 modules" or "5 quizzes" assertions fail, read the actual counts out of the fixture and correct the test — the fixture is the truth.

- [ ] **Step 5: Generate and commit the course file**

`tools/migrate-drive.ts`:

```ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { migrateCourse } from '../packages/course-schema/src/migrate.js';

const html = readFileSync('fixtures/legacy/index.html', 'utf8');
const m = html.match(/<script id="course-data" type="application\/json">([\s\S]*?)<\/script>/);
if (!m?.[1]) throw new Error('course-data block not found');

const course = migrateCourse(JSON.parse(m[1]), {
  id: 'drive-retinopati',
  title: 'DRIVE — Skrining Retinopati Diabetika untuk Dokter Layanan Primer',
  brand: { name: 'DRIVE School', mark: '👁' },
  passingScore: 0.6,
});

mkdirSync('content/drive-retinopati', { recursive: true });
writeFileSync(
  'content/drive-retinopati/course.json',
  JSON.stringify(course, null, 2) + '\n',
  'utf8',
);
console.log(`wrote ${course.modules.length} modules`);
```

Add to the root `package.json` scripts: `"migrate:drive": "tsx tools/migrate-drive.ts"`.

Run: `pnpm migrate:drive`
Expected: `wrote 7 modules`, and `content/drive-retinopati/course.json` exists.

- [ ] **Step 6: Commit**

```bash
git add packages/course-schema tools/migrate-drive.ts content/drive-retinopati/course.json package.json
git commit -m "feat(course-schema): v0 to v1 migration; DRIVE course as data"
```

---

### Task 6: Player core — state, nav, shell, sidebar, hero, divider

From here to Task 13, each task moves renderers out of `fixtures/legacy/index.html` and proves parity. The implementation is largely the legacy code with three mechanical changes applied throughout:

1. `pageKey()` (which returned `modIdx + '-' + pageIdx`) becomes the page's `id`.
2. Module identity checks (`mod.key === 'selesai'`, `mod.key === 'pengantar'`) become `module.completion === true` and `page.type === 'hero'`.
3. Hardcoded brand strings (`DRIVE School`, `👁`) and the sidebar course title read from `course.brand` and `course.title`.

Everything else — class names, element ids, attribute order, entity escaping, emoji — must come across **verbatim**, because the characterisation test compares HTML strings.

**Files:**
- Create: `packages/course-player/package.json`, `tsconfig.json`, `src/dom.ts`, `src/state.ts`, `src/nav.ts`, `src/chrome/shell.ts`, `src/chrome/sidebar.ts`, `src/pages/hero.ts`, `src/pages/divider.ts`, `src/narration.ts`, `src/index.ts`, `src/styles.css`
- Test: `packages/course-player/test/nav.test.ts`, `test/characterisation/parity.test.ts`

**Interfaces:**
- Consumes: `Course`, `Module`, `Page` from `@gamatutor/course-schema`; `TrackingAdapter`, `NullAdapter`, `statement` from `@gamatutor/tracking`.
- Produces:
  - `interface PlayerCapabilities { narration: 'webspeech' | 'audio' | 'off'; resume: boolean; certificate: boolean; offline: boolean; grading: 'client' | 'server' }`
  - `interface PlayerOptions { mount: HTMLElement; course: Course; adapter?: TrackingAdapter; capabilities?: Partial<PlayerCapabilities>; random?: () => number }`
  - `interface Player { render(): void; destroy(): void; readonly state: PlayerState }`
  - `function createPlayer(opts: PlayerOptions): Player`
  - `interface RenderContext { document: Document; course: Course; state: PlayerState; adapter: TrackingAdapter; capabilities: PlayerCapabilities; random: () => number; rerender: () => void }` — the single argument every page renderer takes, from `src/pages/hero.ts` onward
  - `interface PlayerState { moduleIdx: number; pageIdx: number; furthestModuleIdx: number; revealCounts: Record<string, number>; quizAnswers: Record<string, string>; gradingAnswered: Record<string, boolean>; gradingPins: Record<string, boolean[]>; hotspotVisited: Record<string, boolean[]>; hotspotActive: Record<string, number | null>; matchState: Record<string, MatchState>; learnerName: string; showCertificate: boolean }`
  - `function nextTarget(course: Course, state: PlayerState): NavResult` and `function prevTarget(course: Course, state: PlayerState): NavResult` where `type NavResult = { kind: 'blocked' } | { kind: 'reveal'; pageId: string; to: number } | { kind: 'move'; moduleIdx: number; pageIdx: number }`

`createPlayer` requires `mount` to be the element with id `contentCard`'s parent structure already present — the player writes into `#contentCard` and `#stepList`, the same two hooks the legacy file uses. Task 15's standalone build emits that surrounding markup.

- [ ] **Step 1: Write the failing nav test**

`packages/course-player/test/nav.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseCourse } from '@gamatutor/course-schema';
import { createState, nextTarget, prevTarget } from '../src/nav.js';

const course = parseCourse(JSON.parse(readFileSync('content/drive-retinopati/course.json', 'utf8')));

describe('nextTarget', () => {
  it('advances within a module', () => {
    const s = createState();
    expect(nextTarget(course, s)).toEqual({ kind: 'move', moduleIdx: 0, pageIdx: 1 });
  });

  it('rolls into the next module at its first page', () => {
    const s = createState();
    s.pageIdx = course.modules[0]!.pages.length - 1;
    expect(nextTarget(course, s)).toEqual({ kind: 'move', moduleIdx: 1, pageIdx: 0 });
  });

  it('consumes reveal steps before moving on', () => {
    const s = createState();
    const idx = course.modules.findIndex((m) => m.id === 'modul1');
    const pageIdx = course.modules[idx]!.pages.findIndex(
      (p) => p.type === 'content' && Array.isArray(p.reveal_steps) && p.reveal_steps.length > 1,
    );
    s.moduleIdx = idx;
    s.pageIdx = pageIdx;
    const page = course.modules[idx]!.pages[pageIdx]!;
    expect(nextTarget(course, s)).toEqual({ kind: 'reveal', pageId: page.id, to: 2 });
  });

  it('blocks on an unanswered quiz page', () => {
    const s = createState();
    const idx = course.modules.findIndex((m) => m.id === 'evaluasi');
    s.moduleIdx = idx;
    s.pageIdx = course.modules[idx]!.pages.findIndex((p) => p.type === 'quiz');
    expect(nextTarget(course, s)).toEqual({ kind: 'blocked' });
  });
});

describe('prevTarget', () => {
  it('is blocked at the very first page', () => {
    expect(prevTarget(course, createState())).toEqual({ kind: 'blocked' });
  });

  it('steps back into the previous module at its last page', () => {
    const s = createState();
    s.moduleIdx = 1;
    s.pageIdx = 0;
    expect(prevTarget(course, s)).toEqual({
      kind: 'move',
      moduleIdx: 0,
      pageIdx: course.modules[0]!.pages.length - 1,
    });
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: `pnpm vitest run packages/course-player`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement state and nav as pure functions**

`packages/course-player/src/nav.ts` — port `goNext`/`goPrev` from `fixtures/legacy/index.html:380-416`, keeping the decision order exactly: quiz gate first, then reveal steps, then page, then module. Return a decision instead of mutating and re-rendering; `index.ts` applies it.

```ts
import type { Course } from '@gamatutor/course-schema';

export interface MatchState {
  leftOrder: string[];
  rightOrder: string[];
  matched: Record<string, boolean>;
  selected: string | null;
}

export interface PlayerState {
  moduleIdx: number;
  pageIdx: number;
  furthestModuleIdx: number;
  revealCounts: Record<string, number>;
  quizAnswers: Record<string, string>;
  gradingAnswered: Record<string, boolean>;
  gradingPins: Record<string, boolean[]>;
  hotspotVisited: Record<string, boolean[]>;
  hotspotActive: Record<string, number | null>;
  matchState: Record<string, MatchState>;
  learnerName: string;
  showCertificate: boolean;
}

export type NavResult =
  | { kind: 'blocked' }
  | { kind: 'reveal'; pageId: string; to: number }
  | { kind: 'move'; moduleIdx: number; pageIdx: number };

export function createState(): PlayerState {
  return {
    moduleIdx: 0,
    pageIdx: 0,
    furthestModuleIdx: 0,
    revealCounts: {},
    quizAnswers: {},
    gradingAnswered: {},
    gradingPins: {},
    hotspotVisited: {},
    hotspotActive: {},
    matchState: {},
    learnerName: '',
    showCertificate: false,
  };
}

export function revealCount(state: PlayerState, pageId: string): number {
  return state.revealCounts[pageId] ?? 1;
}

export function nextTarget(course: Course, state: PlayerState): NavResult {
  const module = course.modules[state.moduleIdx];
  if (!module) return { kind: 'blocked' };
  const page = module.pages[state.pageIdx];

  if (page?.type === 'quiz' && !state.quizAnswers[page.id]) return { kind: 'blocked' };

  if (page?.type === 'content' && page.reveal_steps?.length) {
    const shown = revealCount(state, page.id);
    if (shown < page.reveal_steps.length) {
      return { kind: 'reveal', pageId: page.id, to: shown + 1 };
    }
  }

  if (state.pageIdx < module.pages.length - 1) {
    return { kind: 'move', moduleIdx: state.moduleIdx, pageIdx: state.pageIdx + 1 };
  }
  if (state.moduleIdx < course.modules.length - 1) {
    return { kind: 'move', moduleIdx: state.moduleIdx + 1, pageIdx: 0 };
  }
  return { kind: 'blocked' };
}

export function prevTarget(course: Course, state: PlayerState): NavResult {
  if (state.pageIdx > 0) {
    return { kind: 'move', moduleIdx: state.moduleIdx, pageIdx: state.pageIdx - 1 };
  }
  if (state.moduleIdx > 0) {
    const prev = course.modules[state.moduleIdx - 1]!;
    return {
      kind: 'move',
      moduleIdx: state.moduleIdx - 1,
      pageIdx: Math.max(prev.pages.length - 1, 0),
    };
  }
  return { kind: 'blocked' };
}
```

- [ ] **Step 4: Run the nav test and verify it passes**

Run: `pnpm vitest run packages/course-player/test/nav.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Extract the CSS and the chrome, and implement hero + divider**

- `src/styles.css` — copy `fixtures/legacy/index.html:8-228` verbatim, no edits.
- `src/dom.ts` — port `esc` from line 321 verbatim.
- `src/chrome/shell.ts` — port `cardShell` (line 417) and `wireFooterNav` (line 438). Replace the two hardcoded brand strings with `course.brand.mark` and `course.brand.name`. Keep the footer link spans and their emoji exactly as written.
- `src/chrome/sidebar.ts` — port `renderSidebar` (line 348), reading `course.modules` and `course.title`.
- `src/pages/hero.ts` — port `renderPengantarHero` (line 479).
- `src/pages/divider.ts` — port `renderDivider` (line 493).
- `src/narration.ts` — port `stopSpeech`, `speakText`, `wireSpeakButton` (lines 323-525), guarded by `capabilities.narration`.
- `src/index.ts` — `createPlayer` owns `PlayerState`, applies `NavResult`, and dispatches on `page.type`, with `module.completion === true` short-circuiting to the completion screen (stubbed until Task 13).

`packages/course-player/package.json` declares **no** `dependencies`. `@gamatutor/course-schema` and `@gamatutor/tracking` go in `devDependencies` as `"workspace:*"` and are imported type-only where possible; the two values actually used at runtime (`statement`, `NullAdapter`) are small enough to keep the zero-runtime-dependency rule meaningful only for third-party code. Record this in the package README so a later reviewer does not "fix" it.

- [ ] **Step 6: Write the player harness and the parity test for the opening walkthrough**

`test/characterisation/player-harness.ts` — kept out of the test file so Task 14 can import it without importing a test module:

```ts
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { parseCourse } from '@gamatutor/course-schema';
import { createPlayer, Scorm12Adapter } from '@gamatutor/course-player';
import { installDeterminism, type Harness, type ScormCall } from './harness.js';

const SHELL = `<!doctype html><html><body>
<div class="app">
  <div class="sidebar"><ul class="steps" id="stepList"></ul></div>
  <div class="main"><div class="content-card" id="contentCard"></div></div>
</div>
</body></html>`;

/** Mount the extracted player over the same two hooks the legacy file uses. */
export async function loadPlayer(opts: { scorm?: boolean } = {}): Promise<Harness> {
  const scorm: ScormCall[] = [];
  const dom = new JSDOM(SHELL, {
    runScripts: 'dangerously',
    beforeParse(window) {
      installDeterminism(window as unknown as Window & typeof globalThis, scorm);
    },
  });
  const window = dom.window as unknown as Window & typeof globalThis;
  const course = parseCourse(
    JSON.parse(readFileSync('content/drive-retinopati/course.json', 'utf8')),
  );
  const adapter = opts.scorm ? new Scorm12Adapter(window) : undefined;
  if (adapter) await adapter.init();
  const player = createPlayer({
    mount: window.document.querySelector('.app')!,
    course,
    adapter,
    random: window.Math.random,
  });
  player.render();
  return { window, document: window.document, scorm };
}
```

`Scorm12Adapter` does not exist until Task 14. Until then, import only `createPlayer` and drop the `opts.scorm` branch; Task 14 Step 5 restores it.

`test/characterisation/parity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadLegacy, runWalkthrough, type Step } from './harness.js';
import { loadPlayer } from './player-harness.js';
import { openingWalkthrough } from './walkthroughs.js';

async function parity(steps: Step[]) {
  const legacy = runWalkthrough(await loadLegacy(), steps);
  const player = runWalkthrough(await loadPlayer(), steps);
  expect(player.length).toBe(legacy.length);
  legacy.forEach((snap, i) => {
    expect({ step: snap.label, card: player[i]!.card }).toEqual({
      step: snap.label,
      card: snap.card,
    });
  });
}

describe('parity: opening', () => {
  it('renders hero, divider and nav chrome identically', async () => {
    await parity(openingWalkthrough);
  });
});
```

- [ ] **Step 7: Run the parity test and iterate until it passes**

Run: `pnpm vitest run test/characterisation/parity.test.ts`
Expected: PASS. Vitest prints a character-level diff of the two HTML strings on failure — work through it until they match. Every difference is a real extraction bug: a dropped class, a changed entity, a reordered attribute.

- [ ] **Step 8: Commit**

```bash
git add packages/course-player test/characterisation/parity.test.ts
git commit -m "feat(course-player): state, nav, chrome, hero and divider with parity test"
```

---

### Task 7: Content pages, including reveal steps and the video step

**Files:**
- Create: `packages/course-player/src/pages/content.ts`
- Modify: `packages/course-player/src/index.ts` (dispatch `content`), `test/characterisation/parity.test.ts`

**Interfaces:**
- Consumes: `RenderContext`, `PlayerState`, `revealCount`, `esc`, `cardShell`, narration from Task 6.
- Produces: `renderContent(ctx: RenderContext, page: PageOfType<'content'>): void`

- [ ] **Step 1: Add the failing parity case**

Append to `test/characterisation/parity.test.ts`:

```ts
import { contentWalkthrough } from './walkthroughs.js';

describe('parity: content', () => {
  it('renders plain content, reveal steps and the video step identically', async () => {
    await parity(contentWalkthrough);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: `pnpm vitest run test/characterisation/parity.test.ts -t content`
Expected: FAIL — the player renders an empty or fallback card where the legacy renders content.

- [ ] **Step 3: Port the renderers**

Port `renderContentPage` (`fixtures/legacy/index.html:527-546`), `renderAnimatedContentPage` (548-581) and `renderBodyBlock` (449-478) verbatim into `src/pages/content.ts`, with exactly these changes:

- `pageKey()` → `page.id`.
- The hardcoded video branch:
  ```js
  if(s.video){ return `<div class="${cls}"><video class="anim-video" controls poster="assets/visus_poster.jpg" src="assets/visus.mp4"></video></div>`; }
  ```
  becomes:
  ```ts
  if ('video' in s) {
    const poster = s.video.poster ? ` poster="${s.video.poster}"` : '';
    return `<div class="${cls}"><video class="anim-video" controls${poster} src="${s.video.src}"></video></div>`;
  }
  ```
  With DRIVE's migrated data this emits the identical string, attribute order included. Confirm that in the diff rather than assuming it.
- `document.getElementById(...)` → `ctx.document.getElementById(...)`.

- [ ] **Step 4: Run the parity test and verify it passes**

Run: `pnpm vitest run test/characterisation/parity.test.ts`
Expected: PASS, both describes.

- [ ] **Step 5: Commit**

```bash
git add packages/course-player test/characterisation
git commit -m "feat(course-player): content and reveal-step pages"
```

---

### Task 8: Cards pages

**Files:**
- Create: `packages/course-player/src/pages/cards.ts`
- Modify: `packages/course-player/src/index.ts`, `test/characterisation/parity.test.ts`

**Interfaces:**
- Consumes: `RenderContext` from Task 7.
- Produces: `renderCards(ctx: RenderContext, page: PageOfType<'cards'>): void`

- [ ] **Step 1: Add the failing parity case**

```ts
import { cardsWalkthrough } from './walkthroughs.js';

describe('parity: cards', () => {
  it('renders the card grid and trailing image identically', async () => {
    await parity(cardsWalkthrough);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: `pnpm vitest run test/characterisation/parity.test.ts -t cards`
Expected: FAIL.

- [ ] **Step 3: Port `renderCardsPage`**

`fixtures/legacy/index.html:582-608` verbatim into `src/pages/cards.ts`. Changes: `RenderContext` threading only. The `columns`, `big`, `dark`, `trailingImage`, `trailingCaption` and `trailingNote` branches all stay as written.

- [ ] **Step 4: Run and verify it passes**

Run: `pnpm vitest run test/characterisation/parity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/course-player test/characterisation
git commit -m "feat(course-player): cards pages"
```

---

### Task 9: Hotspot pages

**Files:**
- Create: `packages/course-player/src/pages/hotspot.ts`
- Modify: `packages/course-player/src/index.ts`, `test/characterisation/parity.test.ts`

**Interfaces:**
- Consumes: `RenderContext`.
- Produces: `renderHotspot(ctx: RenderContext, page: PageOfType<'hotspot'>): void`

Hotspot state is keyed by `page.id`: `state.hotspotVisited[page.id]` is a `boolean[]` parallel to `page.points`, `state.hotspotActive[page.id]` is the open point index or `null`.

- [ ] **Step 1: Add the failing parity case**

```ts
import { hotspotWalkthrough } from './walkthroughs.js';

describe('parity: hotspot', () => {
  it('renders points, masks and the detail panel identically', async () => {
    await parity(hotspotWalkthrough);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: `pnpm vitest run test/characterisation/parity.test.ts -t hotspot`
Expected: FAIL.

- [ ] **Step 3: Port `renderHotspotPage`**

`fixtures/legacy/index.html:609-673` verbatim. Changes: state keys move from `pageKey()` to `page.id`; `ctx.document` threading. Percentage positioning maths for points and masks must be copied character for character — this is the geometry the whole page type depends on.

Add one statement emission at the point-click handler, which the legacy has no equivalent of and which therefore must not touch the DOM:

```ts
ctx.adapter.emit(
  statement('interacted', page.id, { context: { pointIndex: i, label: point.label } }),
);
```

Parity compares `#contentCard` HTML only, so emitting is invisible to it. Task 14 asserts the SCORM side separately.

- [ ] **Step 4: Run and verify it passes**

Run: `pnpm vitest run test/characterisation/parity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/course-player test/characterisation
git commit -m "feat(course-player): hotspot pages with interaction statements"
```

---

### Task 10: Match pages

The only page type with randomness. The player must take its RNG from `ctx.random` so the harness can seed it — never `Math.random` directly.

**Files:**
- Create: `packages/course-player/src/pages/match.ts`
- Modify: `packages/course-player/src/index.ts`, `test/characterisation/parity.test.ts`
- Test: `packages/course-player/test/match.test.ts`

**Interfaces:**
- Consumes: `RenderContext` (uses `ctx.random`).
- Produces: `renderMatch(ctx: RenderContext, page: PageOfType<'match'>): void`, `shuffle<T>(arr: T[], random: () => number): T[]`

- [ ] **Step 1: Write the failing shuffle test**

`packages/course-player/test/match.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { shuffle } from '../src/pages/match.js';
import { seededRandom } from '../../../test/characterisation/harness.js';

describe('shuffle', () => {
  it('is a permutation of the input', () => {
    const out = shuffle(['a', 'b', 'c', 'd'], seededRandom(1));
    expect([...out].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('gives the same order for the same seed', () => {
    expect(shuffle(['a', 'b', 'c', 'd'], seededRandom(7))).toEqual(
      shuffle(['a', 'b', 'c', 'd'], seededRandom(7)),
    );
  });

  it('does not mutate the input', () => {
    const input = ['a', 'b', 'c'];
    shuffle(input, seededRandom(3));
    expect(input).toEqual(['a', 'b', 'c']);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: `pnpm vitest run packages/course-player/test/match.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Port `shuffleArray` and `renderMatchPage`**

`shuffleArray` at `fixtures/legacy/index.html:312-320` becomes:

```ts
export function shuffle<T>(arr: readonly T[], random: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}
```

The loop must consume random numbers in the same order and count as the legacy, or the seeded sequences diverge and parity fails.

Then port `renderMatchPage` and its inner `tryMatch` (`fixtures/legacy/index.html:674-761`) verbatim, with `pageKey()` → `page.id` and `shuffleArray(x)` → `shuffle(x, ctx.random)`. Keep both interaction paths: HTML5 drag events and the click-to-select fallback.

- [ ] **Step 4: Add the parity case and run everything**

```ts
import { matchWalkthrough } from './walkthroughs.js';

describe('parity: match', () => {
  it('shuffles identically and handles correct and incorrect placements', async () => {
    await parity(matchWalkthrough);
  });
});
```

Run: `pnpm vitest run`
Expected: PASS. If the shuffle order differs, the legacy consumed a different number of `Math.random()` calls before this page — check whether any earlier page in the walkthrough calls it.

- [ ] **Step 5: Commit**

```bash
git add packages/course-player test/characterisation
git commit -m "feat(course-player): match pages with injectable RNG"
```

---

### Task 11: Image-grading pages

**Files:**
- Create: `packages/course-player/src/pages/image-grading.ts`
- Modify: `packages/course-player/src/index.ts`, `test/characterisation/parity.test.ts`

**Interfaces:**
- Consumes: `RenderContext`.
- Produces: `renderImageGrading(ctx: RenderContext, page: PageOfType<'image-grading'>): void`

State keys: `state.gradingAnswered[page.id]`, `state.gradingPins[page.id]`.

- [ ] **Step 1: Add the failing parity case**

```ts
import { gradingWalkthrough } from './walkthroughs.js';

describe('parity: image-grading', () => {
  it('renders the option list, then the reasoning and lesion pins', async () => {
    await parity(gradingWalkthrough);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: `pnpm vitest run test/characterisation/parity.test.ts -t image-grading`
Expected: FAIL.

- [ ] **Step 3: Port `renderFundusPage`**

`fixtures/legacy/index.html:762-815` verbatim into `src/pages/image-grading.ts`. Changes: `fundusKey()`/`getFundusAnswered()`/`getFundusPins()` collapse into direct `state.gradingAnswered[page.id]` and `state.gradingPins[page.id]` access; `ctx.document` threading. The element ids `fundusStage` and `optList` and the class names stay exactly as they are — they are in the CSS and in the walkthrough selectors.

Emit on answer, invisible to parity:

```ts
ctx.adapter.emit(
  statement('answered', page.id, {
    result: { response: chosen, success: chosen === page.correct },
  }),
);
```

- [ ] **Step 4: Run and verify it passes**

Run: `pnpm vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/course-player test/characterisation
git commit -m "feat(course-player): image-grading pages (was fundus)"
```

---

### Task 12: Quiz pages and scoring

**Files:**
- Create: `packages/course-player/src/pages/quiz.ts`, `packages/course-player/src/scoring.ts`
- Modify: `packages/course-player/src/index.ts`, `test/characterisation/parity.test.ts`
- Test: `packages/course-player/test/scoring.test.ts`

**Interfaces:**
- Consumes: `RenderContext`, `Course`, `PlayerState`.
- Produces:
  - `renderQuiz(ctx: RenderContext, page: PageOfType<'quiz'>): void`
  - `function scoreCourse(course: Course, state: PlayerState): Score | null` returning `{ raw, min: 0, max }` over every `graded` quiz page in the course, or `null` if there are none.

`scoreCourse` replaces `quizScoreSummary` (`fixtures/legacy/index.html:865-877`), which reconstructed keys as `modIdx + '-' + (i + 1)` — correct for DRIVE only by accident of page ordering. Scoring by page id is equivalent for DRIVE and correct in general.

- [ ] **Step 1: Write the failing scoring test**

`packages/course-player/test/scoring.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCourse } from '@gamatutor/course-schema';
import { createState } from '../src/nav.js';
import { scoreCourse } from '../src/scoring.js';

const course = parseCourse(JSON.parse(readFileSync('content/drive-retinopati/course.json', 'utf8')));
const quizzes = course.modules.flatMap((m) => m.pages).filter((p) => p.type === 'quiz');

describe('scoreCourse', () => {
  it('scores zero with nothing answered', () => {
    expect(scoreCourse(course, createState())).toEqual({ raw: 0, min: 0, max: 5 });
  });

  it('counts only correct answers', () => {
    const s = createState();
    s.quizAnswers[quizzes[0]!.id] = quizzes[0]!.type === 'quiz' ? quizzes[0]!.correct : '';
    s.quizAnswers[quizzes[1]!.id] = 'Z';
    expect(scoreCourse(course, s)).toEqual({ raw: 1, min: 0, max: 5 });
  });

  it('scores full marks when every quiz is right', () => {
    const s = createState();
    for (const q of quizzes) if (q.type === 'quiz') s.quizAnswers[q.id] = q.correct;
    expect(scoreCourse(course, s)).toEqual({ raw: 5, min: 0, max: 5 });
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: `pnpm vitest run packages/course-player/test/scoring.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement scoring and port the quiz renderer**

`packages/course-player/src/scoring.ts`:

```ts
import type { Course } from '@gamatutor/course-schema';
import type { Score } from '@gamatutor/tracking';
import type { PlayerState } from './nav.js';

export function scoreCourse(course: Course, state: PlayerState): Score | null {
  const graded = course.modules
    .flatMap((m) => m.pages)
    .filter((p) => p.type === 'quiz' && p.graded);
  if (graded.length === 0) return null;
  let raw = 0;
  for (const page of graded) {
    if (page.type === 'quiz' && state.quizAnswers[page.id] === page.correct) raw++;
  }
  return { raw, min: 0, max: graded.length };
}
```

Then port `renderQuizPage` (`fixtures/legacy/index.html:816-863`) verbatim, with `pageKey()` → `page.id`. The legacy page indicator uses `page.index` and `page.total`, which the migration removed — recompute them from position among graded quiz pages so the rendered string is unchanged:

```ts
const quizPages = ctx.course.modules.flatMap((m) => m.pages).filter((p) => p.type === 'quiz');
const index = quizPages.findIndex((p) => p.id === page.id);
const total = quizPages.length;
```

Emit on submit:

```ts
ctx.adapter.emit(
  statement('answered', page.id, {
    result: { response: chosen, success: chosen === page.correct },
  }),
);
```

- [ ] **Step 4: Add the parity case and run everything**

```ts
import { quizWalkthrough } from './walkthroughs.js';

describe('parity: quiz', () => {
  it('gates next until answered, then shows the explanation', async () => {
    await parity(quizWalkthrough);
  });
});
```

Run: `pnpm vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/course-player test/characterisation
git commit -m "feat(course-player): quiz pages and id-keyed scoring"
```

---

### Task 13: Completion screen and certificate

**Files:**
- Create: `packages/course-player/src/pages/completion.ts`
- Modify: `packages/course-player/src/index.ts`, `test/characterisation/walkthroughs.ts`, `test/characterisation/parity.test.ts`

**Interfaces:**
- Consumes: `RenderContext`, `scoreCourse`.
- Produces: `renderCompletion(ctx: RenderContext): void`, `renderCertificate(ctx: RenderContext): void`

- [ ] **Step 1: Complete `fullWalkthrough`**

Replace the placeholder in `test/characterisation/walkthroughs.ts` with the full click sequence. Derive it, do not guess: run

```bash
pnpm vitest run test/characterisation/parity.test.ts --reporter=verbose
```

with a temporary test that clicks `#nextBtn` until it is disabled, logging each step's required interaction. Append the resulting steps, finishing with:

```ts
{ setValue: ['#learnerNameInput', 'Dr. Uji Coba'] },
{ click: '#certBtn' },
```

- [ ] **Step 2: Add the failing parity case**

```ts
import { fullWalkthrough } from './walkthroughs.js';

describe('parity: full course', () => {
  it('reaches the completion screen and the certificate identically', async () => {
    await parity(fullWalkthrough);
  });
});
```

- [ ] **Step 3: Run it and verify it fails**

Run: `pnpm vitest run test/characterisation/parity.test.ts -t "full course"`
Expected: FAIL.

- [ ] **Step 4: Port the completion and certificate renderers**

`renderSelesai` (`fixtures/legacy/index.html:878-920`) and `renderCertificate` (921-946) verbatim, with:

- `quizScoreSummary()` → `scoreCourse(ctx.course, ctx.state)`.
- The hardcoded `DRIVE School` heading → `ctx.course.brand.name`.
- The `scormSetValue` calls at lines 882-886 are **removed from the renderer**. Completion reporting becomes `ctx.adapter.finish({ completed: true, score })`, wired in Task 14. Parity is unaffected because those calls never touched the DOM.
- The restart handler resets the same state keys, now by their new names.

The frozen clock in the harness makes `new Date().toLocaleDateString('id-ID', …)` deterministic, so the certificate date matches across both runs.

- [ ] **Step 5: Run the full suite and verify it passes**

Run: `pnpm vitest run`
Expected: PASS, every parity describe green. This is the moment the extraction is complete.

- [ ] **Step 6: Commit**

```bash
git add packages/course-player test/characterisation
git commit -m "feat(course-player): completion screen and certificate; full-course parity"
```

---

### Task 14: `Scorm12Adapter` and SCORM call parity

Until now parity compared HTML. This task compares the other observable output: the sequence of SCORM API calls.

**Files:**
- Create: `packages/tracking/src/scorm12.ts`
- Modify: `packages/tracking/src/index.ts`, `packages/course-player/src/index.ts`
- Test: `packages/tracking/test/scorm12.test.ts`, `test/characterisation/scorm-parity.test.ts`

**Interfaces:**
- Consumes: `Statement`, `Outcome`, `TrackingAdapter`.
- Produces: `class Scorm12Adapter implements TrackingAdapter` with `constructor(win: Window)`, plus `findScormApi(win: Window): Scorm12Api | null`.

Legacy behaviour to reproduce exactly (`fixtures/legacy/index.html:254-290, 878-887`):

1. On boot: `LMSInitialize('')`, then `LMSGetValue('cmi.core.lesson_status')`, and if it returns `'not attempted'`, `LMSSetValue('cmi.core.lesson_status','incomplete')` followed by `LMSCommit('')`.
2. On reaching completion: `LMSSetValue` for `cmi.core.score.raw`, `.min`, `.max` — each followed by its own `LMSCommit('')` — then `cmi.core.lesson_status` = `'completed'` and a final `LMSCommit('')`.
3. On `beforeunload`: `LMSFinish('')`.

Every value is passed through `String(...)`. The per-call `LMSCommit` is legacy behaviour and must be preserved; do not batch it.

- [ ] **Step 1: Write the failing adapter test**

`packages/tracking/test/scorm12.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Scorm12Adapter } from '../src/scorm12.js';

function fakeWindow() {
  const calls: { method: string; args: string[] }[] = [];
  const API = {
    LMSInitialize: (...a: string[]) => (calls.push({ method: 'LMSInitialize', args: a }), 'true'),
    LMSGetValue: (n: string) => (
      calls.push({ method: 'LMSGetValue', args: [n] }),
      n === 'cmi.core.lesson_status' ? 'not attempted' : ''
    ),
    LMSSetValue: (...a: string[]) => (calls.push({ method: 'LMSSetValue', args: a }), 'true'),
    LMSCommit: (...a: string[]) => (calls.push({ method: 'LMSCommit', args: a }), 'true'),
    LMSFinish: (...a: string[]) => (calls.push({ method: 'LMSFinish', args: a }), 'true'),
  };
  const win = { API, parent: null as unknown } as unknown as Window;
  (win as unknown as { parent: unknown }).parent = win;
  return { win, calls };
}

describe('Scorm12Adapter', () => {
  it('initialises and marks an unattempted course incomplete', async () => {
    const { win, calls } = fakeWindow();
    await new Scorm12Adapter(win).init();
    expect(calls.map((c) => c.method)).toEqual([
      'LMSInitialize',
      'LMSGetValue',
      'LMSSetValue',
      'LMSCommit',
    ]);
    expect(calls[2]!.args).toEqual(['cmi.core.lesson_status', 'incomplete']);
  });

  it('writes score then status on finish, committing after each set', async () => {
    const { win, calls } = fakeWindow();
    const a = new Scorm12Adapter(win);
    await a.init();
    calls.length = 0;
    await a.finish({ completed: true, score: { raw: 4, min: 0, max: 5 } });
    expect(calls.map((c) => [c.method, ...c.args])).toEqual([
      ['LMSSetValue', 'cmi.core.score.raw', '4'],
      ['LMSCommit', ''],
      ['LMSSetValue', 'cmi.core.score.min', '0'],
      ['LMSCommit', ''],
      ['LMSSetValue', 'cmi.core.score.max', '5'],
      ['LMSCommit', ''],
      ['LMSSetValue', 'cmi.core.lesson_status', 'completed'],
      ['LMSCommit', ''],
    ]);
  });

  it('is inert with no API present', async () => {
    const win = { parent: null } as unknown as Window;
    (win as unknown as { parent: unknown }).parent = win;
    const a = new Scorm12Adapter(win);
    expect(await a.init()).toBeNull();
    await expect(a.finish({ completed: true })).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: `pnpm vitest run packages/tracking/test/scorm12.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the adapter**

Port `scormFindAPI`, `scormGetAPI`, `scormInit`, `scormSetValue`, `scormFinish` (`fixtures/legacy/index.html:254-290`) into `src/scorm12.ts` as methods, preserving the 10-attempt parent walk and the `window.opener` fallback, and keeping every call inside `try { } catch {}` so a hostile LMS API cannot break the course. `emit()` is a no-op for now — SCORM 1.2 interaction reporting is slice S3 — and `commit()` calls `LMSCommit('')`.

- [ ] **Step 4: Run the adapter test and verify it passes**

Run: `pnpm vitest run packages/tracking`
Expected: PASS, 6 tests.

- [ ] **Step 5: Wire the adapter into the player and assert call parity**

`test/characterisation/scorm-parity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadLegacy, runWalkthrough } from './harness.js';
import { loadPlayer } from './player-harness.js';
import { fullWalkthrough } from './walkthroughs.js';

describe('SCORM call parity', () => {
  it('makes the same LMS calls, in the same order, with the same values', async () => {
    const legacy = await loadLegacy();
    runWalkthrough(legacy, fullWalkthrough);
    const player = await loadPlayer({ scorm: true });
    runWalkthrough(player, fullWalkthrough);
    expect(player.scorm).toEqual(legacy.scorm);
  });
});
```

Restore the `opts.scorm` branch in `test/characterisation/player-harness.ts` (written in Task 6, with the branch removed because `Scorm12Adapter` did not exist yet), and re-export `Scorm12Adapter` from `packages/course-player/src/index.ts` so the harness and Task 15's bundle both reach it through one entry point.

- [ ] **Step 6: Run it and iterate until it passes**

Run: `pnpm vitest run test/characterisation/scorm-parity.test.ts`
Expected: PASS. Any difference is a real reporting change — most likely a missing per-call `LMSCommit` or a number sent as a number rather than a string.

- [ ] **Step 7: Commit**

```bash
git add packages/tracking packages/course-player test/characterisation
git commit -m "feat(tracking): Scorm12Adapter with call-level parity against the legacy course"
```

---

### Task 15: Rebuild the standalone SCORM package from data

The payoff: the artifact GamaTutor started as, regenerated from `course.json` and the player.

**Files:**
- Create: `tools/build-standalone.ts`, `tools/templates/shell.html`, `tools/scorm12-manifest.ts`
- Modify: root `package.json` scripts
- Test: `test/characterisation/standalone.test.ts`

**Interfaces:**
- Consumes: `parseCourse`, `createPlayer`, `Scorm12Adapter`.
- Produces: `buildStandalone(opts: { courseDir: string; outDir: string }): Promise<{ html: string; manifest: string; assets: string[] }>`

The built `index.html` inlines: the extracted CSS, the esbuild-bundled player IIFE, the course JSON in a `<script id="course-data" type="application/json">` block, and a boot script that constructs a `Scorm12Adapter` and calls `createPlayer(...).render()`. Assets are copied beside it. `imsmanifest.xml` is generated from `course.id` and `course.title`, matching the frozen manifest's structure.

- [ ] **Step 1: Write the failing acceptance test**

`test/characterisation/standalone.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildStandalone } from '../../tools/build-standalone.js';
import {
  installDeterminism,
  loadLegacy,
  runWalkthrough,
  type Harness,
  type ScormCall,
} from './harness.js';
import { fullWalkthrough } from './walkthroughs.js';

beforeAll(async () => {
  await buildStandalone({ courseDir: 'content/drive-retinopati', outDir: 'out/drive-retinopati' });
}, 60_000);

function loadBuilt(): Harness {
  const html = readFileSync('out/drive-retinopati/index.html', 'utf8');
  const scorm: ScormCall[] = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    beforeParse(window) {
      installDeterminism(window as unknown as Window & typeof globalThis, scorm);
    },
  });
  const window = dom.window as unknown as Window & typeof globalThis;
  return { window, document: window.document, scorm };
}

describe('standalone build', () => {
  it('emits a manifest naming the course', () => {
    const xml = readFileSync('out/drive-retinopati/imsmanifest.xml', 'utf8');
    expect(xml).toContain('adlcp:scormtype="sco"');
    expect(xml).toContain('href="index.html"');
    expect(xml).toContain('DRIVE');
  });

  it('walks the whole course identically to the frozen original', async () => {
    const legacy = runWalkthrough(await loadLegacy(), fullWalkthrough);
    const built = runWalkthrough(loadBuilt(), fullWalkthrough);
    legacy.forEach((snap, i) => {
      expect({ at: snap.label, card: built[i]!.card }).toEqual({ at: snap.label, card: snap.card });
    });
  });

  it('makes the same SCORM calls as the frozen original', async () => {
    const legacy = await loadLegacy();
    runWalkthrough(legacy, fullWalkthrough);
    const built = loadBuilt();
    runWalkthrough(built, fullWalkthrough);
    expect(built.scorm).toEqual(legacy.scorm);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: `pnpm vitest run test/characterisation/standalone.test.ts`
Expected: FAIL, "Cannot find module '../../tools/build-standalone.js'".

- [ ] **Step 3: Write the builder**

Add `"esbuild": "^0.24.0"` to root devDependencies. `tools/build-standalone.ts` should:

1. Read and `parseCourse` the course file.
2. `esbuild.build` `packages/course-player/src/index.ts` with `bundle: true, format: 'iife', globalName: 'GamaTutorPlayer', write: false, minify: true, platform: 'browser'`.
3. Read `packages/course-player/src/styles.css`.
4. Fill `tools/templates/shell.html` — the `.app` / `.sidebar` / `#stepList` / `#contentCard` markup copied from `fixtures/legacy/index.html:232-247`, with the hardcoded sidebar title replaced by `${course.title}` and the brand mark by `${course.brand.mark}`.
5. Append the boot script:
   ```html
   <script>
   (function(){
     var course = JSON.parse(document.getElementById('course-data').textContent);
     var adapter = new GamaTutorPlayer.Scorm12Adapter(window);
     var player = GamaTutorPlayer.createPlayer({
       mount: document.querySelector('.app'), course: course, adapter: adapter
     });
     adapter.init().then(function(){ player.render(); });
     window.addEventListener('beforeunload', function(){ adapter.finish({ completed: false }); });
   })();
   </script>
   ```
   Re-export `Scorm12Adapter` from `packages/course-player/src/index.ts` so the single IIFE carries both.
6. Copy `content/<id>/assets/` to `<outDir>/assets/`.
7. Write `imsmanifest.xml` from `tools/scorm12-manifest.ts`, modelled on `fixtures/legacy/imsmanifest.xml` with `course.id` as the manifest identifier and `course.title` as the organisation and item title.

Add scripts: `"build:standalone": "tsx tools/build-standalone.ts"`.

> The `adapter.init()` promise resolving before the first `render()` is a deliberate difference from the legacy file, which called `scormInit()` synchronously. Because `Scorm12Adapter.init` performs its LMS calls synchronously inside an already-resolved promise, the recorded call order is unchanged — the third test in Step 1 is what proves it. If it fails, make `createPlayer` accept a pre-initialised adapter and call `init()` synchronously instead.

- [ ] **Step 4: Run the acceptance test and iterate until it passes**

Run: `pnpm vitest run test/characterisation/standalone.test.ts`
Expected: PASS, 3 tests. **This is the S0 acceptance gate.**

- [ ] **Step 5: Verify the whole suite and the build**

Run: `pnpm verify && pnpm build:standalone`
Expected: lint, typecheck and every test green; `out/drive-retinopati/` contains `index.html`, `imsmanifest.xml`, and `assets/` with 23 files.

Open `out/drive-retinopati/index.html` in a browser and click through one module. This is the first time the extracted player runs outside jsdom — images, video, and Web Speech narration only work here.

- [ ] **Step 6: Commit**

```bash
git add tools package.json test/characterisation/standalone.test.ts
git commit -m "feat(tools): rebuild the DRIVE SCORM package from course.json and the player"
```

---

### Task 16: Accessibility pass

The one task allowed to change golden output. Everything before it proved the extraction faithful; this deliberately improves on the original, and the parity baseline moves with it under review.

**Files:**
- Modify: `packages/course-player/src/pages/hotspot.ts`, `packages/course-player/src/pages/match.ts`, `packages/course-player/src/chrome/shell.ts`, `packages/course-player/src/styles.css`
- Modify: `test/characterisation/parity.test.ts` (scoped exclusions)
- Create: `packages/course-player/test/a11y.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: no new exports. Behaviour change only.

Three defects in the original, all confirmed by reading the renderers:

1. `hotspot` points are `<div>` elements with `onclick` — not focusable, not announced, unreachable by keyboard.
2. `match` chips rely on drag events; the click fallback works but gives no focus indication or screen-reader affordance.
3. Card-footer "links" (`📄 Transkrip`, `❓ Bantuan`, `🔗 Referensi`) are `<span>`s that do nothing.

- [ ] **Step 1: Write the failing accessibility test**

Add `"axe-core": "^4.13.0"` to root devDependencies.

`packages/course-player/test/a11y.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { parseCourse } from '@gamatutor/course-schema';
import { createPlayer } from '../src/index.js';

const course = parseCourse(JSON.parse(readFileSync('content/drive-retinopati/course.json', 'utf8')));

function mountAt(moduleId: string, pageIdx: number) {
  const dom = new JSDOM(
    `<div class="app"><div class="sidebar"><ul id="stepList"></ul></div>
     <div class="main"><div id="contentCard"></div></div></div>`,
  );
  const player = createPlayer({
    mount: dom.window.document.querySelector('.app')!,
    course,
    random: () => 0.5,
  });
  player.state.moduleIdx = course.modules.findIndex((m) => m.id === moduleId);
  player.state.pageIdx = pageIdx;
  player.render();
  return dom.window.document;
}

describe('keyboard access', () => {
  it('makes every hotspot point focusable and labelled', () => {
    const doc = mountAt('modul2', 1);
    const points = doc.querySelectorAll('#hotspotStage .hotspot-point');
    expect(points.length).toBeGreaterThan(0);
    points.forEach((p) => {
      expect(p.getAttribute('tabindex')).toBe('0');
      expect(p.getAttribute('role')).toBe('button');
      expect(p.getAttribute('aria-label')).toBeTruthy();
    });
  });

  it('makes every match chip and drop zone focusable', () => {
    const doc = mountAt('modul2', 6);
    doc.querySelectorAll('#matchLeft .match-chip').forEach((c) => {
      expect(c.getAttribute('tabindex')).toBe('0');
    });
    doc.querySelectorAll('#matchRight .match-zone').forEach((z) => {
      expect(z.getAttribute('role')).toBe('button');
    });
  });
});
```

Adjust the `mountAt` page indices to the real positions if they differ — read them from `course.json`.

- [ ] **Step 2: Run it and verify it fails**

Run: `pnpm vitest run packages/course-player/test/a11y.test.ts`
Expected: FAIL — `tabindex` is null on every point.

- [ ] **Step 3: Make the elements reachable**

- Hotspot points: add `tabindex="0"`, `role="button"`, `aria-label="${esc(point.label)}"`, `aria-expanded`, and a `keydown` handler firing the same action on `Enter` and `Space` (calling `preventDefault` on Space).
- Match chips and zones: same treatment, `aria-grabbed` on chips and `aria-dropeffect` on zones, with the click-to-place path bound to `Enter`/`Space`.
- Footer spans: either give them real behaviour or mark them `aria-hidden="true"`. Prefer `aria-hidden` — they are decorative today and inventing behaviour is out of scope for S0.
- Add a visible `:focus-visible` outline in `styles.css` for `.hotspot-point`, `.match-chip`, `.match-zone`, `.opt`.

- [ ] **Step 4: Run the a11y test and verify it passes**

Run: `pnpm vitest run packages/course-player/test/a11y.test.ts`
Expected: PASS.

- [ ] **Step 5: Re-baseline parity deliberately**

The hotspot, match and full walkthroughs now differ from the legacy HTML by exactly these added attributes. Do **not** delete those parity tests. Change `parity()` to accept an allowance:

```ts
const A11Y_ATTRS = /\s(tabindex|role|aria-[a-z-]+)="[^"]*"/g;
async function parity(steps: Step[], opts: { ignoreA11yAttrs?: boolean } = {}) {
  const strip = (s: string) => (opts.ignoreA11yAttrs ? s.replace(A11Y_ATTRS, '') : s);
  // …compare strip(player.card) with strip(legacy.card)
}
```

Pass `{ ignoreA11yAttrs: true }` to the hotspot, match and full-course cases only. Every other parity case stays strict. Record in the commit message which cases were relaxed and why.

- [ ] **Step 6: Run the whole suite**

Run: `pnpm verify`
Expected: everything green.

- [ ] **Step 7: Commit**

```bash
git add packages/course-player test/characterisation
git commit -m "fix(a11y): keyboard-reachable hotspots and match chips

Re-baselines parity for the hotspot, match and full-course walkthroughs,
which now differ from the frozen original by added tabindex/role/aria
attributes only. All other parity cases remain strict."
```

---

## Definition of done for S0

1. `pnpm verify` is green.
2. `pnpm build:standalone` produces `out/drive-retinopati/` that walks identically to `fixtures/legacy/index.html` and makes identical SCORM calls.
3. `content/drive-retinopati/course.json` is the only place DRIVE's content lives.
4. `packages/course-player` has no third-party runtime dependency.
5. `packages/course-schema` and `packages/tracking` import nothing DOM-shaped.
6. `fixtures/legacy/index.html` is unmodified since Task 1.

Slice S1 (Next.js app, Postgres, identity) starts from here and consumes these three packages unchanged.
