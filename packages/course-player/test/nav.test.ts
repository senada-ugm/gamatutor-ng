import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCourse } from '@gamatutor/course-schema';
import { createState, nextTarget, prevTarget, totalPages } from '../src/nav.js';

const course = parseCourse(
  JSON.parse(readFileSync('content/drive-retinopati/course.json', 'utf8')),
);

describe('totalPages', () => {
  it('counts an empty completion module as one slot', () => {
    expect(totalPages(course)).toBe(34);
  });
});

describe('nextTarget', () => {
  it('advances within a module', () => {
    expect(nextTarget(course, createState())).toEqual({ kind: 'move', moduleIdx: 0, pageIdx: 1 });
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
      (p) => p.type === 'content' && (p.reveal_steps?.length ?? 0) > 1,
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

  it('unblocks that quiz page once answered', () => {
    const s = createState();
    const idx = course.modules.findIndex((m) => m.id === 'evaluasi');
    s.moduleIdx = idx;
    s.pageIdx = course.modules[idx]!.pages.findIndex((p) => p.type === 'quiz');
    s.quizAnswers[course.modules[idx]!.pages[s.pageIdx]!.id] = 'A';
    expect(nextTarget(course, s).kind).toBe('move');
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
