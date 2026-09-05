import type { Outcome, ResumeState, Statement } from './statement.js';

export interface TrackingAdapter {
  init(): Promise<ResumeState | null>;
  emit(s: Statement): void;
  commit(): Promise<void>;
  finish(o: Outcome): Promise<void>;
}

/** Records nothing anywhere. Used for instructor preview and in tests. */
export class NullAdapter implements TrackingAdapter {
  readonly sent: Statement[] = [];
  async init(): Promise<ResumeState | null> {
    return null;
  }
  emit(s: Statement): void {
    this.sent.push(s);
  }
  async commit(): Promise<void> {}
  async finish(_o: Outcome): Promise<void> {}
}
