/** Nominatim geocoding with localStorage cache. Privacy: only geocode strings / coords you pass. */

export interface GeocodeHit {
  lat: number;
  lon: number;
  displayName?: string;
}

export interface PlaceCandidate {
  label: string;
  lat: number;
  lon: number;
}

export interface RecentPlace {
  label: string;
  lat: number;
  lon: number;
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

export type SearchPlacesOutcome =
  | { status: 'ok'; places: PlaceCandidate[] }
  | { status: 'empty' }
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
  road?: string;
  pedestrian?: string;
  footway?: string;
  path?: string;
  square?: string;
  house_number?: string;
  amenity?: string;
  tourism?: string;
  leisure?: string;
  shop?: string;
  building?: string;
  historic?: string;
  attraction?: string;
  office?: string;
  craft?: string;
}

const CACHE_KEY = 'sillage-geocode-v1';
const RECENT_KEY = 'sillage-lieu-recent-v1';
const RECENT_MAX = 6;
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

function sameLabel(a: string, b: string): boolean {
  return a.toLocaleLowerCase('fr') === b.toLocaleLowerCase('fr');
}

function roadOf(address: NominatimAddress): string | undefined {
  return (
    address.road ||
    address.pedestrian ||
    address.square ||
    address.footway ||
    address.path
  );
}

/** OSM tag values like fast_food / cafe — not venue display names. */
function looksLikeOsmTagValue(raw: string): boolean {
  const s = raw.trim();
  if (!s) return true;
  if (/\s/.test(s)) return false;
  if (/[A-ZÀ-Ÿ]/.test(s)) return false; // proper names usually have capitals in FR
  return /^[a-z0-9_]+$/.test(s);
}

function namedSpotOf(
  address: NominatimAddress,
  name?: string,
): string | undefined {
  const trimmedName = name?.trim();
  if (trimmedName) return trimmedName;

  const candidates = [
    address.amenity,
    address.tourism,
    address.leisure,
    address.shop,
    address.building,
    address.historic,
    address.attraction,
    address.office,
    address.craft,
  ];
  for (const c of candidates) {
    if (!c) continue;
    const t = c.trim();
    if (!t || looksLikeOsmTagValue(t)) continue;
    return t;
  }
  return undefined;
}

/**
 * Short journal-friendly label: town + département/région (or country).
 * Avoids the full Nominatim dump (street, postcode, etc.).
 * Used by GPS reverse (« Ma position ») — intentionally coarse.
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

/**
 * Precise but readable label for a picked place:
 * street / POI / neighbourhood + locality — e.g. « Place Jean-Jaurès, Saint-Étienne ».
 */
export function formatPrecisePlace(
  address: NominatimAddress,
  displayName?: string,
  name?: string,
): string {
  const locality =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.hamlet;
  const road = roadOf(address);
  const named = namedSpotOf(address, name);
  const neighbourhood = address.neighbourhood || address.suburb;

  let spot = '';
  if (named && (!locality || !sameLabel(named, locality))) {
    // Prefer « Nom, voie » only when the name isn't already the road
    if (road && !sameLabel(named, road) && address.house_number) {
      spot = `${named}, ${address.house_number} ${road}`;
    } else if (road && !sameLabel(named, road)) {
      // Keep POI name alone — locality added below
      spot = named;
    } else {
      spot = named;
    }
  } else if (address.house_number && road) {
    spot = `${address.house_number} ${road}`;
  } else if (road) {
    spot = road;
  } else if (neighbourhood && (!locality || !sameLabel(neighbourhood, locality))) {
    spot = neighbourhood;
  }

  if (spot && locality && !sameLabel(spot, locality)) {
    return `${spot}, ${locality}`;
  }
  if (spot) return spot;

  // Fall back to coarse journal label
  const coarse = formatJournalPlace(address, displayName);
  if (coarse) return coarse;

  if (displayName) {
    const parts = displayName
      .split(',')
      .map((s) => s.trim())
      .filter((p) => p && !/^\d{4,}$/.test(p) && !/^\d+[a-z]?$/i.test(p));
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

/**
 * Seed the forward geocode cache for a precise label so Lieux can pin it
 * without a second Nominatim trip (same key scheme as locationKey).
 */
export function rememberPlace(label: string, hit: GeocodeHit) {
  const normalized = normalizeQuery(label);
  if (!normalized) return;
  if (!Number.isFinite(hit.lat) || !Number.isFinite(hit.lon)) return;
  storeOk(locationKey(normalized), {
    lat: hit.lat,
    lon: hit.lon,
    displayName: normalized,
  });
  pushRecentPlace({ label: normalized, lat: hit.lat, lon: hit.lon });
}

export function listRecentPlaces(): RecentPlace[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentPlace[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p) =>
          p &&
          typeof p.label === 'string' &&
          p.label.trim() &&
          Number.isFinite(p.lat) &&
          Number.isFinite(p.lon),
      )
      .slice(0, RECENT_MAX)
      .map((p) => ({
        label: normalizeQuery(p.label),
        lat: p.lat,
        lon: p.lon,
      }));
  } catch {
    return [];
  }
}

