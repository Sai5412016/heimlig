// lib/timezones.ts — curated list of common IANA timezones for the household timezone picker.
// The daily-digest push (send_daily_digest() Postgres function) fires per household at 8am in
// this zone, so it needs to be a real IANA name Postgres recognizes — not a free-text field.
export const TIMEZONES: string[] = [
  'Europe/Berlin',
  'Europe/London',
  'Europe/Paris',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Zurich',
  'Europe/Vienna',
  'Europe/Warsaw',
  'Europe/Prague',
  'Europe/Budapest',
  'Europe/Bucharest',
  'Europe/Sofia',
  'Europe/Stockholm',
  'Europe/Oslo',
  'Europe/Copenhagen',
  'Europe/Istanbul',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'America/Mexico_City',
  'America/Toronto',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Bangkok',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Jerusalem',
  'Australia/Sydney',
  'Pacific/Auckland',
  'Africa/Johannesburg',
];

const DEFAULT_TIMEZONE = 'Europe/Berlin';

// 'America/New_York' -> 'New York'
export function timezoneLabel(tz: string | undefined | null): string {
  const zone = tz || DEFAULT_TIMEZONE;
  const city = zone.split('/').pop() || zone;
  return city.replace(/_/g, ' ');
}
