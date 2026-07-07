// app/datenschutz.tsx — Datenschutzerklärung gem. Art. 13/14 DSGVO
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, typography } from '../constants/theme';

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
          Stand: Juli 2026. Diese Erklärung informiert dich, welche Daten Heimlig verarbeitet, wofür, und welche Rechte du hast.
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
            • Haushaltsdaten: Anzeigename, Avatarfarbe, Haushaltsname, Einkaufslisten, Aufgaben, Budget/Transaktionen, Rezepte, Notizen — sichtbar für die Mitglieder deines Haushalts{'\n'}
            • Optional, nur wenn du es aktivierst: dein Standort (einmalig beim Tippen auf „Standort teilen", kein dauerhaftes Tracking, Freigaben werden automatisch nach einiger Zeit wieder gelöscht){'\n'}
            • Optional: Fotos von Rezepten, die du zur Zutaten-Erkennung hochlädst{'\n'}
            • Push-Benachrichtigungen: Wenn du Benachrichtigungen erlaubst, wird ein geräteweites Push-Token gespeichert, damit dich andere Haushaltsmitglieder erreichen können (z. B. bei einer neuen Pinnwand-Nachricht) — auch wenn die App geschlossen ist
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>3. Wer die Daten verarbeitet (Auftragsverarbeiter & Drittanbieter)</Text>
          <Text style={styles.p}>
            • Supabase Inc. — Datenbank, Authentifizierung, Backend-Funktionen. Alle App-Inhalte (Konto, Haushaltsdaten) werden dort gespeichert.{'\n\n'}
            • Anthropic (USA) — wenn du ein Rezept per Foto oder Text importierst, wird der Inhalt zur Texterkennung an die Claude-API übermittelt. Dabei findet eine Datenübermittlung in ein Land außerhalb der EU (USA) statt.{'\n\n'}
            • Open Food Facts — beim Scannen eines Produkt-Barcodes wird die Barcode-Nummer an die offene Produktdatenbank Open Food Facts gesendet, um Produktinfos abzurufen. Es werden dabei keine Konto- oder Personendaten übermittelt.{'\n\n'}
            • Google — nur wenn du „Google Kalender verbinden" nutzt: nach deiner ausdrücklichen Anmeldung bei Google werden Kalendertermine zwischen Heimlig und deinem Google-Kalender abgeglichen.{'\n\n'}
            • Vercel Inc. — Hosting der Web-Version (heimlig.vercel.app).{'\n\n'}
            • Expo (EAS Push Service) — wenn du Push-Benachrichtigungen erlaubst, wird bei neuen Haushalts-Nachrichten der Nachrichtentext, der Absendername und dein Geräte-Push-Token an Expos Push-Zustelldienst übermittelt, um die Benachrichtigung an dein Gerät zuzustellen.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>4. Zweck und Rechtsgrundlage</Text>
          <Text style={styles.p}>
            Die Verarbeitung erfolgt zur Bereitstellung der App-Funktionen, die du nutzt (Art. 6 Abs. 1 lit. b DSGVO — Vertragserfüllung), bzw. bei optionalen Funktionen (Standort, Rezeptfoto-Import, Google-Kalender) auf Grundlage deiner Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die du jederzeit widerrufen kannst, indem du die jeweilige Funktion einfach nicht nutzt.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>5. Speicherdauer</Text>
          <Text style={styles.p}>
            Deine Daten bleiben gespeichert, solange dein Konto besteht. Geteilte Standorte werden automatisch nach kurzer Zeit gelöscht. Nach Löschung deines Kontos (siehe Punkt 7) werden deine personenbezogenen Daten entfernt, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>6. Deine Rechte</Text>
          <Text style={styles.p}>
            Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21) sowie das Recht auf Beschwerde bei einer Datenschutzaufsichtsbehörde. Budget-Transaktionen kannst du direkt in der App als CSV exportieren.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>7. Konto & Daten löschen</Text>
          <Text style={styles.p}>
            Du kannst die Löschung deines Kontos und aller zugehörigen Daten jederzeit per E-Mail an heimlig.app@gmail.com beantragen. Eine Selbstbedienungs-Löschfunktion direkt in der App ist in Vorbereitung.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>8. Kontakt</Text>
          <Text style={styles.p}>
            Bei Fragen zum Datenschutz erreichst du uns unter heimlig.app@gmail.com.
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
  intro: { ...typography.sm, color: colors.textMuted, marginBottom: spacing.md, fontStyle: 'italic' },
  section: { marginBottom: spacing.sm },
  h2: { ...typography.h3, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  p: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
});
