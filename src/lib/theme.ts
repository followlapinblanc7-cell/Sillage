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
 * Legacy photographic earth textures (unused by Monde once continents paint land).
 * Kept as CDN references in case a fallback is needed later.
 */
export const GLOBE_EARTH_URL: Record<ThemeId, string> = {
  dark: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-dark.jpg',
  light: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-day.jpg',
};

/** Calm ocean ink for the globe sphere under continent polygons. */
export const GLOBE_OCEAN: Record<ThemeId, string> = {
  dark: '#1a242c',
  light: '#b8c7d0',
};

const oceanUrlCache: Partial<Record<ThemeId, string>> = {};

/** Tiny solid equirectangular texture so land comes only from polygons. */
export function oceanGlobeImageUrl(theme: ThemeId): string {
  const cached = oceanUrlCache[theme];
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 4;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    oceanUrlCache[theme] = GLOBE_EARTH_URL[theme];
    return oceanUrlCache[theme]!;
  }
  ctx.fillStyle = GLOBE_OCEAN[theme];
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL('image/png');
  oceanUrlCache[theme] = url;
  return url;
}

/** Soft atlas fills — muted pastels in the bordeaux / cream / ink family. */
export const GLOBE_CONTINENT_CAP: Record<ThemeId, Record<string, string>> = {
  dark: {
    Africa: 'rgba(158, 108, 78, 0.93)',
    Europe: 'rgba(138, 112, 122, 0.93)',
    Asia: 'rgba(168, 120, 88, 0.93)',
    'North America': 'rgba(108, 126, 140, 0.93)',
    'South America': 'rgba(112, 132, 104, 0.93)',
    Oceania: 'rgba(96, 128, 124, 0.93)',
    Antarctica: 'rgba(156, 148, 140, 0.86)',
  },
  light: {
    Africa: 'rgba(184, 132, 98, 0.92)',
    Europe: 'rgba(154, 126, 138, 0.92)',
    Asia: 'rgba(196, 148, 106, 0.92)',
    'North America': 'rgba(122, 144, 160, 0.92)',
    'South America': 'rgba(128, 154, 120, 0.92)',
    Oceania: 'rgba(112, 148, 144, 0.92)',
    Antarctica: 'rgba(168, 160, 152, 0.84)',
  },
};

export const GLOBE_CONTINENT_FALLBACK: Record<ThemeId, string> = {
  dark: 'rgba(130, 110, 95, 0.9)',
  light: 'rgba(150, 130, 115, 0.88)',
};

export const GLOBE_CONTINENT_SIDE: Record<ThemeId, string> = {
  dark: 'rgba(28, 22, 18, 0.22)',
  light: 'rgba(70, 55, 45, 0.12)',
};

export const GLOBE_CONTINENT_STROKE: Record<ThemeId, string> = {
  dark: 'rgba(36, 28, 24, 0.4)',
  light: 'rgba(90, 70, 55, 0.26)',
};

export const GLOBE_ATMOSPHERE: Record<
  ThemeId,
  { color: string; altitude: number }
> = {
  dark: { color: 'rgba(184, 120, 90, 0.55)', altitude: 0.18 },
  light: { color: 'rgba(196, 150, 110, 0.45)', altitude: 0.16 },
};

export const GLOBE_BG: Record<ThemeId, string> = {
  dark: 'rgba(22, 17, 15, 1)',
  light: 'rgba(232, 223, 212, 1)',
};

export const GLOBE_PIN = {
  idle: '#b85151',
  active: '#e8a090',
  pending: '#c9a27a',
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
