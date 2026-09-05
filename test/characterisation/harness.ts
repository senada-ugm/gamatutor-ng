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
  function FrozenDate(this: unknown, ...args: unknown[]) {
    if (!(this instanceof FrozenDate)) return new RealDate(FROZEN_NOW.getTime()).toString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new (RealDate as any)(...(args.length ? args : [FROZEN_NOW.getTime()]));
  }
  FrozenDate.prototype = RealDate.prototype;
  FrozenDate.now = () => FROZEN_NOW.getTime();
  FrozenDate.parse = RealDate.parse.bind(RealDate);
  FrozenDate.UTC = RealDate.UTC.bind(RealDate);
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
