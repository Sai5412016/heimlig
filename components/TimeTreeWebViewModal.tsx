// components/TimeTreeWebViewModal.tsx — logs into TimeTree's real web login page (so Google/
// Facebook/email all work, exactly like a user signing in themselves) inside a WebView, then
// runs TimeTree's own private API calls *inside that page's JS context* so the browser
// attaches cookies automatically — including HttpOnly ones we could never read directly.
// We never see the user's password, and never handle/store any TimeTree session ourselves.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { Alert } from '../lib/alert';
import { useTranslation } from 'react-i18next';
import { colors, spacing, radius, typography, type ColorPalette } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useStore } from '../store/useStore';
import type { RawTimeTreeEvent } from '../lib/timetreeEvents';

// Runs inside TimeTree's own page after login. `credentials: 'include'` makes the browser
// attach the session cookie automatically, same as if the user opened these URLs themselves.
const FETCH_SCRIPT = `
(async function () {
  try {
    var headers = { 'Content-Type': 'application/json', 'X-Timetreea': 'web/2.1.0/en' };
    var calRes = await fetch('https://timetreeapp.com/api/v1/calendars?since=0', { headers: headers, credentials: 'include' });
    var calBody = await calRes.json();
    var calendars = (calBody.calendars || []).filter(function (c) { return c.deactivated_at == null; });
    var rawEvents = [];
    for (var i = 0; i < calendars.length; i++) {
      var cal = calendars[i];
      var since = 0;
      for (var page = 0; page < 50; page++) {
        var evRes = await fetch('https://timetreeapp.com/api/v1/calendar/' + cal.id + '/events/sync?since=' + since, { headers: headers, credentials: 'include' });
        var evBody = await evRes.json();
        rawEvents = rawEvents.concat(evBody.events || []);
        if (!evBody.chunk) break;
        since = evBody.since || since;
      }
    }
    window.ReactNativeWebView.postMessage(JSON.stringify({ ok: true, events: rawEvents }));
  } catch (e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ ok: false, error: String(e && e.message ? e.message : e) }));
  }
})();
true;
`;

export default function TimeTreeWebViewModal({ visible, onClose, onEvents }: {
  visible: boolean;
  onClose: () => void;
  onEvents: (events: RawTimeTreeEvent[]) => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const language = useStore(s => s.language);
  const signinUrl = `https://timetreeapp.com/signin?locale=${language}`;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const webviewRef = useRef<WebView>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!visible) { setLoggedIn(false); setFetching(false); }
  }, [visible]);

  const handleNavChange = (navState: WebViewNavigation) => {
    const url = navState.url || '';
    const isTimeTree = url.includes('timetreeapp.com');
    const isAuthPage = url.includes('/signin') || url.includes('/auth');
    setLoggedIn(isTimeTree && !isAuthPage);
  };

  const handleFetch = () => {
    setFetching(true);
    webviewRef.current?.injectJavaScript(FETCH_SCRIPT);
  };

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    setFetching(false);
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload.ok) {
        onEvents(payload.events || []);
      } else {
        Alert.alert(t('timetree.loadFailedTitle'), t('timetree.loadFailedBody', { error: payload.error || t('timetree.unknownError') }));
      }
    } catch {
      Alert.alert(t('timetree.loadFailedTitle'), t('timetree.parseFailedBody'));
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.headerBtn}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('timetree.headerTitle')}</Text>
          <View style={{ width: 70 }} />
        </View>
        <Text style={styles.hint}>{t('timetree.hint')}</Text>
        <WebView<{}>
          ref={webviewRef}
          source={{ uri: signinUrl }}
          onNavigationStateChange={handleNavChange}
          onMessage={handleMessage}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          style={styles.flex}
        />
        {loggedIn && (
          <TouchableOpacity style={styles.fetchBtn} onPress={handleFetch} disabled={fetching} activeOpacity={0.85}>
            {fetching
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.fetchBtnText}>{t('timetree.importButton')}</Text>}
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerBtn: { ...typography.body, color: colors.brand, fontWeight: '600', width: 70 },
  headerTitle: { ...typography.h3, color: colors.text },
  hint: { ...typography.xs, color: colors.textMuted, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  fetchBtn: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg, backgroundColor: colors.brand, borderRadius: radius.full, paddingVertical: spacing.md, alignItems: 'center', ...shadowify() },
  fetchBtnText: { ...typography.body, color: '#fff', fontWeight: '700' },
});}

function shadowify() {
  return { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 };
}
