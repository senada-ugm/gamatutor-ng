import { describe, expect, it } from 'vitest';
import { loadLegacy, runWalkthrough } from './harness.js';
import {
  cardsWalkthrough,
  contentWalkthrough,
  fullWalkthrough,
  gradingWalkthrough,
  hotspotWalkthrough,
  matchWalkthrough,
  openingWalkthrough,
  quizWalkthrough,
} from './walkthroughs.js';

/**
 * Every walkthrough must run against the frozen fixture without throwing.
 * This validates the selectors themselves, independently of the player.
 */
const cases = [
  ['opening', openingWalkthrough],
  ['content', contentWalkthrough],
  ['cards', cardsWalkthrough],
  ['hotspot', hotspotWalkthrough],
  ['match', matchWalkthrough],
  ['grading', gradingWalkthrough],
  ['quiz', quizWalkthrough],
  ['full', fullWalkthrough],
] as const;

describe.each(cases)('walkthrough %s', (name, steps) => {
  it('runs against the frozen fixture and changes the card', async () => {
    const snaps = runWalkthrough(await loadLegacy(), steps);
    expect(snaps).toHaveLength(steps.length + 1);
    expect(snaps.at(-1)!.card).not.toBe(snaps[0]!.card);
    expect(snaps.at(-1)!.card.length).toBeGreaterThan(50);
    expect(name).toBeTruthy();
  });
});

describe('full walkthrough', () => {
  it('ends on the certificate', async () => {
    const snaps = runWalkthrough(await loadLegacy(), fullWalkthrough);
    expect(snaps.at(-1)!.card).toContain('SERTIFIKAT PENYELESAIAN');
    expect(snaps.at(-1)!.card).toContain('Dr. Uji Coba');
  });

  it('reports the score to the LMS on completion', async () => {
    const h = await loadLegacy();
    runWalkthrough(h, fullWalkthrough);
    const sets = h.scorm.filter((c) => c.method === 'LMSSetValue').map((c) => c.args.join('='));
    expect(sets).toContain('cmi.core.lesson_status=completed');
    expect(sets.some((s) => s.startsWith('cmi.core.score.max='))).toBe(true);
  });
});
