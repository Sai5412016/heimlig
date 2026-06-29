// app/(tabs)/scan.tsx — "Gesund" tab: scan products (health score + history) and manage the pantry.
import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, RefreshControl, TextInput, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { spacing, radius, typography, shadow, type ColorPalette } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useStore } from '../../store/useStore';
import { categoryForItem } from '../../lib/groceries';
import ProductScanner from '../../components/ProductScanner';
import type { PantryItem } from '../../lib/supabase';
import { format, parseISO, addDays } from 'date-fns';
import { de } from 'date-fns/locale';

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

function expiryInfo(d: string | undefined, colors: ColorPalette): { text: string; color: string } {
  if (!d) return { text: 'Kein Ablaufdatum', color: colors.textMuted };
  const n = daysUntil(d);
  if (n < 0) return { text: `Abgelaufen (${Math.abs(n)} T)`, color: '#E5573F' };
  if (n === 0) return { text: 'Läuft heute ab', color: '#F5A623' };
  if (n <= 3) return { text: `in ${n} Tag${n === 1 ? '' : 'en'}`, color: '#F5A623' };
  return { text: format(parseISO(d), 'dd.MM.yyyy', { locale: de }), color: colors.textSecondary };
}

const EXPIRY_OPTIONS: { label: string; days: number | null }[] = [
  { label: 'Kein', days: null },
  { label: '+3 Tage', days: 3 },
  { label: '+1 Woche', days: 7 },
  { label: '+2 Wochen', days: 14 },
  { label: '+1 Monat', days: 30 },
];

export default function ScanScreen() {
  const { colors } = useTheme();
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
    Alert.alert('Aus Verlauf entfernen?', name, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Entfernen', style: 'destructive', onPress: () => deleteScan(id) },
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
        <Text style={styles.emptyTitle}>Noch nichts gescannt</Text>
        <Text style={styles.emptyBody}>Scanne dein erstes Produkt, um die Gesundheitsbewertung zu sehen.</Text>
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
            <Text style={styles.histDate}>{format(parseISO(h.created_at), 'dd. MMM yyyy', { locale: de })}</Text>
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
          placeholder="Lebensmittel hinzufügen…"
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
          <Text style={styles.emptyTitle}>Vorrat ist leer</Text>
          <Text style={styles.emptyBody}>Füge Lebensmittel hinzu oder scanne sie – mit Ablaufdatum warnt dich die App rechtzeitig.</Text>
        </View>
      ) : (
        pantry.map(p => {
          const exp = expiryInfo(p.expiry_date, colors);
          return (
            <View key={p.id} style={styles.pantryRow}>
              <Text style={styles.pantryEmoji}>{p.emoji ?? '🍽️'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.pantryName} numberOfLines={1}>{p.name}</Text>
                <TouchableOpacity onPress={() => setExpiryTarget(p)}>
                  <Text style={[styles.pantryExpiry, { color: exp.color }]}>⏳ {exp.text} · ändern</Text>
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
          <Text style={styles.headerTitle}>🥗 Gesund</Text>
          <Text style={styles.headerSub}>Scannen, bewerten & Vorrat im Blick</Text>
        </View>
      </View>

      <View style={styles.segment}>
        <TouchableOpacity style={[styles.segBtn, tab === 'history' && styles.segBtnActive]} onPress={() => setTab('history')}>
          <Text style={[styles.segText, tab === 'history' && styles.segTextActive]}>Verlauf</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.segBtn, tab === 'pantry' && styles.segBtnActive]} onPress={() => setTab('pantry')}>
          <Text style={[styles.segText, tab === 'pantry' && styles.segTextActive]}>Vorrat{pantry.length ? ` (${pantry.length})` : ''}</Text>
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
            <Text style={styles.scanCardTitle}>Produkt scannen</Text>
            <Text style={styles.scanCardSub}>Bewertung 0–100 · in Vorrat oder Liste</Text>
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
            <Text style={styles.modalTitle}>Ablaufdatum für „{expiryTarget?.name}"</Text>
            {EXPIRY_OPTIONS.map(o => (
              <TouchableOpacity key={o.label} style={styles.expOption} onPress={() => pickExpiry(o.days)}>
                <Text style={styles.expOptionText}>{o.label}{o.days ? ` (${format(addDays(new Date(), o.days), 'dd.MM.', { locale: de })})` : ''}</Text>
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
  segTextActive: { color: '#fff' },
  scroll: { padding: spacing.lg },
  scanCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.brand, borderRadius: radius.lg, padding: spacing.lg, ...shadow.md, marginBottom: spacing.lg },
  scanCardEmoji: { fontSize: 32 },
  scanCardTitle: { ...typography.h3, color: '#fff' },
  scanCardSub: { ...typography.sm, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  scanCardArrow: { fontSize: 28, color: 'rgba(255,255,255,0.9)', fontWeight: '300' },
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
  pantryAddRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  pantryInput: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, ...typography.body, color: colors.text, borderWidth: 1, borderColor: colors.border },
  pantryAddBtn: { width: 48, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  pantryAddBtnText: { color: '#fff', fontSize: 26, fontWeight: '300' },
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
