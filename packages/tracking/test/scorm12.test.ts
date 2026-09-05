import { describe, expect, it } from 'vitest';
import { Scorm12Adapter } from '../src/scorm12.js';

function fakeWindow() {
  const calls: { method: string; args: string[] }[] = [];
  const API = {
    LMSInitialize: (...a: string[]) => (calls.push({ method: 'LMSInitialize', args: a }), 'true'),
    LMSGetValue: (n: string) => (
      calls.push({ method: 'LMSGetValue', args: [n] }),
      n === 'cmi.core.lesson_status' ? 'not attempted' : ''
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
