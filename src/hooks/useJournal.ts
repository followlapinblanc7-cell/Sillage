import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DayEntry, JournalState, MoodId, Photo } from '../types';
import { SAMPLE_DAYS } from '../data/sampleData';
import { downloadBackup } from '../lib/exportJournal';
import {
  blobToObjectUrl,
  dataUrlToBlob,
  idbClearAll,
  idbDeletePhoto,
  idbDeletePhotos,
  idbGetPhoto,
  idbPutPhoto,
  isBlobUrl,
  isDataUrl,
  isInlineRemoteUrl,
  materializePhotosForExport,
  stripPhotosForStorage,
} from '../lib/photoStore';
import {
  generateSalt,
  hashPin,
  isCoffreUnlocked,
  normalizePin,
  setCoffreUnlocked as persistCoffreUnlocked,
  verifyPin,
} from '../lib/coffrePin';

const STORAGE_KEY = 'sillage-journal-v1';

function toId(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayId(): string {
  return toId(new Date());
}

function clampEveningHour(hour: number): number {
  if (!Number.isFinite(hour)) return 21;
  return Math.min(23, Math.max(17, Math.round(hour)));
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
      if (parsed && parsed.version === 1 && parsed.days) {
        return {
          ...parsed,
          eveningReminder: parsed.eveningReminder ?? false,
          eveningHour: clampEveningHour(parsed.eveningHour ?? 21),
          eveningDismissedOn: parsed.eveningDismissedOn,
          photosInIdb: parsed.photosInIdb,
          coffrePin: parsed.coffrePin ?? null,
        };
      }
    }
  } catch {
    /* ignore */
  }
  const days: Record<string, DayEntry> = {};
  for (const d of SAMPLE_DAYS) days[d.id] = structuredClone(d);
  return {
    days,
    showSamples: true,
    version: 1,
    eveningReminder: false,
    eveningHour: 21,
    photosInIdb: true,
  };
}

