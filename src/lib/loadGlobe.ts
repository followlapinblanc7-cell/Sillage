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

export interface GlobeRenderer {
  setPixelRatio: (ratio: number) => void;
  getContext?: () => WebGLRenderingContext | WebGL2RenderingContext | null;
  dispose?: () => void;
  forceContextLoss?: () => void;
  domElement?: HTMLCanvasElement;
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
  renderer: () => GlobeRenderer | undefined;
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

/** Coarse mobile / constrained-GPU heuristic (Android Chrome included). */
export function isConstrainedGpu(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
  try {
    if (navigator.maxTouchPoints > 1 && window.matchMedia('(pointer: coarse)').matches) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Safer WebGLRenderer params for mid-range Android: no MSAA, default power
 * preference, allow software/slow GPUs, keep alpha for compositing.
 */
export function globeRendererConfig(): Record<string, unknown> {
  const mobile = isConstrainedGpu();
  return {
    antialias: !mobile,
    alpha: true,
    powerPreference: mobile ? 'default' : 'high-performance',
    failIfMajorPerformanceCaveat: false,
    preserveDrawingBuffer: false,
  };
}

/** Cap DPR so 3× Android screens don't OOM the political polygons. */
export function globePixelRatioCap(): number {
  return isConstrainedGpu() ? 1.25 : 2;
}

export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const opts: WebGLContextAttributes = {
      failIfMajorPerformanceCaveat: false,
      powerPreference: 'default',
    };
    const gl =
      canvas.getContext('webgl', opts) ||
      canvas.getContext('experimental-webgl', opts);
    if (!gl) return false;
    // Release the probe context so Android can recycle the slot.
    const lose = (gl as WebGLRenderingContext).getExtension?.('WEBGL_lose_context');
    lose?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function classifyImportError(err: unknown): GlobeFailReason {
  if (!navigator.onLine) return 'network';
  const msg = shortErrorMessage(err);
  if (
    /fetch|network|load failed|failed to fetch|dynamically imported module|chunkloaderror|loading css chunk/i.test(
      msg,
    )
  ) {
    return 'network';
  }
  if (
    /webgl|context|gpu|getcontext|three\.webglrenderer|could not (create|initialize)|egl|opengl/i.test(
      msg,
    )
  ) {
    return 'webgl';
  }
  return 'unknown';
}

/** Short human-readable cause for optional UI (dev / retry sheet). */
export function shortErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const base = `${err.name}: ${err.message}`.trim();
    return base.slice(0, 180);
  }
  if (typeof err === 'string') return err.slice(0, 180);
  try {
    return String(err).slice(0, 180);
  } catch {
    return '';
  }
}

function resolveGlobeConstructor(mod: unknown): GlobeConstructor | null {
  if (!mod) return null;
  const m = mod as { default?: unknown };
  const candidates = [m.default, mod, (m.default as { default?: unknown } | null)?.default];
  for (const c of candidates) {
    if (typeof c === 'function') return c as GlobeConstructor;
  }
  return null;
}

export function loadGlobe(): Promise<GlobeConstructor> {
  if (cached) return Promise.resolve(cached);
  if (loading) return loading;
  loading = (async () => {
    if (!isWebGLAvailable()) {
      throw new GlobeLoadError('webgl', 'WebGL indisponible');
    }
    let Globe: GlobeConstructor | null;
    try {
      const mod = await import('globe.gl');
      Globe = resolveGlobeConstructor(mod);
    } catch (err) {
      throw new GlobeLoadError(
        classifyImportError(err),
        shortErrorMessage(err) || 'Globe indisponible',
      );
    }
    if (!Globe) {
      throw new GlobeLoadError('unknown', 'Export globe.gl invalide');
    }
    cached = Globe;
    return Globe;
  })().catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}

/** Wait until the host has a real layout box (flex often starts at 0×0). */
export function waitForElementSize(
  el: HTMLElement,
  opts: { min?: number; timeoutMs?: number; signal?: { cancelled: boolean } } = {},
): Promise<{ width: number; height: number }> {
  const min = opts.min ?? 2;
  const timeoutMs = opts.timeoutMs ?? 4000;

  const measure = () => {
    const width = el.clientWidth;
    const height = el.clientHeight;
    return { width, height, ok: width >= min && height >= min };
  };

  const first = measure();
  if (first.ok) {
    return Promise.resolve({ width: first.width, height: first.height });
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let raf = 0;
    const obs = new ResizeObserver(() => {
      if (opts.signal?.cancelled || settled) return;
      const m = measure();
      if (m.ok) finish(m.width, m.height);
    });

    const finish = (width: number, height: number) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.cancelAnimationFrame(raf);
      try {
        obs.disconnect();
      } catch {
        /* ignore */
      }
      resolve({ width, height });
    };

    const timer = window.setTimeout(() => {
      if (settled) return;
      const m = measure();
      if (m.ok) {
        finish(m.width, m.height);
        return;
      }
      settled = true;
      try {
        obs.disconnect();
      } catch {
        /* ignore */
      }
      window.cancelAnimationFrame(raf);
      reject(new Error(`Conteneur globe trop petit (${m.width}×${m.height})`));
    }, timeoutMs);

    try {
      obs.observe(el);
    } catch {
      /* ResizeObserver missing — fall through to rAF poll */
    }

    const tick = () => {
      if (settled || opts.signal?.cancelled) return;
      const m = measure();
      if (m.ok) {
        finish(m.width, m.height);
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
  });
}

/** Tear down WebGL aggressively so StrictMode remounts can reclaim a context. */
export function destroyGlobe(globe: GlobeInstance | null, host?: HTMLElement | null) {
  if (!globe) {
    host?.replaceChildren();
    return;
  }
  try {
    const renderer = globe.renderer?.();
    renderer?.forceContextLoss?.();
    const canvas =
      renderer?.domElement ??
      (host?.querySelector('canvas') as HTMLCanvasElement | null);
    const gl =
      renderer?.getContext?.() ??
      canvas?.getContext('webgl') ??
      canvas?.getContext('webgl2');
    const lose = gl?.getExtension?.('WEBGL_lose_context');
    lose?.loseContext();
  } catch {
    /* ignore */
  }
  try {
    globe._destructor();
  } catch {
    /* ignore */
  }
  try {
    host?.replaceChildren();
  } catch {
    /* ignore */
  }
}

export function classifyGlobeRuntimeError(err: unknown): GlobeFailReason {
  if (err instanceof GlobeLoadError) return err.reason;
  if (!isWebGLAvailable()) return 'webgl';
  return classifyImportError(err);
}
