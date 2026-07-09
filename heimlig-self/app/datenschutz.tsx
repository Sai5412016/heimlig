// app/datenschutz.tsx — Datenschutzerklärung gem. Art. 13/14 DSGVO
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '../constants/theme';

export default function DatenschutzScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Zurück</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Datenschutz</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Stand: Juli 2026. Diese Erklärung informiert dich, welche Daten Heimlig Self verarbeitet, wofür, und welche Rechte du hast.
        </Text>

        <View style={styles.section}>
          <Text style={styles.h2}>1. Verantwortlicher</Text>
          <Text style={styles.p}>
            Andreas Schilling{'\n'}Birkensteig 4, 86845 Großaitingen{'\n'}E-Mail: heimlig.app@gmail.com
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>2. Welche Daten wir verarbeiten</Text>
          <Text style={styles.p}>
            • Konto: E-Mail-Adresse, Passwort (verschlüsselt gespeichert){'\n'}
            • Profil: Anzeigename, Avatarfarbe, Spracheinstellung, Dark-Mode-Einstellung{'\n'}
            • Perspektivisch (sobald die jeweiligen Module live sind): Gesundheits- und
            Wohlbefindensdaten, die du selbst einträgst oder über eine verbundene Wearable-
            Integration freigibst (z. B. Schlaf, Aktivität, Stimmung, Journal-Einträge) —
            diese Daten sind besonders sensibel und werden ausschließlich zur Bereitstellung
            der jeweiligen Funktion verarbeitet.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>3. Wer die Daten verarbeitet (Auftragsverarbeiter & Drittanbieter)</Text>
          <Text style={styles.p}>
            • Supabase Inc. — Datenbank und Authentifizierung. Alle App-Inhalte (Konto, Profil) werden dort gespeichert.{'\n\n'}
            • Expo (EAS) — App-Build- und Update-Infrastruktur.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>4. Zweck und Rechtsgrundlage</Text>
          <Text style={styles.p}>
            Die Verarbeitung erfolgt zur Bereitstellung der App-Funktionen, die du nutzt (Art. 6 Abs. 1 lit. b DSGVO — Vertragserfüllung), bzw. bei optionalen/sensiblen Funktionen auf Grundlage deiner ausdrücklichen Einwilligung (Art. 6 Abs. 1 lit. a, Art. 9 Abs. 2 lit. a DSGVO), die du jederzeit widerrufen kannst.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>5. Speicherdauer</Text>
          <Text style={styles.p}>
            Deine Daten werden gespeichert, solange dein Konto besteht. Nach Löschung deines Kontos werden deine Daten gelöscht, soweit keine gesetzliche Aufbewahrungspflicht entgegensteht.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>6. Deine Rechte</Text>
          <Text style={styles.p}>
            Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO) sowie das Recht auf Beschwerde bei einer Datenschutzaufsichtsbehörde. Wende dich dazu an heimlig.app@gmail.com.
          </Text>
        </View>
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
  intro: { ...typography.sm, color: colors.textMuted, marginBottom: spacing.lg },
  section: { marginBottom: spacing.md },
  h2: { ...typography.h3, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  p: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
});
