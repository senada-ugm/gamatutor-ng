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

/**
 * The minimum shape of a browser window this adapter needs. Declared
 * structurally rather than as the DOM `Window` so that @gamatutor/tracking
 * stays free of DOM types and runs in plain Node — see the package README.
 */
export interface ApiHost {
  API?: Scorm12Api;
  parent?: ApiHost | null;
  opener?: ApiHost | null;
}

/**
 * Walks up at most ten parent frames looking for the LMS-provided `API`
 * object, then tries the opener. This is the SCORM 1.2 discovery algorithm and
 * it only works same-origin.
 */
export function findScormApi(win: ApiHost): Scorm12Api | null {
  let w = win;
  let attempts = 0;
  while (w.API == null && w.parent != null && w.parent !== w) {
    attempts++;
    if (attempts > 10) return null;
    w = w.parent;
  }
  if (w.API) return w.API;
  if (win.opener) return findScormApi(win.opener);
  return null;
}

/**
 * SCORM 1.2 stores `cmi.core.student_name` as "Last, First". A certificate
 * wants "First Last"; a name without a comma is used as it is.
 */
export function parseScormName(raw: string): string | null {
  const name = raw.trim();
  if (!name) return null;
  const comma = name.indexOf(',');
  if (comma < 0) return name;
  const last = name.slice(0, comma).trim();
  const first = name.slice(comma + 1).trim();
  return [first, last].filter(Boolean).join(' ') || null;
}

/** CMITimespan: HHHH:MM:SS, hours zero-padded to four digits. */
export function scormTimespan(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const pad = (n: number, w: number) => String(n).padStart(w, '0');
  return `${pad(Math.min(h, 9999), 4)}:${pad(m, 2)}:${pad(sec, 2)}`;
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
  private startedAt: number | null = null;

  constructor(
    private readonly win: ApiHost,
    private readonly now: () => number = () => Date.now(),
  ) {}

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
      this.startedAt = this.now();
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
    if (o.success === true) this.set('cmi.core.lesson_status', 'passed');
    else if (o.success === false) this.set('cmi.core.lesson_status', 'failed');
    else if (o.completed) this.set('cmi.core.lesson_status', 'completed');
  }

  learnerName(): string | null {
    const api = this.getApi();
    if (!api) return null;
    try {
      return parseScormName(api.LMSGetValue('cmi.core.student_name') || '');
    } catch {
      return null;
    }
  }

  /** Called on unload; separate from finish() because the original was. */
  terminate(): void {
    const api = this.getApi();
    if (!api) return;
    try {
      // How long this sitting lasted; the LMS adds it to total_time, which is
      // the time-on-course figure an LMS report can show.
      if (this.startedAt !== null) {
        api.LMSSetValue('cmi.core.session_time', scormTimespan(this.now() - this.startedAt));
        api.LMSCommit('');
      }
      api.LMSFinish('');
    } catch {
      /* ignore */
    }
  }
}
