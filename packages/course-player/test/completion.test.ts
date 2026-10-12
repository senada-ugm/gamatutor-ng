import { describe, expect, it } from 'vitest';
import { NullAdapter } from '@gamatutor/tracking';
import { driveCourse, mount, type Mounted } from './helpers.js';

const course = driveCourse();
const completionIdx = course.modules.findIndex((m) => m.completion);
const quizzes = course.modules.flatMap((m) => m.pages).filter((p) => p.type === 'quiz');

/** Answers `right` quizzes correctly and the rest wrongly, then opens completion. */
function finishWith(m: Mounted, right: number): void {
  quizzes.forEach((q, i) => {
    if (q.type !== 'quiz') return;
    const wrong = q.options.find((o) => o.letter !== q.correct)!.letter;
    m.player.state.quizAnswers[q.id] = i < right ? q.correct : wrong;
  });
  m.player.state.moduleIdx = completionIdx;
  m.player.state.furthestModuleIdx = completionIdx;
  m.player.state.pageIdx = 0;
  m.player.render();
}

const click = (m: Mounted, id: string) => (m.doc.getElementById(id) as HTMLElement).click();

describe('completion', () => {
  it('asks every learner whether they are satisfied, passed or not', () => {
    for (const right of [5, 1]) {
      const m = mount(course, { adapter: new NullAdapter('Ayu Putri') });
      finishWith(m, right);
      expect(m.doc.getElementById('satisfactionQ')!.textContent).toContain('puas dengan nilai');
      expect(m.doc.getElementById('retakeBtn')).not.toBeNull();
    }
  });

  it('shows score, percentage and pass status against the course limit', () => {
    const m = mount(course, { adapter: new NullAdapter('Ayu') });
    finishWith(m, 3);
    expect(m.doc.querySelector('.score')!.textContent).toContain('3 / 5 (60%)');
    expect(m.doc.querySelector('.pass-badge')!.textContent).toContain('Lulus');
  });

  it('retakes: records the attempt, clears answers, keeps modules open, starts at Modul 1', () => {
    const m = mount(course, { adapter: new NullAdapter('Ayu') });
    m.player.state.gradingChoice['modul4-p3'] = 'Retinopati diabetika';
    m.player.state.revealCounts['modul1-p5'] = 10;
    finishWith(m, 2);
    click(m, 'retakeBtn');
    const s = m.player.state;
    expect(s.attempts).toEqual([expect.objectContaining({ raw: 2, max: 5 })]);
    expect(s.quizAnswers).toEqual({});
    expect(s.gradingChoice).toEqual({});
    expect(s.revealCounts).toEqual({});
    expect(s.furthestModuleIdx).toBe(completionIdx);
    expect(course.modules[s.moduleIdx]!.id).toBe('modul1');
    expect(s.pageIdx).toBe(0);
  });

  it('lists earlier attempts and uses the latest score', () => {
    const m = mount(course, { adapter: new NullAdapter('Ayu') });
    finishWith(m, 2);
    click(m, 'retakeBtn');
    finishWith(m, 4);
    expect(m.doc.querySelector('.attempt-history')!.textContent).toContain('Percobaan 1: 2 / 5');
    expect(m.doc.querySelector('.score')!.textContent).toContain('4 / 5');
  });

  it('issues the certificate in the signed-in name, with no name field', () => {
    const m = mount(course, { adapter: new NullAdapter('Ayu Putri') });
    finishWith(m, 5);
    expect(m.doc.querySelector('input')).toBeNull();
    click(m, 'satisfiedBtn');
    expect(m.doc.querySelector('.done-note')!.textContent).toContain('Ayu Putri');
    click(m, 'certBtn');
    expect(m.doc.querySelector('.cert-name')!.textContent).toBe('Ayu Putri');
    expect(m.doc.querySelector('.cert-desc')!.textContent).toBe(
      course.completion?.certificateText ?? `telah menyelesaikan pelatihan “${course.title}”.`,
    );
  });

  it('offers no certificate without a signed-in name', () => {
    const m = mount(course, { adapter: new NullAdapter(null) });
    finishWith(m, 5);
    click(m, 'satisfiedBtn');
    expect(m.doc.getElementById('certBtn')).toBeNull();
    expect(m.doc.querySelector('.done-note')!.textContent).toContain('login');
  });

  it('offers no certificate below the passing score, only a retake', () => {
    const m = mount(course, { adapter: new NullAdapter('Ayu') });
    finishWith(m, 1);
    click(m, 'satisfiedBtn');
    expect(m.doc.getElementById('certBtn')).toBeNull();
    expect(m.doc.getElementById('retakeBtn')).not.toBeNull();
    expect(m.doc.querySelector('.done-note')!.textContent).toContain('belum mencapai');
  });

  it('reports each attempt to the adapter once, with pass or fail', () => {
    const adapter = new NullAdapter('Ayu');
    const m = mount(course, { adapter });
    finishWith(m, 1);
    m.player.render();
    click(m, 'retakeBtn');
    finishWith(m, 5);
    expect(adapter.outcomes.map((o) => o.success)).toEqual([false, true]);
    expect(adapter.sent.filter((s) => s.verb === 'passed' || s.verb === 'failed')).toHaveLength(2);
  });
});

describe('completion before the evaluation is finished', () => {
  it('neither scores nor reports, and sends the learner back to the first open question', () => {
    const adapter = new NullAdapter('Ayu');
    const m = mount(course, { adapter });
    finishWith(m, 5);
    click(m, 'retakeBtn');
    // Straight to the still-open completion module via the sidebar.
    m.player.state.moduleIdx = completionIdx;
    m.player.state.pageIdx = 0;
    m.player.render();
    expect(m.doc.querySelector('.done-screen h1')!.textContent).toContain('BELUM SELESAI');
    expect(adapter.outcomes).toHaveLength(1);
    click(m, 'toQuizBtn');
    expect(course.modules[m.player.state.moduleIdx]!.pages[m.player.state.pageIdx]!.type).toBe(
      'quiz',
    );
    finishWith(m, 5);
    expect(adapter.outcomes.map((o) => o.success)).toEqual([true, true]);
    expect(adapter.outcomes[1]!.score).toMatchObject({ raw: 5, max: 5 });
  });
});
