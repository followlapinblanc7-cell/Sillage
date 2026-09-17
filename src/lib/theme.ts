/** Sillage appearance — dark (default) or literary light (cream paper). */

export type ThemeId = 'dark' | 'light';

export const THEME_META: Record<ThemeId, string> = {
  dark: '#1a1210',
  light: '#f3ebe1',
};

export const CARTO_TILES: Record<ThemeId, string> = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
};

/**
 * Monde 3D — drawn political / atlas globe on a night-space stage.
 * Solid ocean plate + country polygons (Natural Earth 110m). Same cinematic
 * dark look for dark and light app themes (cream UI must not leak behind the
 * sphere). Starfield via three-globe night-sky CDN (runtime fetch, not SW).
 * Do not restore earth-night.jpg photo continents.
 */

/** Starfield / space backdrop for globe.gl `backgroundImageUrl`. */
export const GLOBE_STARFIELD_URL =
  'https://cdn.jsdelivr.net/npm/three-globe@2.45.2/example/img/night-sky.png';

/** Near charcoal / ink ocean under country polygons. */
export const GLOBE_OCEAN: Record<ThemeId, string> = {
  dark: '#0a0e14',
  light: '#0a0e14',
};

const oceanUrlCache: Partial<Record<ThemeId, string>> = {};

/** Tiny solid equirectangular texture — land comes only from polygons. */
export function oceanGlobeImageUrl(theme: ThemeId): string {
  const cached = oceanUrlCache[theme];
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 4;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    oceanUrlCache[theme] = '';
    return '';
  }
  ctx.fillStyle = GLOBE_OCEAN[theme];
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL('image/png');
  oceanUrlCache[theme] = url;
  return url;
}

/**
 * Opaque muted country fills (same night atlas for both app themes).
 * Alpha < 1 lets the ocean punch through tessellation / z-fight gaps.
 */
const NIGHT_COUNTRY_PALETTE = [
  '#764c38',
  '#564662',
  '#80563c',
  '#3a546c',
  '#406048',
  '#305856',
  '#6c4e40',
  '#5c4468',
] as const;

export const GLOBE_COUNTRY_PALETTE: Record<ThemeId, string[]> = {
  dark: [...NIGHT_COUNTRY_PALETTE],
  light: [...NIGHT_COUNTRY_PALETTE],
};

/** Antarctica / unknown — cool slate. */
export const GLOBE_COUNTRY_FALLBACK: Record<ThemeId, string> = {
  dark: '#767c88',
  light: '#767c88',
};

/** Opaque dark skirt; Monde matches side to cap so this is a safe fallback. */
export const GLOBE_COUNTRY_SIDE: Record<ThemeId, string> = {
  dark: '#0a0e14',
  light: '#0a0e14',
};

/** Soft hairline borders so political outlines read on dark fills. */
export const GLOBE_COUNTRY_STROKE: Record<ThemeId, string> = {
  dark: 'rgba(200, 190, 168, 0.22)',
  light: 'rgba(200, 190, 168, 0.2)',
};

/** Subtle graticule (paths). */
export const GLOBE_GRATICULE: Record<ThemeId, { color: string; stroke: number }> =
  {
    dark: { color: 'rgba(170, 180, 210, 0.07)', stroke: 0.32 },
    light: { color: 'rgba(170, 180, 210, 0.06)', stroke: 0.32 },
  };

/** Soft blue / violet atmospheric rim — space, not bright day-atlas. */
export const GLOBE_ATMOSPHERE: Record<
  ThemeId,
  { color: string; altitude: number }
> = {
  dark: { color: 'rgba(120, 130, 200, 0.48)', altitude: 0.2 },
  light: { color: 'rgba(130, 138, 210, 0.42)', altitude: 0.18 },
};

/** Deep space behind the starfield texture (fallback while image loads). */
export const GLOBE_BG: Record<ThemeId, string> = {
  dark: 'rgba(2, 4, 10, 1)',
  light: 'rgba(2, 4, 10, 1)',
};

/** Warm cream / soft gold — readable on dark country fills. */
export const GLOBE_PIN = {
  idle: '#f2e4c0',
  active: '#fff8e4',
  pending: '#e8c98a',
} as const;

export function normalizeTheme(value: unknown): ThemeId {
  return value === 'light' ? 'light' : 'dark';
}

/** Apply data-theme + theme-color meta (and color-scheme via CSS). */
export function applyTheme(theme: ThemeId): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_META[theme]);
}

/** Read theme from journal localStorage before React mounts (FOUC guard). */
export function readStoredTheme(): ThemeId {
  try {
    const raw = localStorage.getItem('sillage-journal-v1');
    if (!raw) return 'dark';
    const parsed = JSON.parse(raw) as { theme?: unknown };
    return normalizeTheme(parsed?.theme);
  } catch {
    return 'dark';
  }
}
