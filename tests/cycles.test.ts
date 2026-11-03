import { describe, expect, it } from 'vitest';
import { cycleKey, daysBetween } from '@/lib/cycles';

describe('cycleKey', () => {
  it('weekly uses ISO weeks (Mon-Sun)', () => {
    expect(cycleKey('2026-11-02', 'weekly')).toBe('2026-W45'); // Monday
    expect(cycleKey('2026-11-08', 'weekly')).toBe('2026-W45'); // Sunday
    expect(cycleKey('2026-11-09', 'weekly')).toBe('2026-W46');
  });
  it('weekly handles year boundaries', () => {
    expect(cycleKey('2026-01-01', 'weekly')).toBe('2026-W01');
    expect(cycleKey('2027-01-01', 'weekly')).toBe('2026-W53');
  });
  it('fortnightly splits at the 15th', () => {
    expect(cycleKey('2026-11-15', 'fortnightly')).toBe('2026-11 (1-15)');
    expect(cycleKey('2026-11-16', 'fortnightly')).toBe('2026-11 (16-end)');
  });
  it('monthly', () => expect(cycleKey('2026-10-31', 'monthly')).toBe('2026-10'));
  it('rejects bad dates', () => expect(() => cycleKey('nope', 'monthly')).toThrow());
});

describe('daysBetween', () => {
  it('counts whole days', () => {
    expect(daysBetween('2026-10-30', '2026-11-03')).toBe(4);
    expect(daysBetween('2026-11-03T23:00:00Z', '2026-11-03')).toBe(0);
  });
});
