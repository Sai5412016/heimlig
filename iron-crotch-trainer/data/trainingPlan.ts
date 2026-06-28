export type Exercise = {
  id: string;
  name: string;
  duration: string;
  description: string;
  steps: string[];
  warning?: string;
  animationType?: string;
  breathingGuide?: {
    inhaleSeconds: number;
    exhaleSeconds: number;
    targetBreaths: number;
  };
};

export type Phase = {
  id: string;
  number: number;
  name: string;
  timeRange: string;
  goal: string;
  dailyDuration: string;
  frequency: string;
  exercises: Exercise[];
  progressionTip: string;
  safetyNote?: string;
};

export const TRAINING_PHASES: Phase[] = [
  {
    id: 'phase1',
    number: 1,
    name: 'Vorbereitung',
    timeRange: 'Wochen 1–4',
    goal: 'Durchblutung erhöhen, Qi erwecken, Gewebe sicher auf das Training vorbereiten.',
    dailyDuration: '15–25 Minuten',
    frequency: 'Täglich',
    exercises: [
      {
        id: 'p1e1',
        name: 'Qi-Atmung (Stehen oder Sitzen)',
        duration: '5–8 Min',
        description: 'Grundlegende Dantian-Atemübung zur Aktivierung der Lebensenergie und Vorbereitung des Gewebes.',
        steps: [
          'Stehe schulterbreit, Knie leicht gebeugt. Hände auf den Unterbauch legen.',
          'Tief in den Bauch einatmen (4–6 Sek) – der Bauch dehnt sich nach außen.',
          'Langsam ausatmen (6–8 Sek) – Beckenboden sanft anheben (wie beim bewussten Anhalten des Urins).',
          'Visualisiere warme goldene Energie, die durch die Körpermittellinie nach unten in den Schrittbereich fließt.',
          'Wiederhole 30–50 Atemzüge in ruhigem Tempo.',
        ],
        animationType: 'qi-atmung',
        breathingGuide: {
          inhaleSeconds: 5,
          exhaleSeconds: 7,
          targetBreaths: 40,
        },
      },
      {
        id: 'p1e2',
        name: 'Bauchmassage',
        duration: '5–7 Min',
        description: 'Sanfte Massage zur Förderung der Durchblutung im Unterleib und zum Lösen von Verspannungen.',
        animationType: 'bauchmassage',
        steps: [
          'Reibe beide Handflächen aneinander, bis sie warm sind.',
          'Lege sie auf den Oberbauch und massiere gleichmäßig nach unten bis zum Schambein (10–20 Mal).',
          'Massiere von unterhalb der Rippen nach außen und dann nach unten zu den Leistenbeugen.',
          'Kreismassage um den Nabel: 30 Kreise im Uhrzeigersinn, dann 30 gegen den Uhrzeigersinn.',
          'Immer mit moderatem Druck arbeiten – niemals schmerzhaft.',
        ],
      },
      {
        id: 'p1e3',
        name: 'Gewebsbewusstsein (Hoden & Samenstrang)',
        duration: '5 Min',
        description: 'Sanfte Berührungsübung zur Erweckung der Eigenwahrnehmung ohne Krafteinsatz.',
        steps: [
          'Setze dich bequem hin, Körper vollständig entspannt.',
          'Umfasse die Hoden sanft mit der Hand, ohne zu drücken oder zu ziehen.',
          'Rolle jeden Samenstrang (die Schläuche oberhalb der Hoden) sehr sanft zwischen Daumen und Zeigefinger – 50–100 Mal pro Seite.',
          'Der Fokus liegt auf Entspannung und Bewusstsein, nicht auf Kraft oder Intensität.',
        ],
        warning: 'Sofort aufhören bei stechendem Schmerz. Nur leichtes Ziehen ist normal.',
      },
    ],
    progressionTip: 'Abschluss: 3–5 Minuten ruhige Meditation. Visualisiere, wie Energie vom Schritt nach oben zum unteren Rücken fließt.',
    safetyNote: 'Diese Phase dient der sanften Vorbereitung. Übertreibe nie die Intensität. Schmerz = stopp.',
  },
  {
    id: 'phase2',
    number: 2,
    name: 'Massage & Manipulation',
    timeRange: 'Wochen 4–12',
    goal: 'Gewebsresilienz und Durchblutung systematisch aufbauen.',
    dailyDuration: '20–30 Minuten',
    frequency: 'Täglich',
    exercises: [
      {
        id: 'p2e1',
        name: 'Fortgeschrittenes Samenstrang-Rollen',
        duration: '5–8 Min',
        description: 'Intensivierte Version der Phase-1-Übung mit höherer Wiederholungszahl.',
        steps: [
          'Wie in Phase 1, aber steigere auf 200–400 sanfte Rollen pro Seite.',
          'Füge eine sehr milde Zugbewegung hinzu: sanft in Längsrichtung dehnen, dann loslassen.',
          'Gleichmäßiges, ruhiges Tempo halten – kein Reißen.',
        ],
      },
      {
        id: 'p2e2',
        name: 'Handflächenkreisen',
        duration: '5 Min',
        description: 'Kreisförmige Massage der Hoden zur Förderung der Durchblutung.',
        steps: [
          'Bilde mit Daumen und Zeigefinger ein lockeres „OK"-Zeichen um die Basis des Hodensacks.',
          'Nutze die andere, flache Handfläche für kleine, sanfte Kreisbewegungen auf jedem Hoden (50–100 Kreise pro Seite).',
          'Hände wechseln und Seiten tauschen.',
          'Druck bleibt immer leicht – kein Quetschen.',
        ],
      },
      {
        id: 'p2e3',
        name: 'Vollständige Hodenbewegung',
        duration: '5–7 Min',
        description: 'Geführte Bewegungsübung zur Erhöhung der Gewebsmobilität.',
        steps: [
          'Verwende Finger und Daumen beider Hände, um beide Hoden sanft zu führen.',
          'Bewegungszyklus: nach außen → nach oben → zusammen → nach unten → loslassen.',
          'Wiederhole den Zyklus 100–200 Mal in einem gleichmäßigen Rhythmus.',
          'Alles bleibt locker und entspannt – keine Kraft.',
        ],
      },
      {
        id: 'p2e4',
        name: 'Leichtes Tapotement',
        duration: '3–5 Min',
        description: 'Sanftes rhythmisches Beklopfen zur schrittweisen Konditionierung.',
        steps: [
          'Hände zu lockeren Fäusten formen oder Handflächen öffnen.',
          'Abwechselnd sehr leicht auf die Hoden klopfen – wie Schmetterlingsberührungen.',
          'Parallel dazu: leichtes Klopfen auf den Solarplexus (Oberbauch) zum Synchronisieren der Atemreaktion.',
          'Beginne absolut federleicht. Die Intensität steigert sich erst in späteren Phasen.',
        ],
      },
    ],
    progressionTip: 'Erst zu Phase 3 wechseln, wenn 400+ Wiederholungen sich leicht und angenehm anfühlen (mindestens 2 Wochen).',
  },
  {
    id: 'phase3',
    number: 3,
    name: 'Gewichtshängen & Schwingen',
    timeRange: 'Monate 3–6',
    goal: 'Kraft und Gewebsstärke durch kontrollierte, progressive Belastung aufbauen.',
    dailyDuration: '30–40 Minuten',
    frequency: '5–6 Tage/Woche',
    exercises: [
      {
        id: 'p3e1',
        name: 'Gewichtshängen – Grundtechnik',
        animationType: 'gewicht-haengen',
        duration: '3–5 Sets × 10–30 Sek',
        description: 'Kontrollierte Belastungsübung mit progressiver Gewichtssteigerung.',
        steps: [
          'Material: Weiches Baumwoll- oder Seidentuch verwenden – niemals raues Seil direkt auf der Haut.',
          'Das Tuch sicher, aber nicht eng um die Basis von Penis und Hodensack binden.',
          'Startgewicht: 0,5–1 kg (z.B. kleiner Sandsack, Wasserflasche in Beutel).',
          'Stehe mit leicht gebeugten Knien. Beine langsam strecken, bis das Gewicht vom Boden abhebt.',
          'Sanfte Vor-Rück-Schwingbewegungen der Hüften in kleinem Radius.',
          '1–2 Minuten Pause zwischen den Sets, Tuch anlassen.',
          'Nach dem letzten Set: Tuch abnehmen, sanft massieren.',
        ],
        warning: 'SOFORT STOPPEN bei Taubheitsgefühl, Kribbeln oder stechendem Schmerz. Niemals aggressiv schwingen.',
      },
      {
        id: 'p3e2',
        name: 'Nachsorge-Ritual',
        duration: '10 Min',
        description: 'Obligatorische Nachbehandlung nach jeder Gewichtshänge-Session.',
        steps: [
          'Tuch vollständig entfernen.',
          'Beide Hände wärmen und sanft Hoden und Samenstrang 2–3 Minuten massieren.',
          'Tiefe Qi-Atemübung (wie in Phase 1) für 5 Minuten.',
          'Visualisiere, wie Energie vom Schrittbereich nach oben durch die Wirbelsäule fließt.',
          'Ruhig sitzen oder liegen, keine sofortige intensive Aktivität.',
        ],
      },
    ],
    progressionTip: 'Gewicht oder Dauer sehr langsam steigern: maximal +0,5 kg oder +30 Sek pro Woche. Geduld ist hier entscheidend.',
    safetyNote: 'Diese Phase erfordert besondere Sorgfalt. Nimm dir Zeit. Ein zu schnelles Steigern führt zu Verletzungen.',
  },
  {
    id: 'phase4',
    number: 4,
    name: 'Schlagkonditionierung',
    timeRange: 'Monate 6–12',
    goal: 'Schrittweise Desensibilisierung und neurophysiologische Kräftigung.',
    dailyDuration: '30–45 Minuten',
    frequency: '5–6 Tage/Woche',
    exercises: [
      {
        id: 'p4e1',
        name: 'Rhythmisches Trommeln',
        animationType: 'trommeln',
        duration: '5–10 Min',
        description: 'Alternierendes Beklopfen zur progressiven Konditionierung.',
        steps: [
          'Hände zu lockeren Fäusten formen.',
          'Abwechselnd linke und rechte Hand, gleichmäßiger Rhythmus.',
          'Beginne mit 50 sehr leichten Kontakten, steigere über Wochen auf 200+.',
          'Intensität langsam steigern: leicht → mittel. Niemals hart schlagen.',
        ],
        warning: 'Beginne immer leichter als du denkst, dass es nötig ist. Der Aufbau dauert Wochen.',
      },
      {
        id: 'p4e2',
        name: 'Kontrollierte Handflächenschläge',
        animationType: 'handflächen',
        duration: '5 Min',
        description: 'Flache oder seitliche Handschläge mit präziser Kontrolle.',
        steps: [
          'Flache Handfläche oder Handkante verwenden.',
          'Kontrollierter, entspannter Schlag – die Hand federt ab, bleibt nicht liegen.',
          'Intensität wöchentlich minimal steigern.',
          'Atemtechnik beachten (siehe Atemintegration).',
        ],
      },
      {
        id: 'p4e3',
        name: 'Solarplexus-Konditionierung',
        animationType: 'solarplexus',
        duration: '5 Min',
        description: 'Synchronisierung des Solarplexus zur Reduktion der reflektierten Schmerzantwort.',
        steps: [
          'Leichtes rhythmisches Klopfen auf den Oberbauch (Solarplexus).',
          'Gleichzeitig tiefe Bauchatmung beibehalten.',
          'Dies reduziert den übertragenen Schmerzreflex auf den Unterbauch.',
        ],
      },
      {
        id: 'p4e4',
        name: 'Atemintegration (Qi-Schutz)',
        duration: 'Durchgehend während aller Schlagübungen',
        description: 'Fundamentale Atemtechnik zum Schutz durch Qi-Verdichtung.',
        steps: [
          'Vor jedem Schlag einatmen – Qi im Dantian (Unterbauch) sammeln.',
          'Im Moment des Kontakts ausatmen – den Atem nicht anhalten.',
          'Den Körper nicht verkrampfen – Kraft kommt durch Entspannung, nicht durch Anspannung.',
          'Visualisiere den Schrittbereich als dichtes, weiches Metall – nicht starr, aber belastbar.',
        ],
        breathingGuide: {
          inhaleSeconds: 3,
          exhaleSeconds: 3,
          targetBreaths: 20,
        },
      },
    ],
    progressionTip: 'Langsam, fokussiert, achtsam. Geschwindigkeit und Kraft kommen nach Monaten konsistenter Übung. Nicht eilen.',
    safetyNote: 'Diese Phase ist nur geeignet, wenn Phase 1–3 vollständig beherrscht werden (mind. 6 Monate konsequentes Training).',
  },
  {
    id: 'phase5',
    number: 5,
    name: 'Meisterniveau',
    timeRange: 'Ab Monat 12+',
    goal: 'Hohe Gewebsresilienz, Qi-Meisterschaft und langfristige Erhaltung.',
    dailyDuration: '20–30 Min Erhaltung + gelegentliche intensive Sessions',
    frequency: '4–5 Tage/Woche',
    exercises: [
      {
        id: 'p5e1',
        name: 'Vollsequenz (alle Phasen kombiniert)',
        duration: '20–30 Min',
        description: 'Fließende Kombination aller vorherigen Phasen zu einer harmonischen Praxis.',
        steps: [
          'Qi-Atmung zum Aufwärmen (5 Min) – Energie aktivieren.',
          'Massage-Sequenz aus Phase 1 & 2 (5–8 Min).',
          'Gewichtshängen nach eigenem Level (Phase 3, 10–20 Min).',
          'Schlagkonditionierung mit vollem Qi-Schutz (Phase 4, 5–10 Min).',
          'Abschluss: Energiezirkulation und Meditation (5 Min).',
        ],
      },
      {
        id: 'p5e2',
        name: 'Fortgeschrittene Qi-Projektion',
        duration: '10 Min',
        description: 'Mentale Konditionierung zur aktiven Qi-Kontrolle vor Belastung.',
        steps: [
          'In ruhigem Sitzen: Visualisiere intensive goldene Energie im Dantian.',
          'Lenke diese Energie bewusst in den Schrittbereich – spüre Wärme und Dichte.',
          'Halte diesen Zustand 30–60 Sekunden, dann release.',
          'Wende diese Technik direkt vor Schlag-/Belastungsübungen an.',
        ],
      },
      {
        id: 'p5e3',
        name: 'Partnerübungen (nur mit erfahrener Anleitung)',
        duration: 'Nach Absprache',
        description: 'Fortgeschrittene Technik – nur mit geschultem Partner.',
        steps: [
          'NUR durchführen mit einem erfahrenen Trainer oder Partner.',
          'Alle 4 vorherigen Phasen müssen vollständig beherrscht sein.',
          'Leichte partnergestützte Tritte oder kontrolliertes Baumstamm-Schwingen.',
          'Immer mit aktivem Qi-Schutz und korrekter Atemtechnik.',
        ],
        warning: 'Ohne erfahrene Anleitung NICHT durchführen. Diese Übung erfordert vollständige Beherrschung aller Vorstufen.',
      },
    ],
    progressionTip: 'Erhaltung ist das Ziel: 4–5 Tage pro Woche die Vollsequenz, 1–2 intensive Sessions pro Woche.',
  },
];

