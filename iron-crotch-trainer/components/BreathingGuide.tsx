import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const CIRCLE_SIZE = Math.min(width * 0.68, 280);

const MIN_SCALE = 0.42;
const MAX_SCALE = 1.0;

type BreathPhase = 'idle' | 'inhale' | 'exhale';

type Props = {
  visible: boolean;
  onClose: () => void;
  inhaleSeconds?: number;
  exhaleSeconds?: number;
  targetBreaths?: number;
  title?: string;
};

const PHASE_COLORS: Record<BreathPhase, string> = {
  idle: '#666666',
  inhale: '#D4A017',
  exhale: '#2980B9',
};

const PHASE_LABELS: Record<BreathPhase, string> = {
  idle: 'Bereit',
  inhale: 'Einatmen',
  exhale: 'Ausatmen',
};

const PHASE_SUBLABELS: Record<BreathPhase, string> = {
  idle: 'Tippe Start zum Beginnen',
  inhale: 'Bauch dehnt sich ...',
  exhale: 'Beckenboden sanft anheben ...',
};

export default function BreathingGuide({
  visible,
  onClose,
  inhaleSeconds = 5,
  exhaleSeconds = 7,
  targetBreaths = 40,
  title = 'Atemführung',
}: Props) {
  const scale = useRef(new Animated.Value(MIN_SCALE)).current;
  const ring1Opacity = useRef(new Animated.Value(0)).current;
  const ring1Scale = useRef(new Animated.Value(1)).current;
  const ring2Opacity = useRef(new Animated.Value(0)).current;
  const ring2Scale = useRef(new Animated.Value(1)).current;

  const [phase, setPhase] = useState<BreathPhase>('idle');
  const [breathCount, setBreathCount] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(inhaleSeconds);
  const [isActive, setIsActive] = useState(false);
  const [done, setDone] = useState(false);

  const isActiveRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const color = PHASE_COLORS[phase];

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startCountdown(seconds: number) {
    setSecondsLeft(seconds);
    let remaining = seconds - 1;
    timerRef.current = setInterval(() => {
      if (remaining <= 0) {
        stopTimer();
        return;
      }
      setSecondsLeft(remaining);
      remaining -= 1;
    }, 1000);
  }

  function triggerRipple(colorHex: string) {
    ring1Scale.setValue(1);
    ring1Opacity.setValue(0.45);
    ring2Scale.setValue(1);
    ring2Opacity.setValue(0.25);

    Animated.parallel([
      Animated.timing(ring1Scale, {
        toValue: 1.55,
        duration: 1200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(ring1Opacity, {
        toValue: 0,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(200),
        Animated.parallel([
          Animated.timing(ring2Scale, {
            toValue: 1.9,
            duration: 1400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(ring2Opacity, {
            toValue: 0,
            duration: 1400,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }

  const runCycle = useCallback(
    (currentCount: number) => {
      if (!isActiveRef.current) return;

      // — Inhale —
      setPhase('inhale');
      startCountdown(inhaleSeconds);

      Animated.timing(scale, {
        toValue: MAX_SCALE,
        duration: inhaleSeconds * 1000,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }).start(({ finished }) => {
        stopTimer();
        if (!finished || !isActiveRef.current) return;

        const next = currentCount + 1;
        setBreathCount(next);
        triggerRipple(PHASE_COLORS.exhale);

        if (next >= targetBreaths) {
          isActiveRef.current = false;
          setIsActive(false);
          setPhase('idle');
          setDone(true);
          Animated.timing(scale, {
            toValue: MIN_SCALE,
            duration: 800,
            useNativeDriver: true,
          }).start();
          return;
        }

        // — Exhale —
        setPhase('exhale');
        startCountdown(exhaleSeconds);

        Animated.timing(scale, {
          toValue: MIN_SCALE,
          duration: exhaleSeconds * 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }).start(({ finished }) => {
          stopTimer();
          if (!finished || !isActiveRef.current) return;
          runCycle(next);
        });
      });
    },
    [inhaleSeconds, exhaleSeconds, targetBreaths]
  );

  function handleStart() {
    setDone(false);
    setBreathCount(0);
    scale.setValue(MIN_SCALE);
    ring1Scale.setValue(1);
    ring1Opacity.setValue(0);
    ring2Scale.setValue(1);
    ring2Opacity.setValue(0);
    isActiveRef.current = true;
    setIsActive(true);
    runCycle(0);
  }

  function handleStop() {
    isActiveRef.current = false;
    setIsActive(false);
    setPhase('idle');
    stopTimer();
    scale.stopAnimation();
    Animated.timing(scale, {
      toValue: MIN_SCALE,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }

  function handleClose() {
    handleStop();
    onClose();
  }

  useEffect(() => {
    if (!visible) handleStop();
    return () => {
      stopTimer();
      isActiveRef.current = false;
    };
  }, [visible]);

  const progress = targetBreaths > 0 ? breathCount / targetBreaths : 0;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title}</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Phase label */}
        <View style={styles.phaseBlock}>
          <Text style={[styles.phaseLabel, { color }]}>{PHASE_LABELS[phase]}</Text>
          <Text style={styles.phaseSub}>{PHASE_SUBLABELS[phase]}</Text>
        </View>

        {/* Circle animation */}
        <View style={styles.circleContainer}>
          {/* Outer track ring */}
          <View style={[styles.trackRing, { borderColor: color + '30' }]} />

          {/* Ripple rings */}
          <Animated.View
            style={[
              styles.rippleRing,
              {
                borderColor: color,
                opacity: ring1Opacity,
                transform: [{ scale: ring1Scale }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.rippleRing,
              {
                borderColor: color,
                opacity: ring2Opacity,
                transform: [{ scale: ring2Scale }],
              },
            ]}
          />

          {/* Breathing circle */}
          <Animated.View
            style={[
              styles.circle,
              {
                backgroundColor: color + '18',
                borderColor: color,
                transform: [{ scale }],
              },
            ]}
          />

          {/* Center content */}
          <View style={styles.centerContent} pointerEvents="none">
            {isActive ? (
              <>
                <Text style={[styles.secondsNum, { color }]}>{secondsLeft}</Text>
                <Text style={[styles.secondsLabel, { color: color + 'AA' }]}>Sek</Text>
              </>
            ) : done ? (
              <>
                <Text style={styles.doneText}>✓</Text>
                <Text style={styles.doneLabel}>Fertig!</Text>
              </>
            ) : (
              <Text style={styles.idleIcon}>☯</Text>
            )}
          </View>
        </View>

        {/* Breath counter */}
        <View style={styles.counterRow}>
          <Text style={[styles.counterNum, { color }]}>{breathCount}</Text>
          <Text style={styles.counterSlash}> / </Text>
          <Text style={styles.counterTarget}>{targetBreaths}</Text>
          <Text style={styles.counterLabel}> Atemzüge</Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              { backgroundColor: color, width: `${progress * 100}%` },
            ]}
          />
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {!isActive ? (
            <TouchableOpacity
              style={[styles.startBtn, { backgroundColor: color }]}
              onPress={handleStart}
              activeOpacity={0.8}
            >
              <Text style={styles.startBtnText}>{done ? 'Nochmal' : 'Start'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.stopBtn} onPress={handleStop} activeOpacity={0.8}>
              <Text style={styles.stopBtnText}>Stopp</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Info footer */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={[styles.infoValue, { color: PHASE_COLORS.inhale }]}>{inhaleSeconds}s</Text>
            <Text style={styles.infoLabel}>Einatmen</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoItem}>
            <Text style={[styles.infoValue, { color: PHASE_COLORS.exhale }]}>{exhaleSeconds}s</Text>
            <Text style={styles.infoLabel}>Ausatmen</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoItem}>
            <Text style={styles.infoValue}>{targetBreaths}</Text>
            <Text style={styles.infoLabel}>Ziel</Text>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
    alignItems: 'center',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#EEEEEE',
    letterSpacing: 0.3,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 18,
    color: '#666666',
  },
  phaseBlock: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 32,
  },
  phaseLabel: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  phaseSub: {
    fontSize: 14,
    color: '#666666',
    letterSpacing: 0.2,
  },
  circleContainer: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  trackRing: {
    position: 'absolute',
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 1.5,
  },
  rippleRing: {
    position: 'absolute',
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 2,
  },
  circle: {
    position: 'absolute',
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 2.5,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  secondsNum: {
    fontSize: 52,
    fontWeight: '900',
    lineHeight: 60,
  },
  secondsLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
  },
  doneText: {
    fontSize: 48,
    color: '#27AE60',
  },
  doneLabel: {
    fontSize: 14,
    color: '#27AE60',
    fontWeight: '700',
  },
  idleIcon: {
    fontSize: 44,
    color: '#333333',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  counterNum: {
    fontSize: 22,
    fontWeight: '900',
  },
  counterSlash: {
    fontSize: 16,
    color: '#444444',
  },
  counterTarget: {
    fontSize: 18,
    color: '#444444',
    fontWeight: '700',
  },
  counterLabel: {
    fontSize: 13,
    color: '#555555',
  },
  progressTrack: {
    width: '72%',
    height: 4,
    backgroundColor: '#1F1F1F',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 36,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  controls: {
    marginBottom: 32,
  },
  startBtn: {
    borderRadius: 50,
    paddingVertical: 16,
    paddingHorizontal: 56,
    alignItems: 'center',
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stopBtn: {
    borderRadius: 50,
    paddingVertical: 16,
    paddingHorizontal: 56,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#444444',
  },
  stopBtnText: {
    color: '#888888',
    fontSize: 18,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  infoItem: {
    flex: 1,
    alignItems: 'center',
  },
  infoValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#EEEEEE',
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 11,
    color: '#555555',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  infoDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#222222',
  },
});
