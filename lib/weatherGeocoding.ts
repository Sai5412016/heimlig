// lib/weatherGeocoding.ts — place-name search for the widget's weather location, backed by
// Open-Meteo's free geocoding API (no key, no account). Foreground-only: this is a plain network
// call from the settings screen, never imported into the widget's headless context.
export interface GeocodingResult {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
}

const FETCH_TIMEOUT_MS = 8000;

// Throws on a network failure or a non-OK response so the caller can show "kein Netz" — unlike
// widgets/weather.ts's getWeatherLine(), which must never throw, this one has a UI right there to
// report to, so swallowing the error here would just hide it instead of handling it.
export async function searchPlaces(query: string, language: 'de' | 'en'): Promise<GeocodingResult[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=${language}&format=json`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`geocoding_http_${res.status}`);
    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    return results
      .filter((r: any) => typeof r?.latitude === 'number' && typeof r?.longitude === 'number' && typeof r?.name === 'string')
      .map((r: any) => ({
        name: r.name,
        admin1: typeof r.admin1 === 'string' ? r.admin1 : undefined,
        country: typeof r.country === 'string' ? r.country : undefined,
        latitude: r.latitude,
        longitude: r.longitude,
      }));
  } finally {
    clearTimeout(timeout);
  }
}
