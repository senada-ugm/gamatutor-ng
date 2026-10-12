import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseCourse, type Course } from '@gamatutor/course-schema';
import { segmentsFor, splitSentences, stepHoldMs } from '../src/narration.js';
import { goTo, mount, type Mounted } from './helpers.js';

const course: Course = parseCourse({
  schemaVersion: 1,
  id: 't',
  title: 'T',
  brand: { name: 'B', mark: 'B' },
  passingScore: 0.6,
  assessment: { mode: 'formative' },
  modules: [
    {
      id: 'm',
      label: 'M',
      pages: [
        {
          id: 'list',
          type: 'content',
          title: 'Daftar',
          transcript: 'Berikut faktornya.',
          reveal_steps: [
            { texts: ['a. Satu'], narration: 'Pertama, satu.' },
            { texts: ['b. Dua'], narration: 'Kedua, dua.' },
            { texts: ['c. Tiga'], narration: 'Ketiga, tiga.' },
          ],
        },
        { id: 'next', type: 'content', title: 'Lain', body: 'Isi', transcript: 'Halaman lain.' },
        {
          id: 'rec',
          type: 'content',
          title: 'Rekaman',
          audio: 'assets/rec.mp3',
          transcript: 'Pengantar.',
          reveal_steps: [
            { texts: ['a'], cue: 2 },
            { texts: ['b'], cue: 5 },
          ],
        },
      ],
    },
    { id: 'end', label: 'Selesai', completion: true, pages: [] },
  ],
});

class FakeUtterance {
  lang = '';
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  constructor(public text: string) {}
}

function installSpeech(m: Mounted, opts: { refuse?: boolean } = {}) {
  const spoken: FakeUtterance[] = [];
  const w = m.dom.window as unknown as Record<string, unknown>;
  w['SpeechSynthesisUtterance'] = FakeUtterance;
  w['speechSynthesis'] = {
    speak: (u: FakeUtterance) => {
      if (opts.refuse) throw new Error('not allowed');
      spoken.push(u);
    },
    cancel: () => {},
  };
  return spoken;
}

const shown = (m: Mounted) => m.player.state.revealCounts['list'];
const visibleSteps = (m: Mounted) =>
  m.doc.querySelectorAll('.anim-stack .anim-step:not(.anim-pending)').length;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('script', () => {
  it('is the transcript as lead-in, then one segment per step', () => {
    const page = course.modules[0]!.pages[0]!;
    expect(segmentsFor(page).map((s) => [s.step, s.text])).toEqual([
      [null, 'Berikut faktornya.'],
      [0, 'Pertama, satu.'],
      [1, 'Kedua, dua.'],
      [2, 'Ketiga, tiga.'],
    ]);
  });

  it('splits sentences and drops list markers for the voice', () => {
    expect(splitSentences('• Satu dua. Tiga?\na. Empat')).toEqual(['Satu dua.', 'Tiga?', 'Empat']);
  });

  it('holds a step between 1.5 and 6 seconds', () => {
    expect(stepHoldMs('satu')).toBe(1500);
    expect(stepHoldMs('kata '.repeat(100))).toBe(6000);
  });
});

describe('without a voice', () => {
  it('brings the steps in one by one on a timer', () => {
    const m = mount(course);
    goTo(m, course, 'list');
    expect(shown(m) ?? 1).toBe(1);
    vi.advanceTimersByTime(1499);
    expect(shown(m) ?? 1).toBe(1);
    vi.advanceTimersByTime(1);
    expect(shown(m)).toBe(2);
    vi.advanceTimersByTime(1500);
    expect(shown(m)).toBe(3);
    expect(visibleSteps(m)).toBe(3);
    vi.advanceTimersByTime(60000);
    expect(shown(m)).toBe(3);
  });

  it('draws no narration button', () => {
    const m = mount(course);
    goTo(m, course, 'list');
    expect(m.doc.getElementById('speakBtn')).toBeNull();
  });
});