export function pushRecentPlace(place: RecentPlace) {
  const label = normalizeQuery(place.label);
  if (!label) return;
  if (!Number.isFinite(place.lat) || !Number.isFinite(place.lon)) return;
  try {
    const prev = listRecentPlaces().filter(
      (p) => !sameLabel(p.label, label),
    );
    const next = [{ label, lat: place.lat, lon: place.lon }, ...prev].slice(
      0,
      RECENT_MAX,
    );
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode — ignore */
  }
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

const POI_ADDRESS_KEYS = [
  'amenity',
  'shop',
  'tourism',
  'leisure',
  'craft',
  'office',
  'historic',
  'attraction',
] as const;

const POI_CLASSES = new Set([
  'amenity',
  'shop',
  'tourism',
  'leisure',
  'craft',
  'office',
  'historic',
]);

interface NominatimSearchRow {
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  class?: string;
  type?: string;
  address?: NominatimAddress;
}

type RankedPlace = PlaceCandidate & { score: number; order: number };

/** Soft viewbox (~±0.2°) around a point — prefers nearby hits without excluding elsewhere. */
function viewboxAround(lat: number, lon: number, delta = 0.2): string {
  const left = lon - delta;
  const right = lon + delta;
  const top = lat + delta;
  const bottom = lat - delta;
  return `${left},${top},${right},${bottom}`;
}

function addressHasPoiKey(address: NominatimAddress | undefined): boolean {
  if (!address) return false;
  for (const key of POI_ADDRESS_KEYS) {
    const v = address[key];
    if (typeof v === 'string' && v.trim()) return true;
  }
  return false;
}

/**
 * Prefer établissements (resto, shop, café…) over cities/admin while still
 * keeping streets and localities when that is what the user typed.
 */
function poiScore(row: NominatimSearchRow): number {
  const cls = (row.class ?? '').toLowerCase();
  if (POI_CLASSES.has(cls)) return 3;
  if (addressHasPoiKey(row.address)) return 3;

  const name = row.name?.trim();
  if (name) {
    const locality =
      row.address?.city ||
      row.address?.town ||
      row.address?.village ||
      row.address?.municipality;
    const road = row.address ? roadOf(row.address) : undefined;
    // Named venue that isn't merely the locality or road label
    if (
      (!locality || !sameLabel(name, locality)) &&
      (!road || !sameLabel(name, road))
    ) {
      return 2;
    }
  }
  return 0;
}

function rankPlaceCandidates(
  rows: NominatimSearchRow[],
  limit: number,
): PlaceCandidate[] {
  const seen = new Set<string>();
  const ranked: RankedPlace[] = [];

  rows.forEach((row, order) => {
    const lat = Number(row.lat);
    const lon = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const label = formatPrecisePlace(
      row.address ?? {},
      row.display_name,
      row.name,
    );
    if (!label) return;
    const key = locationKey(label);
    if (seen.has(key)) return;
    seen.add(key);
    ranked.push({
      label,
      lat,
      lon,
      score: poiScore(row),
      order,
    });
  });

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.order - b.order;
  });

  return ranked.slice(0, limit).map(({ label, lat, lon }) => ({
    label,
    lat,
    lon,
  }));
}

function biasNearFromRecents(): { lat: number; lon: number } | undefined {
  const recent = listRecentPlaces()[0];
  if (!recent) return undefined;
  return { lat: recent.lat, lon: recent.lon };
}

async function fetchNominatimSearchMany(
  query: string,
  limit: number,
  signal?: AbortSignal,
  near?: { lat: number; lon: number },
): Promise<PlaceCandidate[]> {
  await waitForSlot(signal);
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  // Pull a few extra so client-side POI ranking has room to surface venues
  const fetchLimit = Math.min(Math.max(limit * 2, limit), 12);

  const url = new URL(NOMINATIM_SEARCH);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', String(fetchLimit));
  url.searchParams.set('addressdetails', '1');

  if (
    near &&
    Number.isFinite(near.lat) &&
    Number.isFinite(near.lon)
  ) {
    url.searchParams.set('viewbox', viewboxAround(near.lat, near.lon));
    // Soft bias: prefer the box, do not hard-clip results
    url.searchParams.set('bounded', '0');
  }

  const res = await fetch(url.toString(), {
    headers: nominatimHeaders(),
    signal,
  });

  if (!res.ok) {
    throw new Error(`search places http ${res.status}`);
  }

  const data = (await res.json()) as NominatimSearchRow[];

  if (!Array.isArray(data) || !data.length) return [];

  return rankPlaceCandidates(data, limit);
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
 * Forward search for several precise place candidates (établissements, streets, cities).
 * Prefers POI-like Nominatim hits; soft-biases with viewbox when a recent place
 * (or options.near) is known. Respects ≤1 req/s, AbortController, Nominatim policy.
 * Never throws (abort / network → unavailable).
 */
export function searchPlaces(
  raw: string,
  options?: {
    signal?: AbortSignal;
    limit?: number;
    /** Optional bias center; defaults to the most recent lieu when available. */
    near?: { lat: number; lon: number };
  },
): Promise<SearchPlacesOutcome> {
  const query = normalizeQuery(raw);
  if (query.length < 2) return Promise.resolve({ status: 'empty' });
  const limit = Math.min(Math.max(options?.limit ?? 7, 1), 8);
  const signal = options?.signal;
  const near = options?.near ?? biasNearFromRecents();

  const job = chain.then(async (): Promise<SearchPlacesOutcome> => {
    if (signal?.aborted) return { status: 'unavailable' };
    try {
      const places = await fetchNominatimSearchMany(query, limit, signal, near);
      if (!places.length) return { status: 'empty' };
      return { status: 'ok', places };
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
