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
  continentOf,
  countryPaletteIndex,
  loadCountries,
} from '../lib/countries';
import {
  isWebGLAvailable,
  loadGlobe,
  type GlobeInstance,
} from '../lib/loadGlobe';
import {
  GLOBE_ATMOSPHERE,
  GLOBE_BG,
  GLOBE_COUNTRY_FALLBACK,
  GLOBE_COUNTRY_PALETTE,
  GLOBE_COUNTRY_SIDE,
  GLOBE_COUNTRY_STROKE,
  GLOBE_GRATICULE,
  GLOBE_PIN,
  oceanGlobeImageUrl,
  type ThemeId,
} from '../lib/theme';
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

const VIEW_KEY = 'sillage-monde-globe-view-v1';
const DEFAULT_POV = { lat: 20, lng: 8, altitude: 2.35 };
const PENDING_ID = '__pending__';

function countryCapColor(d: unknown, theme: ThemeId): string {
  if (continentOf(d) === 'Antarctica') {
    return GLOBE_COUNTRY_FALLBACK[theme];
  }
  const palette = GLOBE_COUNTRY_PALETTE[theme];
  return palette[countryPaletteIndex(d, palette.length)] ?? GLOBE_COUNTRY_FALLBACK[theme];
}

function applyCountryStyle(globe: GlobeInstance, theme: ThemeId) {
  globe
    .polygonCapColor((d) => countryCapColor(d, theme))
    .polygonSideColor(() => GLOBE_COUNTRY_SIDE[theme])
    .polygonStrokeColor(() => GLOBE_COUNTRY_STROKE[theme]);
}

/** Idle night-emissive path: solid ocean plate, no city-lights glow. */
function clearNightEmissive(globe: GlobeInstance) {
  const mat = globe.globeMaterial?.();
  if (!mat) return;
  const apply = () => {
    mat.emissiveMap = undefined;
    mat.emissive?.set('#000000');
    mat.emissiveIntensity = 0;
    mat.color?.set('#ffffff');
    mat.needsUpdate = true;
    return !!mat.map || true;
  };
  apply();
  let tries = 0;
  const id = window.setInterval(() => {
    tries += 1;
    if (apply() || tries > 40) window.clearInterval(id);
  }, 80);
}

type GraticulePath = { points: { lat: number; lng: number }[] };

function buildGraticule(step = 30): GraticulePath[] {
  const paths: GraticulePath[] = [];
  for (let lat = -60; lat <= 60; lat += step) {
    const points: { lat: number; lng: number }[] = [];
    for (let lng = -180; lng <= 180; lng += 5) {
      points.push({ lat, lng });
    }
    paths.push({ points });
  }
  for (let lng = -180; lng < 180; lng += step) {
    const points: { lat: number; lng: number }[] = [];
    for (let lat = -90; lat <= 90; lat += 5) {
      points.push({ lat, lng });
    }
    paths.push({ points });
  }
  return paths;
}

function applyGraticule(globe: GlobeInstance, theme: ThemeId) {
  const g = GLOBE_GRATICULE[theme];
  globe
    .pathsData(buildGraticule(30))
    .pathPoints('points')
    .pathPointAlt(0.0012)
    .pathColor(() => g.color)
    .pathStroke(g.stroke)
    .pathsTransitionDuration(0);
}

interface GlobePoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
  kind: 'pin' | 'pending';
  active: boolean;
}

