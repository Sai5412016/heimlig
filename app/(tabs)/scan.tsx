// app/(tabs)/scan.tsx — "Gesund" tab: scan products (health score + history) and manage the pantry.
import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, RefreshControl, TextInput, Modal, Pressable,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { spacing, radius, typography, shadow, type ColorPalette } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useStore } from '../../store/useStore';
import { categoryForItem } from '../../lib/groceries';
import ThemeMotif from '../../components/ThemeMotif';
import ProductScanner from '../../components/ProductScanner';
import type { PantryItem } from '../../lib/supabase';
import { format, parseISO, addDays, type Locale } from 'date-fns';
import { de, enUS } from 'date-fns/locale';

function scoreColor(score?: number | null): string {
  if (score == null) return '#9AB5A0';
  if (score >= 75) return '#2D9E57';
  if (score >= 50) return '#8BC34A';
  if (score >= 25) return '#F5A623';
  return '#E5573F';
}

function daysUntil(d: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const e = parseISO(d); e.setHours(0, 0, 0, 0);
  return Math.round((e.getTime() - today.getTime()) / 86400000);
}

function expiryInfo(d: string | undefined, colors: ColorPalette, t: TFunction, dateLocale: Locale): { text: string; color: string } {
  if (!d) return { text: t('scanTab.noExpiry'), color: colors.textMuted };
  const n = daysUntil(d);
  if (n < 0) return { text: t('scanTab.expiredDays', { days: Math.abs(n) }), color: '#E5573F' };
  if (n === 0) return { text: t('scanTab.expiresToday'), color: '#F5A623' };
  if (n <= 3) return { text: t(n === 1 ? 'scanTab.expiresInDays_one' : 'scanTab.expiresInDays_other', { count: n }), color: '#F5A623' };
  return { text: format(parseISO(d), 'dd.MM.yyyy', { locale: dateLocale }), color: colors.textSecondary };
}

function expiryOptions(t: TFunction): { label: string; days: number | null }[] {
  return [
    { label: t('scanTab.expiryNone'), days: null },
    { label: t('scanTab.expiry3days'), days: 3 },
    { label: t('scanTab.expiry1week'), days: 7 },
    { label: t('scanTab.expiry2weeks'), days: 14 },
    { label: t('scanTab.expiry1month'), days: 30 },
  ];
}

