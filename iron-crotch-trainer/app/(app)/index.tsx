import { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import { TRAINING_PHASES, getPhaseColor } from '../../data/trainingPlan';
import { getCurrentPhase, setCurrentPhase } from '../../lib/storage';

export default function HomeScreen() {
  const router = useRouter();
  const [currentPhaseId, setCurrentPhaseId] = useState('phase1');

  useFocusEffect(
    useCallback(() => {
      getCurrentPhase().then(setCurrentPhaseId);
    }, [])
  );

  async function handleSetPhase(phaseId: string) {
    await setCurrentPhase(phaseId);
    setCurrentPhaseId(phaseId);
  }

  const currentPhase = TRAINING_PHASES.find((p) => p.id === currentPhaseId) ?? TRAINING_PHASES[0];
  const currentColor = getPhaseColor(currentPhaseId);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Iron Crotch Trainer</Text>
          <Text style={styles.headerSub}>铁裆功 · Tiě Dāng Gōng</Text>
        </View>

        <View style={[styles.currentPhaseCard, { borderColor: currentColor }]}>
          <View style={styles.currentPhaseBadgeRow}>
            <View style={[styles.phaseDot, { backgroundColor: currentColor }]} />
            <Text style={[styles.currentPhaseLabel, { color: currentColor }]}>Aktuelle Phase</Text>
          </View>
          <Text style={styles.currentPhaseName}>{currentPhase.name}</Text>
          <Text style={styles.currentPhaseRange}>{currentPhase.timeRange}</Text>
          <Text style={styles.currentPhaseGoal} numberOfLines={2}>{currentPhase.goal}</Text>
          <TouchableOpacity
            style={[styles.openPhaseButton, { backgroundColor: currentColor }]}
            onPress={() => router.push(`/(app)/phase/${currentPhaseId}`)}
            activeOpacity={0.8}
          >
            <Text style={styles.openPhaseButtonText}>Phase öffnen →</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Alle Phasen</Text>

        {TRAINING_PHASES.map((phase) => {
          const color = getPhaseColor(phase.id);
          const isActive = phase.id === currentPhaseId;
          return (
            <TouchableOpacity
              key={phase.id}
              style={[styles.phaseCard, isActive && styles.phaseCardActive]}
              onPress={() => router.push(`/(app)/phase/${phase.id}`)}
              activeOpacity={0.75}
            >
              <View style={[styles.phaseNumberCircle, { backgroundColor: color }]}>
                <Text style={styles.phaseNumberText}>{phase.number}</Text>
              </View>
              <View style={styles.phaseCardContent}>
                <View style={styles.phaseCardHeader}>
                  <Text style={styles.phaseCardName}>{phase.name}</Text>
                  {isActive && (
                    <View style={[styles.activePill, { backgroundColor: color + '33' }]}>
                      <Text style={[styles.activePillText, { color }]}>Aktiv</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.phaseCardRange}>{phase.timeRange}</Text>
                <Text style={styles.phaseCardGoal} numberOfLines={2}>{phase.goal}</Text>
                <Text style={styles.phaseCardMeta}>
                  {phase.exercises.length} Übungen · {phase.dailyDuration}
                </Text>
              </View>
              <Text style={styles.phaseArrow}>›</Text>
            </TouchableOpacity>
          );
        })}

        <View style={styles.rulesCard}>
          <Text style={styles.rulesTitle}>Grundregeln</Text>
          <Text style={styles.rulesItem}>• Vorher Arzt konsultieren</Text>
          <Text style={styles.rulesItem}>• Warmer Raum, entspannter Geist</Text>
          <Text style={styles.rulesItem}>• Immer Dantian-Atmung verwenden</Text>
          <Text style={styles.rulesItem}>• Bei stechendem Schmerz sofort stoppen</Text>
          <Text style={styles.rulesItem}>• Erst zur nächsten Phase, wenn aktuelle Phase 2+ Wochen bequem ist</Text>
          <Text style={styles.rulesItem}>• Jede Session protokollieren</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    padding: 20,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  currentPhaseCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 20,
    marginBottom: 28,
    borderWidth: 1.5,
  },
  currentPhaseBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  phaseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  currentPhaseLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  currentPhaseName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  currentPhaseRange: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  currentPhaseGoal: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
    marginBottom: 16,
  },
  openPhaseButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  openPhaseButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  phaseCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  phaseCardActive: {
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceHigh,
  },
  phaseNumberCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  phaseNumberText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  phaseCardContent: {
    flex: 1,
  },
  phaseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  phaseCardName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  activePill: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  phaseCardRange: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  phaseCardGoal: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
    marginBottom: 4,
  },
  phaseCardMeta: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  phaseArrow: {
    fontSize: 22,
    color: Colors.textMuted,
    marginLeft: 8,
  },
  rulesCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 18,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rulesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  rulesItem: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
});
