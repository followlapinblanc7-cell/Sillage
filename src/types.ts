export type MoodId =
  | 'calme'
  | 'joyeux'
  | 'tendre'
  | 'las'
  | 'envole'
  | 'recueilli'
  | 'triste'
  | 'amoureux';

export interface Photo {
  id: string;
  url: string;
  pinned?: boolean;
}

export interface DayEntry {
  id: string; // YYYY-MM-DD
  title: string;
  story: string;
  mood: MoodId | null;
  location: string;
  /** Free-form labels; preserve casing, case-insensitive unique */
  tags: string[];
  photos: Photo[];
  private: boolean;
  pinned: boolean; // day pinned
  updatedAt: string;
}

/** Trim, collapse spaces, drop empties; keep first casing; case-insensitive dedupe. */
export function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const t = item.trim().replace(/\s+/g, ' ');
    if (!t) continue;
    const key = t.toLocaleLowerCase('fr');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** Merge a candidate tag into an existing list (case-insensitive). */
export function addNormalizedTag(tags: string[], candidate: string): string[] {
  const next = normalizeTags([candidate]);
  if (!next.length) return normalizeTags(tags);
  const base = normalizeTags(tags);
  const key = next[0].toLocaleLowerCase('fr');
  if (base.some((t) => t.toLocaleLowerCase('fr') === key)) return base;
  return [...base, next[0]];
}

export interface JournalState {
  days: Record<string, DayEntry>;
  showSamples: boolean;
  version: number;
  /** Soft in-app evening nudge (default false) */
  eveningReminder?: boolean;
  /** Local hour 17–23 (default 21) */
  eveningHour?: number;
  /** Date id YYYY-MM-DD when evening banner was dismissed */
  eveningDismissedOn?: string;
  /** True after user photos have been migrated into IndexedDB */
  photosInIdb?: boolean;
  /** Soft PIN for Coffre UI gate — salt + PBKDF2 hash only; null/absent = no PIN */
  coffrePin?: { salt: string; hash: string } | null;
  /** Selected past day for « Une trace » soft resurfacing */
  traceDayId?: string;
  /** Calendar day (YYYY-MM-DD) when traceDayId was chosen */
  traceShownOn?: string;
  /** Calendar day when user dismissed « Une trace » */
  traceDismissedOn?: string;
}

export const MOODS: { id: MoodId; label: string; icon: string }[] = [
  { id: 'calme', label: 'Calme', icon: '☽' },
  { id: 'joyeux', label: 'Joyeux', icon: '☀' },
  { id: 'tendre', label: 'Tendre', icon: '♡' },
  { id: 'las', label: 'Las', icon: '☁' },
  { id: 'envole', label: 'Envolé', icon: '✧' },
  { id: 'recueilli', label: 'Recueilli', icon: '◎' },
  { id: 'triste', label: 'Triste', icon: '💧' },
  { id: 'amoureux', label: 'Amoureux', icon: '♥' },
];

export function moodLabel(id: MoodId | null): string {
  if (!id) return '';
  return MOODS.find((m) => m.id === id)?.label ?? '';
}
