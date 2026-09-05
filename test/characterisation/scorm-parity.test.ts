import { describe, expect, it } from 'vitest';
import { loadLegacy, runWalkthrough } from './harness.js';
import { loadPlayer } from './player-harness.js';
import { fullWalkthrough } from './walkthroughs.js';

describe('SCORM call parity', () => {
  it('makes the same LMS calls, in the same order, with the same values', async () => {
    const legacy = await loadLegacy();
    runWalkthrough(legacy, fullWalkthrough);

    const player = await loadPlayer({ scorm: true });
    runWalkthrough(player, fullWalkthrough);

    expect(player.scorm).toEqual(legacy.scorm);
  });

  it('actually reports a score, not an empty call list', async () => {
    const legacy = await loadLegacy();
    runWalkthrough(legacy, fullWalkthrough);
    expect(legacy.scorm.length).toBeGreaterThan(5);
  });
});
