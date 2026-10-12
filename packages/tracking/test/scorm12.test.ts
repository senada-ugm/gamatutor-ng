import { describe, expect, it } from 'vitest';
import { parseScormName, Scorm12Adapter, scormTimespan } from '../src/scorm12.js';

function fakeWindow(studentName = '') {
  const calls: { method: string; args: string[] }[] = [];
  const API = {
    LMSInitialize: (...a: string[]) => (calls.push({ method: 'LMSInitialize', args: a }), 'true'),
    LMSGetValue: (n: string) => (
      calls.push({ method: 'LMSGetValue', args: [n] }),
      n === 'cmi.core.lesson_status'
        ? 'not attempted'
        : n === 'cmi.core.student_name'
          ? studentName
          : ''
    ),
    LMSSetValue: (...a: string[]) => (calls.push({ method: 'LMSSetValue', args: a }), 'true'),
    LMSCommit: (...a: string[]) => (calls.push({ method: 'LMSCommit', args: a }), 'true'),
    LMSFinish: (...a: string[]) => (calls.push({ method: 'LMSFinish', args: a }), 'true'),
    LMSGetLastError: () => '0',
  };
  const win = { API } as unknown as Window;
  (win as unknown as { parent: unknown }).parent = win;
  return { win, calls };
}

describe('Scorm12Adapter', () => {
  it('initialises and marks an unattempted course incomplete', async () => {
    const { win, calls } = fakeWindow();
    await new Scorm12Adapter(win).init();
    expect(calls.map((c) => c.method)).toEqual([
      'LMSInitialize',
      'LMSGetValue',
      'LMSSetValue',
      'LMSCommit',
    ]);
    expect(calls[2]!.args).toEqual(['cmi.core.lesson_status', 'incomplete']);
  });

  it('writes score then status on finish, committing after each set', async () => {
    const { win, calls } = fakeWindow();
    const a = new Scorm12Adapter(win);
    await a.init();
    calls.length = 0;
    await a.finish({ completed: true, score: { raw: 4, min: 0, max: 5 } });
    expect(calls.map((c) => [c.method, ...c.args])).toEqual([
      ['LMSSetValue', 'cmi.core.score.raw', '4'],
      ['LMSCommit', ''],
      ['LMSSetValue', 'cmi.core.score.min', '0'],
      ['LMSCommit', ''],
      ['LMSSetValue', 'cmi.core.score.max', '5'],
      ['LMSCommit', ''],
      ['LMSSetValue', 'cmi.core.lesson_status', 'completed'],
      ['LMSCommit', ''],
    ]);
  });

  it('is inert with no API present', async () => {
    const win = {} as unknown as Window;
    (win as unknown as { parent: unknown }).parent = win;
    const a = new Scorm12Adapter(win);
    expect(await a.init()).toBeNull();
    await expect(a.finish({ completed: true })).resolves.toBeUndefined();
  });

  it('survives an LMS whose API throws', async () => {
    const win = {
      API: {
        LMSInitialize: () => {
          throw new Error('boom');
        },
      },
    } as unknown as Window;
    (win as unknown as { parent: unknown }).parent = win;
    await expect(new Scorm12Adapter(win).init()).resolves.toBeNull();
  });
});

describe('learner name', () => {
  it('turns "Last, First" into "First Last"', () => {
    expect(parseScormName('Herwanto, Guntur Budi')).toBe('Guntur Budi Herwanto');
    expect(parseScormName('Guntur')).toBe('Guntur');
    expect(parseScormName('  ')).toBeNull();
    expect(parseScormName(', ')).toBeNull();
  });

  it('reads the name from the LMS', async () => {
    const { win } = fakeWindow('Putri, Ayu');
    const a = new Scorm12Adapter(win);
    await a.init();
    expect(a.learnerName()).toBe('Ayu Putri');
  });

  it('is null when the LMS has no name or there is no LMS', async () => {
    const { win } = fakeWindow('');
    expect(new Scorm12Adapter(win).learnerName()).toBeNull();
    const bare = {} as unknown as Window;
    (bare as unknown as { parent: unknown }).parent = bare;
    expect(new Scorm12Adapter(bare).learnerName()).toBeNull();
  });
});

describe('outcome and time', () => {
  it('reports passed or failed when the outcome says so', async () => {
    const { win, calls } = fakeWindow();
    const a = new Scorm12Adapter(win);
    await a.init();
    calls.length = 0;
    await a.finish({ completed: true, success: false });
    expect(calls[0]!.args).toEqual(['cmi.core.lesson_status', 'failed']);
    calls.length = 0;
    await a.finish({ completed: true, success: true });
    expect(calls[0]!.args).toEqual(['cmi.core.lesson_status', 'passed']);
  });

  it('writes the session time before finishing', async () => {
    const { win, calls } = fakeWindow();
    let t = 1_000_000;
    const a = new Scorm12Adapter(win, () => t);
    await a.init();
    t += (2 * 3600 + 5 * 60 + 9) * 1000;
    calls.length = 0;
    a.terminate();
    expect(calls.map((c) => [c.method, ...c.args])).toEqual([
      ['LMSSetValue', 'cmi.core.session_time', '0002:05:09'],
      ['LMSCommit', ''],
      ['LMSFinish', ''],
    ]);
  });

  it('formats timespans', () => {
    expect(scormTimespan(0)).toBe('0000:00:00');
    expect(scormTimespan(61_500)).toBe('0000:01:01');
  });
});
