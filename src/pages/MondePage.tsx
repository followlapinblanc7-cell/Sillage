import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  formatDateShort,
  hasPreciseCoords,
  type JournalApi,
} from '../hooks/useJournal';
import {
  geocodeLocation,
  rememberPlace,
  reverseGeocode,
  type GeocodeOutcome,
} from '../lib/geocode';
import {
  loadLeaflet,
  type LeafletMap,
  type LeafletMarker,
  type LeafletNamespace,
  type LeafletTileLayer,
} from '../lib/loadLeaflet';
import { CARTO_TILES } from '../lib/theme';
import type { DayEntry } from '../types';

interface Props {
  journal: JournalApi;
}

interface Pin {
  day: DayEntry;
  lat: number;
  lon: number;
  source: 'stored' | 'geocode';
}

type PlacePhase = 'idle' | 'picking' | 'confirm';

const VIEW_KEY = 'sillage-monde-view-v1';
const DEFAULT_VIEW = { lat: 20, lon: 8, zoom: 2 };

function excerpt(text: string, max = 110): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}…`;
}

function pinIcon(L: LeafletNamespace, active: boolean) {
  return L.divIcon({
    className: `monde-pin${active ? ' active' : ''}`,
    html: '<span class="monde-pin-dot" aria-hidden="true"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function readSavedView(): { lat: number; lon: number; zoom: number } {
  try {
    const raw = sessionStorage.getItem(VIEW_KEY);
    if (!raw) return DEFAULT_VIEW;
    const parsed = JSON.parse(raw) as {
      lat?: unknown;
      lon?: unknown;
      zoom?: unknown;
    };
    const lat = typeof parsed.lat === 'number' ? parsed.lat : DEFAULT_VIEW.lat;
    const lon = typeof parsed.lon === 'number' ? parsed.lon : DEFAULT_VIEW.lon;
    const zoom =
      typeof parsed.zoom === 'number' ? parsed.zoom : DEFAULT_VIEW.zoom;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(zoom)) {
      return DEFAULT_VIEW;
    }
    return { lat, lon, zoom };
  } catch {
    return DEFAULT_VIEW;
  }
}

function saveView(map: LeafletMap) {
  try {
    const c = map.getCenter();
    sessionStorage.setItem(
      VIEW_KEY,
      JSON.stringify({ lat: c.lat, lon: c.lng, zoom: map.getZoom() }),
    );
  } catch {
    /* ignore */
  }
}

function formatPendingLabel(lat: number, lon: number): string {
  return `${lat.toFixed(3)}°, ${lon.toFixed(3)}°`;
}

export function MondePage({ journal }: Props) {
  const days = journal.visibleDays;

  const storedPins = useMemo(() => {
    const list: Pin[] = [];
    for (const day of days) {
      if (hasPreciseCoords(day)) {
        list.push({
          day,
          lat: day.lat as number,
          lon: day.lon as number,
          source: 'stored',
        });
      }
    }
    return list;
  }, [days]);

  const needGeocode = useMemo(() => {
    const seen = new Set<string>();
    const labels: { day: DayEntry; label: string; key: string }[] = [];
    for (const day of days) {
      if (hasPreciseCoords(day)) continue;
      const label = (day.location ?? '').trim().replace(/\s+/g, ' ');
      if (!label) continue;
      const key = label.toLocaleLowerCase('fr');
      if (seen.has(`${day.id}:${key}`)) continue;
      seen.add(`${day.id}:${key}`);
      labels.push({ day, label, key });
    }
    return labels;
  }, [days]);

  const [geocodeMap, setGeocodeMap] = useState<
    Record<string, GeocodeOutcome | undefined>
  >({});
  const [retryTick, setRetryTick] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placePhase, setPlacePhase] = useState<PlacePhase>('idle');
  const [pending, setPending] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [pendingLabel, setPendingLabel] = useState('');
  const [labelBusy, setLabelBusy] = useState(false);
  const [placeDayId, setPlaceDayId] = useState(journal.today);
  const [placeMsg, setPlaceMsg] = useState<string | null>(null);

  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tilesRef = useRef<LeafletTileLayer | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const LRef = useRef<LeafletNamespace | null>(null);
  const placePhaseRef = useRef(placePhase);
  const fittedRef = useRef(false);
  const geocodeRef = useRef(geocodeMap);

  useEffect(() => {
    placePhaseRef.current = placePhase;
  }, [placePhase]);

  useEffect(() => {
    geocodeRef.current = geocodeMap;
  }, [geocodeMap]);

  useEffect(() => {
    const onOnline = () => setRetryTick((n) => n + 1);
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  // Geocode days that only have location text
  useEffect(() => {
    if (!needGeocode.length) return;
    let cancelled = false;
    (async () => {
      for (const item of needGeocode) {
        if (cancelled) return;
        const existing = geocodeRef.current[item.key];
        if (existing?.status === 'ok' || existing?.status === 'miss') continue;
        const outcome = await geocodeLocation(item.label);
        if (cancelled) return;
        setGeocodeMap((prev) => ({ ...prev, [item.key]: outcome }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needGeocode, retryTick]);

  const pins: Pin[] = useMemo(() => {
    const byId = new Map<string, Pin>();
    for (const p of storedPins) byId.set(p.day.id, p);
    for (const item of needGeocode) {
      if (byId.has(item.day.id)) continue;
      const outcome = geocodeMap[item.key];
      if (outcome?.status !== 'ok') continue;
      byId.set(item.day.id, {
        day: item.day,
        lat: outcome.hit.lat,
        lon: outcome.hit.lon,
        source: 'geocode',
      });
    }
    return Array.from(byId.values());
  }, [storedPins, needGeocode, geocodeMap]);

  const selectedPin = selectedId
    ? (pins.find((p) => p.day.id === selectedId) ?? null)
    : null;

  // Init map once
  useEffect(() => {
    const el = mapElRef.current;
    if (!el) return;
    let cancelled = false;
    let resizeObs: ResizeObserver | null = null;
    let tileErrorCount = 0;
    const onWinResize = () => mapRef.current?.invalidateSize();

    const onMapClick = (e?: { latlng?: { lat: number; lng: number } }) => {
      if (placePhaseRef.current !== 'picking') return;
      const ll = e?.latlng;
      if (!ll || !Number.isFinite(ll.lat) || !Number.isFinite(ll.lng)) return;
      setPending({ lat: ll.lat, lon: ll.lng });
      setPlacePhase('confirm');
      setPlaceDayId(journal.today);
      setPlaceMsg(null);
    };

    const onMoveEnd = () => {
      if (mapRef.current) saveView(mapRef.current);
    };

    (async () => {
      try {
        const L = await loadLeaflet();
        if (cancelled) return;
        LRef.current = L;
        const saved = readSavedView();
        const map = L.map(el, {
          zoomControl: false,
          attributionControl: true,
          scrollWheelZoom: true,
          worldCopyJump: true,
        }).setView([saved.lat, saved.lon], saved.zoom);

        L.control.zoom({ position: 'topright' }).addTo(map);

        const tiles = L.tileLayer(CARTO_TILES[journal.theme], {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> · <a href="https://carto.com/">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 19,
        });
        tiles.on('tileerror', () => {
          tileErrorCount += 1;
          if (tileErrorCount >= 6) setTilesFailed(true);
        });
        tiles.addTo(map);
        tilesRef.current = tiles;

        map.on('click', onMapClick);
        map.on('contextmenu', onMapClick);
        map.on('moveend', onMoveEnd);

        mapRef.current = map;
        setMapReady(true);
        setMapError(false);
        setTilesFailed(false);
        requestAnimationFrame(() => map.invalidateSize());
        resizeObs = new ResizeObserver(() => map.invalidateSize());
        resizeObs.observe(el);
        window.addEventListener('resize', onWinResize);
        window.addEventListener('orientationchange', onWinResize);
      } catch {
        if (!cancelled) {
          setMapError(true);
          setMapReady(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      resizeObs?.disconnect();
      window.removeEventListener('resize', onWinResize);
      window.removeEventListener('orientationchange', onWinResize);
      markersRef.current.clear();
      if (mapRef.current) {
        mapRef.current.off('click', onMapClick);
        mapRef.current.off('contextmenu', onMapClick);
        mapRef.current.off('moveend', onMoveEnd);
        mapRef.current.remove();
        mapRef.current = null;
        tilesRef.current = null;
      }
      LRef.current = null;
      setMapReady(false);
    };
    // theme handled separately; journal.today only for default day id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const tiles = tilesRef.current;
    if (!tiles || !mapReady) return;
    setTilesFailed(false);
    tiles.setUrl(CARTO_TILES[journal.theme]);
  }, [journal.theme, mapReady]);

  // Reverse-geocode pending pin label
  useEffect(() => {
    if (placePhase !== 'confirm' || !pending) return;
    let cancelled = false;
    const abort = new AbortController();
    setLabelBusy(true);
    setPendingLabel(formatPendingLabel(pending.lat, pending.lon));
    void (async () => {
      const outcome = await reverseGeocode(pending.lat, pending.lon, abort.signal);
      if (cancelled) return;
      setLabelBusy(false);
      if (outcome.status === 'ok') {
        setPendingLabel(outcome.label);
      }
    })();
    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [placePhase, pending]);

  // Markers
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L || !mapReady) return;

    const wanted = new Set(pins.map((p) => p.day.id));
    for (const [id, marker] of markersRef.current) {
      if (!wanted.has(id)) {
        map.removeLayer(marker);
        markersRef.current.delete(id);
      }
    }

    const bounds = L.latLngBounds([]);
    for (const pin of pins) {
      const latlng: [number, number] = [pin.lat, pin.lon];
      bounds.extend(latlng);
      const active = selectedId === pin.day.id;
      const title = pin.day.title.trim() || 'Sans titre';
      const prev = markersRef.current.get(pin.day.id);
      if (prev) {
        prev.setLatLng(latlng);
        prev.setIcon(pinIcon(L, active));
      } else {
        const marker = L.marker(latlng, {
          icon: pinIcon(L, active),
          title,
          riseOnHover: true,
        });
        marker.on('click', () => {
          setSelectedId(pin.day.id);
          if (placePhaseRef.current === 'picking') {
            setPlacePhase('idle');
            setPending(null);
          }
        });
        marker.addTo(map);
        markersRef.current.set(pin.day.id, marker);
      }
    }

    if (pins.length > 0 && !fittedRef.current) {
      fittedRef.current = true;
      const saved = readSavedView();
      // Only auto-fit if still at default world view (first visit this session)
      const atDefault =
        Math.abs(saved.lat - DEFAULT_VIEW.lat) < 0.01 &&
        Math.abs(saved.lon - DEFAULT_VIEW.lon) < 0.01 &&
        saved.zoom <= DEFAULT_VIEW.zoom + 0.5;
      if (atDefault) {
        if (pins.length === 1) {
          map.setView([pins[0].lat, pins[0].lon], 11);
        } else if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [48, 48], maxZoom: 12 });
        }
      }
    }

    requestAnimationFrame(() => map.invalidateSize());
  }, [pins, mapReady, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L || !mapReady) return;
    for (const [id, marker] of markersRef.current) {
      const active = selectedId === id;
      const elPin = marker.getElement?.();
      if (elPin) elPin.classList.toggle('active', active);
      else marker.setIcon(pinIcon(L, active));
    }
  }, [selectedId, mapReady]);

  const startPlace = () => {
    setSelectedId(null);
    setPending(null);
    setPlaceMsg(null);
    setPlacePhase('picking');
  };

  const cancelPlace = () => {
    setPlacePhase('idle');
    setPending(null);
    setPlaceMsg(null);
    setLabelBusy(false);
  };

  const confirmPlace = () => {
    if (!pending) return;
    const id = placeDayId || journal.today;
    const label =
      pendingLabel.trim() || formatPendingLabel(pending.lat, pending.lon);
    rememberPlace(label, { lat: pending.lat, lon: pending.lon });
    journal.updateDay(id, {
      location: label,
      lat: pending.lat,
      lon: pending.lon,
    });
    setSelectedId(id);
    setPlacePhase('idle');
    setPending(null);
    setPlaceMsg('Souvenir posé.');
    const map = mapRef.current;
    if (map) {
      map.flyTo([pending.lat, pending.lon], Math.max(map.getZoom(), 12), {
        duration: 0.5,
      });
    }
  };

  const recentChoices = useMemo(() => {
    const ids = new Set<string>([journal.today]);
    const list: { id: string; label: string }[] = [
      { id: journal.today, label: `Aujourd’hui · ${formatDateShort(journal.today)}` },
    ];
    for (const d of days) {
      if (ids.has(d.id)) continue;
      ids.add(d.id);
      list.push({ id: d.id, label: formatDateShort(d.id) });
      if (list.length >= 8) break;
    }
    return list;
  }, [days, journal.today]);

  const emptyPins = pins.length === 0;
  const statusLine = mapError
    ? 'La carte dort hors ligne — le reste du journal reste là.'
    : tilesFailed
      ? 'Les tuiles peinent — réessaie avec le réseau.'
      : placePhase === 'picking'
        ? 'Touche la carte pour poser un souvenir.'
        : placeMsg;

  return (
    <div
      className={`monde-page${placePhase === 'picking' ? ' is-placing' : ''}`}
    >
      <header className="monde-top">
        <div className="monde-top-text">
          <h1 className="monde-title">Monde</h1>
          <p className="monde-sub">
            {emptyPins
              ? 'Des souvenirs sur la carte'
              : pins.length === 1
                ? 'Un souvenir posé'
                : `${pins.length} souvenirs posés`}
          </p>
        </div>
        <button
          type="button"
          className={`monde-place-btn${placePhase !== 'idle' ? ' active' : ''}`}
          onClick={() =>
            placePhase === 'idle' ? startPlace() : cancelPlace()
          }
          aria-pressed={placePhase !== 'idle'}
        >
          {placePhase === 'idle' ? 'Poser un souvenir' : 'Annuler'}
        </button>
      </header>

      <div className="monde-map-wrap" aria-busy={labelBusy || undefined}>
        {mapError ? (
          <p className="monde-map-fallback" role="status">
            La carte a besoin du réseau. Tes jours, eux, restent.
          </p>
        ) : (
          <div
            ref={mapElRef}
            className="monde-map"
            role="application"
            aria-label="Carte du monde des souvenirs"
          />
        )}

        {emptyPins && !mapError && placePhase === 'idle' ? (
          <div className="monde-empty" role="status">
            <p className="monde-empty-quote">
              « Le monde attend la première trace. »
            </p>
            <p className="muted monde-empty-hint">
              Écris un lieu sur un jour, ou pose un souvenir ici — sur la carte.
            </p>
            <Link to="/lieux" className="monde-lieux-link">
              Voir les lieux du Tiroir
            </Link>
          </div>
        ) : null}

        {statusLine ? (
          <p className="monde-status" role="status">
            {statusLine}
          </p>
        ) : null}
      </div>

      {selectedPin && placePhase === 'idle' ? (
        <aside className="monde-preview" aria-live="polite">
          <button
            type="button"
            className="monde-preview-close"
            aria-label="Fermer l’aperçu"
            onClick={() => setSelectedId(null)}
          >
            ×
          </button>
          <p className="monde-preview-date">
            {formatDateShort(selectedPin.day.id)}
          </p>
          <h2 className="monde-preview-title">
            {selectedPin.day.title.trim() || 'Sans titre'}
          </h2>
          {selectedPin.day.location.trim() ? (
            <p className="monde-preview-lieu">{selectedPin.day.location}</p>
          ) : null}
          {excerpt(selectedPin.day.story) ? (
            <p className="monde-preview-excerpt">
              {excerpt(selectedPin.day.story)}
            </p>
          ) : null}
          <Link
            to={`/jour/${selectedPin.day.id}`}
            className="monde-preview-open"
          >
            Ouvrir le jour
          </Link>
        </aside>
      ) : null}

      {placePhase === 'confirm' && pending ? (
        <div className="monde-place-sheet" role="dialog" aria-modal="true" aria-label="Poser un souvenir">
          <p className="monde-place-sheet-label">
            {labelBusy ? 'Le lieu se nomme…' : pendingLabel}
          </p>
          <p className="muted monde-place-sheet-hint">
            Sur quel jour poser cette trace ?
          </p>
          <label className="monde-place-day-label">
            <span className="sr-only">Jour</span>
            <select
              className="monde-place-day"
              value={placeDayId}
              onChange={(e) => setPlaceDayId(e.target.value)}
            >
              {recentChoices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <input
            type="date"
            className="monde-place-date"
            value={placeDayId}
            onChange={(e) => {
              if (e.target.value) setPlaceDayId(e.target.value);
            }}
            aria-label="Choisir une autre date"
          />
          <div className="monde-place-actions">
            <button type="button" className="btn-ghost" onClick={cancelPlace}>
              Annuler
            </button>
            <button
              type="button"
              className="monde-place-confirm"
              onClick={confirmPlace}
            >
              Poser ici
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
