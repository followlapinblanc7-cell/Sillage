/** Load Leaflet CSS + JS from CDN once (keeps the app bundle free of map deps). */

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const INTEGRITY_CSS =
  'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
const INTEGRITY_JS =
  'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';

export interface LeafletLatLngBounds {
  extend: (latlng: [number, number] | LeafletLatLng) => void;
  isValid: () => boolean;
}

export interface LeafletLatLng {
  lat: number;
  lng: number;
}

export interface LeafletMap {
  setView: (center: [number, number], zoom: number) => LeafletMap;
  flyTo: (
    center: [number, number],
    zoom?: number,
    options?: { duration?: number; easeLinearity?: number },
  ) => LeafletMap;
  fitBounds: (
    bounds: LeafletLatLngBounds,
    options?: { padding?: [number, number]; maxZoom?: number },
  ) => LeafletMap;
  getZoom: () => number;
  remove: () => void;
  invalidateSize: () => void;
  removeLayer: (layer: unknown) => void;
  closePopup: () => LeafletMap;
  on: (event: string, fn: () => void) => LeafletMap;
  off: (event: string, fn: () => void) => LeafletMap;
}

export interface LeafletMarker {
  addTo: (map: LeafletMap) => LeafletMarker;
  bindPopup: (html: string, options?: Record<string, unknown>) => LeafletMarker;
  openPopup: () => LeafletMarker;
  closePopup: () => LeafletMarker;
  on: (event: string, fn: () => void) => LeafletMarker;
  setLatLng: (latlng: [number, number]) => LeafletMarker;
  setIcon: (icon: unknown) => LeafletMarker;
  getElement: () => HTMLElement | undefined;
}

export interface LeafletTileLayer {
  addTo: (map: LeafletMap) => LeafletTileLayer;
  on: (event: string, fn: () => void) => LeafletTileLayer;
  setUrl: (url: string) => LeafletTileLayer;
  remove: () => void;
}

export interface LeafletControl {
  addTo: (map: LeafletMap) => LeafletControl;
}

export interface LeafletNamespace {
  map: (el: HTMLElement, options?: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, options?: Record<string, unknown>) => LeafletTileLayer;
  marker: (
    latlng: [number, number],
    options?: Record<string, unknown>,
  ) => LeafletMarker;
  divIcon: (options: Record<string, unknown>) => unknown;
  latLngBounds: (latlngs?: [number, number][]) => LeafletLatLngBounds;
  control: {
    zoom: (options?: { position?: string }) => LeafletControl;
  };
  Icon: {
    Default: {
      prototype: Record<string, unknown>;
      mergeOptions: (o: Record<string, unknown>) => void;
    };
  };
}

declare global {
  interface Window {
    L?: LeafletNamespace;
  }
}

let loading: Promise<LeafletNamespace> | null = null;

function injectCss(): void {
  if (document.querySelector(`link[href="${LEAFLET_CSS}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = LEAFLET_CSS;
  link.integrity = INTEGRITY_CSS;
  link.crossOrigin = '';
  document.head.appendChild(link);
}

function injectScript(): Promise<void> {
  if (window.L) return Promise.resolve();
  const existing = document.querySelector(`script[src="${LEAFLET_JS}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () =>
        reject(new Error('Leaflet indisponible')),
      );
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.integrity = INTEGRITY_JS;
    script.crossOrigin = '';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Leaflet indisponible'));
    document.head.appendChild(script);
  });
}

export function loadLeaflet(): Promise<LeafletNamespace> {
  if (window.L) return Promise.resolve(window.L);
  if (loading) return loading;
  loading = (async () => {
    injectCss();
    await injectScript();
    if (!window.L) throw new Error('Leaflet indisponible');
    return window.L;
  })().catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}
