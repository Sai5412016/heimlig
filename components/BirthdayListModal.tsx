// components/BirthdayListModal.tsx — full list of upcoming birthdays within the next year.
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { useStore } from '../store/useStore';
import { spacing, radius, typography, type ColorPalette } from '../constants/theme';
import type { Task } from '../lib/supabase';
import { format, parseISO } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { nextYearlyOccurrence } from '../lib/dateMath';

// Strip "Geburtstag" boilerplate from a task title so we show just the person's name.
function birthdayName(title: string): string {
  return title.replace(/geburtstag/ig, '').replace(/[:•\-–]/g, '').replace(/🎂/g, '').replace(/\s+/g, ' ').trim() || title;
}

export default function BirthdayListModal({ visible, onClose, tasks }: { visible: boolean; onClose: () => void; tasks: Task[] }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const language = useStore(s => s.language);
  const dateLocale = language === 'en' ? enUS : de;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const upcoming = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return tasks
      .filter(task => task.category === 'Geburtstag' && task.due_date)
      .map(task => {
        const d = parseISO(task.due_date!);
        const next = nextYearlyOccurrence(d.getMonth(), d.getDate(), today);
        const days = Math.round((next.getTime() - today.getTime()) / 86400000);
        return { task, date: next, days };
      })
      .filter(x => x.days <= 366)
      .sort((a, b) => a.days - b.days);
  }, [tasks]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Separate backdrop behind the sheet — keeps the ScrollView free of any Pressable
            ancestor, which on some Android devices blocks the scroll gesture entirely. */}
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t('birthdays.title')}</Text>
          <Text style={styles.subtitle}>{t('birthdays.subtitle')}</Text>

          <ScrollView
            style={{ flexGrow: 0, flexShrink: 1 }}
            showsVerticalScrollIndicator={false}
          >
            {upcoming.length === 0 ? (
              <Text style={styles.empty}>{t('birthdays.emptyBody')}</Text>
            ) : (
              upcoming.map(({ task, date, days }) => (
                <View key={task.id} style={styles.row}>
                  <View style={styles.dateBox}>
                    <Text style={styles.dateDay}>{format(date, 'd')}</Text>
                    <Text style={styles.dateMonth}>{format(date, 'MMM', { locale: dateLocale })}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{birthdayName(task.title)}</Text>
                    <Text style={styles.days}>
                      {days === 0 ? t('birthdays.today') : days === 1 ? t('recipes.tomorrow') : t('birthdays.inDays', { days })}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xl, maxHeight: '80%' },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  title: { ...typography.h2, color: colors.text },
  subtitle: { ...typography.sm, color: colors.textSecondary, marginBottom: spacing.md },
  empty: { ...typography.sm, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  dateBox: { width: 50, height: 50, borderRadius: radius.md, backgroundColor: colors.brandPale, alignItems: 'center', justifyContent: 'center' },
  dateDay: { ...typography.h3, color: colors.brand, lineHeight: 20 },
  dateMonth: { ...typography.xs, color: colors.brand, textTransform: 'uppercase' },
  name: { ...typography.body, color: colors.text, fontWeight: '700' },
  days: { ...typography.xs, color: colors.textSecondary, marginTop: 1 },
  closeBtn: { padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  closeBtnText: { ...typography.body, color: colors.textSecondary },
}); }
