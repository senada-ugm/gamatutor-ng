import { describe, expect, it } from 'vitest';
import { loadLegacy, runWalkthrough, normalise } from './harness.js';

describe('characterisation harness', () => {
  it('is deterministic across two loads of the same fixture', async () => {
    const a = await loadLegacy();
    const b = await loadLegacy();
    // The hero page has no footer nav — it launches with #launchBtn.
    const steps = [{ click: '#launchBtn' }, { click: '#nextBtn' }, { click: '#nextBtn' }];
    expect(runWalkthrough(a, steps)).toEqual(runWalkthrough(b, steps));
  });

  it('records SCORM calls made during boot', async () => {
    const h = await loadLegacy();
    expect(h.scorm.map((c) => c.method)).toContain('LMSInitialize');
  });

  it('normalise collapses whitespace but keeps state classes', () => {
    expect(normalise('<div   class="anim-step anim-in" >\n  x </div>')).toBe(
      '<div class="anim-step anim-in"> x </div>',
    );
  });
});
