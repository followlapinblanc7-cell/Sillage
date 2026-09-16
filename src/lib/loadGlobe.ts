/** Lazy-load globe.gl (Three.js + WebGL) via Vite — same-origin chunk, no CDN. */

export interface GlobeGeoCoords {
  lat: number;
  lng: number;
  altitude?: number;
}

export interface GlobePointerObject {
  __globeObjType?: string;
}

export interface GlobeMaterial {
  map?: unknown;
  emissiveMap?: unknown;
  emissive?: { set: (color: string) => unknown };
  emissiveIntensity?: number;
  color?: { set: (color: string) => unknown };
  needsUpdate?: boolean;
}

export interface GlobeInstance {
  width: (w?: number) => number | GlobeInstance;
  height: (h?: number) => number | GlobeInstance;
  globeImageUrl: (url: string | null) => GlobeInstance;
  bumpImageUrl: (url: string | null) => GlobeInstance;
  backgroundColor: (color: string) => GlobeInstance;
  backgroundImageUrl: (url: string | null) => GlobeInstance;
  showAtmosphere: (show: boolean) => GlobeInstance;
  atmosphereColor: (color: string) => GlobeInstance;
  atmosphereAltitude: (alt: number) => GlobeInstance;
  globeMaterial: () => GlobeMaterial | undefined;
  onGlobeReady: (fn: () => void) => GlobeInstance;
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
  polygonsData: (data: unknown[]) => GlobeInstance;
  polygonGeoJsonGeometry: (
    acc: string | ((d: unknown) => unknown),
  ) => GlobeInstance;
  polygonCapColor: (acc: string | ((d: unknown) => string)) => GlobeInstance;
  polygonSideColor: (acc: string | ((d: unknown) => string)) => GlobeInstance;
  polygonStrokeColor: (
    acc: string | ((d: unknown) => string | null | undefined),
  ) => GlobeInstance;
  polygonAltitude: (
    acc: number | string | ((d: unknown) => number),
  ) => GlobeInstance;
  polygonLabel: (
    acc: string | ((d: unknown) => string | null | undefined),
  ) => GlobeInstance;
  polygonsTransitionDuration: (ms: number) => GlobeInstance;
  onPolygonClick: (
    fn: (
      polygon: unknown,
      event: MouseEvent,
      coords: { lat: number; lng: number; altitude: number },
    ) => void,
  ) => GlobeInstance;
  pointerEventsFilter: (
    fn: (obj: GlobePointerObject, data?: unknown) => boolean,
  ) => GlobeInstance;
  pathsData: (data: unknown[]) => GlobeInstance;
  pathPoints: (
    acc: string | ((d: unknown) => { lat: number; lng: number; altitude?: number }[]),
  ) => GlobeInstance;
  pathColor: (acc: string | ((d: unknown) => string)) => GlobeInstance;
  pathStroke: (acc: number | string | ((d: unknown) => number)) => GlobeInstance;
  pathAltitude: (
    acc: number | string | ((d: unknown) => number),
  ) => GlobeInstance;
  pathPointAlt: (
    acc: number | string | ((d: unknown) => number),
  ) => GlobeInstance;
  pathsTransitionDuration: (ms: number) => GlobeInstance;
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

export type GlobeConstructor = new (
  element: HTMLElement,
  configOptions?: { rendererConfig?: Record<string, unknown> },
) => GlobeInstance;

/** Why the Monde globe could not start. */
export type GlobeFailReason = 'webgl' | 'network' | 'unknown';

export class GlobeLoadError extends Error {
  readonly reason: GlobeFailReason;

  constructor(reason: GlobeFailReason, message: string) {
    super(message);
    this.name = 'GlobeLoadError';
    this.reason = reason;
  }
}

let cached: GlobeConstructor | null = null;
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

function classifyImportError(err: unknown): GlobeFailReason {
  if (!navigator.onLine) return 'network';
  const msg =
    err instanceof Error
      ? `${err.name} ${err.message}`
      : typeof err === 'string'
        ? err
        : '';
  if (/fetch|network|load failed|failed to fetch|dynamically imported module/i.test(msg)) {
    return 'network';
  }
  return 'unknown';
}

export function loadGlobe(): Promise<GlobeConstructor> {
  if (cached) return Promise.resolve(cached);
  if (loading) return loading;
  loading = (async () => {
    if (!isWebGLAvailable()) {
      throw new GlobeLoadError('webgl', 'WebGL indisponible');
    }
    let Globe: GlobeConstructor;
    try {
      const mod = await import('globe.gl');
      Globe = mod.default as unknown as GlobeConstructor;
    } catch (err) {
      throw new GlobeLoadError(
        classifyImportError(err),
        'Globe indisponible',
      );
    }
    if (!Globe) {
      throw new GlobeLoadError('unknown', 'Globe indisponible');
    }
    cached = Globe;
    return Globe;
  })().catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}
