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
  photos: Photo[];
  private: boolean;
  pinned: boolean; // day pinned
  updatedAt: string;
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
