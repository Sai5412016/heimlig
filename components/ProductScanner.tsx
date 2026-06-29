// components/ProductScanner.tsx — barcode scanner + Yuka-style health rating.
// Scans a product barcode with the camera (native) or via manual entry (web/fallback),
// looks it up in Open Food Facts and shows a 0–100 health score with a reasoned breakdown.

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView,
  ActivityIndicator, Platform, TextInput, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTheme } from '../hooks/useTheme';
import { spacing, radius, typography, shadow, type ColorPalette } from '../constants/theme';
import { fetchAndScore, type ScanResult } from '../lib/productScore';
import { useStore } from '../store/useStore';

type Mode = 'scan' | 'loading' | 'result';

export default function ProductScanner({ visible, onClose, onAddToList, onAddToPantry, initialBarcode }: {
  visible: boolean;
  onClose: () => void;
  onAddToList?: (name: string, brand?: string) => void;
  onAddToPantry?: (name: string, barcode?: string) => void;
  initialBarcode?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const saveScan = useStore(s => s.saveScan);
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<Mode>('scan');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [manualCode, setManualCode] = useState('');
  const scannedRef = useRef(false);

  const canUseCamera = Platform.OS !== 'web';

  const reset = () => { setMode('scan'); setResult(null); setManualCode(''); scannedRef.current = false; };
  const handleClose = () => { reset(); onClose(); };

  const lookup = useCallback(async (code: string) => {
    setMode('loading');
    const r = await fetchAndScore(code);
    setResult(r);
    setMode('result');
    if (r.found) saveScan(r);   // remember it in the household's scan history
  }, [saveScan]);

  // When opened on a specific product (e.g. tapping a history entry), look it up directly.
  useEffect(() => {
    if (visible && initialBarcode && !scannedRef.current) {
      scannedRef.current = true;
      lookup(initialBarcode);
    }
    if (!visible) reset();
  }, [visible, initialBarcode]);

  const onBarcode = useCallback(({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    lookup(data);
  }, [lookup]);

  const handleManual = () => {
    const c = manualCode.trim();
    if (c) lookup(c);
  };

  const handleAdd = () => {
    if (result?.info && onAddToList) {
      onAddToList(result.info.name, result.info.brand);
      handleClose();
    }
  };

  const handleAddPantry = () => {
    if (result?.info && onAddToPantry) {
      onAddToPantry(result.info.name, result.info.barcode);
      handleClose();
    }
  };

  // ── Camera / manual-entry screen ──
  const renderScan = () => {
    if (canUseCamera && !permission?.granted) {
      return (
        <View style={styles.centered}>
          <Text style={styles.bigEmoji}>📷</Text>
          <Text style={styles.title}>Kamera-Zugriff</Text>
          <Text style={styles.subtle}>Heimlig braucht die Kamera, um Produkt-Barcodes zu scannen.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
            <Text style={styles.primaryBtnText}>Kamera erlauben</Text>
          </TouchableOpacity>
          <ManualEntry />
        </View>
      );
    }
    return (
      <View style={styles.flex}>
        {canUseCamera ? (
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              onBarcodeScanned={mode === 'scan' ? onBarcode : undefined}
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] }}
            />
            <View style={styles.scanFrame} />
            <Text style={styles.scanHint}>Barcode in den Rahmen halten</Text>
          </View>
        ) : (
          <View style={styles.centered}>
            <Text style={styles.bigEmoji}>🔍</Text>
            <Text style={styles.title}>Barcode eingeben</Text>
            <Text style={styles.subtle}>Im Browser bitte die Barcode-Nummer manuell eingeben.</Text>
          </View>
        )}
        <ManualEntry />
      </View>
    );
  };

  const ManualEntry = () => (
    <View style={styles.manualBox}>
      <TextInput
        style={styles.manualInput}
        placeholder="Barcode-Nummer eingeben…"
        placeholderTextColor={colors.textMuted}
        value={manualCode}
        onChangeText={setManualCode}
        keyboardType="number-pad"
        returnKeyType="search"
        onSubmitEditing={handleManual}
      />
      <TouchableOpacity
        style={[styles.manualBtn, !manualCode.trim() && { opacity: 0.5 }]}
        onPress={handleManual}
        disabled={!manualCode.trim()}
      >
        <Text style={styles.manualBtnText}>Suchen</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Result screen ──
  const renderResult = () => {
    if (!result) return null;
    if (!result.found || !result.info || !result.rating) {
      return (
        <View style={styles.centered}>
          <Text style={styles.bigEmoji}>🤷</Text>
          <Text style={styles.title}>Produkt nicht gefunden</Text>
          <Text style={styles.subtle}>Dieses Produkt ist (noch) nicht in der Datenbank. Du kannst es trotzdem manuell zur Liste hinzufügen.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={reset}>
            <Text style={styles.primaryBtnText}>Erneut scannen</Text>
          </TouchableOpacity>
        </View>
      );
    }
    const { info, rating } = result;
    return (
      <ScrollView contentContainerStyle={styles.resultScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.productHeader}>
          {info.imageUrl ? (
            <Image source={{ uri: info.imageUrl }} style={styles.productImg} resizeMode="contain" />
          ) : (
            <View style={[styles.productImg, styles.productImgPlaceholder]}><Text style={{ fontSize: 30 }}>🛒</Text></View>
          )}
          <View style={styles.flex}>
            <Text style={styles.productName} numberOfLines={3}>{info.name}</Text>
            {info.brand ? <Text style={styles.productBrand}>{info.brand}</Text> : null}
          </View>
        </View>

        {/* Score gauge */}
        <View style={styles.scoreRow}>
          <View style={[styles.scoreCircle, { borderColor: rating.color }]}>
            <Text style={[styles.scoreNum, { color: rating.color }]}>{rating.score}</Text>
            <Text style={styles.scoreMax}>/100</Text>
          </View>
          <View style={styles.flex}>
            <Text style={[styles.ratingLabel, { color: rating.color }]}>{rating.label}</Text>
            {rating.limited && <Text style={styles.limitedNote}>⚠️ Wenig Daten – Bewertung unsicher</Text>}
            <View style={styles.badgeRow}>
              {info.nutriScore && (
                <View style={[styles.nutriBadge, { backgroundColor: nutriColor(info.nutriScore) }]}>
                  <Text style={styles.nutriBadgeText}>Nutri-Score {info.nutriScore.toUpperCase()}</Text>
                </View>
              )}
              {info.novaGroup ? (
                <View style={styles.novaBadge}>
                  <Text style={styles.novaBadgeText}>NOVA {info.novaGroup}</Text>
                </View>
              ) : null}
              {info.organic && (
                <View style={styles.bioBadge}><Text style={styles.bioBadgeText}>🌱 Bio</Text></View>
              )}
            </View>
          </View>
        </View>

        {/* Breakdown */}
        {rating.negatives.length > 0 && (
          <View style={styles.breakSection}>
            <Text style={styles.breakTitle}>Negativ</Text>
            {rating.negatives.map((t, i) => (
              <View key={i} style={styles.breakRow}><Text style={styles.breakBad}>✕</Text><Text style={styles.breakText}>{t}</Text></View>
            ))}
          </View>
        )}
        {rating.positives.length > 0 && (
          <View style={styles.breakSection}>
            <Text style={styles.breakTitle}>Positiv</Text>
            {rating.positives.map((t, i) => (
              <View key={i} style={styles.breakRow}><Text style={styles.breakGood}>✓</Text><Text style={styles.breakText}>{t}</Text></View>
            ))}
          </View>
        )}

        {info.additives.length > 0 && (
          <View style={styles.breakSection}>
            <Text style={styles.breakTitle}>Zusatzstoffe ({info.additives.length})</Text>
            <Text style={styles.additivesText}>{info.additives.join(' · ')}</Text>
          </View>
        )}

        {info.ingredients ? (
          <View style={styles.breakSection}>
            <Text style={styles.breakTitle}>Zutaten</Text>
            <Text style={styles.ingredientsText}>{info.ingredients}</Text>
          </View>
        ) : null}

        <Text style={styles.disclaimer}>Daten: Open Food Facts. Bewertung ist eine unabhängige Orientierung, keine medizinische Beratung.</Text>

        <View style={styles.resultBtns}>
          <TouchableOpacity style={[styles.primaryBtn, styles.flex, { backgroundColor: colors.border }]} onPress={reset}>
            <Text style={[styles.primaryBtnText, { color: colors.text }]}>Erneut scannen</Text>
          </TouchableOpacity>
          {onAddToPantry && (
            <TouchableOpacity style={[styles.primaryBtn, styles.flex, { backgroundColor: colors.accent }]} onPress={handleAddPantry}>
              <Text style={styles.primaryBtnText}>In Vorrat</Text>
            </TouchableOpacity>
          )}
          {onAddToList && (
            <TouchableOpacity style={[styles.primaryBtn, styles.flex]} onPress={handleAdd}>
              <Text style={styles.primaryBtnText}>Zur Liste</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Text style={styles.topTitle}>Produkt scannen</Text>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.closeX}>✕</Text>
          </TouchableOpacity>
        </View>
        {mode === 'loading' ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={styles.subtle}>Produkt wird geprüft…</Text>
          </View>
        ) : mode === 'result' ? renderResult() : renderScan()}
      </SafeAreaView>
    </Modal>
  );
}

function nutriColor(grade: string): string {
  switch (grade.toLowerCase()) {
    case 'a': return '#2D9E57';
    case 'b': return '#8BC34A';
    case 'c': return '#F5C518';
    case 'd': return '#F5A623';
    default: return '#E5573F';
  }
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  topTitle: { ...typography.h3, color: colors.text },
  closeX: { fontSize: 22, color: colors.textSecondary, fontWeight: '600' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  bigEmoji: { fontSize: 56 },
  title: { ...typography.h2, color: colors.text, textAlign: 'center' },
  subtle: { ...typography.sm, color: colors.textSecondary, textAlign: 'center' },
  cameraWrap: { flex: 1, margin: spacing.md, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  scanFrame: { width: '70%', height: 130, borderWidth: 3, borderColor: '#fff', borderRadius: radius.md, opacity: 0.9 },
  scanHint: { position: 'absolute', bottom: spacing.lg, color: '#fff', ...typography.sm, fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full },
  manualBox: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  manualInput: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, ...typography.body, color: colors.text, borderWidth: 1, borderColor: colors.border },
  manualBtn: { backgroundColor: colors.brand, borderRadius: radius.md, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  manualBtnText: { ...typography.body, color: '#fff', fontWeight: '700' },
  primaryBtn: { backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, alignItems: 'center' },
  primaryBtnText: { ...typography.body, color: '#fff', fontWeight: '700' },
  resultScroll: { padding: spacing.lg, gap: spacing.md },
  productHeader: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  productImg: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surface },
  productImgPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  productName: { ...typography.h3, color: colors.text },
  productBrand: { ...typography.sm, color: colors.textSecondary, marginTop: 2 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, ...shadow.sm },
  scoreCircle: { width: 84, height: 84, borderRadius: 42, borderWidth: 6, alignItems: 'center', justifyContent: 'center' },
  scoreNum: { fontSize: 30, fontWeight: '800' },
  scoreMax: { ...typography.xs, color: colors.textMuted, marginTop: -2 },
  ratingLabel: { ...typography.h2 },
  limitedNote: { ...typography.xs, color: colors.textMuted, marginTop: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  nutriBadge: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  nutriBadgeText: { ...typography.xs, color: '#fff', fontWeight: '700' },
  novaBadge: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3, backgroundColor: colors.border },
  novaBadgeText: { ...typography.xs, color: colors.text, fontWeight: '700' },
  bioBadge: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3, backgroundColor: colors.brandPale },
  bioBadgeText: { ...typography.xs, color: colors.brand, fontWeight: '700' },
  breakSection: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, ...shadow.sm },
  breakTitle: { ...typography.label, color: colors.textMuted, marginBottom: spacing.sm, textTransform: 'uppercase' },
  breakRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 3 },
  breakGood: { color: '#2D9E57', fontWeight: '800', fontSize: 15, width: 18, textAlign: 'center' },
  breakBad: { color: '#E5573F', fontWeight: '800', fontSize: 15, width: 18, textAlign: 'center' },
  breakText: { ...typography.body, color: colors.text, flex: 1 },
  additivesText: { ...typography.sm, color: colors.textSecondary },
  ingredientsText: { ...typography.sm, color: colors.textSecondary, lineHeight: 20 },
  disclaimer: { ...typography.xs, color: colors.textMuted, textAlign: 'center', paddingHorizontal: spacing.md },
  resultBtns: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
}); }
