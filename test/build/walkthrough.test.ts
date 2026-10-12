import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildStandalone } from '../../tools/build-standalone.js';

const OUT = 'out/.walkthrough-drive-retinopati';

beforeAll(async () => {
  await buildStandalone({ courseDir: 'content/drive-retinopati', outDir: OUT });
}, 120_000);

type Call = [string, ...string[]];

/** Loads the built package inside a stub LMS that knows the learner. */
function load(studentName: string) {
  const calls: Call[] = [];
  const dom = new JSDOM(readFileSync(`${OUT}/index.html`, 'utf8'), {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(w) {
      (w as unknown as { API: unknown }).API = {
        LMSInitialize: () => (calls.push(['LMSInitialize']), 'true'),
        LMSFinish: () => (calls.push(['LMSFinish']), 'true'),
        LMSGetValue: (n: string) =>
          n === 'cmi.core.lesson_status'
            ? 'not attempted'
            : n === 'cmi.core.student_name'
              ? studentName
              : '',
        LMSSetValue: (n: string, v: string) => (calls.push(['LMSSetValue', n, v]), 'true'),
        LMSCommit: () => 'true',
        LMSGetLastError: () => '0',
      };
      w.print = () => {};
    },
  });
  return { doc: dom.window.document, calls, close: () => dom.window.close() };
}

/** Clicks → until the completion screen, answering every quiz with `pick`. */
function walkToEnd(doc: Document, pick: (letters: string[]) => string): void {
  for (let i = 0; i < 400 && !doc.querySelector('.done-screen'); i++) {
    const submit = doc.getElementById('quizSubmitBtn') as HTMLButtonElement | null;
    if (submit && !submit.disabled) {
      const rows = [...doc.querySelectorAll<HTMLElement>('#quizOptList .opt-row')];
      const letter = pick(rows.map((r) => r.dataset['letter']!));
      rows.find((r) => r.dataset['letter'] === letter)!.click();
      submit.click();
    }
    (doc.getElementById('nextBtn') ?? doc.getElementById('launchBtn'))!.click();
  }
}

describe('the built course, end to end', () => {
  it('walks to the end, retakes, passes and certifies in the LMS name', () => {
    const course = JSON.parse(readFileSync('content/drive-retinopati/course.json', 'utf8'));
    const answers: string[] = course.modules
      .flatMap((m: { pages: { type: string; correct: string }[] }) => m.pages)
      .filter((p: { type: string }) => p.type === 'quiz')
      .map((p: { correct: string }) => p.correct);

    const { doc, calls, close } = load('Putri, Ayu');
    walkToEnd(doc, (letters) => letters.find((l) => !answers.includes(l)) ?? letters[0]!);
    expect(doc.querySelector('.pass-badge')!.textContent).toContain('Belum lulus');
    expect(calls).toContainEqual(['LMSSetValue', 'cmi.core.lesson_status', 'failed']);

    (doc.getElementById('retakeBtn') as HTMLElement).click();
    expect(doc.querySelector('.step.active')!.textContent).toContain('Modul 1');

    let q = 0;
    walkToEnd(doc, () => answers[q++]!);
    expect(doc.querySelector('.score')!.textContent).toContain('5 / 5');
    expect(doc.querySelector('.attempt-history')!.textContent).toContain('Percobaan 1');
    expect(calls).toContainEqual(['LMSSetValue', 'cmi.core.lesson_status', 'passed']);

    (doc.getElementById('satisfiedBtn') as HTMLElement).click();
    (doc.getElementById('certBtn') as HTMLElement).click();
    expect(doc.querySelector('.cert-name')!.textContent).toBe('Ayu Putri');
    close();
  });

  it('offers no certificate outside an LMS sign-in', () => {
    const { doc, close } = load('');
    walkToEnd(doc, (letters) => letters[0]!);
    (doc.getElementById('satisfiedBtn') as HTMLElement).click();
    expect(doc.getElementById('certBtn')).toBeNull();
    close();
  });
});
