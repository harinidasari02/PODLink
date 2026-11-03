import type { BillingCycle } from './types';

/** ISO week (Mon-Sun) key like 2026-W44, computed in UTC from a yyyy-mm-dd date. */
function isoWeek(d: Date): { year: number; week: number } {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: t.getUTCFullYear(), week };
}

/**
 * The billing cycle a delivery belongs to, by delivery date.
 *  weekly      -> 2026-W44
 *  fortnightly -> 2026-11 (1-15) / 2026-11 (16-end)
 *  monthly     -> 2026-11
 */
export function cycleKey(deliveredOn: string, cycle: BillingCycle): string {
  const d = new Date(deliveredOn + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${deliveredOn}`);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  if (cycle === 'weekly') {
    const { year, week } = isoWeek(d);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }
  if (cycle === 'fortnightly') {
    return `${y}-${m} (${d.getUTCDate() <= 15 ? '1-15' : '16-end'})`;
  }
  return `${y}-${m}`;
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso.slice(0, 10) + 'T00:00:00Z');
  const b = Date.parse(toIso.slice(0, 10) + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}
