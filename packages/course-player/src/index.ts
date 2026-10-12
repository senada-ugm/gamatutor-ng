import type { Course, Page } from '@gamatutor/course-schema';
import { NullAdapter, statement, type TrackingAdapter } from '@gamatutor/tracking';
import { DEFAULT_CAPABILITIES, type PlayerCapabilities, type RenderContext } from './context.js';
import { renderSidebar } from './chrome/sidebar.js';
import {
  autoNarrationEnabled,
  NarrationSession,
  refreshSpeakButton,
  stopSpeech,
} from './narration.js';
import { createState, nextTarget, prevTarget, revealCount, type PlayerState } from './nav.js';
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
import { renderEmbed } from './pages/embed.js';

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
  /**
   * Prefix for course-relative asset paths ("assets/x.png"). Empty in the
   * standalone package, where assets sit beside the page.
   */
  assetBase?: string;
  /** State to resume from, as last passed to `adapter.saveState`. */
  initialState?: Partial<PlayerState>;
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

  const state: PlayerState = { ...createState(), ...opts.initialState };
  const assetBase = opts.assetBase ?? '';
  const adapter: TrackingAdapter = opts.adapter ?? new NullAdapter();
  let launched = false;
  let session: NarrationSession | null = null;
  let sessionPageId: string | null = null;

  const ctx: RenderContext = {
    document: doc,
    window: win,
    course: opts.course,
    state,
    adapter,
    capabilities: { ...DEFAULT_CAPABILITIES, ...opts.capabilities },
    random: opts.random ?? (() => Math.random()),
    asset: (src) => (assetBase && !/^([a-z]+:|\/)/i.test(src) ? assetBase + src : src),
    narration: {
      get available() {
        return session?.available ?? false;
      },
      get playing() {
        return session?.playing ?? false;
      },
      toggle: () => session?.toggle(),
    },
    rerender: () => render(),
    goNext: () => goNext(),
    goPrev: () => goPrev(),
  };

  function endSession(): void {
    session?.stop();
    session = null;
    sessionPageId = null;
    stopSpeech(ctx);
  }

  /** Reveals up to and including `stepIdx`; never hides what was shown. */
  function revealTo(pageId: string, stepIdx: number): void {
    const shown = state.revealCounts[pageId] ?? 1;
    if (stepIdx + 1 <= shown) return;
    state.revealCounts[pageId] = stepIdx + 1;
    render();
  }

  function goPrev(): void {
    endSession();
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
      state.revealCounts[target.pageId] = target.to;
      render();
      session?.seekToStep(target.to - 1);
      return;
    }
    endSession();
    state.moduleIdx = target.moduleIdx;
    state.pageIdx = target.pageIdx;
    if (target.pageIdx === 0) {
      state.furthestModuleIdx = Math.max(state.furthestModuleIdx, target.moduleIdx);
    }
    render();
  }

  function render(): void {
    renderView();
    adapter.saveState?.(state);
  }

  function renderView(): void {
    renderSidebar(ctx);
    const module = ctx.course.modules[state.moduleIdx];
    if (!module) return;

    if (module.completion) {
      endSession();
      renderCompletion(ctx);
      return;
    }

    const page = module.pages[state.pageIdx];
    if (!page) return;

    // A session belongs to one page visit; re-rendering the same page (a
    // revealed step, a clicked hotspot) must not restart the voice.
    if (sessionPageId !== page.id) {
      endSession();
      adapter.emit(statement('experienced', page.id));
      const pageId = page.id;
      const s = new NarrationSession(
        ctx,
        page,
        (i) => revealTo(pageId, i),
        () => {
          if (session === s) refreshSpeakButton(ctx);
        },
      );
      session = s;
      sessionPageId = page.id;
      const autoplay = autoNarrationEnabled(ctx.window);
      if (state.revealCounts[page.id] === undefined && s.holdsFirstStep(autoplay)) {
        state.revealCounts[page.id] = 0;
      }
      renderPage(page);
      s.start(autoplay);
      return;
    }
    renderPage(page);
  }

  function renderPage(page: Page): void {
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
      case 'embed':
        return renderEmbed(ctx, page);
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
      endSession();
      const card = doc.getElementById('contentCard');
      if (card) card.innerHTML = '';
    },
  };
}

export { revealCount };
