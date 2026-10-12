import type { Outcome, ResumeState, Statement } from './statement.js';

export interface TrackingAdapter {
  init(): Promise<ResumeState | null>;
  emit(s: Statement): void;
  commit(): Promise<void>;
  finish(o: Outcome): Promise<void>;
  /**
   * The signed-in learner's display name, from whatever system launched the
   * course. Null when nobody is signed in; certificates need it.
   */
  learnerName?(): string | null;
  /** Persists the player's state so a learner resumes where they left off. */
  saveState?(state: unknown): void;
  /**
   * Asks the platform to issue (or return) the certificate for the latest
   * passing result; resolves to the URL to open. SCORM has no such thing.
   */
  issueCertificate?(): Promise<string>;
}

/** Records nothing anywhere. Used for instructor preview and in tests. */
export class NullAdapter implements TrackingAdapter {
  readonly sent: Statement[] = [];
  readonly outcomes: Outcome[] = [];
  constructor(private readonly name: string | null = null) {}
  async init(): Promise<ResumeState | null> {
    return null;
  }
  emit(s: Statement): void {
    this.sent.push(s);
  }
  async commit(): Promise<void> {}
  async finish(o: Outcome): Promise<void> {
    this.outcomes.push(o);
  }
  learnerName(): string | null {
    return this.name;
  }
}
