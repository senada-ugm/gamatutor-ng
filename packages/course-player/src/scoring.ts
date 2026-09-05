import type { Course } from '@gamatutor/course-schema';
import type { Score } from '@gamatutor/tracking';
import type { PlayerState } from './nav.js';

/**
 * Scores every graded quiz page by stable page id.
 *
 * Replaces the original's positional key reconstruction, which happened to be
 * correct for this one course only because its quiz pages sat at consecutive
 * indices after a single divider.
 */
export function scoreCourse(course: Course, state: PlayerState): Score | null {
  const graded = course.modules.flatMap((m) => m.pages).filter((p) => p.type === 'quiz' && p.graded);
  if (graded.length === 0) return null;
  let raw = 0;
  for (const page of graded) {
    if (page.type === 'quiz' && state.quizAnswers[page.id] === page.correct) raw++;
  }
  return { raw, min: 0, max: graded.length };
}
