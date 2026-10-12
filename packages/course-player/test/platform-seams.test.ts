import { describe, expect, it } from 'vitest';
import { JSDOM, VirtualConsole } from 'jsdom';
import { NullAdapter, type Outcome } from '@gamatutor/tracking';
import { createPlayer, type PlayerState } from '../src/index.js';
import { driveCourse } from './helpers.js';

const course = driveCourse();

function shell(virtualConsole?: VirtualConsole) {
  return new JSDOM(
    `<div class="app"><div class="sidebar"><ul id="stepList"></ul></div>
     <div class="main"><div id="contentCard"></div></div></div>`,
    {
      url: 'https://gamatutor.test/belajar/drive-retinopati',
      ...(virtualConsole ? { virtualConsole } : {}),
    },
  );
}

class PlatformLike extends NullAdapter {
  saved: PlayerState[] = [];
  issued = 0;
  saveState(s: unknown) {
    this.saved.push(structuredClone(s) as PlayerState);
  }
  async issueCertificate() {
    this.issued++;
    return '/sertifikat/ABC123';
  }
  override async finish(o: Outcome) {
    await super.finish(o);
  }
}

describe('platform seams', () => {
  it('prefixes course-relative assets with the asset base, and leaves absolute ones', () => {
    const dom = shell();
    const player = createPlayer({
      mount: dom.window.document.querySelector('.app')!,
      course,
      assetBase: '/c/v1/',
      capabilities: { narration: 'off' },
    });
    player.render();
    const hero = dom.window.document.querySelector<HTMLImageElement>('.hero-bg-img')!;
    expect(hero.getAttribute('src')).toBe('/c/v1/assets/hero-illustration.svg');
  });

  it('resumes from an initial state and reports state after each render', () => {
    const dom = shell();
    const adapter = new PlatformLike('Ayu');
    const player = createPlayer({
      mount: dom.window.document.querySelector('.app')!,
      course,
      adapter,
      capabilities: { narration: 'off' },
      initialState: { moduleIdx: 2, pageIdx: 1, furthestModuleIdx: 3 },
    });
    player.render();
    expect(dom.window.document.querySelector('.step.active')!.textContent).toContain('Modul 2');
    (dom.window.document.getElementById('nextBtn') as HTMLElement).click();
    expect(adapter.saved.at(-1)).toMatchObject({ moduleIdx: 2, pageIdx: 2, furthestModuleIdx: 3 });
  });

  it('asks the platform for the certificate instead of drawing one', async () => {
    // jsdom cannot navigate; it reports the attempt, which is what we check.
    const navigations: string[] = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', (e) => navigations.push(String(e.message)));
    const dom = shell(vc);
    const adapter = new PlatformLike('Ayu');
    const quizzes = course.modules.flatMap((m) => m.pages).filter((p) => p.type === 'quiz');
    const answers: Record<string, string> = {};
    for (const q of quizzes) if (q.type === 'quiz') answers[q.id] = q.correct;
    const player = createPlayer({
      mount: dom.window.document.querySelector('.app')!,
      course,
      adapter,
      capabilities: { narration: 'off' },
      initialState: {
        moduleIdx: course.modules.length - 1,
        furthestModuleIdx: course.modules.length - 1,
        quizAnswers: answers,
        satisfied: true,
      },
    });
    player.render();
    (dom.window.document.getElementById('certBtn') as HTMLElement).click();
    await Promise.resolve();
    await Promise.resolve();
    expect(adapter.issued).toBe(1);
    expect(navigations.some((m) => m.includes('navigation'))).toBe(true);
    expect(dom.window.document.querySelector('.certificate')).toBeNull();
  });
});
