import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../../constants/colors';
import { TRAINING_PHASES, getPhaseColor, type Exercise } from '../../../data/trainingPlan';
import { setCurrentPhase } from '../../../lib/storage';
import BreathingGuide from '../../../components/BreathingGuide';
import ExerciseAnimation from '../../../components/ExerciseAnimation';

export default function PhaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [breathingExercise, setBreathingExercise] = useState<Exercise | null>(null);

  const phase = TRAINING_PHASES.find((p) => p.id === id);

  if (!phase) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{ color: Colors.text, padding: 20 }}>Phase nicht gefunden.</Text>
      </SafeAreaView>
    );
  }

  const color = getPhaseColor(phase.id);

  async function handleSetActive() {
    await setCurrentPhase(phase.id);
    Alert.alert('Aktiviert', `Phase ${phase.number}: ${phase.name} ist jetzt deine aktuelle Phase.`);
  }

  function toggleExercise(exerciseId: string) {
    setExpandedExercise((prev) => (prev === exerciseId ? null : exerciseId));
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Zurück</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.setActiveButton, { borderColor: color }]}
            onPress={handleSetActive}
          >
            <Text style={[styles.setActiveText, { color }]}>Als aktiv setzen</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.phaseHeader, { borderLeftColor: color }]}>
          <View style={styles.phaseHeaderTop}>
            <View style={[styles.phaseCircle, { backgroundColor: color }]}>
              <Text style={styles.phaseCircleNumber}>{phase.number}</Text>
            </View>
            <View style={styles.phaseHeaderText}>
              <Text style={[styles.phaseTag, { color }]}>PHASE {phase.number} · {phase.timeRange}</Text>
              <Text style={styles.phaseName}>{phase.name}</Text>
            </View>
          </View>
          <Text style={styles.phaseGoal}>{phase.goal}</Text>
          <View style={styles.chipRow}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>⏱ {phase.dailyDuration}</Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipText}>📅 {phase.frequency}</Text>
            </View>
          </View>
        </View>

        {phase.safetyNote && (
          <View style={styles.safetyCard}>
            <Text style={styles.safetyIcon}>⚠️</Text>
            <Text style={styles.safetyText}>{phase.safetyNote}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Übungen ({phase.exercises.length})</Text>

        {phase.exercises.map((exercise, idx) => {
          const isExpanded = expandedExercise === exercise.id;
          return (
            <View key={exercise.id} style={styles.exerciseCard}>
              <TouchableOpacity
                style={styles.exerciseHeader}
                onPress={() => toggleExercise(exercise.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.exerciseIndex, { backgroundColor: color + '22' }]}>
                  <Text style={[styles.exerciseIndexText, { color }]}>{idx + 1}</Text>
                </View>
                <View style={styles.exerciseHeaderText}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.exerciseDuration}>{exercise.duration}</Text>
                </View>
                <Text style={styles.expandArrow}>{isExpanded ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.exerciseBody}>
                  {exercise.animationType && (
                    <ExerciseAnimation animationType={exercise.animationType} color={color} />
                  )}
                  <Text style={styles.exerciseDescription}>{exercise.description}</Text>

                  <View style={styles.stepsList}>
                    {exercise.steps.map((step, stepIdx) => (
                      <View key={stepIdx} style={styles.stepRow}>
                        <View style={[styles.stepBullet, { backgroundColor: color }]}>
                          <Text style={styles.stepBulletText}>{stepIdx + 1}</Text>
                        </View>
                        <Text style={styles.stepText}>{step}</Text>
                      </View>
                    ))}
                  </View>

                  {exercise.warning && (
                    <View style={styles.exerciseWarning}>
                      <Text style={styles.exerciseWarningText}>⚠️ {exercise.warning}</Text>
                    </View>
                  )}

                  {exercise.breathingGuide && (
                    <TouchableOpacity
                      style={[styles.breathingBtn, { borderColor: color }]}
                      onPress={() => setBreathingExercise(exercise)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.breathingBtnIcon}>🫁</Text>
                      <View>
                        <Text style={[styles.breathingBtnText, { color }]}>Atemhilfe starten</Text>
                        <Text style={styles.breathingBtnSub}>
                          {exercise.breathingGuide.inhaleSeconds}s ein · {exercise.breathingGuide.exhaleSeconds}s aus · {exercise.breathingGuide.targetBreaths} Atemzüge
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.progressionCard}>
          <Text style={styles.progressionTitle}>Steigerungshinweis</Text>
          <Text style={styles.progressionText}>{phase.progressionTip}</Text>
        </View>

        <TouchableOpacity
          style={[styles.logButton, { backgroundColor: color }]}
          onPress={() => router.push('/(app)/log')}
          activeOpacity={0.8}
        >
          <Text style={styles.logButtonText}>📋  Session protokollieren</Text>
        </TouchableOpacity>
      </ScrollView>

      {breathingExercise?.breathingGuide && (
        <BreathingGuide
          visible={breathingExercise !== null}
          onClose={() => setBreathingExercise(null)}
          inhaleSeconds={breathingExercise.breathingGuide.inhaleSeconds}
          exhaleSeconds={breathingExercise.breathingGuide.exhaleSeconds}
          targetBreaths={breathingExercise.breathingGuide.targetBreaths}
          title={breathingExercise.name}
        />
      )}
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
    paddingBottom: 40,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    paddingVertical: 8,
  },
  backButtonText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  setActiveButton: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  setActiveText: {
    fontSize: 13,
    fontWeight: '700',
  },
  phaseHeader: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  phaseHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  phaseCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  phaseCircleNumber: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  phaseHeaderText: {
    flex: 1,
  },
  phaseTag: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  phaseName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  phaseGoal: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
    marginBottom: 14,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  safetyCard: {
    backgroundColor: '#1C1209',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  safetyIcon: {
    fontSize: 16,
    marginRight: 10,
    marginTop: 1,
  },
  safetyText: {
    flex: 1,
    fontSize: 13,
    color: '#C8A46E',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  exerciseCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  exerciseIndex: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  exerciseIndexText: {
    fontSize: 14,
    fontWeight: '800',
  },
  exerciseHeaderText: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  exerciseDuration: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  expandArrow: {
    color: Colors.textMuted,
    fontSize: 11,
    marginLeft: 8,
  },
  exerciseBody: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  exerciseDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
    marginTop: 14,
    fontStyle: 'italic',
  },
  stepsList: {
    gap: 10,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepBullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
    flexShrink: 0,
  },
  stepBulletText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    lineHeight: 20,
  },
  exerciseWarning: {
    backgroundColor: '#1A0A0A',
    borderRadius: 8,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: Colors.danger + '66',
  },
  exerciseWarningText: {
    fontSize: 12,
    color: Colors.danger,
    lineHeight: 18,
  },
  progressionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 18,
    marginTop: 6,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  progressionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.gold,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  progressionText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  logButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  breathingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  breathingBtnIcon: {
    fontSize: 26,
  },
  breathingBtnText: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  breathingBtnSub: {
    fontSize: 11,
    color: '#666666',
  },
});
