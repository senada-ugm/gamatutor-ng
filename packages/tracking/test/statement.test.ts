import { describe, expect, it } from 'vitest';
import { NullAdapter, statement } from '../src/index.js';

describe('statement', () => {
  it('stamps verb, object and an ISO timestamp', () => {
    const s = statement('experienced', 'modul1-p2');
    expect(s.verb).toBe('experienced');
    expect(s.objectId).toBe('modul1-p2');
    expect(Number.isNaN(Date.parse(s.timestamp))).toBe(false);
  });

  it('carries a result through unchanged', () => {
    const s = statement('answered', 'evaluasi-p2', {
      result: { response: 'C', success: true },
    });
    expect(s.result).toEqual({ response: 'C', success: true });
  });
});

describe('NullAdapter', () => {
  it('records emitted statements and resumes nothing', async () => {
    const a = new NullAdapter();
    expect(await a.init()).toBeNull();
    a.emit(statement('launched', 'drive-retinopati'));
    await a.commit();
    await a.finish({ completed: true, score: { raw: 4, min: 0, max: 5 } });
    expect(a.sent.map((s) => s.verb)).toEqual(['launched']);
  });
});