export default function ScanScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const language = useStore(s => s.language);
  const dateLocale = language === 'en' ? enUS : de;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const {
    scanHistory, loadScanHistory, deleteScan, activeListId, addItem,
    pantry, loadPantry, addPantryItem, setPantryExpiry, deletePantryItem,
  } = useStore();
  const [tab, setTab] = useState<'history' | 'pantry'>('history');
  const [showScanner, setShowScanner] = useState(false);
  const [openBarcode, setOpenBarcode] = useState<string | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [expiryTarget, setExpiryTarget] = useState<PantryItem | null>(null);

  useFocusEffect(useCallback(() => { loadScanHistory(); loadPantry(); }, []));

  const onRefresh = async () => { setRefreshing(true); await Promise.all([loadScanHistory(), loadPantry()]); setRefreshing(false); };

  const openScanner = () => { setOpenBarcode(undefined); setShowScanner(true); };
  const openHistory = (barcode: string) => { setOpenBarcode(barcode); setShowScanner(true); };

  const handleAddToList = async (name: string, brand?: string) => {
    if (!activeListId) return;
    const cat = categoryForItem(name) || 'Lebensmittel';
    await addItem(activeListId, name, undefined, cat, undefined, brand);
  };

  const handleAddToPantry = async (name: string, barcode?: string) => {
    await addPantryItem(name, undefined, null, barcode);
  };

  const handleManualPantryAdd = async () => {
    if (!newItem.trim()) return;
    await addPantryItem(newItem.trim());
    setNewItem('');
  };

  const confirmDeleteScan = (id: string, name: string) => {
    Alert.alert(t('scanTab.removeFromHistoryTitle'), name, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('household.removeButton'), style: 'destructive', onPress: () => deleteScan(id) },
    ]);
  };

  const pickExpiry = async (days: number | null) => {
    if (!expiryTarget) return;
    const date = days == null ? null : format(addDays(new Date(), days), 'yyyy-MM-dd');
    await setPantryExpiry(expiryTarget.id, date);
    setExpiryTarget(null);
  };

  const renderHistory = () => (
    scanHistory.length === 0 ? (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>🔍</Text>
        <Text style={styles.emptyTitle}>{t('scanTab.historyEmptyTitle')}</Text>
        <Text style={styles.emptyBody}>{t('scanTab.historyEmptyBody')}</Text>
        <TouchableOpacity style={styles.emptyCta} onPress={openScanner}>
          <Text style={styles.emptyCtaText}>{t('scanTab.scanNowButton')}</Text>
        </TouchableOpacity>
      </View>
    ) : (
      scanHistory.map(h => (
        <TouchableOpacity key={h.id} style={styles.histRow} onPress={() => openHistory(h.barcode)} onLongPress={() => confirmDeleteScan(h.id, h.name)} activeOpacity={0.7}>
          {h.image_url ? (
            <Image source={{ uri: h.image_url }} style={styles.histImg} resizeMode="contain" />
          ) : (
            <View style={[styles.histImg, styles.histImgPlaceholder]}><Text style={{ fontSize: 22 }}>🛒</Text></View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.histName} numberOfLines={2}>{h.name}</Text>
            {h.brand ? <Text style={styles.histBrand} numberOfLines={1}>{h.brand}</Text> : null}
            <Text style={styles.histDate}>{format(parseISO(h.created_at), 'dd. MMM yyyy', { locale: dateLocale })}</Text>
          </View>
          <View style={[styles.histScore, { borderColor: scoreColor(h.score) }]}>
            <Text style={[styles.histScoreNum, { color: scoreColor(h.score) }]}>{h.score ?? '–'}</Text>
          </View>
        </TouchableOpacity>
      ))
    )
  );

  const renderPantry = () => (
    <>
      <View style={styles.pantryAddRow}>
        <TextInput
          style={styles.pantryInput}
          placeholder={t('scanTab.pantryPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={newItem}
          onChangeText={setNewItem}
          returnKeyType="done"
          onSubmitEditing={handleManualPantryAdd}
        />
        <TouchableOpacity style={[styles.pantryAddBtn, !newItem.trim() && { opacity: 0.5 }]} onPress={handleManualPantryAdd} disabled={!newItem.trim()}>
          <Text style={styles.pantryAddBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {pantry.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🧊</Text>
          <Text style={styles.emptyTitle}>{t('scanTab.pantryEmptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('scanTab.pantryEmptyBody')}</Text>
        </View>
      ) : (
        pantry.map(p => {
          const exp = expiryInfo(p.expiry_date, colors, t, dateLocale);
          return (
            <View key={p.id} style={styles.pantryRow}>
              <Text style={styles.pantryEmoji}>{p.emoji ?? '🍽️'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.pantryName} numberOfLines={1}>{p.name}</Text>
                <TouchableOpacity onPress={() => setExpiryTarget(p)}>
                  <Text style={[styles.pantryExpiry, { color: exp.color }]}>⏳ {exp.text} · {t('scanTab.changeLabel')}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => deletePantryItem(p.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.trash}>🗑</Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={styles.headerTitle}>🥗 {t('tabs.scan')}</Text>
            <ThemeMotif />
          </View>
          <Text style={styles.headerSub}>{t('scanTab.headerSub')}</Text>
        </View>
      </View>

      <View style={styles.segment}>
        <TouchableOpacity style={[styles.segBtn, tab === 'history' && styles.segBtnActive]} onPress={() => setTab('history')}>
          <Text style={[styles.segText, tab === 'history' && styles.segTextActive]}>{t('scanTab.historyTab')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.segBtn, tab === 'pantry' && styles.segBtnActive]} onPress={() => setTab('pantry')}>
          <Text style={[styles.segText, tab === 'pantry' && styles.segTextActive]}>{t('scanTab.pantryTab')}{pantry.length ? ` (${pantry.length})` : ''}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        <TouchableOpacity style={styles.scanCard} onPress={openScanner} activeOpacity={0.9}>
          <Text style={styles.scanCardEmoji}>📷</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.scanCardTitle}>{t('scanner.topTitle')}</Text>
            <Text style={styles.scanCardSub}>{t('scanTab.scanCardSub')}</Text>
          </View>
          <Text style={styles.scanCardArrow}>›</Text>
        </TouchableOpacity>

        {tab === 'history' ? renderHistory() : renderPantry()}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      <ProductScanner
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onAddToList={activeListId ? handleAddToList : undefined}
        onAddToPantry={handleAddToPantry}
        initialBarcode={openBarcode}
      />

      {/* Expiry quick-pick */}
      <Modal visible={!!expiryTarget} transparent animationType="fade" onRequestClose={() => setExpiryTarget(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setExpiryTarget(null)}>
          <Pressable style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{t('scanTab.expiryModalTitle', { name: expiryTarget?.name })}</Text>
            {expiryOptions(t).map(o => (
              <TouchableOpacity key={o.label} style={styles.expOption} onPress={() => pickExpiry(o.days)}>
                <Text style={styles.expOptionText}>{o.label}{o.days ? ` (${format(addDays(new Date(), o.days), 'dd.MM.', { locale: dateLocale })})` : ''}</Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { ...typography.h2, color: colors.text },
  headerSub: { ...typography.sm, color: colors.textSecondary, marginTop: 2 },
  segment: { flexDirection: 'row', backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  segBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center', backgroundColor: colors.background },
  segBtnActive: { backgroundColor: colors.brand },
  segText: { ...typography.sm, color: colors.textSecondary, fontWeight: '700' },
  segTextActive: { color: colors.textInverse },
  scroll: { padding: spacing.lg },
  scanCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.brand, borderRadius: radius.lg, padding: spacing.lg, ...shadow.md, marginBottom: spacing.lg },
  scanCardEmoji: { fontSize: 32 },
  scanCardTitle: { ...typography.h3, color: colors.textInverse },
  scanCardSub: { ...typography.sm, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  scanCardArrow: { fontSize: 28, color: 'rgba(255,255,255,0.9)', fontWeight: '300' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { ...typography.h3, color: colors.text },
  emptyBody: { ...typography.sm, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.lg },
  emptyCta: { marginTop: spacing.sm, backgroundColor: colors.brand, borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  emptyCtaText: { ...typography.sm, color: colors.textInverse, fontWeight: '700' },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm },
  histImg: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.background },
  histImgPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  histName: { ...typography.body, color: colors.text, fontWeight: '600' },
  histBrand: { ...typography.xs, color: colors.textSecondary, marginTop: 1 },
  histDate: { ...typography.xs, color: colors.textMuted, marginTop: 2 },
  histScore: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  histScoreNum: { ...typography.body, fontWeight: '800' },
  pantryAddRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  pantryInput: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, ...typography.body, color: colors.text, borderWidth: 1, borderColor: colors.border },
  pantryAddBtn: { width: 48, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  pantryAddBtnText: { color: colors.textInverse, fontSize: 26, fontWeight: '300' },
  pantryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm },
  pantryEmoji: { fontSize: 24 },
  pantryName: { ...typography.body, color: colors.text, fontWeight: '600' },
  pantryExpiry: { ...typography.xs, fontWeight: '600', marginTop: 2 },
  trash: { fontSize: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg },
  modalSheet: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, ...shadow.lg },
  modalTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.md },
  expOption: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  expOptionText: { ...typography.body, color: colors.text },
}); }
