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
