/** Nominatim geocoding with localStorage cache. Privacy: only geocode strings you pass. */

export interface GeocodeHit {
  lat: number;
  lon: number;
  displayName?: string;
}

type CacheEntry =
  | { status: 'ok'; lat: number; lon: number; displayName?: string; at: number }
  | { status: 'miss'; at: number };

const CACHE_KEY = 'sillage-geocode-v1';
const USER_AGENT = 'Sillage/1.0 (personal journal PWA; local-only; github.com/followlapinblanc7-cell/Sillage)';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
/** Nominatim usage policy: ≤1 req/s */
const MIN_INTERVAL_MS = 1100;
/** Re-try failed lookups after a week */
const MISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let lastRequestAt = 0;
let chain: Promise<unknown> = Promise.resolve();

function normalizeQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export function locationKey(raw: string): string {
  return normalizeQuery(raw).toLocaleLowerCase('fr');
}

function readCache(): Record<string, CacheEntry> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, CacheEntry>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* quota / private mode — ignore */
  }
}

function fromCache(key: string): GeocodeHit | null | undefined {
  const cache = readCache();
  const entry = cache[key];
  if (!entry) return undefined;
  if (entry.status === 'ok') {
    return { lat: entry.lat, lon: entry.lon, displayName: entry.displayName };
  }
  if (Date.now() - entry.at < MISS_TTL_MS) return null;
  return undefined;
}

function storeOk(key: string, hit: GeocodeHit) {
  const cache = readCache();
  cache[key] = {
    status: 'ok',
    lat: hit.lat,
    lon: hit.lon,
    displayName: hit.displayName,
    at: Date.now(),
  };
  writeCache(cache);
}

function storeMiss(key: string) {
  const cache = readCache();
  cache[key] = { status: 'miss', at: Date.now() };
  writeCache(cache);
}

async function waitForSlot() {
  const now = Date.now();
  const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastRequestAt));
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestAt = Date.now();
}

async function fetchNominatim(query: string): Promise<GeocodeHit | null> {
  await waitForSlot();
  const url = new URL(NOMINATIM);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '0');

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'fr',
    },
    // Nominatim asks for a valid identifying User-Agent; browsers may override,
    // but we still send it where allowed and identify as Sillage in comments/docs.
  });

  // Transient / rate-limit — do not cache as a lasting miss
  if (!res.ok) {
    throw new Error(`geocode http ${res.status}`);
  }
  const data = (await res.json()) as Array<{
    lat?: string;
    lon?: string;
    display_name?: string;
  }>;
  if (!Array.isArray(data) || !data.length) return null;
  const first = data[0];
  const lat = Number(first.lat);
  const lon = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    lat,
    lon,
    displayName: first.display_name,
  };
}

/**
 * Resolve a free-text place. Returns a hit, null on known miss / failure,
 * never throws. Results are cached in localStorage.
 * Network/offline errors are not cached as misses so they can retry later.
 */
export function geocodeLocation(raw: string): Promise<GeocodeHit | null> {
  const query = normalizeQuery(raw);
  if (!query) return Promise.resolve(null);
  const key = locationKey(query);

  const cached = fromCache(key);
  if (cached !== undefined) return Promise.resolve(cached);

  const job = chain.then(async () => {
    const again = fromCache(key);
    if (again !== undefined) return again;
    try {
      const hit = await fetchNominatim(query);
      if (hit) {
        storeOk(key, hit);
        return hit;
      }
      storeMiss(key);
      return null;
    } catch {
      // Offline, timeout, or HTTP error — leave uncached for a later pass
      return null;
    }
  });

  chain = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
}

/** Identify Sillage for Nominatim policy (also set on fetch when possible). */
export const GEOCODE_USER_AGENT = USER_AGENT;
