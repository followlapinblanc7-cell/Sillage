/** Compact continents GeoJSON (Natural Earth 110m, dissolved by CONTINENT). */

export type ContinentName =
  | 'Africa'
  | 'Antarctica'
  | 'Asia'
  | 'Europe'
  | 'North America'
  | 'Oceania'
  | 'South America';

export interface ContinentFeature {
  type: 'Feature';
  properties: { continent: string };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: unknown;
  };
}

const CONTINENTS_URL = `${import.meta.env.BASE_URL}geo/continents.geojson`;

let loading: Promise<ContinentFeature[]> | null = null;

export function loadContinents(): Promise<ContinentFeature[]> {
  if (loading) return loading;
  loading = (async () => {
    const res = await fetch(CONTINENTS_URL);
    if (!res.ok) throw new Error('Continents indisponibles');
    const fc = (await res.json()) as { features?: ContinentFeature[] };
    if (!Array.isArray(fc.features)) throw new Error('Continents invalides');
    return fc.features;
  })().catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}

export function continentOf(feat: unknown): string {
  const f = feat as ContinentFeature | null;
  return f?.properties?.continent ?? '';
}
