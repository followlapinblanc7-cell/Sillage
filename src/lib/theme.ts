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

/** Remote earth textures for globe.gl (not precached — too large for SW). */
export const GLOBE_EARTH_URL: Record<ThemeId, string> = {
  dark: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-dark.jpg',
  light: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-day.jpg',
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
