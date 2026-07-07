// lib/sentry.ts — crash & error reporting.
// The DSN is safe to expose client-side (Sentry DSNs are ingest-only, no read access).
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const DSN = 'https://b7c5e1a191e8fc439a301e036455a559@o4511695291744256.ingest.de.sentry.io/4511695306489936';

export function initSentry() {
  Sentry.init({
    dsn: DSN,
    debug: __DEV__,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: 0.2,
    release: `heimlig@${Constants.expoConfig?.version}`,
    dist: String(Constants.expoConfig?.android?.versionCode ?? ''),
  });
}

export { Sentry };
