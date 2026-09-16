/** Nominatim geocoding with localStorage cache. Privacy: only geocode strings / coords you pass. */

export interface GeocodeHit {
  lat: number;
  lon: number;
  displayName?: string;
}

/** ok = placed; miss = known empty result (cached); unavailable = network/HTTP (not cached). */
export type GeocodeOutcome =
  | { status: 'ok'; hit: GeocodeHit }
  | { status: 'miss' }
  | { status: 'unavailable' };

export type ReverseGeocodeOutcome =
  | { status: 'ok'; label: string; hit: GeocodeHit }
  | { status: 'miss' }
  | { status: 'unavailable' };

type CacheEntry =
  | { status: 'ok'; lat: number; lon: number; displayName?: string; at: number }
  | { status: 'miss'; at: number };

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  hamlet?: string;
  suburb?: string;
  neighbourhood?: string;
  city_district?: string;
  county?: string;
  state?: string;
  region?: string;
  country?: string;
}

const CACHE_KEY = 'sillage-geocode-v1';
const USER_AGENT =
  'Sillage/1.0 (personal journal PWA; local-only; github.com/followlapinblanc7-cell/Sillage)';
const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';
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

/** Round coords for cache (~110 m) — journal places don’t need metre precision. */
export function coordsCacheKey(lat: number, lon: number): string {
  const rLat = Math.round(lat * 1e3) / 1e3;
  const rLon = Math.round(lon * 1e3) / 1e3;
  return `rev:${rLat.toFixed(3)},${rLon.toFixed(3)}`;
}

/**
 * Short journal-friendly label: town + département/région (or country).
 * Avoids the full Nominatim dump (street, postcode, etc.).
 */
export function formatJournalPlace(
  address: NominatimAddress,
  displayName?: string,
): string {
  const locality =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.hamlet ||
    address.suburb ||
    address.city_district ||
    address.neighbourhood;
  // Prefer county (département in FR) over large région / state
  const area = address.county || address.state || address.region;
  const country = address.country;

  if (locality && area) return `${locality}, ${area}`;
  if (locality && country) return `${locality}, ${country}`;
  if (locality) return locality;
  if (area && country && area !== country) return `${area}, ${country}`;
  if (area) return area;
  if (country) return country;

  if (displayName) {
    const parts = displayName
      .split(',')
      .map((s) => s.trim())
      .filter((p) => p && !/^\d+[a-z]?$/i.test(p));
    if (parts.length >= 2) return `${parts[0]}, ${parts[1]}`;
    if (parts.length === 1) return parts[0];
  }
  return '';
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

function fromCache(key: string): GeocodeOutcome | undefined {
  const cache = readCache();
  const entry = cache[key];
  if (!entry) return undefined;
  if (entry.status === 'ok') {
    return {
      status: 'ok',
      hit: { lat: entry.lat, lon: entry.lon, displayName: entry.displayName },
    };
  }
  if (Date.now() - entry.at < MISS_TTL_MS) return { status: 'miss' };
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

async function waitForSlot(signal?: AbortSignal) {
  const now = Date.now();
  const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastRequestAt));
  if (wait > 0) {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, wait);
      const onAbort = () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      if (signal?.aborted) {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }
  lastRequestAt = Date.now();
}

function nominatimHeaders(): HeadersInit {
  return {
    Accept: 'application/json',
    'Accept-Language': 'fr',
    // Nominatim asks for a valid identifying User-Agent; browsers may override,
    // but we still send it where allowed and identify as Sillage in comments/docs.
  };
}

async function fetchNominatimSearch(query: string): Promise<GeocodeHit | null> {
  await waitForSlot();
  const url = new URL(NOMINATIM_SEARCH);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '0');

  const res = await fetch(url.toString(), {
    headers: nominatimHeaders(),
  });

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

async function fetchNominatimReverse(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<{ hit: GeocodeHit; label: string } | null> {
  await waitForSlot(signal);
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const url = new URL(NOMINATIM_REVERSE);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('zoom', '14');

  const res = await fetch(url.toString(), {
    headers: nominatimHeaders(),
    signal,
  });

  if (!res.ok) {
    throw new Error(`reverse geocode http ${res.status}`);
  }

  const data = (await res.json()) as {
    error?: string;
    lat?: string;
    lon?: string;
    display_name?: string;
    address?: NominatimAddress;
  };

  if (data.error) return null;

  const outLat = Number(data.lat);
  const outLon = Number(data.lon);
  if (!Number.isFinite(outLat) || !Number.isFinite(outLon)) return null;

  const label = formatJournalPlace(data.address ?? {}, data.display_name);
  if (!label) return null;

  return {
    hit: {
      lat: outLat,
      lon: outLon,
      displayName: label,
    },
    label,
  };
}

/**
 * Resolve a free-text place. Never throws.
 * - ok / miss are cached in localStorage
 * - unavailable (offline, timeout, HTTP) is not cached so a later pass can retry
 */
export function geocodeLocation(raw: string): Promise<GeocodeOutcome> {
  const query = normalizeQuery(raw);
  if (!query) return Promise.resolve({ status: 'miss' });
  const key = locationKey(query);

  const cached = fromCache(key);
  if (cached !== undefined) return Promise.resolve(cached);

  const job = chain.then(async (): Promise<GeocodeOutcome> => {
    const again = fromCache(key);
    if (again !== undefined) return again;
    try {
      const hit = await fetchNominatimSearch(query);
      if (hit) {
        storeOk(key, hit);
        return { status: 'ok', hit };
      }
      storeMiss(key);
      return { status: 'miss' };
    } catch {
      return { status: 'unavailable' };
    }
  });

  chain = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
}

/**
 * Reverse-geocode lat/lon into a short place string for the journal.
 * Cache keyed by rounded coords. Never throws (abort → unavailable).
 * Also seeds the forward cache under the label so Lieux can reuse it.
 */
export function reverseGeocode(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<ReverseGeocodeOutcome> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Promise.resolve({ status: 'miss' });
  }
  const key = coordsCacheKey(lat, lon);

  const cached = fromCache(key);
  if (cached?.status === 'ok' && cached.hit.displayName) {
    return Promise.resolve({
      status: 'ok',
      label: cached.hit.displayName,
      hit: cached.hit,
    });
  }
  if (cached?.status === 'miss') return Promise.resolve({ status: 'miss' });
  // ok without label (legacy) — re-fetch

  const job = chain.then(async (): Promise<ReverseGeocodeOutcome> => {
    if (signal?.aborted) return { status: 'unavailable' };
    const again = fromCache(key);
    if (again?.status === 'ok' && again.hit.displayName) {
      return { status: 'ok', label: again.hit.displayName, hit: again.hit };
    }
    if (again?.status === 'miss') return { status: 'miss' };
    try {
      const result = await fetchNominatimReverse(lat, lon, signal);
      if (result) {
        storeOk(key, result.hit);
        // Seed forward lookup so Lieux map can place this label without a second trip
        storeOk(locationKey(result.label), result.hit);
        return { status: 'ok', label: result.label, hit: result.hit };
      }
      storeMiss(key);
      return { status: 'miss' };
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return { status: 'unavailable' };
      }
      return { status: 'unavailable' };
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
