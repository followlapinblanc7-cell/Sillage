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
  const [geocoding, setGeocoding] = useState(false);

  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const LRef = useRef<LeafletNamespace | null>(null);
  const lieuxRef = useRef(lieux);
  useEffect(() => {
    lieuxRef.current = lieux;
  }, [lieux]);

  // Geocode unique labels sequentially (cache-aware, ≤1 req/s)
  useEffect(() => {
    if (!hasLieux) {
      setCoords({});
      setGeocoding(false);
      return;
    }
    let cancelled = false;
    setGeocoding(true);

    (async () => {
      for (const lieu of lieux) {
        if (cancelled) return;
        const hit = await geocodeLocation(lieu.label);
        if (cancelled) return;
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

    (async () => {
      try {
        const L = await loadLeaflet();
        if (cancelled) return;
        LRef.current = L;

        const map = L.map(el, {
          zoomControl: false,
          attributionControl: true,
          scrollWheelZoom: false,
        }).setView([46.6, 2.4], 5);

        L.tileLayer(
          'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19,
          },
        ).addTo(map);

        mapRef.current = map;
        setMapReady(true);
        setMapError(false);
        requestAnimationFrame(() => map.invalidateSize());
        resizeObs = new ResizeObserver(() => map.invalidateSize());
        resizeObs.observe(el);
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
      markersRef.current.clear();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      LRef.current = null;
      setMapReady(false);
    };
  }, [hasLieux]);

  const lastPinCountRef = useRef(0);

  // Rebuild markers when coords change; refresh active style on selection
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
      const active = selectedKey === lieu.key;
      const icon = L.divIcon({
        className: `lieux-pin${active ? ' active' : ''}`,
        html: '<span class="lieux-pin-dot" aria-hidden="true"></span>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const prev = markersRef.current.get(lieu.key);
      if (prev) map.removeLayer(prev);

      const marker = L.marker(latlng, { icon, title: lieu.label });
      marker.addTo(map);
      marker.bindPopup(
        `<strong>${escapeHtml(lieu.label)}</strong><br/>${dayCountLabel(lieu.days.length)}`,
      );
      marker.on('click', () => setSelectedKey(lieu.key));
      markersRef.current.set(lieu.key, marker);
    }

    // Refit when pins appear or increase (not on mere selection change)
    if (pinCount > 0 && pinCount !== lastPinCountRef.current) {
      lastPinCountRef.current = pinCount;
      if (pinCount === 1) {
        const only = currentLieux.find((l) => coords[l.key]);
        const hit = only ? coords[only.key] : null;
        if (hit) map.setView([hit.lat, hit.lon], 11);
      } else if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 12 });
      }
    }

    requestAnimationFrame(() => map.invalidateSize());
  }, [coords, mapReady, selectedKey]);

  useEffect(() => {
    if (!mapReady) lastPinCountRef.current = 0;
  }, [mapReady]);

  const selected: LieuGroup | null = selectedKey
    ? (lieux.find((l) => l.key === selectedKey) ?? null)
    : null;

  const pinCount = lieux.filter((l) => coords[l.key]).length;

  if (!hasLieux) {
    return (
      <div className="lieux-page">
        <Link to="/tiroir" className="btn-ghost lieux-back">
          ← Retour
        </Link>
        <h1 className="page-title">Lieux</h1>
        <p className="page-sub">Les endroits que tu as notés</p>
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

  return (
    <div className="lieux-page">
      <Link to="/tiroir" className="btn-ghost lieux-back">
        ← Retour
      </Link>
      <h1 className="page-title">Lieux</h1>
      <p className="page-sub">
        {lieux.length === 1
          ? 'Un endroit dans ton journal'
          : `${lieux.length} endroits dans ton journal`}
      </p>

      <div className="lieux-map-wrap">
        {mapError ? (
          <p className="lieux-map-fallback" role="status">
            La carte est indisponible hors ligne. La liste reste là.
          </p>
        ) : (
          <div
            ref={mapElRef}
            className="lieux-map"
            role="img"
            aria-label="Carte des lieux du journal"
          />
        )}
        {!mapError && geocoding && pinCount < lieux.length ? (
          <p className="lieux-map-status" role="status">
            Placement des lieux…
          </p>
        ) : null}
        {!mapError && !geocoding && pinCount === 0 ? (
          <p className="lieux-map-status" role="status">
            Impossible de placer ces lieux pour l&apos;instant — ils restent
            dans la liste.
          </p>
        ) : null}
      </div>

      <ul className="lieux-list" aria-label="Liste des lieux">
        {lieux.map((lieu) => {
          const hasPin = !!coords[lieu.key];
          const knownMiss = coords[lieu.key] === null;
          const isSelected = selectedKey === lieu.key;
          return (
            <li key={lieu.key}>
              <button
                type="button"
                className={`lieux-row${isSelected ? ' selected' : ''}`}
                onClick={() =>
                  setSelectedKey((prev) =>
                    prev === lieu.key ? null : lieu.key,
                  )
                }
                aria-pressed={isSelected}
                aria-expanded={isSelected}
              >
                <span
                  className={`lieux-row-pin${hasPin ? ' on' : ''}`}
                  aria-hidden="true"
                />
                <span className="lieux-row-text">
                  <span className="lieux-row-label">{lieu.label}</span>
                  <span className="lieux-row-meta">
                    {dayCountLabel(lieu.days.length)}
                    {knownMiss ? ' · sans pin' : ''}
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
