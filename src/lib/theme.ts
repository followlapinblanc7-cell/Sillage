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
 * not SW-precached (runtime fetch only). Landmass presence via soft amber polygon wash
 * + emissive boost on the night plate (oceans stay near-black).
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
 * Soft warm land washes over night Earth — lift continents without hiding city lights.
 * Same cinematic night look for both app themes; oceans stay dark (no ocean fill).
 */
const NIGHT_LAND_CAP = {
  Africa: 'rgba(232, 188, 118, 0.17)',
  Europe: 'rgba(236, 198, 132, 0.18)',
  Asia: 'rgba(230, 184, 112, 0.17)',
  'North America': 'rgba(234, 196, 128, 0.17)',
  'South America': 'rgba(228, 182, 108, 0.16)',
  Oceania: 'rgba(226, 190, 124, 0.16)',
  Antarctica: 'rgba(176, 188, 210, 0.08)',
} as const;

export const GLOBE_CONTINENT_CAP: Record<ThemeId, Record<string, string>> = {
  dark: { ...NIGHT_LAND_CAP },
  light: { ...NIGHT_LAND_CAP },
};

export const GLOBE_CONTINENT_FALLBACK: Record<ThemeId, string> = {
  dark: 'rgba(230, 186, 118, 0.16)',
  light: 'rgba(230, 186, 118, 0.16)',
};

/** Transparent sides — avoid a plastic “extruded” look on night Earth. */
export const GLOBE_CONTINENT_SIDE: Record<ThemeId, string> = {
  dark: 'rgba(0, 0, 0, 0)',
  light: 'rgba(0, 0, 0, 0)',
};

/** Hairline warm rim so coastlines read without covering lights. */
export const GLOBE_CONTINENT_STROKE: Record<ThemeId, string> = {
  dark: 'rgba(255, 220, 160, 0.14)',
  light: 'rgba(255, 220, 160, 0.12)',
};

/**
 * Night-texture material boost (MeshPhongMaterial via globe.gl).
 * EmissiveMap = night plate so city lights / lit land pop; near-black oceans stay dark.
 */
export const GLOBE_NIGHT_EMISSIVE = {
  color: '#fff2dc',
  intensity: 0.58,
} as const;

/** Soft blue-white atmospheric rim (Earth-from-space halo). */
export const GLOBE_ATMOSPHERE: Record<
  ThemeId,
  { color: string; altitude: number }
> = {
  dark: { color: '#a8ceff', altitude: 0.31 },
  /** Slightly softer rim on light UI; globe surface stays night. */
  light: { color: '#bcd8ff', altitude: 0.27 },
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
