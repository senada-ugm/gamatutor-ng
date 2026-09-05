import type { TrackingAdapter } from './adapter.js';
import type { Outcome, ResumeState, Statement } from './statement.js';

export interface Scorm12Api {
  LMSInitialize(arg: string): string;
  LMSFinish(arg: string): string;
  LMSGetValue(name: string): string;
  LMSSetValue(name: string, value: string): string;
  LMSCommit(arg: string): string;
  LMSGetLastError(): string;
}

type ApiWindow = Window & {
  API?: Scorm12Api;
};

/**
 * Walks up at most ten parent frames looking for the LMS-provided `API`
 * object, then tries the opener. This is the SCORM 1.2 discovery algorithm and
 * it only works same-origin.
 */
export function findScormApi(win: Window): Scorm12Api | null {
  let w = win as ApiWindow;
  let attempts = 0;
  while (w.API == null && w.parent != null && w.parent !== (w as Window)) {
    attempts++;
    if (attempts > 10) return null;
    w = w.parent as ApiWindow;
  }
  if (w.API) return w.API;
  const opener = (win as Window).opener as Window | null | undefined;
  if (opener) return findScormApi(opener);
  return null;
}

/**
 * Reports into a SCORM 1.2 LMS. Every call is wrapped so a hostile or broken
 * LMS API cannot take the course down with it, and each set is committed
 * individually — the original did that, and changing it would alter the
 * observable call sequence.
 */
export class Scorm12Adapter implements TrackingAdapter {
  private api: Scorm12Api | null = null;
  private resolved = false;

  constructor(private readonly win: Window) {}

  private getApi(): Scorm12Api | null {
    if (!this.resolved) {
      this.api = findScormApi(this.win);
      this.resolved = true;
    }
    return this.api;
  }

  private set(name: string, value: string | number): void {
    const api = this.getApi();
    if (!api) return;
    try {
      api.LMSSetValue(name, String(value));
      api.LMSCommit('');
    } catch {
      /* an LMS that throws is not worth breaking the course over */
    }
  }

  async init(): Promise<ResumeState | null> {
    const api = this.getApi();
    if (!api) return null;
    try {
      api.LMSInitialize('');
      if (api.LMSGetValue('cmi.core.lesson_status') === 'not attempted') {
        api.LMSSetValue('cmi.core.lesson_status', 'incomplete');
        api.LMSCommit('');
      }
    } catch {
      return null;
    }
    // Resume is a slice S2 concern; SCORM suspend_data is not read here yet.
    return null;
  }

  /** SCORM 1.2 interaction reporting is deferred to a later slice. */
  emit(_s: Statement): void {}

  async commit(): Promise<void> {
    const api = this.getApi();
    if (!api) return;
    try {
      api.LMSCommit('');
    } catch {
      /* ignore */
    }
  }

  async finish(o: Outcome): Promise<void> {
    if (o.score) {
      this.set('cmi.core.score.raw', o.score.raw);
      this.set('cmi.core.score.min', o.score.min);
      this.set('cmi.core.score.max', o.score.max);
    }
    if (o.completed) this.set('cmi.core.lesson_status', 'completed');
  }

  /** Called on unload; separate from finish() because the original was. */
  terminate(): void {
    const api = this.getApi();
    if (!api) return;
    try {
      api.LMSFinish('');
    } catch {
      /* ignore */
    }
  }
}
