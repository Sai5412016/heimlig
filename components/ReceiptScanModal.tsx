// components/ReceiptScanModal.tsx — photograph a receipt (Kassenzettel), let Claude Vision
// read amount/category/date/store name off it, then show an editable draft (same idea as
// RecipeImportModal) so the user confirms before anything is saved as a budget entry.
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Modal, Pressable, ScrollView, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { Alert } from '../lib/alert';
import { useTranslation } from 'react-i18next';
import { colors, spacing, radius, typography, type ColorPalette } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabase';
import { currencySymbol } from '../lib/currency';
import { format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import { ALL_CATEGORIES, CAT_EMOJIS, CAT_COLORS, categoryLabel } from '../lib/budgetCategories';
import PayerPicker from './PayerPicker';
import AiQuotaHint from './AiQuotaHint';
import PremiumModal from './PremiumModal';
import AiQuotaWallModal from './AiQuotaWallModal';
import { readAiLimitError } from '../lib/aiUsage';

export interface ReceiptDraft {
  amount: number; description?: string; category: string; date: string;
  imageBase64: string; imageMimeType: string;
  // null = "gemeinsam" (stored as member_id IS NULL). Previously this screen had no payer
  // choice at all and the caller hard-wired the current member, so a scanned receipt could
  // never be booked as a shared expense.
  memberId: string | null;
}

export default function ReceiptScanModal({ visible, onClose, onConfirm }: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (draft: ReceiptDraft) => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const language = useStore(state => state.language);
  const household = useStore(state => state.household);
  const members = useStore(state => state.members);
  const currentMember = useStore(state => state.currentMember);
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [step, setStep] = useState<'pick' | 'review'>('pick');
  const [loading, setLoading] = useState(false);
  const [imageB64, setImageB64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState('image/jpeg');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Lebensmittel');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paidBy, setPaidBy] = useState<string | null>(currentMember?.id ?? null);
  const [showPremium, setShowPremium] = useState(false);
  // Non-null while the quota wall is up; carries the numbers the server rejected with,
  // so the wall shows what was actually counted rather than a locally guessed figure.
  const [quotaWall, setQuotaWall] = useState<{ used: number; limit: number } | null>(null);

  const reset = () => {
    setStep('pick'); setImageB64(null); setImageMime('image/jpeg');
    setAmount(''); setDescription(''); setCategory('Lebensmittel'); setDate(format(new Date(), 'yyyy-MM-dd'));
    setPaidBy(currentMember?.id ?? null);
  };

  useEffect(() => { if (!visible) reset(); }, [visible]);

  const pickAndExtract = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.6,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    if (!asset.base64) return;
    const mime = asset.mimeType || 'image/jpeg';
    setImageB64(asset.base64);
    setImageMime(mime);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-receipt', {
        // householdId is what lets the server count this against the shared AI quota — without
        // it the edge function deliberately fails open and the scan wouldn't be metered at all.
        body: { imageBase64: asset.base64, imageMediaType: mime, householdId: household?.id },
      });
      if (error) throw error;
      setAmount(data.amount != null ? String(data.amount).replace('.', language === 'en' ? '.' : ',') : '');
      setDescription(data.description || '');
      setCategory(data.category || 'Lebensmittel');
      setDate(data.date || format(new Date(), 'yyyy-MM-dd'));
      setStep('review');
    } catch (e: any) {
      const limit = await readAiLimitError(e);
      if (limit) {
        setQuotaWall({ used: limit.used, limit: limit.limit });
      } else {
        Alert.alert(t('common.error'), t('receiptScan.extractErrorBody'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    const num = language === 'en'
      ? parseFloat(amount.replace(/,/g, ''))
      : parseFloat(amount.replace(/\./g, '').replace(',', '.'));
    if (!num || isNaN(num) || !imageB64) return;
    onConfirm({ amount: num, description: description.trim() || undefined, category, date, imageBase64: imageB64, imageMimeType: imageMime, memberId: paidBy });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[s.overlay, Platform.OS === 'web' && { justifyContent: 'flex-start' }]}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} onPress={onClose} />
          <View style={[s.sheet, { maxHeight: Platform.OS === 'web' ? '100%' : '90%' }]}>
            <View style={s.handle} />
            <Text style={s.title}>{t('receiptScan.title')}</Text>

            {step === 'pick' ? (
              <>
                <AiQuotaHint refreshKey={visible} />
                <TouchableOpacity style={s.imagePick} onPress={pickAndExtract} disabled={loading}>
                  <Text style={s.imagePickText}>{loading ? t('receiptScan.extracting') : t('receiptScan.pickPlaceholder')}</Text>
                </TouchableOpacity>
                <Text style={s.hint}>{t('receiptScan.hint')}</Text>
              </>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {imageB64 && (
                  <Image source={{ uri: `data:${imageMime};base64,${imageB64}` }} style={s.preview} resizeMode="cover" />
                )}

                <Text style={s.fieldLabel}>{t('budget.amountPlaceholder')}</Text>
                <View style={s.amountRow}>
                  <Text style={s.currencySymbol}>{currencySymbol(household?.currency)}</Text>
                  <TextInput style={s.amountInput} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholderTextColor={colors.textMuted} />
                </View>

                <Text style={s.fieldLabel}>{t('budget.descriptionPlaceholder')}</Text>
                <TextInput style={s.input} value={description} onChangeText={setDescription} placeholderTextColor={colors.textMuted} />

                <Text style={s.fieldLabel}>{t('budget.datePlaceholder')}</Text>
                <TextInput style={s.input} value={date} onChangeText={setDate} placeholderTextColor={colors.textMuted} />

                <Text style={s.fieldLabel}>{t('common.category')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                  {ALL_CATEGORIES.map(cat => {
                    const isActive = cat === category;
                    const catColor = CAT_COLORS[cat] || colors.brand;
                    return (
                      <TouchableOpacity key={cat} style={[s.catChip, isActive && { backgroundColor: catColor, borderColor: catColor }]} onPress={() => setCategory(cat)}>
                        <Text style={s.catChipEmoji}>{CAT_EMOJIS[cat]}</Text>
                        <Text style={[s.catChipText, isActive && { color: colors.textInverse }]}>{categoryLabel(t, cat)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <PayerPicker members={members} value={paidBy} onChange={setPaidBy} />

                <TouchableOpacity style={[s.addBtn, !amount && s.addBtnDisabled]} onPress={handleConfirm} disabled={!amount}>
                  <Text style={s.addBtnText}>{t('receiptScan.saveButton')}</Text>
                </TouchableOpacity>
                <View style={{ height: 20 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
      <AiQuotaWallModal
        visible={!!quotaWall}
        used={quotaWall?.used ?? 0}
        limit={quotaWall?.limit ?? 0}
        source="receipt_scan"
        onClose={() => setQuotaWall(null)}
        // Wall closes before the premium sheet opens — two Modals visible at once is
        // unreliable on Android.
        onUpgrade={() => { setQuotaWall(null); setShowPremium(true); }}
      />
      <PremiumModal visible={showPremium} onClose={() => setShowPremium(false)} />
    </Modal>
  );
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.lg },
  title: { ...typography.h3, color: colors.text, marginBottom: spacing.md },
  imagePick: { borderWidth: 1.5, borderColor: colors.brand, borderStyle: 'dashed', borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', backgroundColor: colors.brandPale, marginBottom: spacing.sm },
  imagePickText: { ...typography.body, color: colors.brand, fontWeight: '700' },
  hint: { ...typography.xs, color: colors.textMuted, marginBottom: spacing.sm },
  preview: { width: '100%', height: 160, borderRadius: radius.md, marginBottom: spacing.md },
  fieldLabel: { ...typography.xs, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, ...typography.body, color: colors.text, borderWidth: 1, borderColor: colors.border },
  amountRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md },
  currencySymbol: { ...typography.h3, color: colors.textSecondary, marginRight: spacing.xs },
  amountInput: { flex: 1, ...typography.h3, color: colors.text, paddingVertical: spacing.md },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, marginRight: spacing.sm, backgroundColor: colors.surface },
  catChipEmoji: { fontSize: 14 },
  catChipText: { ...typography.sm, color: colors.textSecondary, fontWeight: '600' },
  addBtn: { backgroundColor: colors.brand, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { ...typography.body, color: colors.textInverse, fontWeight: '700' },
}); }