function saveState(state: JournalState) {
  try {
    const stripped = stripPhotosForStorage(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
  } catch (e) {
    console.error('Sillage storage', e);
    throw e;
  }
}

function rememberObjectUrl(
  map: Map<string, string>,
  photoId: string,
  objectUrl: string,
) {
  const prev = map.get(photoId);
  if (prev && prev !== objectUrl) {
    try {
      URL.revokeObjectURL(prev);
    } catch {
      /* ignore */
    }
  }
  map.set(photoId, objectUrl);
}

function revokeTracked(map: Map<string, string>, photoId: string) {
  const prev = map.get(photoId);
  if (prev) {
    try {
      URL.revokeObjectURL(prev);
    } catch {
      /* ignore */
    }
    map.delete(photoId);
  }
}

function revokeAll(map: Map<string, string>) {
  for (const url of map.values()) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
  map.clear();
}

/** Hydrate photos from IDB / migrate data: URLs into IDB + object URLs. */
async function hydrateAndMigrate(
  state: JournalState,
  objectUrls: Map<string, string>,
): Promise<JournalState> {
  const days: Record<string, DayEntry> = {};

  for (const [dayId, day] of Object.entries(state.days)) {
    const photos: Photo[] = [];
    for (const p of day.photos) {
      const url = p.url ?? '';

      if (isInlineRemoteUrl(url)) {
        photos.push({ ...p, url });
        continue;
      }

      if (isDataUrl(url)) {
        try {
          const blob = await dataUrlToBlob(url);
          await idbPutPhoto(p.id, blob);
          const objectUrl = blobToObjectUrl(blob);
          rememberObjectUrl(objectUrls, p.id, objectUrl);
          photos.push({ ...p, url: objectUrl });
        } catch (e) {
          console.error('Sillage migrate photo', p.id, e);
          photos.push({ ...p, url: '' });
        }
        continue;
      }

      if (isBlobUrl(url)) {
        // Already an object URL in this session — keep and track
        rememberObjectUrl(objectUrls, p.id, url);
        photos.push({ ...p, url });
        continue;
      }

      // Missing / empty url — load from IDB
      try {
        const blob = await idbGetPhoto(p.id);
        if (blob) {
          const objectUrl = blobToObjectUrl(blob);
          rememberObjectUrl(objectUrls, p.id, objectUrl);
          photos.push({ ...p, url: objectUrl });
        } else {
          // Broken photo — keep entry with empty url so user can remove
          photos.push({ ...p, url: '' });
        }
      } catch (e) {
        console.error('Sillage hydrate photo', p.id, e);
        photos.push({ ...p, url: '' });
      }
    }
    days[dayId] = { ...day, photos };
  }

  return { ...state, days, photosInIdb: true };
}

/** Import: put data-url photos into IDB, produce runtime object URLs. */
async function prepareImportedState(
  next: JournalState,
  objectUrls: Map<string, string>,
): Promise<JournalState> {
  await idbClearAll();
  revokeAll(objectUrls);

  const days: Record<string, DayEntry> = {};
  for (const [dayId, day] of Object.entries(next.days)) {
    const photos: Photo[] = [];
    for (const p of day.photos) {
      const url = p.url ?? '';
      if (isInlineRemoteUrl(url)) {
        photos.push({ ...p, url });
        continue;
      }
      if (isDataUrl(url)) {
        try {
          const blob = await dataUrlToBlob(url);
          await idbPutPhoto(p.id, blob);
          const objectUrl = blobToObjectUrl(blob);
          rememberObjectUrl(objectUrls, p.id, objectUrl);
          photos.push({ ...p, url: objectUrl });
        } catch (e) {
          console.error('Sillage import photo', p.id, e);
          photos.push({ ...p, url: '' });
        }
        continue;
      }
      // Already stripped / blob — try IDB (just cleared, so likely empty)
      try {
        const blob = await idbGetPhoto(p.id);
        if (blob) {
          const objectUrl = blobToObjectUrl(blob);
          rememberObjectUrl(objectUrls, p.id, objectUrl);
          photos.push({ ...p, url: objectUrl });
        } else {
          photos.push({ ...p, url: '' });
        }
      } catch {
        photos.push({ ...p, url: '' });
      }
    }
    days[dayId] = { ...day, photos };
  }

  return {
    ...next,
    days,
    eveningReminder: next.eveningReminder ?? false,
    eveningHour: clampEveningHour(next.eveningHour ?? 21),
    eveningDismissedOn: next.eveningDismissedOn,
    photosInIdb: true,
    coffrePin: next.coffrePin ?? null,
  };
}


function mergeHydratedPhotos(
  prev: JournalState,
  hydrated: JournalState,
): JournalState {
  const days: Record<string, DayEntry> = { ...prev.days };
  for (const [dayId, hDay] of Object.entries(hydrated.days)) {
    const pDay = days[dayId];
    if (!pDay) {
      days[dayId] = hDay;
      continue;
    }
    const urlById = new Map(hDay.photos.map((p) => [p.id, p.url]));
    days[dayId] = {
      ...pDay,
      photos: pDay.photos.map((p) => ({
        ...p,
        url: urlById.has(p.id) ? (urlById.get(p.id) as string) : p.url,
      })),
    };
  }
  return { ...prev, days, photosInIdb: true };
}

export function useJournal() {
  const [state, setState] = useState<JournalState>(() => loadState());
  const [photosReady, setPhotosReady] = useState(false);
  const [coffreUnlocked, setCoffreUnlockedState] = useState(() =>
    isCoffreUnlocked(),
  );
  const objectUrlsRef = useRef<Map<string, string>>(new Map());
  const skipSaveRef = useRef(true);
  const hydrateGenRef = useRef(0);

  // Hydrate / migrate on mount (from initial LS snapshot; data URLs still display until done)
  useEffect(() => {
    const gen = ++hydrateGenRef.current;
    let cancelled = false;
    const snapshot = loadState();

    (async () => {
      try {
        const hydrated = await hydrateAndMigrate(
          snapshot,
          objectUrlsRef.current,
        );
        if (cancelled || gen !== hydrateGenRef.current) return;
        setState((prev) => mergeHydratedPhotos(prev, hydrated));
      } catch (e) {
        console.error('Sillage hydrate', e);
      } finally {
        if (!cancelled && gen === hydrateGenRef.current) {
          setPhotosReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      revokeAll(objectUrlsRef.current);
    };
  }, []);

  // Persist (stripped) whenever state changes — skip first paint
  useEffect(() => {
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    try {
      saveState(state);
    } catch {
      /* surfaced elsewhere when adding photos */
    }
  }, [state]);

  const today = todayId();

  const allDays = useMemo(() => {
    return Object.values(state.days).sort((a, b) => b.id.localeCompare(a.id));
  }, [state.days]);

  const visibleDays = useMemo(() => {
    return allDays.filter((d) => hasContent(d) && !d.private);
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
      const current = prev.days[id];
      if (current?.photos.length) {
        const ids = current.photos.map((p) => p.id);
        for (const pid of ids) revokeTracked(objectUrlsRef.current, pid);
        void idbDeletePhotos(ids);
      }
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

  const addPhoto = useCallback(async (dayId: string, dataUrl: string) => {
    const photoId = `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const blob = await dataUrlToBlob(dataUrl);
    try {
      await idbPutPhoto(photoId, blob);
    } catch (e) {
      console.error('Sillage idb put', e);
      throw e instanceof Error
        ? e
        : new Error('Impossible d’enregistrer la photo.');
    }
    const objectUrl = blobToObjectUrl(blob);
    rememberObjectUrl(objectUrlsRef.current, photoId, objectUrl);
    const photo: Photo = {
      id: photoId,
      url: objectUrl,
      pinned: false,
    };
    setState((prev) => {
      const current = prev.days[dayId] ?? emptyDay(dayId);
      const photos = [...current.photos];
      if (photos.length === 0) photo.pinned = true;
      photos.push(photo);
      return {
        ...prev,
        photosInIdb: true,
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
    revokeTracked(objectUrlsRef.current, photoId);
    void idbDeletePhoto(photoId);
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

  const setEveningReminder = useCallback((enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      eveningReminder: enabled,
    }));
  }, []);

  const setEveningHour = useCallback((hour: number) => {
    setState((prev) => ({
      ...prev,
      eveningHour: clampEveningHour(hour),
    }));
  }, []);

  const dismissEveningReminder = useCallback((dateId: string) => {
    setState((prev) => ({
      ...prev,
      eveningDismissedOn: dateId,
    }));
  }, []);

  const search = useCallback(
    (q: string, moodFilter?: MoodId | null) => {
      const query = q.trim().toLowerCase();
      return allDays.filter((d) => {
        if (!hasContent(d) || d.private) return false;
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
      if (d.private) continue;
      if (d.mood && hasContent(d)) set.add(d.mood);
    }
    return Array.from(set);
  }, [allDays]);

  const pinnedPhotos = useMemo(() => {
    const items: { day: DayEntry; photo: Photo }[] = [];
    for (const d of allDays) {
      if (d.private) continue;
      for (const p of d.photos) {
        if (p.pinned) items.push({ day: d, photo: p });
      }
    }
    return items;
  }, [allDays]);

  const pinnedDays = useMemo(
    () => allDays.filter((d) => d.pinned && !d.private && hasContent(d)),
    [allDays],
  );

  const privateDays = useMemo(
    () => allDays.filter((d) => d.private && hasContent(d)),
    [allDays],
  );

  const samplesPresent = useMemo(() => {
    return SAMPLE_DAYS.some((s) => state.days[s.id]);
  }, [state.days]);

  const exportBackup = useCallback(async () => {
    const full = await materializePhotosForExport(state);
    downloadBackup(full);
  }, [state]);

  const importBackup = useCallback(async (next: JournalState) => {
    const prepared = await prepareImportedState(next, objectUrlsRef.current);
    setState(prepared);
  }, []);

  const hasCoffrePin = !!(state.coffrePin?.salt && state.coffrePin?.hash);

  const setCoffrePin = useCallback(async (pin: string) => {
    const normalized = normalizePin(pin);
    if (normalized.length < 4 || normalized.length > 6) {
      throw new Error('4 à 6 chiffres');
    }
    const salt = generateSalt();
    const hash = await hashPin(normalized, salt);
    setState((prev) => ({
      ...prev,
      coffrePin: { salt, hash },
    }));
    persistCoffreUnlocked(true);
    setCoffreUnlockedState(true);
  }, []);

  const changeCoffrePin = useCallback(
    async (current: string, next: string) => {
      const stored = state.coffrePin;
      if (!stored?.salt || !stored?.hash) {
        throw new Error('Aucun code défini.');
      }
      const cur = normalizePin(current);
      const nxt = normalizePin(next);
      if (nxt.length < 4 || nxt.length > 6) {
        throw new Error('4 à 6 chiffres');
      }
      const ok = await verifyPin(cur, stored);
      if (!ok) {
        throw new Error('Code incorrect.');
      }
      const salt = generateSalt();
      const hash = await hashPin(nxt, salt);
      setState((prev) => ({
        ...prev,
        coffrePin: { salt, hash },
      }));
      persistCoffreUnlocked(true);
      setCoffreUnlockedState(true);
    },
    [state.coffrePin],
  );

  const clearCoffrePin = useCallback(
    async (current: string) => {
      const stored = state.coffrePin;
      if (!stored?.salt || !stored?.hash) {
        setState((prev) => ({ ...prev, coffrePin: null }));
        persistCoffreUnlocked(false);
        setCoffreUnlockedState(false);
        return;
      }
      const cur = normalizePin(current);
      const ok = await verifyPin(cur, stored);
      if (!ok) {
        throw new Error('Code incorrect.');
      }
      setState((prev) => ({ ...prev, coffrePin: null }));
      persistCoffreUnlocked(false);
      setCoffreUnlockedState(false);
    },
    [state.coffrePin],
  );

  const unlockCoffre = useCallback(
    async (pin: string): Promise<boolean> => {
      const stored = state.coffrePin;
      if (!stored?.salt || !stored?.hash) {
        persistCoffreUnlocked(true);
        setCoffreUnlockedState(true);
        return true;
      }
      const normalized = normalizePin(pin);
      const ok = await verifyPin(normalized, stored);
      if (ok) {
        persistCoffreUnlocked(true);
        setCoffreUnlockedState(true);
      }
      return ok;
    },
    [state.coffrePin],
  );

  const lockCoffre = useCallback(() => {
    persistCoffreUnlocked(false);
    setCoffreUnlockedState(false);
  }, []);

  const eveningReminder = state.eveningReminder ?? false;
  const eveningHour = clampEveningHour(state.eveningHour ?? 21);
  const eveningDismissedOn = state.eveningDismissedOn;

  return {
    state,
    photosReady,
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
    pinnedDays,
    privateDays,
    samplesPresent,
    showSamplesBanner: state.showSamples && samplesPresent,
    eveningReminder,
    eveningHour,
    eveningDismissedOn,
    setEveningReminder,
    setEveningHour,
    dismissEveningReminder,
    exportBackup,
    importBackup,
    hasCoffrePin,
    coffreUnlocked,
    setCoffrePin,
    changeCoffrePin,
    clearCoffrePin,
    unlockCoffre,
    lockCoffre,
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

export function weekDaysAround(refDay: string): string[] {
  const [y, m, d] = refDay.split('-').map(Number);
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

/** Shift a date id by N weeks (positive = future). */
export function shiftWeek(id: string, deltaWeeks: number): string {
  const [y, m, d] = id.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + deltaWeeks * 7);
  return toId(date);
}

function parseId(id: string): Date {
  const [y, m, d] = id.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Short FR range label from Mon–Sun strip ids, e.g. « 8–14 septembre ». */
export function formatWeekRange(ids: string[]): string {
  if (!ids.length) return '';
  const first = parseId(ids[0]);
  const last = parseId(ids[ids.length - 1]);
  const sameMonth =
    first.getMonth() === last.getMonth() &&
    first.getFullYear() === last.getFullYear();
  const sameYear = first.getFullYear() === last.getFullYear();
  const thisYear = new Date().getFullYear();

  const monthName = (date: Date) =>
    date.toLocaleDateString('fr-FR', { month: 'long' });

  if (sameMonth) {
    const month = monthName(first);
    const range = `${first.getDate()}–${last.getDate()} ${month}`;
    if (first.getFullYear() !== thisYear) {
      return `${range} ${first.getFullYear()}`;
    }
    return range;
  }

  if (sameYear) {
    const left = `${first.getDate()} ${monthName(first)}`;
    const right = `${last.getDate()} ${monthName(last)}`;
    const range = `${left} – ${right}`;
    if (first.getFullYear() !== thisYear) {
      return `${range} ${first.getFullYear()}`;
    }
    return range;
  }

  const left = first.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const right = last.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return `${left} – ${right}`;
}

export type JournalApi = ReturnType<typeof useJournal>;
