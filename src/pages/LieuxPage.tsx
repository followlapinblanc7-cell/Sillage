import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  formatDateShort,
  type JournalApi,
} from '../hooks/useJournal';
import { geocodeLocation, type GeocodeHit } from '../lib/geocode';
import { collectLieux, type LieuGroup } from '../lib/lieux';
import {
  loadLeaflet,
  type LeafletMap,
  type LeafletMarker,
  type LeafletNamespace,
} from '../lib/loadLeaflet';

interface Props {
  journal: JournalApi;
}

type CoordMap = Record<string, GeocodeHit | null>;

function dayCountLabel(n: number): string {
  return n === 1 ? '1 jour' : `${n} jours`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pinIcon(L: LeafletNamespace, active: boolean) {
  return L.divIcon({
    className: `lieux-pin${active ? ' active' : ''}`,
    html: '<span class="lieux-pin-dot" aria-hidden="true"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function popupHtml(label: string, days: number): string {
  return `<div class="lieux-popup"><p class="lieux-popup-label">${escapeHtml(label)}</p><p class="lieux-popup-meta">${dayCountLabel(days)}</p></div>`;
}

export function LieuxPage({ journal }: Props) {
  const lieux = useMemo(
    () => collectLieux(journal.visibleDays),
    [journal.visibleDays],
  );
  const hasLieux = lieux.length > 0;

  const [coords, setCoords] = useState<CoordMap>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeDone, setGeocodeDone] = useState(0);

  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const LRef = useRef<LeafletNamespace | null>(null);
  const lieuxRef = useRef(lieux);
  const rowRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const selectedKeyRef = useRef<string | null>(null);
  const lastPinCountRef = useRef(0);
  const skipNextFlyRef = useRef(false);

  useEffect(() => {
    lieuxRef.current = lieux;
  }, [lieux]);

  useEffect(() => {
    selectedKeyRef.current = selectedKey;
  }, [selectedKey]);

  // Geocode unique labels sequentially (cache-aware, ≤1 req/s)
  useEffect(() => {
    if (!hasLieux) {
      setCoords({});
      setGeocoding(false);
      setGeocodeDone(0);
      return;
    }
    let cancelled = false;
    setGeocoding(true);
    setGeocodeDone(0);

    (async () => {
      let done = 0;
      for (const lieu of lieux) {
        if (cancelled) return;
        const hit = await geocodeLocation(lieu.label);
        if (cancelled) return;
        done += 1;
        setGeocodeDone(done);
        setCoords((prev) =>
          prev[lieu.key] === hit ? prev : { ...prev, [lieu.key]: hit },
        );
      }
      if (!cancelled) setGeocoding(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [hasLieux, lieux]);

  // Init Leaflet once when we have lieux
  useEffect(() => {
    if (!hasLieux) return;
    const el = mapElRef.current;
    if (!el) return;
    let cancelled = false;
    let resizeObs: ResizeObserver | null = null;
    let tileErrorCount = 0;
    const onWinResize = () => mapRef.current?.invalidateSize();

    (async () => {
      try {
        const L = await loadLeaflet();
        if (cancelled) return;
        LRef.current = L;

        const finePointer =
          typeof window !== 'undefined' &&
          window.matchMedia('(pointer: fine)').matches;

        const map = L.map(el, {
          zoomControl: false,
          attributionControl: true,
          scrollWheelZoom: false,
          // On touch devices, keep page scroll; pinch still zooms
          dragging: finePointer,
          tapTolerance: 18,
        }).setView([46.6, 2.4], 5);

        const tiles = L.tileLayer(
          'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> · <a href="https://carto.com/">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19,
          },
        );
        tiles.on('tileerror', () => {
          tileErrorCount += 1;
          if (tileErrorCount >= 6) setTilesFailed(true);
        });
        tiles.addTo(map);

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
        mapRef.current.remove();
        mapRef.current = null;
      }
      LRef.current = null;
      setMapReady(false);
    };
  }, [hasLieux]);

  // Rebuild markers when coords change (not on mere selection)
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L || !mapReady) return;

    const currentLieux = lieuxRef.current;
    const wanted = new Set(
      currentLieux.filter((l) => coords[l.key]).map((l) => l.key),
    );

    for (const [key, marker] of markersRef.current) {
      if (!wanted.has(key)) {
        map.removeLayer(marker);
        markersRef.current.delete(key);
      }
    }

    const bounds = L.latLngBounds([]);
    let pinCount = 0;

    for (const lieu of currentLieux) {
      const hit = coords[lieu.key];
      if (!hit) continue;
      pinCount += 1;
      const latlng: [number, number] = [hit.lat, hit.lon];
      bounds.extend(latlng);
      const active = selectedKeyRef.current === lieu.key;

      const prev = markersRef.current.get(lieu.key);
      if (prev) {
        prev.setLatLng(latlng);
        prev.setIcon(pinIcon(L, active));
        prev.bindPopup(popupHtml(lieu.label, lieu.days.length), {
          className: 'lieux-popup-wrap',
          closeButton: false,
          offset: [0, -6],
        });
      } else {
        const marker = L.marker(latlng, {
          icon: pinIcon(L, active),
          title: lieu.label,
          riseOnHover: true,
        });
        marker.bindPopup(popupHtml(lieu.label, lieu.days.length), {
          className: 'lieux-popup-wrap',
          closeButton: false,
          offset: [0, -6],
        });
        marker.on('click', () => {
          // Pin tap: select + scroll list; skip fly (already on pin)
          skipNextFlyRef.current = true;
          setSelectedKey(lieu.key);
        });
        marker.addTo(map);
        markersRef.current.set(lieu.key, marker);
      }
    }

    // Refit when pins appear or increase (not on mere selection change)
    if (pinCount > 0 && pinCount !== lastPinCountRef.current) {
      lastPinCountRef.current = pinCount;
      if (pinCount === 1) {
        const only = currentLieux.find((l) => coords[l.key]);
        const hit = only ? coords[only.key] : null;
        if (hit) map.setView([hit.lat, hit.lon], 11);
      } else if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
      }
    }

    requestAnimationFrame(() => map.invalidateSize());
  }, [coords, mapReady]);

  useEffect(() => {
    if (!mapReady) lastPinCountRef.current = 0;
  }, [mapReady]);

  // Selection ↔ map: highlight pin, fly/pan, open quiet popup, scroll list
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L || !mapReady) return;

    for (const [key, marker] of markersRef.current) {
      const active = selectedKey === key;
      marker.setIcon(pinIcon(L, active));
      if (!active) marker.closePopup();
    }

    if (!selectedKey) {
      skipNextFlyRef.current = false;
      return;
    }

    const hit = coords[selectedKey];
    const marker = markersRef.current.get(selectedKey);
    const skipFly = skipNextFlyRef.current;
    skipNextFlyRef.current = false;

    if (hit && marker) {
      if (!skipFly) {
        const zoom = Math.max(map.getZoom(), 11);
        map.flyTo([hit.lat, hit.lon], zoom, { duration: 0.55 });
      }
      // Open after a beat so fly doesn't fight the popup
      const t = window.setTimeout(() => {
        marker.openPopup();
        map.invalidateSize();
      }, skipFly ? 0 : 280);
      // Scroll list row into view
      const row = rowRefs.current.get(selectedKey);
      row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return () => window.clearTimeout(t);
    }

    // No pin — still scroll the list row into view
    rowRefs.current.get(selectedKey)?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }, [selectedKey, mapReady, coords]);

  // When the day panel opens, map size may shift — refresh tiles
  useEffect(() => {
    if (!mapReady) return;
    const id = requestAnimationFrame(() => mapRef.current?.invalidateSize());
    return () => cancelAnimationFrame(id);
  }, [selectedKey, mapReady]);

  const selected: LieuGroup | null = selectedKey
    ? (lieux.find((l) => l.key === selectedKey) ?? null)
    : null;

  const pinCount = lieux.filter((l) => coords[l.key]).length;
  const resolvedCount = Object.keys(coords).length;
  const pendingCount = Math.max(0, lieux.length - resolvedCount);

  if (!hasLieux) {
    return (
      <div className="lieux-page">
        <Link to="/tiroir" className="btn-ghost lieux-back">
          ← Retour
        </Link>
        <h1 className="page-title">Lieux</h1>
        <p className="page-sub">Des traces d&apos;endroits gardés</p>
        <div className="empty-state">
          <p className="empty-quote">
            « Les lieux n&apos;attendent que d&apos;être nommés. »
          </p>
          <p className="muted" style={{ marginTop: 0 }}>
            Note un endroit sur un jour — il apparaîtra ici.
          </p>
        </div>
      </div>
    );
  }

  const subCopy =
    lieux.length === 1
      ? 'Un lieu gardé dans tes traces'
      : `${lieux.length} lieux gardés dans tes traces`;

  let statusMessage: string | null = null;
  if (!mapError) {
    if (tilesFailed) {
      statusMessage =
        'La carte peine à se charger — la liste reste lisible.';
    } else if (geocoding && pendingCount > 0) {
      statusMessage =
        lieux.length === 1
          ? 'Le lieu se place…'
          : `Les lieux se placent… ${geocodeDone} sur ${lieux.length}`;
    } else if (!geocoding && pinCount === 0 && resolvedCount >= lieux.length) {
      statusMessage =
        'Ces lieux restent dans la liste — la carte ne les a pas trouvés.';
    }
  }

  return (
    <div className="lieux-page">
      <Link to="/tiroir" className="btn-ghost lieux-back">
        ← Retour
      </Link>
      <h1 className="page-title">Lieux</h1>
      <p className="page-sub">{subCopy}</p>

      <div className="lieux-map-wrap">
        {mapError ? (
          <p className="lieux-map-fallback" role="status">
            La carte dort hors ligne. La liste, elle, reste.
          </p>
        ) : (
          <div
            ref={mapElRef}
            className="lieux-map"
            role="img"
            aria-label="Carte des lieux gardés"
          />
        )}
        {statusMessage ? (
          <p className="lieux-map-status" role="status">
            {statusMessage}
          </p>
        ) : null}
      </div>

      <ul className="lieux-list" aria-label="Liste des lieux gardés">
        {lieux.map((lieu) => {
          const hasPin = !!coords[lieu.key];
          const knownMiss = coords[lieu.key] === null;
          const isSelected = selectedKey === lieu.key;
          return (
            <li key={lieu.key}>
              <button
                type="button"
                ref={(node) => {
                  if (node) rowRefs.current.set(lieu.key, node);
                  else rowRefs.current.delete(lieu.key);
                }}
                className={`lieux-row${isSelected ? ' selected' : ''}`}
                onClick={() =>
                  setSelectedKey((prev) =>
                    prev === lieu.key ? null : lieu.key,
                  )
                }
                aria-pressed={isSelected}
                aria-current={isSelected ? 'true' : undefined}
                aria-expanded={isSelected}
              >
                <span
                  className={`lieux-row-pin${hasPin ? ' on' : ''}${isSelected ? ' selected' : ''}`}
                  aria-hidden="true"
                />
                <span className="lieux-row-text">
                  <span className="lieux-row-label">{lieu.label}</span>
                  <span className="lieux-row-meta">
                    {dayCountLabel(lieu.days.length)}
                    {knownMiss ? ' · hors carte' : ''}
                    {!hasPin && !knownMiss && geocoding ? ' · …' : ''}
                  </span>
                </span>
                <span className="chev" aria-hidden="true">
                  ›
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {selected ? (
        <section
          className="lieux-days"
          aria-label={`Jours à ${selected.label}`}
        >
          <div className="lieux-days-head">
            <h2 className="lieux-days-title">{selected.label}</h2>
            <Link
              className="lieux-chercher-link"
              to={`/chercher?q=${encodeURIComponent(selected.label)}`}
            >
              Chercher ce lieu
            </Link>
          </div>
          <ul className="lieux-day-list">
            {selected.days.map((d) => (
              <li key={d.id}>
                <Link to={`/jour/${d.id}`} className="lieux-day-link">
                  <span className="lieux-day-date">
                    {formatDateShort(d.id)}
                  </span>
                  <span className="lieux-day-title">
                    {d.title.trim() || 'Sans titre'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
