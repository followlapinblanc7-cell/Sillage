import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import {
  listRecentPlaces,
  rememberPlace,
  searchPlaces,
  type PlaceCandidate,
  type RecentPlace,
} from '../lib/geocode';

const DEBOUNCE_MS = 380;
const MIN_QUERY = 2;

type SuggestKind = 'search' | 'recent';

interface SuggestItem {
  id: string;
  label: string;
  lat: number;
  lon: number;
  kind: SuggestKind;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function LieuField({ value, onChange }: Props) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pickLockRef = useRef(false);

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [items, setItems] = useState<SuggestItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState<'idle' | 'empty' | 'unavailable'>('idle');
  const [recents, setRecents] = useState<RecentPlace[]>(() => listRecentPlaces());

  const closeList = () => {
    setOpen(false);
    setActiveIndex(-1);
    setSearching(false);
    setStatus('idle');
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  };

  const showRecents = () => {
    const list = listRecentPlaces();
    setRecents(list);
    if (!list.length) {
      setItems([]);
      setOpen(false);
      setStatus('idle');
      return;
    }
    setItems(
      list.map((r, i) => ({
        id: `recent-${i}-${r.label}`,
        label: r.label,
        lat: r.lat,
        lon: r.lon,
        kind: 'recent' as const,
      })),
    );
    setStatus('idle');
    setOpen(true);
    setActiveIndex(-1);
  };

  const runSearch = (query: string) => {
    if (abortRef.current) abortRef.current.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setSearching(true);
    setStatus('idle');

    void (async () => {
      const outcome = await searchPlaces(query, {
        signal: abort.signal,
        limit: 7,
      });
      if (abort.signal.aborted) return;
      setSearching(false);
      if (outcome.status === 'ok') {
        setItems(
          outcome.places.map((p: PlaceCandidate, i) => ({
            id: `search-${i}-${p.label}`,
            label: p.label,
            lat: p.lat,
            lon: p.lon,
            kind: 'search' as const,
          })),
        );
        setStatus('idle');
        setOpen(true);
        setActiveIndex(-1);
      } else if (outcome.status === 'empty') {
        setItems([]);
        setStatus('empty');
        setOpen(true);
        setActiveIndex(-1);
      } else {
        // aborted searches return unavailable — ignore if we replaced the controller
        if (abortRef.current !== abort) return;
        setItems([]);
        setStatus('unavailable');
        setOpen(true);
        setActiveIndex(-1);
      }
    })();
  };

  const scheduleSearch = (raw: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = raw.trim();
    if (q.length < MIN_QUERY) {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      setSearching(false);
      if (!q) {
        showRecents();
      } else {
        setItems([]);
        setStatus('idle');
        setOpen(false);
      }
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(q), DEBOUNCE_MS);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) closeList();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const pick = (item: SuggestItem) => {
    pickLockRef.current = true;
    rememberPlace(item.label, { lat: item.lat, lon: item.lon });
    setRecents(listRecentPlaces());
    onChange(item.label);
    closeList();
    // Allow typing again after the value settles
    requestAnimationFrame(() => {
      pickLockRef.current = false;
    });
    inputRef.current?.blur();
  };

  const onInputChange = (next: string) => {
    if (pickLockRef.current) return;
    onChange(next);
    setStatus('idle');
    scheduleSearch(next);
  };

  const onFocus = () => {
    const q = value.trim();
    if (q.length >= MIN_QUERY) {
      scheduleSearch(q);
    } else {
      showRecents();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        closeList();
      }
      return;
    }

    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      if (items.length || value.trim().length >= MIN_QUERY || recents.length) {
        e.preventDefault();
        if (items.length) {
          setOpen(true);
          setActiveIndex(e.key === 'ArrowDown' ? 0 : items.length - 1);
        } else if (value.trim().length >= MIN_QUERY) {
          scheduleSearch(value);
        } else {
          showRecents();
        }
      }
      return;
    }

    if (!open || !items.length) {
      if (e.key === 'Enter' && open && status !== 'idle') {
        e.preventDefault();
        closeList();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < items.length) {
        e.preventDefault();
        pick(items[activeIndex]);
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(items.length - 1);
    }
  };

  const activeId =
    open && activeIndex >= 0 && items[activeIndex]
      ? `${listId}-${activeIndex}`
      : undefined;

  const showPanel =
    open && (items.length > 0 || status === 'empty' || status === 'unavailable' || searching);

  const statusMessage =
    searching && !items.length
      ? 'Recherche…'
      : status === 'empty'
        ? 'Rien par ici — un resto, une rue, une ville… ?'
        : status === 'unavailable'
          ? 'Pas de réseau'
          : null;

  const listLabel =
    items.length && items[0]?.kind === 'recent'
      ? 'Lieux récents'
      : 'Suggestions de lieux';

  return (
    <div className="lieu-picker" ref={wrapRef}>
      <input
        ref={inputRef}
        className="lieu-input"
        type="text"
        placeholder="Ville, café, resto, un coin…"
        value={value}
        onChange={(e) => onInputChange(e.target.value)}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-label="Lieu"
        aria-autocomplete="list"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-activedescendant={activeId}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {showPanel ? (
        <div className="lieu-suggest" id={listId}>
          {items.length > 0 ? (
            <ul
              className="lieu-suggest-list"
              role="listbox"
              aria-label={listLabel}
            >
              {items[0]?.kind === 'recent' ? (
                <li className="lieu-suggest-heading" role="presentation">
                  Récents
                </li>
              ) : null}
              {items.map((item, index) => {
                const selected = index === activeIndex;
                return (
                  <li
                    key={item.id}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={selected}
                    className={`lieu-suggest-option${selected ? ' active' : ''}`}
                    onMouseDown={(e) => {
                      // Prevent input blur before click registers
                      e.preventDefault();
                      pick(item);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <span className="lieu-suggest-label">{item.label}</span>
                    {item.kind === 'recent' ? (
                      <span className="lieu-suggest-meta" aria-hidden="true">
                        récent
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {statusMessage ? (
            <p
              className="lieu-suggest-status muted"
              role={status === 'unavailable' ? 'alert' : 'status'}
              aria-live="polite"
            >
              {statusMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
