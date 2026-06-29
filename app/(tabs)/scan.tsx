// app/(tabs)/scan.tsx — "Gesund" tab: scan products, see their health score, browse history.
import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { spacing, radius, typography, shadow, type ColorPalette } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useStore } from '../../store/useStore';
import { categoryForItem } from '../../lib/groceries';
import ProductScanner from '../../components/ProductScanner';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function scoreColor(score?: number | null): string {
  if (score == null) return '#9AB5A0';
  if (score >= 75) return '#2D9E57';
  if (score >= 50) return '#8BC34A';
  if (score >= 25) return '#F5A623';
  return '#E5573F';
}

export default function ScanScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { scanHistory, loadScanHistory, deleteScan, activeListId, addItem } = useStore();
  const [showScanner, setShowScanner] = useState(false);
  const [openBarcode, setOpenBarcode] = useState<string | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { loadScanHistory(); }, []));

  const onRefresh = async () => { setRefreshing(true); await loadScanHistory(); setRefreshing(false); };

  const openScanner = () => { setOpenBarcode(undefined); setShowScanner(true); };
  const openHistory = (barcode: string) => { setOpenBarcode(barcode); setShowScanner(true); };

  const handleAddToList = async (name: string, brand?: string) => {
    if (!activeListId) return;
    const cat = categoryForItem(name) || 'Lebensmittel';
    await addItem(activeListId, name, undefined, cat, undefined, brand);
  };

  const confirmDelete = (id: string, name: string) => {
    Alert.alert('Aus Verlauf entfernen?', name, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Entfernen', style: 'destructive', onPress: () => deleteScan(id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🥗 Gesund</Text>
          <Text style={styles.headerSub}>Produkte scannen & Bewertung prüfen</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        <TouchableOpacity style={styles.scanCard} onPress={openScanner} activeOpacity={0.9}>
          <Text style={styles.scanCardEmoji}>📷</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.scanCardTitle}>Produkt scannen</Text>
            <Text style={styles.scanCardSub}>Barcode scannen → Gesundheitsbewertung 0–100</Text>
          </View>
          <Text style={styles.scanCardArrow}>›</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>VERLAUF</Text>

        {scanHistory.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyTitle}>Noch nichts gescannt</Text>
            <Text style={styles.emptyBody}>Scanne dein erstes Produkt, um die Gesundheitsbewertung zu sehen.</Text>
          </View>
        ) : (
          scanHistory.map(h => (
            <TouchableOpacity
              key={h.id}
              style={styles.histRow}
              onPress={() => openHistory(h.barcode)}
              onLongPress={() => confirmDelete(h.id, h.name)}
              activeOpacity={0.7}
            >
              {h.image_url ? (
                <Image source={{ uri: h.image_url }} style={styles.histImg} resizeMode="contain" />
              ) : (
                <View style={[styles.histImg, styles.histImgPlaceholder]}><Text style={{ fontSize: 22 }}>🛒</Text></View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.histName} numberOfLines={2}>{h.name}</Text>
                {h.brand ? <Text style={styles.histBrand} numberOfLines={1}>{h.brand}</Text> : null}
                <Text style={styles.histDate}>{format(parseISO(h.created_at), 'dd. MMM yyyy', { locale: de })}</Text>
              </View>
              <View style={[styles.histScore, { borderColor: scoreColor(h.score) }]}>
                <Text style={[styles.histScoreNum, { color: scoreColor(h.score) }]}>{h.score ?? '–'}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      <ProductScanner
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onAddToList={activeListId ? handleAddToList : undefined}
        initialBarcode={openBarcode}
      />
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { ...typography.h2, color: colors.text },
  headerSub: { ...typography.sm, color: colors.textSecondary, marginTop: 2 },
  scroll: { padding: spacing.lg },
  scanCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.brand, borderRadius: radius.lg, padding: spacing.lg, ...shadow.md, marginBottom: spacing.lg },
  scanCardEmoji: { fontSize: 32 },
  scanCardTitle: { ...typography.h3, color: '#fff' },
  scanCardSub: { ...typography.sm, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  scanCardArrow: { fontSize: 28, color: 'rgba(255,255,255,0.9)', fontWeight: '300' },
  sectionLabel: { ...typography.label, color: colors.textMuted, marginBottom: spacing.sm, textTransform: 'uppercase' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { ...typography.h3, color: colors.text },
  emptyBody: { ...typography.sm, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.lg },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm },
  histImg: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.background },
  histImgPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  histName: { ...typography.body, color: colors.text, fontWeight: '600' },
  histBrand: { ...typography.xs, color: colors.textSecondary, marginTop: 1 },
  histDate: { ...typography.xs, color: colors.textMuted, marginTop: 2 },
  histScore: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  histScoreNum: { ...typography.body, fontWeight: '800' },
}); }
