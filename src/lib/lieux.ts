import type { DayEntry } from '../types';
import { locationKey } from './geocode';

export interface LieuGroup {
  /** Display label (first casing seen) */
  label: string;
  key: string;
  days: DayEntry[];
}

/** Unique non-empty locations from visible (non-private) days only. */
export function collectLieux(visibleDays: DayEntry[]): LieuGroup[] {
  const map = new Map<string, LieuGroup>();
  for (const day of visibleDays) {
    const raw = (day.location ?? '').trim().replace(/\s+/g, ' ');
    if (!raw) continue;
    const key = locationKey(raw);
    const existing = map.get(key);
    if (existing) {
      existing.days.push(day);
    } else {
      map.set(key, { label: raw, key, days: [day] });
    }
  }
  const groups = Array.from(map.values());
  groups.sort((a, b) =>
    a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }),
  );
  // Days already newest-first from visibleDays; keep that order within group
  return groups;
}