describe('with speech synthesis', () => {
  it('holds the first step for the lead-in, then reveals each step as it is spoken', () => {
    const m = mount(course, { capabilities: { narration: 'webspeech' } });
    const spoken = installSpeech(m);
    goTo(m, course, 'list');
    expect(spoken.map((u) => u.text)).toEqual(['Berikut faktornya.']);
    expect(shown(m)).toBe(0);
    spoken[0]!.onend!();
    expect(shown(m)).toBe(1);
    expect(spoken.at(-1)!.text).toBe('Pertama, satu.');
    spoken.at(-1)!.onend!();
    expect(shown(m)).toBe(2);
    expect(m.doc.getElementById('speakBtn')!.textContent).toContain('Jeda');
  });

  it('does not restart when the same page re-renders', () => {
    const m = mount(course, { capabilities: { narration: 'webspeech' } });
    const spoken = installSpeech(m);
    goTo(m, course, 'list');
    m.player.render();
    m.player.render();
    expect(spoken).toHaveLength(1);
  });

  it('jumps the voice to a step revealed with →', () => {
    const m = mount(course, { capabilities: { narration: 'webspeech' } });
    const spoken = installSpeech(m);
    goTo(m, course, 'list');
    (m.doc.getElementById('nextBtn') as HTMLButtonElement).click();
    expect(shown(m)).toBe(1);
    expect(spoken.at(-1)!.text).toBe('Pertama, satu.');
  });

  it('falls back to the timer when the browser refuses to speak', () => {
    const m = mount(course, { capabilities: { narration: 'webspeech' } });
    installSpeech(m, { refuse: true });
    goTo(m, course, 'list');
    vi.advanceTimersByTime(30000);
    expect(shown(m)).toBe(3);
  });

  it('stops when the learner leaves; nothing from the old page lands later', () => {
    const m = mount(course, { capabilities: { narration: 'webspeech' } });
    const spoken = installSpeech(m);
    goTo(m, course, 'list');
    const first = spoken[0]!;
    for (let i = 0; i < 4; i++) (m.doc.getElementById('nextBtn') as HTMLButtonElement).click();
    expect(m.player.state.pageIdx).toBe(1);
    const before = { ...m.player.state.revealCounts };
    first.onend?.();
    vi.advanceTimersByTime(60000);
    expect(m.player.state.revealCounts).toEqual(before);
    expect(m.player.state.pageIdx).toBe(1);
  });

  it('pauses and resumes with the narration button', () => {
    const m = mount(course, { capabilities: { narration: 'webspeech' } });
    const spoken = installSpeech(m);
    goTo(m, course, 'list');
    (m.doc.getElementById('speakBtn') as HTMLButtonElement).click();
    expect(m.doc.getElementById('speakBtn')!.textContent).toContain('Putar');
    (m.doc.getElementById('speakBtn') as HTMLButtonElement).click();
    expect(m.doc.getElementById('speakBtn')!.textContent).toContain('Jeda');
    expect(spoken.length).toBeGreaterThan(1);
  });
});

describe('with recorded audio', () => {
  it('reveals each step when playback passes its cue', () => {
    const m = mount(course, { capabilities: { narration: 'audio' } });
    const created: Array<EventTarget & { currentTime: number; src: string }> = [];
    const w = m.dom.window as unknown as Record<string, unknown>;
    const ET = m.dom.window.EventTarget;
    w['Audio'] = class extends ET {
      currentTime = 0;
      constructor(public src: string) {
        super();
        created.push(this);
      }
      play() {
        return Promise.resolve();
      }
      pause() {}
    };
    goTo(m, course, 'rec');
    const a = created[0]!;
    expect(a.src).toBe('assets/rec.mp3');
    expect(m.player.state.revealCounts['rec']).toBe(0);
    a.currentTime = 2.1;
    a.dispatchEvent(new m.dom.window.Event('timeupdate'));
    expect(m.player.state.revealCounts['rec']).toBe(1);
    a.currentTime = 5.5;
    a.dispatchEvent(new m.dom.window.Event('timeupdate'));
    expect(m.player.state.revealCounts['rec']).toBe(2);
  });
});

describe('review fixes', () => {
  it('goes on without a voice when speech is accepted but never starts', () => {
    const m = mount(course, { capabilities: { narration: 'webspeech' } });
    installSpeech(m);
    goTo(m, course, 'list');
    expect(shown(m)).toBe(0);
    vi.advanceTimersByTime(2500);
    vi.advanceTimersByTime(30000);
    expect(shown(m)).toBe(3);
  });

  it('keeps waiting while speech has started, even past the watchdog', () => {
    const m = mount(course, { capabilities: { narration: 'webspeech' } });
    const spoken = installSpeech(m);
    goTo(m, course, 'list');
    spoken[0]!.onstart!();
    vi.advanceTimersByTime(3000);
    expect(shown(m)).toBe(0);
  });

  it('replays from the start once every step is shown', () => {
    const m = mount(course, { capabilities: { narration: 'webspeech' } });
    const spoken = installSpeech(m);
    m.player.state.revealCounts['list'] = 3;
    goTo(m, course, 'list');
    const btn = () => m.doc.getElementById('speakBtn') as HTMLButtonElement;
    btn().click(); // pause
    btn().click(); // play again
    expect(spoken.at(-1)!.text).toBe('Berikut faktornya.');
  });

  it('does not bring steps in on its own after the learner paused', () => {
    const m = mount(course, { capabilities: { narration: 'webspeech' } });
    installSpeech(m);
    goTo(m, course, 'list');
    (m.doc.getElementById('speakBtn') as HTMLButtonElement).click(); // pause
    (m.doc.getElementById('nextBtn') as HTMLButtonElement).click(); // reveal one by hand
    expect(shown(m)).toBe(1);
    vi.advanceTimersByTime(60000);
    expect(shown(m)).toBe(1);
  });

  it('breaks very long sentences at commas', () => {
    const long = Array.from({ length: 30 }, (_, i) => `kata${i}`)
      .join(' ')
      .replace('kata12', 'kata12,');
    const parts = splitSentences(long);
    expect(parts.length).toBe(2);
    expect(parts[0]!.endsWith('kata12,')).toBe(true);
  });
});
