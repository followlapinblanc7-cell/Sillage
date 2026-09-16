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
 * Monde 3D — drawn political / atlas globe (not satellite or night-Earth).
 * Solid ocean plate + country polygons (Natural Earth 110m). Night photo /
 * starfield / emissive city-lights path is idle in this mode.
 */

/** Calm ocean ink under country polygons. */
export const GLOBE_OCEAN: Record<ThemeId, string> = {
  dark: '#1c2830',
  light: '#b9c8d2',
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
 * Small categorical country palette (warm paper / ink family).
 * Index via country a3 hash so neighbours often differ.
 */
export const GLOBE_COUNTRY_PALETTE: Record<ThemeId, string[]> = {
  dark: [
    'rgba(158, 108, 78, 0.94)',
    'rgba(138, 112, 122, 0.94)',
    'rgba(168, 120, 88, 0.94)',
    'rgba(108, 126, 140, 0.94)',
    'rgba(112, 132, 104, 0.94)',
    'rgba(96, 128, 124, 0.94)',
    'rgba(148, 118, 98, 0.94)',
    'rgba(124, 108, 128, 0.94)',
  ],
  light: [
    'rgba(186, 136, 100, 0.93)',
    'rgba(158, 130, 140, 0.93)',
    'rgba(198, 150, 108, 0.93)',
    'rgba(126, 146, 162, 0.93)',
    'rgba(132, 156, 122, 0.93)',
    'rgba(116, 150, 146, 0.93)',
    'rgba(172, 138, 112, 0.93)',
    'rgba(146, 128, 150, 0.93)',
  ],
};

/** Antarctica / unknown — cooler parchment. */
export const GLOBE_COUNTRY_FALLBACK: Record<ThemeId, string> = {
  dark: 'rgba(150, 144, 136, 0.88)',
  light: 'rgba(168, 160, 152, 0.86)',
};

export const GLOBE_COUNTRY_SIDE: Record<ThemeId, string> = {
  dark: 'rgba(28, 22, 18, 0.28)',
  light: 'rgba(70, 55, 45, 0.14)',
};

/** Thin ink borders so political outlines read clearly. */
export const GLOBE_COUNTRY_STROKE: Record<ThemeId, string> = {
  dark: 'rgba(28, 22, 18, 0.55)',
  light: 'rgba(78, 58, 44, 0.38)',
};

/** Subtle graticule (paths). */
export const GLOBE_GRATICULE: Record<ThemeId, { color: string; stroke: number }> =
  {
    dark: { color: 'rgba(210, 190, 160, 0.09)', stroke: 0.35 },
    light: { color: 'rgba(70, 55, 45, 0.1)', stroke: 0.35 },
  };

/** Soft warm atmospheric rim — atlas, not Earth-from-space blue. */
export const GLOBE_ATMOSPHERE: Record<
  ThemeId,
  { color: string; altitude: number }
> = {
  dark: { color: 'rgba(184, 140, 100, 0.42)', altitude: 0.15 },
  light: { color: 'rgba(196, 160, 120, 0.38)', altitude: 0.14 },
};

/** Soft space / paper backdrop (no starfield photo). */
export const GLOBE_BG: Record<ThemeId, string> = {
  dark: 'rgba(18, 14, 12, 1)',
  light: 'rgba(236, 228, 216, 1)',
};

/** Warm cream / soft gold — readable on muted country fills. */
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
