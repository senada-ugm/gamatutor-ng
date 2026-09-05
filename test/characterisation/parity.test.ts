import { describe, expect, it } from 'vitest';
import { loadLegacy, runWalkthrough, type Step } from './harness.js';
import { loadPlayer } from './player-harness.js';
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
 * The extracted player adds keyboard and screen-reader affordances the original
 * lacked (Task 16). Those attributes are the ONLY sanctioned difference, so
 * parity strips them from both sides and compares everything else strictly.
 * If a diff survives this strip, the extraction is wrong.
 */
const A11Y_ATTRS = /\s(tabindex|role|aria-[a-z-]+)="[^"]*"/g;
const strip = (html: string) => html.replace(A11Y_ATTRS, '');

async function parity(steps: Step[]) {
  const legacy = runWalkthrough(await loadLegacy(), steps);
  const player = runWalkthrough(await loadPlayer(), steps);
  expect(player).toHaveLength(legacy.length);
  legacy.forEach((snap, i) => {
    expect({ at: snap.label, card: strip(player[i]!.card) }).toEqual({
      at: snap.label,
      card: strip(snap.card),
    });
  });
}

describe('parity', () => {
  it('opening: hero, divider and nav chrome', async () => {
    await parity(openingWalkthrough);
  });
  it('content: plain, reveal steps and the video step', async () => {
    await parity(contentWalkthrough);
  });
  it('cards: grid and trailing image', async () => {
    await parity(cardsWalkthrough);
  });
  it('hotspot: points, masks and the detail panel', async () => {
    await parity(hotspotWalkthrough);
  });
  it('match: identical shuffle, correct and incorrect placements', async () => {
    await parity(matchWalkthrough);
  });
  it('image-grading: options, reasoning and lesion pins', async () => {
    await parity(gradingWalkthrough);
  });
  it('quiz: gated next, then the explanation', async () => {
    await parity(quizWalkthrough);
  });
  it('full course: through to the certificate', async () => {
    await parity(fullWalkthrough);
  });
});
