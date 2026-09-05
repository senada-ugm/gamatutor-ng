import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCourse } from '@gamatutor/course-schema';
import { createState } from '../src/nav.js';
import { scoreCourse } from '../src/scoring.js';

const course = parseCourse(
  JSON.parse(readFileSync('content/drive-retinopati/course.json', 'utf8')),
);
const quizzes = course.modules.flatMap((m) => m.pages).filter((p) => p.type === 'quiz');

describe('scoreCourse', () => {
  it('scores zero with nothing answered', () => {
    expect(scoreCourse(course, createState())).toEqual({ raw: 0, min: 0, max: 5 });
  });

  it('counts only correct answers', () => {
    const s = createState();
    const first = quizzes[0]!;
    const second = quizzes[1]!;
    if (first.type !== 'quiz' || second.type !== 'quiz') throw new Error('expected quiz pages');
    s.quizAnswers[first.id] = first.correct;
    s.quizAnswers[second.id] = 'Z';
    expect(scoreCourse(course, s)).toEqual({ raw: 1, min: 0, max: 5 });
  });

  it('scores full marks when every quiz is right', () => {
    const s = createState();
    for (const q of quizzes) if (q.type === 'quiz') s.quizAnswers[q.id] = q.correct;
    expect(scoreCourse(course, s)).toEqual({ raw: 5, min: 0, max: 5 });
  });

  it('returns null for a course with no graded pages', () => {
    const ungraded = { ...course, modules: [course.modules[0]!] };
    expect(scoreCourse(ungraded, createState())).toBeNull();
  });
});
