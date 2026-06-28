import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, comfortColor } from '../../constants/colors';
import { TRAINING_PHASES, getPhaseColor } from '../../data/trainingPlan';
import { Session, addSession, deleteSession, getCurrentPhase, getSessions } from '../../lib/storage';

type NewSession = {
  phaseId: string;
  duration: string;
  comfort: number;
  notes: string;
};

const EMPTY: NewSession = {
  phaseId: 'phase1',
  duration: '',
  comfort: 7,
  notes: '',
};

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LogScreen() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<NewSession>(EMPTY);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const [s, currentPhase] = await Promise.all([getSessions(), getCurrentPhase()]);
        setSessions(s);
        setForm((prev) => ({ ...prev, phaseId: currentPhase }));
      }
      load();
    }, [])
  );

  function openModal() {
    getCurrentPhase().then((phaseId) => {
      setForm({ ...EMPTY, phaseId });
      setModalVisible(true);
    });
  }

  async function handleSave() {
    const durationNum = parseInt(form.duration, 10);
    if (!form.duration || isNaN(durationNum) || durationNum <= 0) {
      Alert.alert('Fehler', 'Bitte eine gültige Dauer (Minuten) eingeben.');
      return;
    }
    const phase = TRAINING_PHASES.find((p) => p.id === form.phaseId);
    await addSession({
      date: new Date().toISOString(),
      phaseId: form.phaseId,
      phaseName: phase?.name ?? form.phaseId,
      duration: durationNum,
      comfort: form.comfort,
      notes: form.notes.trim(),
    });
    const updated = await getSessions();
    setSessions(updated);
    setModalVisible(false);
  }

  async function handleDelete(id: string) {
    Alert.alert('Session löschen?', 'Diese Session wird endgültig entfernt.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          await deleteSession(id);
          setSessions((prev) => prev.filter((s) => s.id !== id));
        },
      },
    ]);
  }

  const totalMinutes = sessions.reduce((acc, s) => acc + s.duration, 0);
  const avgComfort =
    sessions.length > 0
      ? (sessions.reduce((acc, s) => acc + s.comfort, 0) / sessions.length).toFixed(1)
      : '–';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Trainingsprotokoll</Text>
          <TouchableOpacity style={styles.addButton} onPress={openModal} activeOpacity={0.8}>
            <Text style={styles.addButtonText}>+ Neu</Text>
          </TouchableOpacity>
        </View>

        {sessions.length > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{sessions.length}</Text>
              <Text style={styles.statLabel}>Sessions</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{totalMinutes}</Text>
              <Text style={styles.statLabel}>Minuten gesamt</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: comfortColor(parseFloat(avgComfort as string) || 5) }]}>
                {avgComfort}
              </Text>
              <Text style={styles.statLabel}>∅ Wohlbefinden</Text>
            </View>
          </View>
        )}

        {sessions.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>Noch keine Sessions</Text>
            <Text style={styles.emptyText}>
              Protokolliere deine erste Trainingseinheit nach einer abgeschlossenen Session.
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={openModal} activeOpacity={0.8}>
              <Text style={styles.emptyButtonText}>Erste Session eintragen</Text>
            </TouchableOpacity>
          </View>
        )}

        {sessions.map((session) => {
          const color = getPhaseColor(session.phaseId);
          return (
            <TouchableOpacity
              key={session.id}
              style={styles.sessionCard}
              onLongPress={() => handleDelete(session.id)}
              activeOpacity={0.75}
            >
              <View style={[styles.sessionColorBar, { backgroundColor: color }]} />
              <View style={styles.sessionContent}>
                <View style={styles.sessionTopRow}>
                  <Text style={styles.sessionPhaseName}>{session.phaseName}</Text>
                  <View
                    style={[
                      styles.comfortBadge,
                      { backgroundColor: comfortColor(session.comfort) + '22' },
                    ]}
                  >
                    <Text
                      style={[styles.comfortBadgeText, { color: comfortColor(session.comfort) }]}
                    >
                      {session.comfort}/10
                    </Text>
                  </View>
                </View>
                <Text style={styles.sessionDate}>{formatDate(session.date)}</Text>
                <View style={styles.sessionMetaRow}>
                  <Text style={styles.sessionMeta}>⏱ {session.duration} Min</Text>
                  {session.notes ? (
                    <Text style={styles.sessionNotes} numberOfLines={1}>
                      · {session.notes}
                    </Text>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {sessions.length > 0 && (
          <Text style={styles.deleteTip}>Gedrückt halten zum Löschen einer Session</Text>
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <SafeAreaView style={styles.modalSafe}>
            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Session protokollieren</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Phase</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.phaseSelector}>
                {TRAINING_PHASES.map((phase) => {
                  const selected = form.phaseId === phase.id;
                  const color = getPhaseColor(phase.id);
                  return (
                    <TouchableOpacity
                      key={phase.id}
                      style={[
                        styles.phasePill,
                        selected && { backgroundColor: color, borderColor: color },
                        !selected && { borderColor: Colors.border },
                      ]}
                      onPress={() => setForm((f) => ({ ...f, phaseId: phase.id }))}
                    >
                      <Text
                        style={[
                          styles.phasePillText,
                          { color: selected ? '#FFFFFF' : Colors.textSecondary },
                        ]}
                      >
                        {phase.number}. {phase.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.fieldLabel}>Dauer (Minuten)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                placeholder="z.B. 25"
                placeholderTextColor={Colors.textMuted}
                value={form.duration}
                onChangeText={(t) => setForm((f) => ({ ...f, duration: t }))}
              />

              <Text style={styles.fieldLabel}>Wohlbefinden ({form.comfort}/10)</Text>
              <View style={styles.comfortRow}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
                  const selected = form.comfort === n;
                  const c = comfortColor(n);
                  return (
                    <TouchableOpacity
                      key={n}
                      style={[
                        styles.comfortDot,
                        { borderColor: c },
                        selected && { backgroundColor: c },
                      ]}
                      onPress={() => setForm((f) => ({ ...f, comfort: n }))}
                    >
                      <Text
                        style={[
                          styles.comfortDotText,
                          { color: selected ? '#FFFFFF' : c },
                        ]}
                      >
                        {n}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.comfortScale}>
                <Text style={[styles.comfortScaleLabel, { color: Colors.comfortLow }]}>Schlecht</Text>
                <Text style={[styles.comfortScaleLabel, { color: Colors.comfortHigh }]}>Sehr gut</Text>
              </View>

              <Text style={styles.fieldLabel}>Notizen (optional)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Wie lief die Session? Besonderheiten?"
                placeholderTextColor={Colors.textMuted}
                value={form.notes}
                onChangeText={(t) => setForm((f) => ({ ...f, notes: t }))}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8}>
                <Text style={styles.saveButtonText}>Session speichern</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.text,
  },
  addButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  emptyButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  sessionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    marginBottom: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sessionColorBar: {
    width: 4,
  },
  sessionContent: {
    flex: 1,
    padding: 14,
  },
  sessionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sessionPhaseName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  comfortBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  comfortBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sessionDate: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  sessionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  sessionNotes: {
    flex: 1,
    fontSize: 12,
    color: Colors.textMuted,
    marginLeft: 4,
  },
  deleteTip: {
    textAlign: 'center',
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 8,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalSafe: {
    flex: 1,
  },
  modalScroll: {
    padding: 24,
    paddingBottom: 48,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  modalClose: {
    fontSize: 18,
    color: Colors.textMuted,
    padding: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 4,
  },
  phaseSelector: {
    marginBottom: 20,
  },
  phasePill: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  phasePillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    fontSize: 15,
    color: Colors.text,
    marginBottom: 20,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  comfortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  comfortDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comfortDotText: {
    fontSize: 11,
    fontWeight: '700',
  },
  comfortScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  comfortScaleLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
