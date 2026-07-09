// app/impressum.tsx — Impressum gem. § 5 TMG
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '../constants/theme';

export default function ImpressumScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Zurück</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Impressum</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.h2}>Angaben gemäß § 5 TMG</Text>
        <Text style={styles.p}>
          Andreas Schilling{'\n'}
          Birkensteig 4{'\n'}
          86845 Großaitingen{'\n'}
          Deutschland
        </Text>

        <Text style={styles.h2}>Kontakt</Text>
        <Text style={styles.p}>E-Mail: heimlig.app@gmail.com</Text>

        <Text style={styles.h2}>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</Text>
        <Text style={styles.p}>Andreas Schilling (Anschrift wie oben)</Text>

        <Text style={styles.h2}>EU-Streitschlichtung</Text>
        <Text style={styles.p}>
          Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: https://ec.europa.eu/consumers/odr/.{'\n\n'}
          Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
        </Text>

        <Text style={styles.h2}>Haftungshinweis</Text>
        <Text style={styles.p}>
          Heimlig Self ist ein privates, eigenständig entwickeltes Projekt. Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte externer Links. Für den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber verantwortlich.{'\n\n'}
          Heimlig Self ersetzt keine ärztliche, therapeutische oder psychologische Beratung. Alle Auswertungen (u.a. Energy Score, KI-Coach-Hinweise) sind unverbindliche Orientierungshilfen.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { marginRight: spacing.md },
  backText: { ...typography.body, color: colors.brand, fontWeight: '600' },
  title: { ...typography.h2, color: colors.text },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  h2: { ...typography.h3, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  p: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
});