function excerpt(text: string, max = 110): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}…`;
}

function readSavedView(): { lat: number; lng: number; altitude: number } {
  try {
    const raw = sessionStorage.getItem(VIEW_KEY);
    if (!raw) return DEFAULT_POV;
    const parsed = JSON.parse(raw) as {
      lat?: unknown;
      lng?: unknown;
      altitude?: unknown;
    };
    const lat = typeof parsed.lat === 'number' ? parsed.lat : DEFAULT_POV.lat;
    const lng = typeof parsed.lng === 'number' ? parsed.lng : DEFAULT_POV.lng;
    const altitude =
      typeof parsed.altitude === 'number'
        ? parsed.altitude
        : DEFAULT_POV.altitude;
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      !Number.isFinite(altitude)
    ) {
      return DEFAULT_POV;
    }
    return { lat, lng, altitude };
  } catch {
    return DEFAULT_POV;
  }
}

function saveView(globe: GlobeInstance) {
  try {
    const pov = globe.pointOfView() as {
      lat: number;
      lng: number;
      altitude: number;
    };
    sessionStorage.setItem(
      VIEW_KEY,
      JSON.stringify({
        lat: pov.lat,
        lng: pov.lng,
        altitude: pov.altitude,
      }),
    );
  } catch {
    /* ignore */
  }
}

function formatPendingLabel(lat: number, lon: number): string {
  return `${lat.toFixed(3)}°, ${lon.toFixed(3)}°`;
}

function fitPinsAltitude(count: number): number {
  if (count <= 1) return 1.15;
  if (count <= 4) return 1.55;
  return 2.0;
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
  const [globeReady, setGlobeReady] = useState(false);
  const [globeError, setGlobeError] = useState(false);
  const [webglMissing, setWebglMissing] = useState(false);
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

  const globeElRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeInstance | null>(null);
  const placePhaseRef = useRef(placePhase);
  const fittedRef = useRef(false);
  const geocodeRef = useRef(geocodeMap);
  const selectedIdRef = useRef(selectedId);
  const pendingRef = useRef(pending);
  const pinsRef = useRef<Pin[]>([]);

  useEffect(() => {
    placePhaseRef.current = placePhase;
  }, [placePhase]);

  useEffect(() => {
    geocodeRef.current = geocodeMap;
  }, [geocodeMap]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

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

  useEffect(() => {
    pinsRef.current = pins;
  }, [pins]);

  const selectedPin = selectedId
    ? (pins.find((p) => p.day.id === selectedId) ?? null)
    : null;

  const buildPoints = (
    pinList: Pin[],
    sel: string | null,
    pend: { lat: number; lon: number } | null,
  ): GlobePoint[] => {
    const pts: GlobePoint[] = pinList.map((p) => ({
      id: p.day.id,
      lat: p.lat,
      lng: p.lon,
      label: p.day.title.trim() || 'Sans titre',
      kind: 'pin' as const,
      active: sel === p.day.id,
    }));
    if (pend) {
      pts.push({
        id: PENDING_ID,
        lat: pend.lat,
        lng: pend.lon,
        label: 'Nouveau souvenir',
        kind: 'pending',
        active: true,
      });
    }
    return pts;
  };

  const applyPoints = (globe: GlobeInstance) => {
    globe.pointsData(
      buildPoints(pinsRef.current, selectedIdRef.current, pendingRef.current),
    );
  };

  // Init globe once
  useEffect(() => {
    const el = globeElRef.current;
    if (!el) return;
    let cancelled = false;
    let resizeObs: ResizeObserver | null = null;
    let saveTimer: number | null = null;

    const syncSize = () => {
      const g = globeRef.current;
      if (!g || !el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) {
        g.width(w);
        g.height(h);
      }
    };

    const onWinResize = () => syncSize();

    (async () => {
      try {
        if (!isWebGLAvailable()) {
          if (!cancelled) {
            setWebglMissing(true);
            setGlobeError(true);
            setGlobeReady(false);
          }
          return;
        }
        const Globe = await loadGlobe();
        if (cancelled) return;

        const theme = journal.theme;
        const atm = GLOBE_ATMOSPHERE[theme];
        const saved = readSavedView();

        const globe = new Globe(el, {
          rendererConfig: {
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
          },
        })
          .backgroundColor(GLOBE_BG[theme])
          .backgroundImageUrl(null)
          .globeImageUrl(oceanGlobeImageUrl(theme))
          .showAtmosphere(true)
          .atmosphereColor(atm.color)
          .atmosphereAltitude(atm.altitude)
          .polygonsTransitionDuration(0)
          .polygonAltitude(0.0035)
          .polygonLabel(() => null)
          .polygonGeoJsonGeometry('geometry')
          .pointerEventsFilter((obj) => obj.__globeObjType !== 'polygon')
          .pointsMerge(false)
          .pointLat('lat')
          .pointLng('lng')
          .pointAltitude((d) => {
            const p = d as GlobePoint;
            if (p.kind === 'pending') return 0.018;
            return p.active ? 0.022 : 0.012;
          })
          .pointRadius((d) => {
            const p = d as GlobePoint;
            if (p.kind === 'pending') return 0.55;
            return p.active ? 0.62 : 0.42;
          })
          .pointColor((d) => {
            const p = d as GlobePoint;
            if (p.kind === 'pending') return GLOBE_PIN.pending;
            return p.active ? GLOBE_PIN.active : GLOBE_PIN.idle;
          })
          .pointLabel((d) => (d as GlobePoint).label)
          .onPointClick((point) => {
            const p = point as GlobePoint;
            if (!p || p.kind === 'pending') return;
            setSelectedId(p.id);
            if (placePhaseRef.current === 'picking') {
              setPlacePhase('idle');
              setPending(null);
            }
          })
          .onGlobeClick(({ lat, lng }) => {
            if (placePhaseRef.current !== 'picking') return;
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
            setPending({ lat, lon: lng });
            setPlacePhase('confirm');
            setPlaceDayId(journal.today);
            setPlaceMsg(null);
            setSelectedId(null);
          });

        const controls = globe.controls();
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.25;
        controls.enableZoom = true;
        controls.minDistance = 120;
        controls.maxDistance = 500;

        globe.pointOfView(saved, 0);
        syncSize();

        // Pause auto-rotate while interacting / placing
        const canvas = el.querySelector('canvas');
        const stopSpin = () => {
          controls.autoRotate = false;
        };
        const maybeResume = () => {
          if (placePhaseRef.current === 'idle' && !selectedIdRef.current) {
            window.setTimeout(() => {
              if (placePhaseRef.current === 'idle' && !selectedIdRef.current) {
                controls.autoRotate = true;
              }
            }, 4200);
          }
        };
        canvas?.addEventListener('pointerdown', stopSpin);
        canvas?.addEventListener('pointerup', maybeResume);

        const onControlsChange = () => {
          if (saveTimer) window.clearTimeout(saveTimer);
          saveTimer = window.setTimeout(() => {
            if (globeRef.current) saveView(globeRef.current);
          }, 350);
        };
        // three.js OrbitControls emits 'change'
        (
          controls as unknown as {
            addEventListener?: (t: string, fn: () => void) => void;
          }
        ).addEventListener?.('change', onControlsChange);

        globeRef.current = globe;
        applyCountryStyle(globe, theme);
        applyGraticule(globe, theme);
        applyPoints(globe);
        clearNightEmissive(globe);
        globe.onGlobeReady(() => clearNightEmissive(globe));
        setGlobeReady(true);
        setGlobeError(false);
        setWebglMissing(false);

        // Drawn political countries over a solid ocean plate.
        void loadCountries()
          .then((features) => {
            if (cancelled || globeRef.current !== globe) return;
            globe.polygonsData(features);
          })
          .catch(() => {
            /* ocean alone — pins still work */
          });

        resizeObs = new ResizeObserver(() => syncSize());
        resizeObs.observe(el);
        window.addEventListener('resize', onWinResize);
        window.addEventListener('orientationchange', onWinResize);

        // stash listeners for cleanup
        (
          el as HTMLDivElement & {
            __sillageGlobeCleanup?: () => void;
          }
        ).__sillageGlobeCleanup = () => {
          canvas?.removeEventListener('pointerdown', stopSpin);
          canvas?.removeEventListener('pointerup', maybeResume);
          (
            controls as unknown as {
              removeEventListener?: (t: string, fn: () => void) => void;
            }
          ).removeEventListener?.('change', onControlsChange);
        };
      } catch {
        if (!cancelled) {
          setGlobeError(true);
          setGlobeReady(false);
          if (!isWebGLAvailable()) setWebglMissing(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      resizeObs?.disconnect();
      window.removeEventListener('resize', onWinResize);
      window.removeEventListener('orientationchange', onWinResize);
      if (saveTimer) window.clearTimeout(saveTimer);
      const cleanup = (
        el as HTMLDivElement & { __sillageGlobeCleanup?: () => void }
      ).__sillageGlobeCleanup;
      cleanup?.();
      if (globeRef.current) {
        try {
          saveView(globeRef.current);
          globeRef.current._destructor();
        } catch {
          /* ignore */
        }
        globeRef.current = null;
      }
      // clear leftover canvas nodes
      el.replaceChildren();
      setGlobeReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme: political atlas ocean / fills / rim shift with dark & light UI
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !globeReady) return;
    const atm = GLOBE_ATMOSPHERE[journal.theme];
    globe
      .backgroundColor(GLOBE_BG[journal.theme])
      .backgroundImageUrl(null)
      .globeImageUrl(oceanGlobeImageUrl(journal.theme))
      .atmosphereColor(atm.color)
      .atmosphereAltitude(atm.altitude);
    applyCountryStyle(globe, journal.theme);
    applyGraticule(globe, journal.theme);
    clearNightEmissive(globe);
  }, [journal.theme, globeReady]);

  // Pause auto-rotate while placing or previewing
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !globeReady) return;
    const controls = globe.controls();
    if (placePhase !== 'idle' || selectedId) {
      controls.autoRotate = false;
    } else {
      controls.autoRotate = true;
    }
  }, [placePhase, selectedId, globeReady]);

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

  // Sync points + first-fit
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !globeReady) return;
    applyPoints(globe);

    if (pins.length > 0 && !fittedRef.current) {
      fittedRef.current = true;
      const saved = readSavedView();
      const atDefault =
        Math.abs(saved.lat - DEFAULT_POV.lat) < 0.01 &&
        Math.abs(saved.lng - DEFAULT_POV.lng) < 0.01 &&
        Math.abs(saved.altitude - DEFAULT_POV.altitude) < 0.15;
      if (atDefault) {
        if (pins.length === 1) {
          globe.pointOfView(
            { lat: pins[0].lat, lng: pins[0].lon, altitude: 0.85 },
            900,
          );
        } else {
          const midLat =
            pins.reduce((s, p) => s + p.lat, 0) / pins.length;
          const midLng =
            pins.reduce((s, p) => s + p.lon, 0) / pins.length;
          globe.pointOfView(
            {
              lat: midLat,
              lng: midLng,
              altitude: fitPinsAltitude(pins.length),
            },
            900,
          );
        }
      }
    }
  }, [pins, globeReady, selectedId, pending]);

  const startPlace = () => {
    setSelectedId(null);
    setPending(null);
    setPlaceMsg(null);
    setPlacePhase('picking');
    const globe = globeRef.current;
    if (globe) globe.controls().autoRotate = false;
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
    const globe = globeRef.current;
    if (globe) {
      globe.pointOfView(
        { lat: pending.lat, lng: pending.lon, altitude: 0.75 },
        700,
      );
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
  const statusLine = globeError
    ? webglMissing
      ? 'Cet appareil ne peut pas dessiner le globe.'
      : 'Le globe dort hors ligne — le reste du journal reste là.'
    : placePhase === 'picking'
      ? 'Touche le globe pour poser un souvenir.'
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
              ? 'Des souvenirs sur la Terre'
              : pins.length === 1
                ? 'Un souvenir posé'
                : `${pins.length} souvenirs posés`}
          </p>
        </div>
        {!globeError ? (
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
        ) : null}
      </header>

      <div className="monde-map-wrap" aria-busy={labelBusy || undefined}>
        {globeError ? (
          <div className="monde-map-fallback" role="status">
            <p>
              {webglMissing
                ? 'Le globe a besoin de WebGL — indisponible ici.'
                : 'Le globe a besoin du réseau. Tes jours, eux, restent.'}
            </p>
            <Link to="/lieux" className="monde-lieux-link">
              Voir la carte des lieux
            </Link>
          </div>
        ) : (
          <div
            ref={globeElRef}
            className="monde-map monde-globe"
            role="application"
            aria-label="Globe des souvenirs"
          />
        )}

        {!globeError && globeReady && placePhase === 'idle' && !selectedPin ? (
          <p className="monde-hint" aria-hidden="true">
            Glisse pour tourner · pince pour zoomer
          </p>
        ) : null}

        {emptyPins && !globeError && placePhase === 'idle' ? (
          <div className="monde-empty" role="status">
            <p className="monde-empty-quote">
              « Le monde attend la première trace. »
            </p>
            <p className="muted monde-empty-hint">
              Écris un lieu sur un jour, ou pose un souvenir ici — sur le globe.
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
        <div
          className="monde-place-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Poser un souvenir"
        >
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
