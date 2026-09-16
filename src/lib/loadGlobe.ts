/** Load globe.gl (Three.js + WebGL) from CDN once — keeps the app bundle free of 3D deps. */

const GLOBE_JS =
  'https://cdn.jsdelivr.net/npm/globe.gl@2.46.2/dist/globe.gl.min.js';

export interface GlobeGeoCoords {
  lat: number;
  lng: number;
  altitude?: number;
}

export interface GlobeInstance {
  width: (w?: number) => number | GlobeInstance;
  height: (h?: number) => number | GlobeInstance;
  globeImageUrl: (url: string | null) => GlobeInstance;
  bumpImageUrl: (url: string | null) => GlobeInstance;
  backgroundColor: (color: string) => GlobeInstance;
  showAtmosphere: (show: boolean) => GlobeInstance;
  atmosphereColor: (color: string) => GlobeInstance;
  atmosphereAltitude: (alt: number) => GlobeInstance;
  pointsData: (data: unknown[]) => GlobeInstance;
  pointLat: (acc: string | ((d: unknown) => number)) => GlobeInstance;
  pointLng: (acc: string | ((d: unknown) => number)) => GlobeInstance;
  pointAltitude: (acc: number | string | ((d: unknown) => number)) => GlobeInstance;
  pointRadius: (acc: number | string | ((d: unknown) => number)) => GlobeInstance;
  pointColor: (acc: string | ((d: unknown) => string)) => GlobeInstance;
  pointsMerge: (merge: boolean) => GlobeInstance;
  pointLabel: (acc: string | ((d: unknown) => string)) => GlobeInstance;
  onPointClick: (
    fn: (
      point: unknown,
      event: MouseEvent,
      coords: { lat: number; lng: number; altitude: number },
    ) => void,
  ) => GlobeInstance;
  onGlobeClick: (
    fn: (coords: { lat: number; lng: number }, event: MouseEvent) => void,
  ) => GlobeInstance;
  pointOfView: (
    pov?: { lat?: number; lng?: number; altitude?: number },
    transitionMs?: number,
  ) => GlobeGeoCoords | GlobeInstance;
  controls: () => {
    autoRotate: boolean;
    autoRotateSpeed: number;
    enableZoom: boolean;
    minDistance: number;
    maxDistance: number;
  };
  _destructor: () => void;
}

type GlobeConstructor = new (
  element: HTMLElement,
  configOptions?: { rendererConfig?: Record<string, unknown> },
) => GlobeInstance;

declare global {
  interface Window {
    Globe?: GlobeConstructor;
  }
}

let loading: Promise<GlobeConstructor> | null = null;

export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false }) ||
      canvas.getContext('experimental-webgl');
    return !!gl;
  } catch {
    return false;
  }
}

function injectScript(): Promise<void> {
  if (window.Globe) return Promise.resolve();
  const existing = document.querySelector(`script[src="${GLOBE_JS}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () =>
        reject(new Error('Globe indisponible')),
      );
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GLOBE_JS;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Globe indisponible'));
    document.head.appendChild(script);
  });
}

export function loadGlobe(): Promise<GlobeConstructor> {
  if (window.Globe) return Promise.resolve(window.Globe);
  if (loading) return loading;
  loading = (async () => {
    if (!isWebGLAvailable()) {
      throw new Error('WebGL indisponible');
    }
    await injectScript();
    if (!window.Globe) throw new Error('Globe indisponible');
    return window.Globe;
  })().catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}
