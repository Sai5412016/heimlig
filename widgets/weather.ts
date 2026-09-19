// widgets/weather.ts — fetches, caches and formats the widget's optional weather line.
//
// Runs inside widgetTaskHandler's execution context. react-native-android-widget schedules its
// headless JS task on the app's own ReactHost (see HeadlessJsTaskWorker.java) — same index.js
// entry point as the foreground app, not a separate bundle — so by the time widgetTaskHandler()
// is actually invoked, lib/i18n.ts has already run and registered its static de/en resources.
// That's enough for i18n.t() to work here (see lib/notifications.ts for the same "no React
// tree, use i18n.t() directly" pattern), but the instance's ACTIVE language reflects whatever
// last ran in that JS context, not necessarily this device's saved choice — so every t() call
// below passes an explicit `lng` read fresh from AsyncStorage instead of relying on it.
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../lib/i18n';

const ENABLED_KEY = '@heimlig/weatherWidgetEnabled';
const LAT_KEY = '@heimlig/weatherLat';
const LON_KEY = '@heimlig/weatherLon';
const LANGUAGE_KEY = '@heimlig/language';
const CACHE_KEY = '@heimlig/weatherCache';

const DEFAULT_LAT = 48.22;
const DEFAULT_LON = 10.85;

// Independent of the widget's own ~30-minute native redraw cadence (updatePeriodMillis in
// app.json) — a redraw that lands inside the same hour reuses the cache instead of hitting
// Open-Meteo again.
const CACHE_MAX_AGE_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

interface WeatherCache {
  lat: number;
  lon: number;
  tempC: number;
  weatherCode: number;
  high: number;
  low: number;
  fetchedAt: number; // epoch ms
}

function parseCoord(raw: string | null, fallback: number, min: number, max: number): number {
  const n = raw ? parseFloat(raw.replace(',', '.')) : NaN;
  return isFinite(n) && n >= min && n <= max ? n : fallback;
}

// Groups Open-Meteo's WMO weather_code values (open-meteo.com/en/docs, "WMO Weather
// interpretation codes") into the short set of condition words a one-line widget has room
// for — not all ~25 distinct phrases like "moderate freezing drizzle".
function conditionKeyFor(code: number): string {
  if (code === 0) return 'clear';
  if (code === 1) return 'mainlyClear';
  if (code === 2) return 'partlyCloudy';
  if (code === 3) return 'overcast';
  if (code === 45 || code === 48) return 'fog';
  if ([51, 53, 55, 56, 57].includes(code)) return 'drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'thunderstorm';
  return 'unknown';
}

async function readCache(): Promise<WeatherCache | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as WeatherCache) : null;
  } catch {
    return null;
  }
}

async function writeCache(cache: WeatherCache): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* best-effort — a failed cache write just means the next call fetches again */ }
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherCache | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    // timezone=auto lets Open-Meteo derive the local timezone from lat/lon itself, so "today's"
    // high/low lines up with the entered coordinates instead of always being anchored to
    // Europe/Berlin's calendar day (would drift for e.g. an AU/NZ household's coordinates).
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const tempC = data?.current?.temperature_2m;
    const weatherCode = data?.current?.weather_code;
    const high = data?.daily?.temperature_2m_max?.[0];
    const low = data?.daily?.temperature_2m_min?.[0];
    if (typeof tempC !== 'number' || typeof weatherCode !== 'number' || typeof high !== 'number' || typeof low !== 'number') {
      return null;
    }
    return { lat, lon, tempC, weatherCode, high, low, fetchedAt: Date.now() };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function formatLine(cache: WeatherCache, lang: string): string {
  const condition = i18n.t(`system.widgetWeather.${conditionKeyFor(cache.weatherCode)}`, { lng: lang });
  return i18n.t('system.widgetWeatherLine', {
    lng: lang,
    temp: Math.round(cache.tempC),
    condition,
    high: Math.round(cache.high),
    low: Math.round(cache.low),
  });
}

// Returns the formatted weather line, or null if the setting is off, nothing has ever been
// fetched successfully, or something failed — the caller (widgetTaskHandler) then simply
// leaves the line out of the widget. This function must never throw and never itself decide
// to show an error string in the widget.
export async function getWeatherLine(): Promise<string | null> {
  try {
    const enabled = await AsyncStorage.getItem(ENABLED_KEY);
    if (enabled !== '1') return null;

    const [rawLat, rawLon, rawLang] = await Promise.all([
      AsyncStorage.getItem(LAT_KEY),
      AsyncStorage.getItem(LON_KEY),
      AsyncStorage.getItem(LANGUAGE_KEY),
    ]);
    const lat = parseCoord(rawLat, DEFAULT_LAT, -90, 90);
    const lon = parseCoord(rawLon, DEFAULT_LON, -180, 180);
    const lang = rawLang === 'en' ? 'en' : 'de';

    const cached = await readCache();
    // A coordinate change (user edited the settings fields) invalidates the cache immediately,
    // regardless of age — otherwise the widget would keep showing the PREVIOUS location's
    // weather for up to an hour after the user pointed it somewhere else.
    const sameLocation = !!cached && Math.abs(cached.lat - lat) < 0.01 && Math.abs(cached.lon - lon) < 0.01;
    const cacheFresh = !!cached && sameLocation && (Date.now() - cached.fetchedAt) < CACHE_MAX_AGE_MS;

    let result: WeatherCache | null = cacheFresh ? cached : null;
    if (!result) {
      const fresh = await fetchWeather(lat, lon);
      if (fresh) {
        result = fresh;
        await writeCache(fresh);
      } else if (cached) {
        // No network or a bad response: show the last known value (even if stale or for a
        // since-changed location) rather than nothing — "kein Netz oder Fehler: den letzten
        // Wert anzeigen".
        result = cached;
      }
    }
    return result ? formatLine(result, lang) : null;
  } catch {
    // Never let a bug here take the rest of the widget down with it.
    return null;
  }
}
