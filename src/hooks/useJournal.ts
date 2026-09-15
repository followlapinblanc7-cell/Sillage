import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DayEntry, JournalState, MoodId, Photo } from '../types';
import { DEMO_TODAY, SAMPLE_DAYS } from '../data/sampleData';

const STORAGE_KEY = 'sillage-journal-v1';

function todayId(): string {
  // Use demo today so sample data aligns with "aujourd'hui"
  return DEMO_TODAY;
}

function emptyDay(id: string): DayEntry {
  return {
    id,
    title: '',
    story: '',
    mood: null,
    location: '',
    photos: [],
    private: false,
    pinned: false,
    updatedAt: new Date().toISOString(),
  };
}

function loadState(): JournalState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as JournalState;
      if (parsed && parsed.version === 1 && parsed.days) return parsed;
    }
  } catch {
    /* ignore */
  }
  const days: Record<string, DayEntry> = {};
  for (const d of SAMPLE_DAYS) days[d.id] = structuredClone(d);
  return { days, showSamples: true, version: 1 };
}

function saveState(state: JournalState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function useJournal() {
  const [state, setState] = useState<JournalState>(() => loadState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  const today = todayId();

  const allDays = useMemo(() => {
    return Object.values(state.days).sort((a, b) => b.id.localeCompare(a.id));
  }, [state.days]);

  const visibleDays = useMemo(() => {
    // Fil / Album show non-private primarily; private still accessible via Tiroir
    return allDays.filter((d) => hasContent(d));
  }, [allDays]);

  const getDay = useCallback(
    (id: string): DayEntry => {
      return state.days[id] ?? emptyDay(id);
    },
    [state.days],
  );

  const upsertDay = useCallback((day: DayEntry) => {
    setState((prev) => ({
      ...prev,
      days: {
        ...prev.days,
        [day.id]: { ...day, updatedAt: new Date().toISOString() },
      },
    }));
  }, []);

  const updateDay = useCallback(
    (id: string, patch: Partial<DayEntry>) => {
      setState((prev) => {
        const current = prev.days[id] ?? emptyDay(id);
        return {
          ...prev,
          days: {
            ...prev.days,
            [id]: {
              ...current,
              ...patch,
              updatedAt: new Date().toISOString(),
            },
          },
        };
      });
    },
    [],
  );

  const deleteDay = useCallback((id: string) => {
    setState((prev) => {
      const next = { ...prev.days };
      delete next[id];
      return { ...prev, days: next };
    });
  }, []);

  const removeSamples = useCallback(() => {
    setState((prev) => {
      const next = { ...prev.days };
      for (const s of SAMPLE_DAYS) {
        delete next[s.id];
      }
      return { ...prev, days: next, showSamples: false };
    });
  }, []);

  const restoreSamples = useCallback(() => {
    setState((prev) => {
      const next = { ...prev.days };
      for (const s of SAMPLE_DAYS) {
        next[s.id] = structuredClone(s);
      }
      return { ...prev, days: next, showSamples: true };
    });
  }, []);

  const addPhoto = useCallback((dayId: string, url: string) => {
    const photo: Photo = {
      id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      url,
      pinned: false,
    };
    setState((prev) => {
      const current = prev.days[dayId] ?? emptyDay(dayId);
      const photos = [...current.photos];
      if (photos.length === 0) photo.pinned = true;
      photos.push(photo);
      return {
        ...prev,
        days: {
          ...prev.days,
          [dayId]: { ...current, photos, updatedAt: new Date().toISOString() },
        },
      };
    });
  }, []);

  const pinPhoto = useCallback((dayId: string, photoId: string) => {
    setState((prev) => {
      const current = prev.days[dayId];
      if (!current) return prev;
      const photos = current.photos.map((p) => ({
        ...p,
        pinned: p.id === photoId,
      }));
      return {
        ...prev,
        days: {
          ...prev.days,
          [dayId]: { ...current, photos, updatedAt: new Date().toISOString() },
        },
      };
    });
  }, []);

  const removePhoto = useCallback((dayId: string, photoId: string) => {
    setState((prev) => {
      const current = prev.days[dayId];
      if (!current) return prev;
      let photos = current.photos.filter((p) => p.id !== photoId);
      if (photos.length && !photos.some((p) => p.pinned)) {
        photos = photos.map((p, i) => ({ ...p, pinned: i === 0 }));
      }
      return {
        ...prev,
        days: {
          ...prev.days,
          [dayId]: { ...current, photos, updatedAt: new Date().toISOString() },
        },
      };
    });
  }, []);

  const setMood = useCallback((dayId: string, mood: MoodId | null) => {
    updateDay(dayId, { mood });
  }, [updateDay]);

  const search = useCallback(
    (q: string, moodFilter?: MoodId | null) => {
      const query = q.trim().toLowerCase();
      return allDays.filter((d) => {
        if (!hasContent(d)) return false;
        if (moodFilter && d.mood !== moodFilter) return false;
        if (!query) return !!moodFilter;
        const hay = [d.title, d.story, d.location, d.mood ?? '']
          .join(' ')
          .toLowerCase();
        return hay.includes(query);
      });
    },
    [allDays],
  );

  const moodsInData = useMemo(() => {
    const set = new Set<MoodId>();
    for (const d of allDays) {
      if (d.mood && hasContent(d)) set.add(d.mood);
    }
    return Array.from(set);
  }, [allDays]);

  const pinnedPhotos = useMemo(() => {
    const items: { day: DayEntry; photo: Photo }[] = [];
    for (const d of allDays) {
      for (const p of d.photos) {
        if (p.pinned) items.push({ day: d, photo: p });
      }
      if (d.pinned && hasContent(d)) {
        // day itself pinned — already covered if has pinned photo
      }
    }
    return items;
  }, [allDays]);

  const privateDays = useMemo(
    () => allDays.filter((d) => d.private && hasContent(d)),
    [allDays],
  );

  const samplesPresent = useMemo(() => {
    return SAMPLE_DAYS.some((s) => state.days[s.id]);
  }, [state.days]);

  return {
    state,
    today,
    allDays,
    visibleDays,
    getDay,
    upsertDay,
    updateDay,
    deleteDay,
    removeSamples,
    restoreSamples,
    addPhoto,
    pinPhoto,
    removePhoto,
    setMood,
    search,
    moodsInData,
    pinnedPhotos,
    privateDays,
    samplesPresent,
    showSamplesBanner: state.showSamples && samplesPresent,
  };
}

export function hasContent(d: DayEntry): boolean {
  return !!(
    d.title.trim() ||
    d.story.trim() ||
    d.mood ||
    d.location.trim() ||
    d.photos.length
  );
}

export function coverPhoto(d: DayEntry): string | null {
  const pinned = d.photos.find((p) => p.pinned);
  if (pinned) return pinned.url;
  return d.photos[0]?.url ?? null;
}

export function formatDateLong(id: string): string {
  const [y, m, day] = id.split('-').map(Number);
  const date = new Date(y, m - 1, day);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateShort(id: string): string {
  const [y, m, day] = id.split('-').map(Number);
  const date = new Date(y, m - 1, day);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

export function formatDayNumber(id: string): number {
  return Number(id.split('-')[2]);
}

export function weekDaysAround(today: string): string[] {
  const [y, m, d] = today.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay(); // 0=Sun
  // Monday-start week
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(y, m - 1, d + mondayOffset);
  const ids: string[] = [];
  for (let i = 0; i < 7; i++) {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    ids.push(toId(x));
  }
  return ids;
}

function toId(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type JournalApi = ReturnType<typeof useJournal>;
