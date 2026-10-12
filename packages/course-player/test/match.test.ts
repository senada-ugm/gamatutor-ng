import { describe, expect, it } from 'vitest';
import { shuffle } from '../src/pages/match.js';
import { seededRandom } from './helpers.js';

describe('shuffle', () => {
  it('is a permutation of the input', () => {
    const out = shuffle(['a', 'b', 'c', 'd'], seededRandom(1));
    expect([...out].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('gives the same order for the same seed', () => {
    expect(shuffle(['a', 'b', 'c', 'd'], seededRandom(7))).toEqual(
      shuffle(['a', 'b', 'c', 'd'], seededRandom(7)),
    );
  });

  it('does not mutate the input', () => {
    const input = ['a', 'b', 'c'];
    shuffle(input, seededRandom(3));
    expect(input).toEqual(['a', 'b', 'c']);
  });
});
