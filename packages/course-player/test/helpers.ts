import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { parseCourse, type Course } from '@gamatutor/course-schema';
import type { TrackingAdapter } from '@gamatutor/tracking';
import { createPlayer, type Player, type PlayerCapabilities } from '../src/index.js';

/** Deterministic LCG. Same seed => same sequence. */
export function seededRandom(seed = 42): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function driveCourse(): Course {
  return parseCourse(JSON.parse(readFileSync('content/drive-retinopati/course.json', 'utf8')));
}

export interface Mounted {
  dom: JSDOM;
  doc: Document;
  player: Player;
}

/** Mounts the player in a bare shell; narration is off unless asked for. */
export function mount(
  course: Course,
  opts: { adapter?: TrackingAdapter; capabilities?: Partial<PlayerCapabilities> } = {},
): Mounted {
  const dom = new JSDOM(
    `<div class="app"><div class="sidebar"><ul id="stepList"></ul></div>
     <div class="main"><div id="contentCard"></div></div></div>`,
    { pretendToBeVisual: true },
  );
  const player = createPlayer({
    mount: dom.window.document.querySelector('.app')!,
    course,
    random: seededRandom(),
    capabilities: { narration: 'off', ...opts.capabilities },
    ...(opts.adapter ? { adapter: opts.adapter } : {}),
  });
  return { dom, doc: dom.window.document, player };
}

/** Moves to a page by id and renders it. */
export function goTo(m: Mounted, course: Course, pageId: string): void {
  course.modules.forEach((mod, mi) =>
    mod.pages.forEach((p, pi) => {
      if (p.id === pageId) {
        m.player.state.moduleIdx = mi;
        m.player.state.pageIdx = pi;
        m.player.state.furthestModuleIdx = Math.max(m.player.state.furthestModuleIdx, mi);
      }
    }),
  );
  m.player.render();
}
