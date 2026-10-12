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
  /** The option chosen on each image-grading page. */
  gradingChoice: Record<string, string>;
  gradingPins: Record<string, boolean[]>;
  hotspotVisited: Record<string, boolean[]>;
  hotspotActive: Record<string, number | null>;
  matchState: Record<string, MatchState>;
  showCertificate: boolean;
  /** Earlier attempts at the evaluation, oldest first. */
  attempts: Attempt[];
  /** The learner answered "yes, satisfied" on the completion screen. */
  satisfied: boolean;
  /** attempts.length when the outcome was last reported, so it is sent once. */
  reportedAttempt: number;
}

export interface Attempt {
  raw: number;
  max: number;
  at: string;
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
    gradingChoice: {},
    gradingPins: {},
    hotspotVisited: {},
    hotspotActive: {},
    matchState: {},
    showCertificate: false,
    attempts: [],
    satisfied: false,
    reportedAttempt: -1,
  };
}

export function revealCount(state: PlayerState, pageId: string): number {
  return state.revealCounts[pageId] ?? 1;
}

/** An empty module still occupies one slot in the page counter. */
export function totalPages(course: Course): number {
  return course.modules.reduce((sum, m) => sum + Math.max(m.pages.length, 1), 0);
}

export function globalPageNumber(course: Course, state: PlayerState): number {
  let n = 0;
  for (let i = 0; i < state.moduleIdx; i++) {
    n += Math.max(course.modules[i]!.pages.length, 1);
  }
  return n + state.pageIdx + 1;
}

export function progressFillPct(course: Course, state: PlayerState): number {
  return Math.round(((globalPageNumber(course, state) - 1) / (totalPages(course) - 1)) * 100);
}

/**
 * Decision order matters and mirrors the original exactly: an unanswered quiz
 * blocks first, then outstanding reveal steps are consumed, then the page
 * advances, then the module.
 */
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

/** Where a retake starts: the first module that is not just the opener. */
export function retakeModuleIdx(course: Course): number {
  const first = course.modules[0];
  return first && first.pages[0]?.type === 'hero' && course.modules.length > 1 ? 1 : 0;
}

/**
 * Starts a fresh attempt: every answer and discovery is cleared, but modules
 * already reached stay open in the sidebar.
 */
export function startRetake(course: Course, state: PlayerState, attempt: Attempt | null): void {
  if (attempt) state.attempts.push(attempt);
  state.revealCounts = {};
  state.quizAnswers = {};
  state.gradingChoice = {};
  state.gradingPins = {};
  state.hotspotVisited = {};
  state.hotspotActive = {};
  state.matchState = {};
  state.showCertificate = false;
  state.satisfied = false;
  state.moduleIdx = retakeModuleIdx(course);
  state.pageIdx = 0;
}
