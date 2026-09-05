// components/SuggestionCarousel.tsx — the row of starter cards in an empty shopping/task list.
//
// Horizontally scrollable so eight cards fit on a phone without pushing the rest of the empty
// state off screen. Each card offers exactly two actions: add this, or make this one go away.
// Renders nothing once every card has been dismissed — an empty carousel would leave a labelled
// void where suggestions used to be.
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { spacing, radius, typography, type ColorPalette } from '../constants/theme';

export interface CarouselCard {
  key: string;
  emoji: string;
  label: string;
}

interface Props {
  cards: CarouselCard[];
  heading: string;
  addLabel: string;
  dismissLabel: string;
  onAdd: (key: string) => void;
  onDismiss: (key: string) => void;
  /** Set while a row is being written, so a double tap can't create the same entry twice. */
  busyKey?: string | null;
}

export default function SuggestionCarousel({ cards, heading, addLabel, dismissLabel, onAdd, onDismiss, busyKey }: Props) {
  const { colors } = useTheme();
  const s = React.useMemo(() => makeStyles(colors), [colors]);

  if (cards.length === 0) return null;

  return (
    <View style={s.wrap}>
      <Text style={s.heading}>{heading}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.row}
        keyboardShouldPersistTaps="handled"
      >
        {cards.map(card => (
          <View key={card.key} style={s.card}>
            <TouchableOpacity
              onPress={() => onDismiss(card.key)}
              style={s.close}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={dismissLabel}
            >
              <Text style={s.closeIcon}>✕</Text>
            </TouchableOpacity>
            <Text style={s.emoji}>{card.emoji}</Text>
            <Text style={s.label} numberOfLines={2}>{card.label}</Text>
            <TouchableOpacity
              style={[s.addBtn, busyKey === card.key && s.addBtnBusy]}
              onPress={() => onAdd(card.key)}
              disabled={busyKey === card.key}
              accessibilityRole="button"
            >
              <Text style={s.addBtnText}>{addLabel}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  wrap: { marginTop: spacing.lg, alignSelf: 'stretch' },
  heading: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm, paddingHorizontal: spacing.lg },
  row: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  card: {
    width: 116, backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: spacing.md, paddingHorizontal: spacing.sm, alignItems: 'center',
  },
  close: { position: 'absolute', top: 4, right: 6, zIndex: 1 },
  closeIcon: { ...typography.xs, color: colors.textMuted, fontWeight: '700' },
  emoji: { fontSize: 28, marginBottom: spacing.xs },
  label: { ...typography.sm, color: colors.text, textAlign: 'center', minHeight: 34, marginBottom: spacing.sm },
  addBtn: { backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 6, paddingHorizontal: spacing.md, alignSelf: 'stretch', alignItems: 'center' },
  addBtnBusy: { opacity: 0.5 },
  addBtnText: { ...typography.xs, color: colors.textInverse, fontWeight: '700' },
}); }
