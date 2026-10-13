import {
  statement,
  type Outcome,
  type ResumeState,
  type Statement,
  type TrackingAdapter,
} from '@gamatutor/tracking';

interface Outgoing extends Statement {
  clientEventId: string;
}

const FLUSH_MS = 5_000;
const HEARTBEAT_MS = 60_000;
/** A learner who has not touched the page for this long is not "studying". */
const IDLE_MS = 3 * 60_000;
const SAVE_MS = 1_500;
/** Unsent events survive a reload or a dropped connection. */
const QUEUE_KEY = (attemptId: string) => `gamatutor.outbox.${attemptId}`;

/**
 * Sends the player's statements to GamaTutor. Statements are queued and sent
 * in batches; each carries a client id, so a batch sent twice (a retry, a
 * beacon racing a fetch) is stored once.
 *
 * A heartbeat goes out every minute while the learner is actually there: the
 * tab is visible and they have touched the page in the last three minutes,
 * or narration or a video is playing. That is what makes reading time
 * measurable without counting a tab left open overnight.
 */
export class PlatformAdapter implements TrackingAdapter {
  private queue: Outgoing[] = [];
  private flushTimer: number | null = null;
  private saveTimer: number | null = null;
  private heartbeat: number | null = null;
  private pendingState: unknown = undefined;
  private lastPage: string;
  private inFlight: Promise<void> | null = null;
  private lastInput = Date.now();
  /** Strictly increasing per save, so the server can drop an older one. */
  private seq = Date.now();

  constructor(
    private readonly attemptId: string,
    private readonly name: string,
    courseId: string,
  ) {
    this.lastPage = courseId;
    try {
      const saved = localStorage.getItem(QUEUE_KEY(attemptId));
      if (saved) this.queue = JSON.parse(saved) as Outgoing[];
    } catch {
      /* storage blocked: the queue lives in memory only */
    }
  }

  private get base(): string {
    return `/api/attempts/${this.attemptId}`;
  }

  async init(): Promise<ResumeState | null> {
    this.heartbeat = window.setInterval(() => {
      if (this.present()) this.emit(statement('heartbeat', this.lastPage));
    }, HEARTBEAT_MS);
    for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll']) {
      window.addEventListener(ev, this.onInput, { passive: true, capture: true });
    }
    document.addEventListener('visibilitychange', this.onHide);
    window.addEventListener('pagehide', this.onLeave);
    if (this.queue.length) this.scheduleFlush();
    return null;
  }

  dispose(): void {
    if (this.heartbeat) window.clearInterval(this.heartbeat);
    for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll']) {
      window.removeEventListener(ev, this.onInput, { capture: true });
    }
    document.removeEventListener('visibilitychange', this.onHide);
    window.removeEventListener('pagehide', this.onLeave);
    this.onLeave();
  }

  private onInput = () => {
    this.lastInput = Date.now();
  };

  /** Visible, and either recently touched or something is being played to them. */
  private present(): boolean {
    if (document.visibilityState !== 'visible') return false;
    if (Date.now() - this.lastInput < IDLE_MS) return true;
    const speaking = 'speechSynthesis' in window && window.speechSynthesis.speaking;
    const media = [...document.querySelectorAll<HTMLMediaElement>('audio, video')].some(
      (m) => !m.paused && !m.ended,
    );
    return speaking || media;
  }

  private onHide = () => {
    if (document.visibilityState === 'hidden') void this.flush();
  };

  /** The tab is going away: last chance, so use beacons. */
  private onLeave = () => {
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    if (this.pendingState !== undefined) {
      navigator.sendBeacon(
        `${this.base}/state`,
        new Blob([JSON.stringify({ seq: ++this.seq, state: this.pendingState })], {
          type: 'application/json',
        }),
      );
      this.pendingState = undefined;
    }
    if (this.queue.length) {
      navigator.sendBeacon(
        `${this.base}/events`,
        new Blob([JSON.stringify({ events: this.queue.slice(0, 200) })], { type: 'application/json' }),
      );
    }
  };

  emit(s: Statement): void {
    if (s.verb === 'experienced') this.lastPage = s.objectId;
    this.queue.push({ ...s, clientEventId: crypto.randomUUID() });
    this.persist();
    // Answers and results matter more than page views: send those at once.
    if (s.verb === 'passed' || s.verb === 'failed' || s.verb === 'answered') void this.flush();
    else this.scheduleFlush();
  }

  private persist(): void {
    try {
      localStorage.setItem(QUEUE_KEY(this.attemptId), JSON.stringify(this.queue.slice(-1000)));
    } catch {
      /* ignore */
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== null) return;
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, FLUSH_MS);
  }

  /**
   * Sends what is queued. A call while a send is in flight waits for it and
   * then sends whatever arrived meanwhile, so `await flush()` really means
   * "everything emitted so far has been offered to the server".
   */
  flush(): Promise<void> {
    if (this.inFlight) {
      return this.inFlight.then(() => (this.queue.length ? this.flush() : undefined));
    }
    if (this.queue.length === 0) return Promise.resolve();
    this.inFlight = this.sendBatch().finally(() => {
      this.inFlight = null;
      if (this.queue.length) this.scheduleFlush();
    });
    return this.inFlight;
  }

  private async sendBatch(): Promise<void> {
    const batch = this.queue.slice(0, 200);
    try {
      const res = await fetch(`${this.base}/events`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ events: batch }),
        keepalive: true,
      });
      if (res.ok || res.status === 400) {
        // 400 means the batch can never be accepted; dropping it unblocks the rest.
        const sent = new Set(batch.map((e) => e.clientEventId));
        this.queue = this.queue.filter((e) => !sent.has(e.clientEventId));
        this.persist();
      }
    } catch {
      /* offline: keep the queue and try again later */
    }
  }

  async commit(): Promise<void> {
    await this.flush();
  }

  async finish(_o: Outcome): Promise<void> {
    await this.flush();
  }

  learnerName(): string | null {
    return this.name || null;
  }

  saveState(state: unknown): void {
    this.pendingState = JSON.parse(JSON.stringify(state));
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      const body = JSON.stringify({ seq: ++this.seq, state: this.pendingState });
      this.pendingState = undefined;
      void fetch(`${this.base}/state`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }, SAVE_MS);
  }

  async issueCertificate(): Promise<string> {
    // The server grades from the answers it has received, so every answer and
    // the result must have arrived first.
    for (let i = 0; i < 5 && this.queue.length; i++) await this.flush();
    if (this.queue.length) throw new Error('offline');
    const res = await fetch(`${this.base}/certificate`, { method: 'POST' });
    const body = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !body.url) throw new Error(body.error ?? 'certificate failed');
    return body.url;
  }
}
