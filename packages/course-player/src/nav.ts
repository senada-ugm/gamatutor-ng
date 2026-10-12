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
    gradingChoice: {},
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
