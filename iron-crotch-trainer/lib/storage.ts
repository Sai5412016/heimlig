import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  AGE_CONFIRMED: '@ict:age_confirmed',
  CURRENT_PHASE: '@ict:current_phase',
  SESSIONS: '@ict:sessions',
} as const;

export type Session = {
  id: string;
  date: string;
  phaseId: string;
  phaseName: string;
  duration: number;
  comfort: number;
  notes: string;
};

export async function getAgeConfirmed(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(KEYS.AGE_CONFIRMED);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function setAgeConfirmed(): Promise<void> {
  await AsyncStorage.setItem(KEYS.AGE_CONFIRMED, 'true');
}

export async function getCurrentPhase(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(KEYS.CURRENT_PHASE)) ?? 'phase1';
  } catch {
    return 'phase1';
  }
}

export async function setCurrentPhase(phaseId: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.CURRENT_PHASE, phaseId);
}

export async function getSessions(): Promise<Session[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SESSIONS);
    return raw ? (JSON.parse(raw) as Session[]) : [];
  } catch {
    return [];
  }
}

export async function addSession(session: Omit<Session, 'id'>): Promise<void> {
  const sessions = await getSessions();
  const newSession: Session = { ...session, id: Date.now().toString() };
  await AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify([newSession, ...sessions]));
}

export async function deleteSession(id: string): Promise<void> {
  const sessions = await getSessions();
  const updated = sessions.filter((s) => s.id !== id);
  await AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(updated));
}
