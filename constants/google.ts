// constants/google.ts — Google OAuth client IDs (public, not secret) + scopes.
// Used for connecting a Google account to sync Heimlig tasks with Google Calendar.
export const GOOGLE_OAUTH = {
  webClientId: '241489332668-81llenv1g85dmrog4vof2jfdjjicrsve.apps.googleusercontent.com',
  androidClientId: '241489332668-jm371qn6djpd44a6opa0btd92ns7i5mk.apps.googleusercontent.com',
  // Manage (read + write) calendar events.
  scopes: ['https://www.googleapis.com/auth/calendar.events'],
};
