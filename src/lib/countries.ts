/** Compact countries GeoJSON (Natural Earth 110m admin_0, simplified). */

export interface CountryFeature {
  type: 'Feature';
  properties: {
    continent: string;
    name: string;
    a3: string;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: unknown;
  };
}

const COUNTRIES_URL = `${import.meta.env.BASE_URL}geo/countries.geojson`;

let loading: Promise<CountryFeature[]> | null = null;

export function loadCountries(): Promise<CountryFeature[]> {
  if (loading) return loading;
  loading = (async () => {
    const res = await fetch(COUNTRIES_URL);
    if (!res.ok) throw new Error('Pays indisponibles');
    const fc = (await res.json()) as { features?: CountryFeature[] };
    if (!Array.isArray(fc.features)) throw new Error('Pays invalides');
    return fc.features;
  })().catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}

export function continentOf(feat: unknown): string {
  const f = feat as CountryFeature | null;
  return f?.properties?.continent ?? '';
}

export function countryKey(feat: unknown): string {
  const f = feat as CountryFeature | null;
  return f?.properties?.a3 || f?.properties?.name || '';
}

/** Stable 0..n-1 bucket for categorical country fills. */
export function countryPaletteIndex(feat: unknown, n: number): number {
  const key = countryKey(feat);
  if (!key || n <= 0) return 0;
  let h = 0;
  for (let i = 0; i < key.length; i += 1) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  return h % n;
}
