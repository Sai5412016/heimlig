// lib/deviceCalendar.ts — reads events from the OS Calendar app via expo-calendar. READ-ONLY:
// this module never calls createEventAsync/updateEventAsync/deleteEventAsync, and app.json
// deliberately blocks the WRITE_CALENDAR permission the plugin would otherwise request (see
// android.blockedPermissions) — nothing here could write to the device calendar even if asked to.
//
// Counterpart to lib/googleCalendar.ts, but native-only: there is no OS calendar to read on web,
// so every export here is a no-op on web (see the `!Calendar` guards) — the UI gates the whole
// feature to native platforms too (see household.tsx), this is just defense in depth.
let Calendar: typeof import('expo-calendar') | null = null;

// Only load in real builds, not Expo Go — same defensive pattern as lib/notifications.ts.
try {
  Calendar = require('expo-calendar');
} catch (e) { /* native module not linked (Expo Go) or unavailable on this platform */ }

const pad = (n: number) => String(n).padStart(2, '0');

export interface DeviceCalendarInfo {
  id: string;
  title: string;
  color: string;
}

export interface DeviceCalendarEvent {
  id: string;
  title: string;
  date: string;        // yyyy-MM-dd
  time?: string;        // HH:MM, device-local — absent for all-day events
  description?: string;
}

// Reads the current permission WITHOUT ever opening the system dialog.
export async function hasCalendarPermission(): Promise<boolean> {
  if (!Calendar) return false;
  try {
    const { status } = await Calendar.getCalendarPermissionsAsync();
    return status === 'granted';
  } catch { return false; }
}

// Whether asking again can still produce a dialog. Android only offers the dialog once: after a
// denial `canAskAgain` is false and the only remaining route is system settings.
export async function canAskForCalendarPermission(): Promise<boolean> {
  if (!Calendar) return false;
  try {
    const { status, canAskAgain } = await Calendar.getCalendarPermissionsAsync();
    if (status === 'granted') return false;
    return canAskAgain !== false;
  } catch { return false; }
}

// OPENS THE SYSTEM DIALOG. Only call this from a place where the user has just been told what
// the permission is for and has actively started the import — see components/DeviceCalendarModal.
export async function requestCalendarPermission(): Promise<boolean> {
  if (!Calendar) return false;
  try {
    const { status: existing } = await Calendar.getCalendarPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === 'granted';
  } catch { return false; }
}

// Calendars shown in the OS Calendar app (not Reminders — we never touch those). Call only after
// permission is confirmed granted; returns [] otherwise rather than triggering a prompt itself.
export async function getDeviceCalendars(): Promise<DeviceCalendarInfo[]> {
  if (!Calendar) return [];
  try {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    return calendars.map(c => ({ id: c.id, title: c.title, color: c.color }));
  } catch { return []; }
}

function toDateAndTime(rawStart: string | Date, allDay: boolean): { date: string; time?: string } {
  const d = new Date(rawStart);
  if (allDay) {
    // All-day events are stored as UTC midnight representing the calendar date itself, not a
    // real moment in time (that's how Android's CalendarContract stores them, regardless of the
    // viewer's zone). Reading it back with LOCAL getters can roll the date a day backward for
    // anyone west of UTC — UTC getters read the authored date exactly as entered.
    return { date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` };
  }
  // Timed events carry a real instant — local getters are exactly the wall-clock time the user
  // sees in their own Calendar app, same convention as lib/ics.ts's parseDateProp().
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

// Events in the next `days` days across the given calendars, normalized to the same shape the
// store expects (see store/useStore.ts importDeviceCalendarEvents).
export async function listDeviceCalendarEvents(calendarIds: string[], days = 60): Promise<DeviceCalendarEvent[]> {
  if (!Calendar || calendarIds.length === 0) return [];
  try {
    const start = new Date();
    const end = new Date(Date.now() + days * 86400000);
    const events = await Calendar.getEventsAsync(calendarIds, start, end);
    return events.map(e => {
      const { date, time } = toDateAndTime(e.startDate, e.allDay);
      return { id: e.id, title: e.title || 'Termin', date, time, description: e.notes || undefined };
    });
  } catch { return []; }
}
