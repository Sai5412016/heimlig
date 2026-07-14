// components/WhatsNewModal.tsx — shows unseen release notes once, after an update.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { spacing, radius, typography, shadow, type ColorPalette } from '../constants/theme';
import { useStore } from '../store/useStore';
import { getUnseenChangelog, markChangelogSeen, type ChangelogEntry } from '../lib/changelog';

export default function WhatsNewModal() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const household = useStore(s => s.household);
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [visible, setVisible] = useState(false);

  // Only check once the user is actually in the app (household active).
  useEffect(() => {
    if (!household) return;
    let active = true;
    (async () => {
      const e = await getUnseenChangelog();
      if (active && e.length) { setEntries(e); setVisible(true); }
    })();
    return () => { active = false; };
  }, [household?.id]);

  const close = async () => {
    await markChangelogSeen(entries);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.heading}>{t('whatsNew.heading')}</Text>
          <Text style={styles.subheading}>{t('whatsNew.subheading')}</Text>
          <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
            {entries.map(e => (
              <View key={e.version_code} style={styles.block}>
                <Text style={styles.blockTitle}>{e.title}</Text>
                {e.items.map((it, i) => (
                  <View key={i} style={styles.itemRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.itemText}>{it}</Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.btn} onPress={close} activeOpacity={0.85}>
            <Text style={styles.btnText}>{t('whatsNew.closeButton')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ColorPalette) { return StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, ...shadow.lg },
  heading: { ...typography.h2, color: colors.text },
  subheading: { ...typography.sm, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.md },
  block: { marginBottom: spacing.md, backgroundColor: colors.background, borderRadius: radius.lg, padding: spacing.md },
  blockTitle: { ...typography.h3, color: colors.brand, marginBottom: spacing.sm },
  itemRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: 3 },
  bullet: { ...typography.body, color: colors.brand, fontWeight: '800' },
  itemText: { ...typography.body, color: colors.text, flex: 1 },
  btn: { backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  btnText: { ...typography.body, color: '#fff', fontWeight: '700' },
}); }