export const GENERAL_RULES: string[] = [
  'Vor Beginn einen Arzt konsultieren – besonders bei Vorerkrankungen.',
  'Trainiere in einem warmen Raum mit entspanntem Geist und entleerter Blase.',
  'Verwende immer tiefe Dantian-Atmung: Einatmen → Bauch dehnt sich, Ausatmen → Beckenboden sanft anheben.',
  'Bei stechendem oder scharfem Schmerz sofort aufhören. Leichter Muskelkater zu Beginn ist normal.',
  'Zur nächsten Phase nur wechseln, wenn die aktuelle Phase 2+ Wochen komfortabel ist.',
  'Mindestens 1 Ruhetag pro Woche einplanen.',
  'Jede Session protokollieren: Datum, Dauer, Wohlbefinden.',
  'Ausreichend schlafen und Stress minimieren – das Nervensystem braucht Erholung.',
];

export const NUTRITION_TIPS: string[] = [
  'Warme, nährende Küche bevorzugen (z.B. Suppen, gedünstetes Gemüse).',
  'Nierenstärkende Lebensmittel: schwarze Bohnen, Walnüsse, Kürbiskerne, dunkle Beeren.',
  'Ausreichend trinken – warmes Wasser oder Kräutertee.',
  'Alkohol und scharfes Essen vor dem Training meiden.',
];

export const WEEKLY_SCHEDULE = [
  { days: 'Mo–Fr', focus: 'Volle Phasen-Routine' },
  { days: 'Sa', focus: 'Leichte oder aktive Erholung' },
  { days: 'So', focus: 'Ruhe oder sanfte Atemübungen' },
];

export function getPhaseColor(phaseId: string): string {
  const map: Record<string, string> = {
    phase1: '#27AE60',
    phase2: '#2980B9',
    phase3: '#E67E22',
    phase4: '#E74C3C',
    phase5: '#8E44AD',
  };
  return map[phaseId] ?? '#999999';
}
