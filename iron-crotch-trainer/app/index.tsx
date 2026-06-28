import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { getAgeConfirmed, setAgeConfirmed } from '../lib/storage';

export default function AgeGateScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAgeConfirmed().then((confirmed) => {
      if (confirmed) {
        router.replace('/(app)/');
      } else {
        setLoading(false);
      }
    });
  }, []);

  async function handleConfirm() {
    await setAgeConfirmed();
    router.replace('/(app)/');
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        <View style={styles.warningBadge}>
          <Text style={styles.warningBadgeText}>18+</Text>
        </View>

        <Text style={styles.title}>Iron Crotch{'\n'}Trainer</Text>

        <Text style={styles.subtitle}>Traditionelles Qi-Kampfkunsttraining</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Altersverifikation erforderlich</Text>
          <Text style={styles.cardText}>
            Diese App enthält detaillierte Anleitungen für ein traditionelles chinesisches
            Kampfkunst-Training (铁裆功, Tiě Dāng Gōng), das intime Körperbereiche betrifft.
          </Text>
          <Text style={styles.cardText}>
            Die Inhalte sind ausschließlich für Erwachsene (18+) bestimmt und dienen
            gesundheitlichen sowie kampfkünstlerischen Zwecken.
          </Text>
        </View>

        <View style={styles.disclaimerCard}>
          <Text style={styles.disclaimerTitle}>⚠️ Medizinischer Hinweis</Text>
          <Text style={styles.disclaimerText}>
            Konsultiere vor Trainingsbeginn einen Arzt. Diese App ersetzt keine medizinische
            Beratung. Trainiere verantwortungsbewusst und höre auf deinen Körper.
          </Text>
        </View>

        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm} activeOpacity={0.8}>
          <Text style={styles.confirmButtonText}>Ich bin 18 Jahre oder älter</Text>
          <Text style={styles.confirmButtonSub}>Und akzeptiere die Hinweise</Text>
        </TouchableOpacity>

        <Text style={styles.declineText}>
          Minderjährige verlassen bitte diese App.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 24,
    alignItems: 'center',
    paddingBottom: 40,
  },
  warningBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    marginTop: 12,
  },
  warningBadgeText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: Colors.text,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
  },
  cardText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
    marginBottom: 8,
  },
  disclaimerCard: {
    backgroundColor: '#1C1209',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  disclaimerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.warning,
    marginBottom: 8,
  },
  disclaimerText: {
    fontSize: 13,
    color: '#C8A46E',
    lineHeight: 20,
  },
  confirmButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  confirmButtonSub: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    marginTop: 3,
  },
  declineText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
