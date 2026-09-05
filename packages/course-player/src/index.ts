import type { Course } from '@gamatutor/course-schema';
import { NullAdapter, statement, type TrackingAdapter } from '@gamatutor/tracking';
import {
  DEFAULT_CAPABILITIES,
  type PlayerCapabilities,
  type RenderContext,
} from './context.js';
import { renderSidebar } from './chrome/sidebar.js';
import { stopSpeech } from './narration.js';
import {
  createState,
  nextTarget,
  prevTarget,
  revealCount,
  type PlayerState,
} from './nav.js';
import { renderCards } from './pages/cards.js';
import { renderCompletion } from './pages/completion.js';
import { renderContent } from './pages/content.js';
import { renderDivider } from './pages/divider.js';
import { renderHero } from './pages/hero.js';
import { renderHotspot } from './pages/hotspot.js';
import { renderImageGrading } from './pages/image-grading.js';
import { renderMatch } from './pages/match.js';
import { renderQuiz } from './pages/quiz.js';
import { renderVideo } from './pages/video.js';

export * from './context.js';
export * from './nav.js';
export { scoreCourse } from './scoring.js';
export { shuffle } from './pages/match.js';
export { Scorm12Adapter } from '@gamatutor/tracking';

export interface PlayerOptions {
  mount: HTMLElement;
  course: Course;
  adapter?: TrackingAdapter;
  capabilities?: Partial<PlayerCapabilities>;
  random?: () => number;
}

export interface Player {
  render(): void;
  destroy(): void;
  readonly state: PlayerState;
}

export function createPlayer(opts: PlayerOptions): Player {
  const doc = opts.mount.ownerDocument;
  const win = doc.defaultView;
  if (!win) throw new Error('course-player: mount element has no window');

  const state = createState();
  const adapter = opts.adapter ?? new NullAdapter();
  let launched = false;

  const ctx: RenderContext = {
    document: doc,
    window: win,
    course: opts.course,
    state,
    adapter,
    capabilities: { ...DEFAULT_CAPABILITIES, ...opts.capabilities },
    random: opts.random ?? (() => Math.random()),
    rerender: () => render(),
    goNext: () => goNext(),
    goPrev: () => goPrev(),
  };

  function goPrev(): void {
    stopSpeech(ctx);
    const target = prevTarget(ctx.course, state);
    if (target.kind !== 'move') return;
    state.moduleIdx = target.moduleIdx;
    state.pageIdx = target.pageIdx;
    render();
  }

  function goNext(): void {
    const target = nextTarget(ctx.course, state);
    if (target.kind === 'blocked') return;
    if (target.kind === 'reveal') {
      stopSpeech(ctx);
      state.revealCounts[target.pageId] = target.to;
      render();
      return;
    }
    stopSpeech(ctx);
    state.moduleIdx = target.moduleIdx;
    state.pageIdx = target.pageIdx;
    if (target.pageIdx === 0) {
      state.furthestModuleIdx = Math.max(state.furthestModuleIdx, target.moduleIdx);
    }
    render();
  }

  function render(): void {
    renderSidebar(ctx);
    const module = ctx.course.modules[state.moduleIdx];
    if (!module) return;

    if (module.completion) {
      renderCompletion(ctx);
      return;
    }

    const page = module.pages[state.pageIdx];
    if (!page) return;

    adapter.emit(statement('experienced', page.id));

    switch (page.type) {
      case 'hero':
        return renderHero(ctx, page);
      case 'divider':
        return renderDivider(ctx, page);
      case 'cards':
        return renderCards(ctx, page);
      case 'hotspot':
        return renderHotspot(ctx, page);
      case 'match':
        return renderMatch(ctx, page);
      case 'image-grading':
        return renderImageGrading(ctx, page);
      case 'quiz':
        return renderQuiz(ctx, page);
      case 'video':
        return renderVideo(ctx, page);
      case 'content':
        return renderContent(ctx, page);
    }
  }

  return {
    state,
    render() {
      if (!launched) {
        adapter.emit(statement('launched', ctx.course.id));
        launched = true;
      }
      render();
    },
    destroy() {
      stopSpeech(ctx);
      const card = doc.getElementById('contentCard');
      if (card) card.innerHTML = '';
    },
  };
}

export { revealCount };
