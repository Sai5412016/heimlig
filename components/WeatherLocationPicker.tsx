// components/WeatherLocationPicker.tsx — replaces the old raw lat/lon text fields with a place
// search, backed by Open-Meteo's free geocoding API (lib/weatherGeocoding.ts). No location
// permission anywhere in this component — the user types a name, picks a result, done.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { spacing, radius, typography, type ColorPalette } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { searchPlaces, type GeocodingResult } from '../lib/weatherGeocoding';

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 400;

export default function WeatherLocationPicker({
  placeName, lat, lon, onSelect,
}: {
  placeName: string;
  lat: string;
  lon: string;
  onSelect: (result: { lat: string; lon: string; placeName: string }) => void;
}) {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const s = makeStyles(colors);
  // Existing users with coordinates but no stored place name (set before this feature existed)
  // see their coordinates as a neutral starting value instead of a blank field implying nothing
  // is configured — typing a real search replaces it immediately, same as for anyone else.
  const [query, setQuery] = useState(placeName || (lat && lon ? `${lat}, ${lon}` : ''));
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setQuery(placeName || (lat && lon ? `${lat}, ${lon}` : ''));
    // Only when the underlying setting changes from OUTSIDE this component (e.g. store hydration
    // on launch) — not on every keystroke, which lives in local `query` state alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeName]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleChangeText = (text: string) => {
    setQuery(text);
    setErrorMsg(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      return;
    }
    const thisRequestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const lang = i18n.language === 'en' ? 'en' : 'de';
        const found = await searchPlaces(text.trim(), lang);
        // A slower earlier search resolving after a newer one would otherwise flash stale
        // results back in — only the most recent request may still write to state.
        if (thisRequestId !== requestIdRef.current) return;
        setResults(found);
        setErrorMsg(found.length === 0 ? t('household.weatherPlaceNoResults') : null);
      } catch {
        if (thisRequestId !== requestIdRef.current) return;
        setResults([]);
        setErrorMsg(t('household.weatherPlaceSearchFailed'));
      } finally {
        if (thisRequestId === requestIdRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
  };

  const handleSelect = (r: GeocodingResult) => {
    requestIdRef.current++; // invalidates any debounced search still in flight
    setQuery(r.name);
    setResults([]);
    setErrorMsg(null);
    onSelect({ lat: String(r.latitude), lon: String(r.longitude), placeName: r.name });
  };

  return (
    <View>
      <TextInput
        style={s.input}
        value={query}
        onChangeText={handleChangeText}
        placeholder={t('household.weatherPlacePlaceholder')}
        placeholderTextColor={colors.textMuted}
        autoCorrect={false}
      />
      {loading && <ActivityIndicator size="small" color={colors.brand} style={s.spinner} />}
      {errorMsg && <Text style={s.errorText}>{errorMsg}</Text>}
      {results.length > 0 && (
        <View style={s.resultsBox}>
          {results.map((r, i) => (
            <TouchableOpacity
              key={`${r.latitude}-${r.longitude}-${i}`}
              style={[s.resultRow, i === results.length - 1 && s.resultRowLast]}
              onPress={() => handleSelect(r)}
            >
              <Text style={s.resultName}>{r.name}</Text>
              <Text style={s.resultSub} numberOfLines={1}>{[r.admin1, r.country].filter(Boolean).join(', ')}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  input: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, ...typography.body, color: colors.text, borderWidth: 1, borderColor: colors.border },
  spinner: { marginTop: spacing.xs, alignSelf: 'flex-start' },
  errorText: { ...typography.xs, color: colors.error, marginTop: spacing.xs },
  resultsBox: { marginTop: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  resultRow: { padding: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultRowLast: { borderBottomWidth: 0 },
  resultName: { ...typography.body, color: colors.text, fontWeight: '600' },
  resultSub: { ...typography.xs, color: colors.textMuted, marginTop: 1 },
}); }
