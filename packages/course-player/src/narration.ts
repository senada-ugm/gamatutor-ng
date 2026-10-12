import type { Page } from '@gamatutor/course-schema';
import type { RenderContext } from './context.js';

type SpeechCapableWindow = Window & {
  speechSynthesis?: SpeechSynthesis;
  SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance;
  Audio?: typeof Audio;
};

/** One stretch of narration; `step` is the reveal step it brings in, if any. */
export interface Segment {
  text: string;
  step: number | null;
  cue?: number;
}

/** What page renderers see of the narration: enough to draw and wire a button. */
export interface NarrationControl {
  readonly available: boolean;
  readonly playing: boolean;
  toggle(): void;
}

const AUTO_KEY = 'gamatutor.autoNarration';
/** How long speech may take to begin before the steps go on without it. */
const START_TIMEOUT_MS = 2500;

/** Learner preference; on unless they switched it off. Storage may be blocked. */
export function autoNarrationEnabled(win: Window): boolean {
  try {
    return win.localStorage.getItem(AUTO_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setAutoNarration(win: Window, on: boolean): void {
  try {
    win.localStorage.setItem(AUTO_KEY, on ? '1' : '0');
  } catch {
    /* preference simply is not remembered */
  }
}

/** Bullet markers and list letters are for the eye, not the voice. */
export function spokenText(text: string): string {
  return text
    .split('\n')
    .map((l) =>
      l
        .trim()
        .replace(/^[•·-]\s*/, '')
        .replace(/^[a-j]\.\s+/, ''),
    )
    .filter(Boolean)
    .join(' ');
}

const MAX_WORDS = 20;

/**
 * Sentences, with long ones broken at commas: some engines (Chrome's online
 * voices) stop a single utterance after about 15 seconds.
 */
export function splitSentences(text: string): string[] {
  const spoken = spokenText(text);
  if (!spoken) return [];
  const sentences = (spoken.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) ?? [spoken])
    .map((s) => s.trim())
    .filter(Boolean);
  return sentences.flatMap(breakAtCommas);
}

function breakAtCommas(sentence: string): string[] {
  if (sentence.split(/\s+/).length <= MAX_WORDS) return [sentence];
  const parts = sentence.split(/(?<=,)\s+/);
  const out: string[] = [];
  let cur = '';
  for (const part of parts) {
    const joined = cur ? `${cur} ${part}` : part;
    if (cur && joined.split(/\s+/).length > MAX_WORDS) {
      out.push(cur);
      cur = part;
    } else {
      cur = joined;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** How long a step stays the newest one when there is no voice to follow. */
export function stepHoldMs(text: string): number {
  const words = spokenText(text).split(/\s+/).filter(Boolean).length;
  return Math.min(6000, Math.max(1500, words * 400));
}

type RevealStep = NonNullable<Extract<Page, { type: 'content' }>['reveal_steps']>[number];

function stepText(step: RevealStep): string {
  if (step.narration) return step.narration;
  if ('texts' in step) return step.texts.join(' ');
  if ('image' in step) return [step.title, step.body].filter(Boolean).join('. ');
  return '';
}

export function revealSteps(page: Page): readonly RevealStep[] {
  return page.type === 'content' ? (page.reveal_steps ?? []) : [];
}

/** The page's script: the transcript as a lead-in, then one segment per step. */
export function segmentsFor(page: Page): Segment[] {
  const segments: Segment[] = [];
  const lead = 'transcript' in page ? page.transcript : undefined;
  if (lead) segments.push({ text: lead, step: null });
  revealSteps(page).forEach((s, i) => {
    segments.push({ text: stepText(s), step: i, ...(s.cue !== undefined ? { cue: s.cue } : {}) });
  });
  return segments;
}

function pageAudio(page: Page): string | undefined {
  return page.type === 'content' || page.type === 'cards' ? page.audio : undefined;
}

function synth(ctx: RenderContext): SpeechSynthesis | null {
  if (ctx.capabilities.narration === 'off') return null;
  const w = ctx.window as SpeechCapableWindow;
  if (!w.SpeechSynthesisUtterance) return null;
  return w.speechSynthesis ?? null;
}

export function stopSpeech(ctx: RenderContext): void {
  try {
    synth(ctx)?.cancel();
  } catch {
    /* nothing to stop */
  }
}

/** One-off speech, used by hotspot points. */
export function speakText(ctx: RenderContext, text: string): void {
  const s = synth(ctx);
  if (!s) return;
  const w = ctx.window as SpeechCapableWindow;
  try {
    s.cancel();
    const u = new w.SpeechSynthesisUtterance!(spokenText(text));
    u.lang = ctx.course.language;
    s.speak(u);
  } catch {
    /* speech refused; the text is on screen anyway */
  }
}

/**
 * The narration of one page visit. It reveals steps as the voice reaches them
 * (recorded audio by cue, otherwise speech synthesis sentence by sentence),
 * and falls back to a timer when there is no voice or the browser refuses it.
 * Every callback checks `gen`, so nothing from a stopped session lands later.
 */
export class NarrationSession implements NarrationControl {
  private gen = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private guard: ReturnType<typeof setTimeout> | null = null;
  private audio: HTMLAudioElement | null = null;
  private segIdx = 0;
  private voice = false;
  /** The learner paused; nothing appears on its own until they resume. */
  private paused = false;
  readonly segments: Segment[];
  readonly steps: number;

  constructor(
    private readonly ctx: RenderContext,
    private readonly page: Page,
    private readonly onStep: (stepIdx: number) => void,
    private readonly onChange: () => void = () => {},
  ) {
    this.segments = segmentsFor(page);
    this.steps = revealSteps(page).length;
  }

  get available(): boolean {
    if (this.ctx.capabilities.narration === 'off') return false;
    if (pageAudio(this.page)) return !!(this.ctx.window as SpeechCapableWindow).Audio;
    return !!synth(this.ctx) && this.segments.some((s) => s.text);
  }

  get playing(): boolean {
    return this.voice;
  }

  get engine(): 'audio' | 'speech' | 'timer' {
    if (!this.voice) return 'timer';
    return this.audio ? 'audio' : 'speech';
  }

  /**
   * Whether the first step should wait for the voice. True only on a first
   * visit with a lead-in to speak; a returning learner keeps what they saw.
   */
  holdsFirstStep(autoplay: boolean): boolean {
    return autoplay && this.available && this.segments[0]?.step === null && this.steps > 0;
  }

  start(autoplay: boolean): void {
    if (autoplay && this.available) this.playFrom(0);
    else this.runTimer();
  }

  /** The learner pressed →: show step `i` now and carry on from there. */
  seekToStep(i: number): void {
    const seg = this.segments.findIndex((s) => s.step === i);
    if (this.voice && seg >= 0) {
      if (this.audio && this.segments[seg]!.cue !== undefined) {
        this.audio.currentTime = this.segments[seg]!.cue!;
        return;
      }
      if (!this.audio) {
        this.playFrom(seg);
        return;
      }
    }
    if (!this.voice && !this.paused) this.runTimer();
  }

  toggle(): void {
    if (this.voice) {
      this.halt();
      this.paused = true;
      this.onChange();
      return;
    }
    this.paused = false;
    // Resume at the newest step; with nothing or everything shown, replay all.
    const shown = this.ctx.state.revealCounts[this.page.id];
    const from =
      shown === undefined || shown <= 0 || shown >= this.steps
        ? 0
        : this.segments.findIndex((s) => s.step === shown - 1);
    this.playFrom(Math.max(from, 0));
  }

  stop(): void {
    this.halt();
  }

  private halt(): void {
    this.gen++;
    this.voice = false;
    if (this.timer) clearTimeout(this.timer);
    if (this.guard) clearTimeout(this.guard);
    this.timer = this.guard = null;
    if (this.audio) {
      try {
        this.audio.pause();
      } catch {
        /* already gone */
      }
      this.audio = null;
    }
    stopSpeech(this.ctx);
  }

  private reveal(step: number | null): void {
    if (step !== null) this.onStep(step);
  }

  private playFrom(segIdx: number): void {
    this.halt();
    const src = pageAudio(this.page);
    if (src) this.playAudio(src, segIdx);
    else this.playSpeech(segIdx);
  }

  private playAudio(src: string, segIdx: number): void {
    const gen = this.gen;
    const w = this.ctx.window as SpeechCapableWindow;
    const audio = new w.Audio!(this.ctx.asset(src));
    this.audio = audio;
    this.voice = true;
    const cueOf = this.segments[segIdx]?.cue;
    if (cueOf) audio.currentTime = cueOf;
    const sync = () => {
      if (gen !== this.gen) return;
      for (const s of this.segments) {
        if (s.step !== null && s.cue !== undefined && s.cue <= audio.currentTime)
          this.reveal(s.step);
      }
    };
    audio.addEventListener('timeupdate', sync);
    audio.addEventListener('ended', () => {
      if (gen !== this.gen) return;
      for (const s of this.segments) this.reveal(s.step);
      this.voice = false;
      this.audio = null;
      this.onChange();
    });
    audio.addEventListener('error', () => this.fallBack(gen));
    try {
      const p = audio.play();
      if (p && typeof p.catch === 'function') p.catch(() => this.fallBack(gen));
    } catch {
      this.fallBack(gen);
      return;
    }
    this.onChange();
  }

  private playSpeech(segIdx: number): void {
    const s = synth(this.ctx);
    if (!s) {
      this.runTimer();
      return;
    }
    const gen = this.gen;
    const chunks: Array<{ text: string; seg: number; first: boolean }> = [];
    this.segments.slice(segIdx).forEach((seg, k) => {
      const sentences = splitSentences(seg.text);
      if (sentences.length === 0) chunks.push({ text: '', seg: segIdx + k, first: true });
      sentences.forEach((t, j) => chunks.push({ text: t, seg: segIdx + k, first: j === 0 }));
    });
    this.voice = true;
    this.onChange();
    const w = this.ctx.window as SpeechCapableWindow;
    const next = (i: number): void => {
      if (gen !== this.gen) return;
      if (this.guard) clearTimeout(this.guard);
      const chunk = chunks[i];
      if (!chunk) {
        this.voice = false;
        this.onChange();
        return;
      }
      this.segIdx = chunk.seg;
      if (chunk.first) this.reveal(this.segments[chunk.seg]!.step);
      if (gen !== this.gen) return;
      if (!chunk.text) {
        next(i + 1);
        return;
      }
      let done = false;
      const advance = () => {
        if (done) return;
        done = true;
        next(i + 1);
      };
      try {
        const u = new w.SpeechSynthesisUtterance!(chunk.text);
        u.lang = this.ctx.course.language;
        u.onend = advance;
        if (i === 0) {
          // Some browsers accept speak() and then never start (no user
          // gesture on iOS, a hung engine). Do not leave the page silent.
          let started = false;
          u.onstart = () => {
            started = true;
          };
          setTimeout(() => {
            if (!started && !done) this.fallBack(gen);
          }, START_TIMEOUT_MS);
        }
        u.onerror = (e: SpeechSynthesisErrorEvent) => {
          if (gen !== this.gen) return;
          // Interrupted means someone else cancelled us; anything else means
          // the browser will not speak, so the steps go on without a voice.
          if (e.error === 'interrupted' || e.error === 'canceled') this.halt();
          else this.fallBack(gen);
          this.onChange();
        };
        s.speak(u);
        // Chrome sometimes never fires onend; never let that freeze the page.
        this.guard = setTimeout(advance, chunk.text.split(/\s+/).length * 900 + 4000);
      } catch {
        this.fallBack(gen);
      }
    };
    next(0);
  }

  private fallBack(gen: number): void {
    if (gen !== this.gen) return;
    this.halt();
    this.runTimer();
    this.onChange();
  }

  /** Brings in the remaining steps one by one, without a voice. */
  private runTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    const gen = this.gen;
    const tick = () => {
      if (gen !== this.gen) return;
      const shown = this.ctx.state.revealCounts[this.page.id] ?? 1;
      if (shown >= this.steps) return;
      const prev = this.segments.find((s) => s.step === shown - 1);
      this.timer = setTimeout(
        () => {
          if (gen !== this.gen) return;
          this.reveal(shown);
          tick();
        },
        stepHoldMs(prev?.text ?? ''),
      );
    };
    tick();
  }
}

/** Wires the per-page narration button, if the page rendered one. */
export function wireSpeakButton(ctx: RenderContext): void {
  const btn = ctx.document.getElementById('speakBtn');
  if (!btn) return;
  btn.onclick = () => ctx.narration.toggle();
}

const speakLabel = (playing: boolean) => (playing ? '⏸ Jeda narasi' : '🔊 Putar narasi');

/** The button markup, reflecting whether the voice is playing. */
export function speakButtonHtml(ctx: RenderContext): string {
  if (!ctx.narration.available) return '';
  const playing = ctx.narration.playing;
  return `<div class="speak-row"><button class="speak-btn" id="speakBtn" aria-pressed="${playing}">${speakLabel(playing)}</button></div>`;
}

/**
 * Updates the button in place. Re-rendering the card for this would recreate
 * a video the learner may be watching.
 */
export function refreshSpeakButton(ctx: RenderContext): void {
  const btn = ctx.document.getElementById('speakBtn');
  if (!btn) return;
  const playing = ctx.narration.playing;
  btn.textContent = speakLabel(playing);
  btn.setAttribute('aria-pressed', String(playing));
}
