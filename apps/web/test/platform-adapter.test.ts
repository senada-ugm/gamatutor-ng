// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformAdapter } from '../src/client/platform-adapter';

type Sent = { url: string; body: { events?: Array<{ verb: string; objectId: string }> } };

let sent: Sent[];
let visibility: 'visible' | 'hidden';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-13T01:00:00Z'));
  sent = [];
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: { body: string }) => {
      sent.push({ url, body: JSON.parse(init.body) });
      return new Response('{}', { status: 200 });
    }),
  );
  Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: vi.fn(() => true) });
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const heartbeats = () =>
  sent.flatMap((s) => s.body.events ?? []).filter((e) => e.verb === 'heartbeat').length;

async function minutes(n: number) {
  for (let i = 0; i < n; i++) await vi.advanceTimersByTimeAsync(60_000);
}

describe('heartbeat (study time, note 15)', () => {
  it('beats every minute while the learner is active and the tab visible', async () => {
    const a = new PlatformAdapter('att', 'Ayu', 'drive');
    await a.init();
    for (let i = 0; i < 3; i++) {
      window.dispatchEvent(new Event('pointerdown'));
      await minutes(1);
    }
    await a.flush();
    expect(heartbeats()).toBe(3);
    a.dispose();
  });

  it('stops counting a tab left open without input', async () => {
    const a = new PlatformAdapter('att', 'Ayu', 'drive');
    await a.init();
    window.dispatchEvent(new Event('keydown'));
    await minutes(30);
    await a.flush();
    // Present for the first three minutes after the last input, then idle.
    expect(heartbeats()).toBeLessThanOrEqual(3);
    a.dispose();
  });

  it('keeps counting while narration is playing, even without input', async () => {
    vi.stubGlobal('speechSynthesis', { speaking: true });
    const a = new PlatformAdapter('att', 'Ayu', 'drive');
    await a.init();
    await minutes(10);
    await a.flush();
    expect(heartbeats()).toBe(10);
    a.dispose();
  });

  it('never beats while the tab is hidden', async () => {
    const a = new PlatformAdapter('att', 'Ayu', 'drive');
    await a.init();
    visibility = 'hidden';
    window.dispatchEvent(new Event('pointerdown'));
    await minutes(5);
    await a.flush();
    expect(heartbeats()).toBe(0);
    a.dispose();
  });
});

describe('certificate request', () => {
  it('waits for answers still being sent before asking', async () => {
    const a = new PlatformAdapter('att', 'Ayu', 'drive');
    await a.init();
    a.emit({ verb: 'passed', objectId: 'drive', timestamp: new Date().toISOString() });
    const url = a.issueCertificate();
    const order: string[] = [];
    await vi.waitFor(() => expect(sent.length).toBeGreaterThan(0));
    order.push(...sent.map((s) => s.url));
    vi.mocked(fetch).mockImplementationOnce(async (u) => {
      order.push(String(u));
      return new Response(JSON.stringify({ url: '/sertifikat/X' }), { status: 200 });
    });
    await expect(url).resolves.toBe('/sertifikat/X');
    expect(order[0]).toContain('/events');
    expect(order.at(-1)).toContain('/certificate');
    a.dispose();
  });
});
