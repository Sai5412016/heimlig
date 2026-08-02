// components/RecipeDetailModal.tsx — full view of a saved recipe: ingredients, cooking steps,
// and (if the recipe was imported from text or a photo) the original for reference while
// actually cooking, since the structured extraction can miss nuance in the instructions.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, radius, typography, type ColorPalette } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { Recipe } from '../lib/supabase';
import { getRecipeImageUrl } from '../lib/recipeAttachments';

export default function RecipeDetailModal({ recipe, onClose }: { recipe: Recipe | null; onClose: () => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const s = React.useMemo(() => makeStyles(colors), [colors]);
  const [showOriginal, setShowOriginal] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);

  useEffect(() => {
    setShowOriginal(false);
    setImageUrl(null);
  }, [recipe?.id]);

  const handleShowOriginal = async () => {
    if (showOriginal) { setShowOriginal(false); return; }
    setShowOriginal(true);
    if (recipe?.source_image_path && !imageUrl) {
      setLoadingImage(true);
      const url = await getRecipeImageUrl(recipe.source_image_path);
      setImageUrl(url);
      setLoadingImage(false);
    }
  };

  const hasOriginal = !!(recipe?.source_text || recipe?.source_image_path);
  const instructions = recipe?.instructions || [];

  return (
    <Modal visible={!!recipe} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={s.title}>{recipe?.name}</Text>

            <Text style={s.sectionLabel}>{t('recipeDetail.ingredientsLabel')}</Text>
            {(recipe?.ingredients || []).map((ing, idx) => (
              <View key={idx} style={s.ingRow}>
                <Text style={s.ingName}>{ing.name}</Text>
                {ing.quantity ? <Text style={s.ingQty}>{ing.quantity}</Text> : null}
              </View>
            ))}

            {instructions.length > 0 && (
              <>
                <Text style={[s.sectionLabel, { marginTop: spacing.lg }]}>{t('recipeDetail.stepsLabel')}</Text>
                {instructions.map((step, idx) => (
                  <View key={idx} style={s.stepRow}>
                    <Text style={s.stepNumber}>{idx + 1}</Text>
                    <Text style={s.stepText}>{step}</Text>
                  </View>
                ))}
              </>
            )}

            {hasOriginal && (
              <>
                <TouchableOpacity style={s.originalBtn} onPress={handleShowOriginal}>
                  <Text style={s.originalBtnText}>{showOriginal ? t('recipeDetail.hideOriginal') : t('recipeDetail.showOriginal')}</Text>
                </TouchableOpacity>
                {showOriginal && (
                  <View style={s.originalBox}>
                    {recipe?.source_text ? (
                      <Text style={s.originalText}>{recipe.source_text}</Text>
                    ) : loadingImage ? (
                      <ActivityIndicator color={colors.brand} />
                    ) : imageUrl ? (
                      <Image source={{ uri: imageUrl }} style={s.originalImage} resizeMode="contain" />
                    ) : (
                      <Text style={s.originalText}>{t('recipeDetail.originalLoadFailed')}</Text>
                    )}
                  </View>
                )}
              </>
            )}

            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Text style={s.closeBtnText}>{t('common.close')}</Text>
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl, maxHeight: '90%' },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.lg },
  title: { ...typography.h3, color: colors.text, marginBottom: spacing.md },
  sectionLabel: { ...typography.xs, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5, marginBottom: spacing.sm },
  ingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  ingName: { flex: 1, ...typography.body, color: colors.text },
  ingQty: { ...typography.sm, color: colors.textSecondary },
  stepRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, alignItems: 'flex-start' },
  stepNumber: { ...typography.sm, color: colors.textInverse, backgroundColor: colors.brand, width: 22, height: 22, borderRadius: 11, textAlign: 'center', lineHeight: 22, fontWeight: '700', overflow: 'hidden' },
  stepText: { flex: 1, ...typography.body, color: colors.text, lineHeight: 21 },
  originalBtn: { marginTop: spacing.lg, alignSelf: 'flex-start' },
  originalBtnText: { ...typography.sm, color: colors.brand, fontWeight: '600' },
  originalBox: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  originalText: { ...typography.sm, color: colors.textSecondary, lineHeight: 20 },
  originalImage: { width: '100%', height: 320, borderRadius: radius.md },
  closeBtn: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  closeBtnText: { ...typography.body, color: colors.text, fontWeight: '600' },
}); }
