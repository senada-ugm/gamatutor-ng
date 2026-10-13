import { statement, type Outcome, type ResumeState, type Statement, type TrackingAdapter } from '@gamatutor/tracking';

interface Outgoing extends Statement {
  clientEventId: string;
}

const FLUSH_MS = 5_000;
const HEARTBEAT_MS = 60_000;
const SAVE_MS = 1_500;
/** Unsent events survive a reload or a dropped connection. */
const QUEUE_KEY = (attemptId: string) => `gamatutor.outbox.${attemptId}`;

/**
 * Sends the player's statements to GamaTutor. Statements are queued and sent
 * in batches; each carries a client id, so a batch sent twice (a retry, a
 * beacon racing a fetch) is stored once. While the course is visible a
 * heartbeat goes out every minute, which is what makes reading time
 * measurable.
 */
export class PlatformAdapter implements TrackingAdapter {
  private queue: Outgoing[] = [];
  private flushTimer: number | null = null;
  private saveTimer: number | null = null;
  private heartbeat: number | null = null;
  private pendingState: unknown = undefined;
  private lastPage: string;
  private sending = false;

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
      if (document.visibilityState === 'visible') this.emit(statement('heartbeat', this.lastPage));
    }, HEARTBEAT_MS);
    document.addEventListener('visibilitychange', this.onHide);
    window.addEventListener('pagehide', this.onLeave);
    if (this.queue.length) this.scheduleFlush();
    return null;
  }

  dispose(): void {
    if (this.heartbeat) window.clearInterval(this.heartbeat);
    document.removeEventListener('visibilitychange', this.onHide);
    window.removeEventListener('pagehide', this.onLeave);
    this.onLeave();
  }

  private onHide = () => {
    if (document.visibilityState === 'hidden') void this.flush();
  };

  /** The tab is going away: last chance, so use beacons. */
  private onLeave = () => {
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    if (this.pendingState !== undefined) {
      navigator.sendBeacon(`${this.base}/state`, new Blob([JSON.stringify(this.pendingState)], { type: 'application/json' }));
      this.pendingState = undefined;
    }
    if (this.queue.length) {
      navigator.sendBeacon(`${this.base}/events`, new Blob([JSON.stringify({ events: this.queue })], { type: 'application/json' }));
    }
  };

  emit(s: Statement): void {
    if (s.verb === 'experienced') this.lastPage = s.objectId;
    this.queue.push({ ...s, clientEventId: crypto.randomUUID() });
    this.persist();
    // Results matter more than page views: send those at once.
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

  async flush(): Promise<void> {
    if (this.sending || this.queue.length === 0) return;
    this.sending = true;
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
    } finally {
      this.sending = false;
      if (this.queue.length) this.scheduleFlush();
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
      const body = JSON.stringify(this.pendingState);
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
    // The server checks the latest result, so it must have arrived first.
    for (let i = 0; i < 3 && this.queue.length; i++) await this.flush();
    const res = await fetch(`${this.base}/certificate`, { method: 'POST' });
    const body = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !body.url) throw new Error(body.error ?? 'certificate failed');
    return body.url;
  }
}
