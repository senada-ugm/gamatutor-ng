import { describe, expect, it } from 'vitest';
import { csvField, toCsv } from '../src/server/csv';
import {
  activeSpans,
  dailyLearners,
  formatDuration,
  heatmap,
  learnerTimes,
  minutesPerModule,
  wibSlot,
  wibStamp,
} from '../src/server/time-report';

const at = (iso: string) => new Date(iso);
const e = (userId: string, iso: string, objectId = 'p1') => ({ userId, at: at(iso), objectId });

describe('active time', () => {
  it('sums gaps, caps each at 5 minutes, and splits sessions after 30 minutes idle', () => {
    const t = learnerTimes([
      e('a', '2026-10-12T01:00:00Z'),
      e('a', '2026-10-12T01:02:00Z'), // +2 min
      e('a', '2026-10-12T01:20:00Z'), // +18 min idle, capped to 5
      e('a', '2026-10-12T03:00:00Z'), // new session, not counted
      e('a', '2026-10-12T03:01:00Z'), // +1 min
    ]).get('a')!;
    expect(t.activeMs).toBe(8 * 60_000);
    expect(t.sessions).toBe(2);
    expect(t.firstAt.toISOString()).toBe('2026-10-12T01:00:00.000Z');
  });

  it('keeps learners apart and handles a single event', () => {
    const times = learnerTimes([e('a', '2026-10-12T01:00:00Z'), e('b', '2026-10-12T01:01:00Z')]);
    expect(times.get('a')!.activeMs).toBe(0);
    expect(times.get('a')!.sessions).toBe(1);
    expect(times.size).toBe(2);
  });

  it('sorts unordered input before measuring', () => {
    const t = learnerTimes([e('a', '2026-10-12T01:03:00Z'), e('a', '2026-10-12T01:00:00Z')]).get('a')!;
    expect(t.activeMs).toBe(3 * 60_000);
  });
});

describe('WIB buckets', () => {
  it('shifts UTC by seven hours, Monday first', () => {
    expect(wibSlot(at('2026-10-12T17:30:00Z'))).toEqual({ weekday: 1, hour: 0 }); // Tue 00:30 WIB
    expect(wibSlot(at('2026-10-11T23:00:00Z'))).toEqual({ weekday: 0, hour: 6 }); // Mon 06:00 WIB
    expect(wibStamp(at('2026-10-12T13:05:00Z'))).toBe('2026-10-12 20:05');
  });

  it('puts active minutes in the hour they started', () => {
    const grid = heatmap(activeSpans([e('a', '2026-10-12T13:00:00Z'), e('a', '2026-10-12T13:04:00Z')]));
    expect(grid[0]![20]).toBe(4);
    expect(grid.flat().reduce((x, y) => x + y)).toBe(4);
  });

  it('counts distinct learners per WIB day', () => {
    const days = dailyLearners(
      [e('a', '2026-10-12T18:00:00Z'), e('b', '2026-10-13T01:00:00Z'), e('a', '2026-10-13T02:00:00Z')],
      2,
      at('2026-10-13T05:00:00Z'),
    );
    expect(days).toEqual([
      { date: '2026-10-12', learners: 0 },
      { date: '2026-10-13', learners: 2 },
    ]);
  });
});

describe('per module', () => {
  it('reports the median across learners who spent time there', () => {
    const spans = activeSpans([
      e('a', '2026-10-12T01:00:00Z', 'm1-p1'),
      e('a', '2026-10-12T01:02:00Z', 'm2-p1'),
      e('a', '2026-10-12T01:06:00Z', 'm2-p1'),
      e('b', '2026-10-12T01:00:00Z', 'm1-p1'),
      e('b', '2026-10-12T01:04:00Z', 'm1-p1'),
    ]);
    const rows = minutesPerModule(
      spans,
      new Map([
        ['m1-p1', 'Modul 1'],
        ['m2-p1', 'Modul 2'],
      ]),
      ['Modul 1', 'Modul 2', 'Modul 3'],
    );
    expect(rows).toEqual([
      { module: 'Modul 1', medianMinutes: 3, learners: 2 },
      { module: 'Modul 2', medianMinutes: 4, learners: 1 },
      { module: 'Modul 3', medianMinutes: 0, learners: 0 },
    ]);
  });

  it('formats durations', () => {
    expect(formatDuration(65 * 60_000)).toBe('1 j 05 m');
    expect(formatDuration(42 * 60_000)).toBe('42 m');
  });
});

describe('CSV', () => {
  it('quotes separators and defuses formulas', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvField(null)).toBe('');
    expect(toCsv(['a'], [[1]])).toBe('﻿a\r\n1\r\n');
  });
});
