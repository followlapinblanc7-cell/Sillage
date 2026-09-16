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
 * Monde 3D globe — cinematic Earth-at-night (city lights).
 * Same night look for dark and light app themes (cinematic contrast on cream UI).
 * CDN textures from three-globe examples (NASA Blue Marble Night Lights style);
 * not SW-precached (runtime fetch only).
 */
export const GLOBE_NIGHT_EARTH_URL =
  'https://cdn.jsdelivr.net/npm/three-globe@2.45.2/example/img/earth-night.jpg';

/** Starfield / space backdrop for globe.gl `backgroundImageUrl`. */
export const GLOBE_STARFIELD_URL =
  'https://cdn.jsdelivr.net/npm/three-globe@2.45.2/example/img/night-sky.png';

/** @deprecated Prefer GLOBE_NIGHT_EARTH_URL — kept as CDN fallback reference. */
export const GLOBE_EARTH_URL: Record<ThemeId, string> = {
  dark: GLOBE_NIGHT_EARTH_URL,
  light: GLOBE_NIGHT_EARTH_URL,
};

export function nightGlobeImageUrl(_theme?: ThemeId): string {
  return GLOBE_NIGHT_EARTH_URL;
}

/**
 * Continent atlas fills from PR #17 — unused on night Earth (photo must win).
 * Kept for a future subtle-outline mode if desired.
 */
export const GLOBE_CONTINENT_CAP: Record<ThemeId, Record<string, string>> = {
  dark: {
    Africa: 'rgba(0, 0, 0, 0)',
    Europe: 'rgba(0, 0, 0, 0)',
    Asia: 'rgba(0, 0, 0, 0)',
    'North America': 'rgba(0, 0, 0, 0)',
    'South America': 'rgba(0, 0, 0, 0)',
    Oceania: 'rgba(0, 0, 0, 0)',
    Antarctica: 'rgba(0, 0, 0, 0)',
  },
  light: {
    Africa: 'rgba(0, 0, 0, 0)',
    Europe: 'rgba(0, 0, 0, 0)',
    Asia: 'rgba(0, 0, 0, 0)',
    'North America': 'rgba(0, 0, 0, 0)',
    'South America': 'rgba(0, 0, 0, 0)',
    Oceania: 'rgba(0, 0, 0, 0)',
    Antarctica: 'rgba(0, 0, 0, 0)',
  },
};

export const GLOBE_CONTINENT_FALLBACK: Record<ThemeId, string> = {
  dark: 'rgba(0, 0, 0, 0)',
  light: 'rgba(0, 0, 0, 0)',
};

export const GLOBE_CONTINENT_SIDE: Record<ThemeId, string> = {
  dark: 'rgba(0, 0, 0, 0)',
  light: 'rgba(0, 0, 0, 0)',
};

export const GLOBE_CONTINENT_STROKE: Record<ThemeId, string> = {
  dark: 'rgba(0, 0, 0, 0)',
  light: 'rgba(0, 0, 0, 0)',
};

/** Soft blue-white atmospheric rim (Earth-from-space halo). */
export const GLOBE_ATMOSPHERE: Record<
  ThemeId,
  { color: string; altitude: number }
> = {
  dark: { color: '#9ec5ff', altitude: 0.28 },
  /** Slightly softer rim on light UI; globe surface stays night. */
  light: { color: '#b4d0ff', altitude: 0.24 },
};

/** Deep space behind the starfield texture (fallback while image loads). */
export const GLOBE_BG: Record<ThemeId, string> = {
  dark: 'rgba(2, 4, 10, 1)',
  light: 'rgba(4, 8, 16, 1)',
};

/** Warm cream / soft gold — readable on city-light clusters. */
export const GLOBE_PIN = {
  idle: '#f0e2c4',
  active: '#fff6dc',
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
