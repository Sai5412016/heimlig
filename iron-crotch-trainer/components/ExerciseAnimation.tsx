import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Polygon, Rect } from 'react-native-svg';

// Animated SVG primitives
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

const BF = '#232323'; // body fill
const BS = '#3C3C3C'; // body stroke

// ─── Shared body silhouette ──────────────────────────────────────────────────
function Body() {
  return (
    <G>
      {/* Head */}
      <Circle cx="50" cy="16" r="12" fill={BF} stroke={BS} strokeWidth="1.5" />
      {/* Neck */}
      <Rect x="46" y="27" width="8" height="9" fill={BF} />
      {/* Shoulder line */}
      <Ellipse cx="50" cy="37" rx="27" ry="5" fill={BF} stroke={BS} strokeWidth="1" />
      {/* Torso */}
      <Path d="M25 39 L75 39 L71 110 L29 110 Z" fill={BF} stroke={BS} strokeWidth="1.5" />
      {/* Left arm */}
      <Path d="M27 42 Q14 73 12 106" stroke={BF} strokeWidth="8" strokeLinecap="round" fill="none" />
      {/* Right arm */}
      <Path d="M73 42 Q86 73 88 106" stroke={BF} strokeWidth="8" strokeLinecap="round" fill="none" />
      {/* Hips */}
      <Ellipse cx="50" cy="112" rx="23" ry="6" fill={BF} stroke={BS} strokeWidth="1" />
      {/* Left leg */}
      <Path d="M33 116 L30 210" stroke={BF} strokeWidth="10" strokeLinecap="round" fill="none" />
      {/* Right leg */}
      <Path d="M67 116 L70 210" stroke={BF} strokeWidth="10" strokeLinecap="round" fill="none" />
    </G>
  );
}

// Small arrowhead helper
function Arrow({ x1, y1, x2, y2, color }: { x1: number; y1: number; x2: number; y2: number; color: string }) {
  const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
  const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const tipX = x1 + Math.cos(angle * (Math.PI / 180)) * len;
  const tipY = y1 + Math.sin(angle * (Math.PI / 180)) * len;
  const pts = `${tipX},${tipY} ${tipX - 6 * Math.cos((angle - 30) * (Math.PI / 180))},${tipY - 6 * Math.sin((angle - 30) * (Math.PI / 180))} ${tipX - 6 * Math.cos((angle + 30) * (Math.PI / 180))},${tipY - 6 * Math.sin((angle + 30) * (Math.PI / 180))}`;
  return (
    <>
      <Path d={`M${x1} ${y1} L${tipX} ${tipY}`} stroke={color} strokeWidth="1.5" fill="none" strokeDasharray="3 2" />
      <Polygon points={pts} fill={color} />
    </>
  );
}

// ─── 1. Qi-Atmung ────────────────────────────────────────────────────────────
function QiAtmungAnim({ color }: { color: string }) {
  const bellyRx = useRef(new Animated.Value(18)).current;
  const bellyRy = useRef(new Animated.Value(12)).current;
  const bellyOp = useRef(new Animated.Value(0.25)).current;
  const arrowOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(bellyRx, { toValue: 26, duration: 4500, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(bellyRy, { toValue: 18, duration: 4500, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(bellyOp, { toValue: 0.55, duration: 4500, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(arrowOp, { toValue: 1, duration: 2000, useNativeDriver: false }),
        ]),
        Animated.timing(arrowOp, { toValue: 0, duration: 800, useNativeDriver: false }),
        Animated.parallel([
          Animated.timing(bellyRx, { toValue: 18, duration: 6500, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(bellyRy, { toValue: 12, duration: 6500, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(bellyOp, { toValue: 0.25, duration: 6500, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Svg viewBox="0 0 100 220" width="100%" height="100%">
      <Body />
      {/* Dantian glow */}
      <AnimatedEllipse cx="50" cy="88" rx={bellyRx} ry={bellyRy} fill={color} fillOpacity={bellyOp} />
      {/* Label */}
      <Rect x="28" y="126" width="44" height="13" rx="3" fill="#111" />
      <Path d="M28 126 L72 126 L72 139 L28 139 Z" fill="#111" />
    </Svg>
  );
}

// ─── 2. Bauchmassage ─────────────────────────────────────────────────────────
function BauchmassageAnim({ color }: { color: string }) {
  const angle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(angle, { toValue: 1, duration: 2800, easing: Easing.linear, useNativeDriver: false })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const cx = angle.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [50, 72, 50, 28, 50] });
  const cy = angle.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [74, 88, 102, 88, 74] });

  return (
    <Svg viewBox="0 0 100 220" width="100%" height="100%">
      <Body />
      {/* Massage track */}
      <Ellipse cx="50" cy="88" rx="22" ry="14" stroke={color} strokeWidth="1" fill="none" strokeDasharray="3 2" fillOpacity="0.08" />
      {/* Moving hand dot */}
      <AnimatedCircle cx={cx} cy={cy} r="5.5" fill={color} fillOpacity="0.9" />
      {/* Inner highlight */}
      <Ellipse cx="50" cy="88" rx="12" ry="8" fill={color} fillOpacity="0.12" />
    </Svg>
  );
}

// ─── 3. Gewicht hängen ───────────────────────────────────────────────────────
function GewichtAnim({ color }: { color: string }) {
  const swing = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(swing, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(swing, { toValue: -1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const weightX = swing.interpolate({ inputRange: [-1, 0, 1], outputRange: [42, 50, 58] });
  const weightY = swing.interpolate({ inputRange: [-1, 0, 1], outputRange: [150, 148, 150] });
  const ropeX2 = swing.interpolate({ inputRange: [-1, 0, 1], outputRange: [42, 50, 58] });

  return (
    <Svg viewBox="0 0 100 220" width="100%" height="100%">
      <Body />
      {/* Binding point highlight */}
      <Ellipse cx="50" cy="113" rx="10" ry="5" fill={color} fillOpacity="0.4" />
      {/* Rope */}
      <AnimatedRect
        x={ropeX2}
        y="118"
        width="1.5"
        height="22"
        fill={color}
        fillOpacity="0.7"
      />
      {/* Weight */}
      <AnimatedRect
        x={weightX}
        y={weightY}
        width="16"
        height="10"
        rx="3"
        fill={color}
        fillOpacity="0.85"
      />
      {/* Arrow showing weight direction */}
      <Polygon points="50,212 46,206 54,206" fill={color} fillOpacity="0.5" />
    </Svg>
  );
}

// ─── 4. Trommeln ─────────────────────────────────────────────────────────────
function TrommelnAnim({ color }: { color: string }) {
  const leftY = useRef(new Animated.Value(108)).current;
  const rightY = useRef(new Animated.Value(108)).current;
  const targetOp = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        // Left strikes
        Animated.parallel([
          Animated.timing(leftY, { toValue: 124, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: false }),
          Animated.timing(targetOp, { toValue: 0.7, duration: 180, useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.timing(leftY, { toValue: 108, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          Animated.timing(targetOp, { toValue: 0.2, duration: 320, useNativeDriver: false }),
        ]),
        Animated.delay(150),
        // Right strikes
        Animated.parallel([
          Animated.timing(rightY, { toValue: 124, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: false }),
          Animated.timing(targetOp, { toValue: 0.7, duration: 180, useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.timing(rightY, { toValue: 108, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          Animated.timing(targetOp, { toValue: 0.2, duration: 320, useNativeDriver: false }),
        ]),
        Animated.delay(150),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Svg viewBox="0 0 100 220" width="100%" height="100%">
      <Body />
      {/* Target zone */}
      <AnimatedEllipse cx="50" cy="113" rx="20" ry="9" fill={color} fillOpacity={targetOp} />
      {/* Left fist */}
      <AnimatedCircle cx="12" cy={leftY} r="7" fill={color} fillOpacity="0.9" />
      <Circle cx="12" cy="108" r="7" fill={BS} fillOpacity="0.4" />
      {/* Right fist */}
      <AnimatedCircle cx="88" cy={rightY} r="7" fill={color} fillOpacity="0.9" />
      <Circle cx="88" cy="108" r="7" fill={BS} fillOpacity="0.4" />
      {/* Direction arrows */}
      <Polygon points="12,118 9,111 15,111" fill={color} fillOpacity="0.5" />
      <Polygon points="88,118 85,111 91,111" fill={color} fillOpacity="0.5" />
    </Svg>
  );
}

// ─── 5. Handflächenschläge ───────────────────────────────────────────────────
function HandflaechenAnim({ color }: { color: string }) {
  const handX = useRef(new Animated.Value(88)).current;
  const handY = useRef(new Animated.Value(70)).current;
  const impactOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(600),
        // Strike in
        Animated.parallel([
          Animated.timing(handX, { toValue: 64, duration: 280, easing: Easing.in(Easing.quad), useNativeDriver: false }),
          Animated.timing(handY, { toValue: 113, duration: 280, easing: Easing.in(Easing.quad), useNativeDriver: false }),
          Animated.timing(impactOp, { toValue: 0.8, duration: 280, useNativeDriver: false }),
        ]),
        // Hold impact
        Animated.delay(120),
        // Pull back
        Animated.parallel([
          Animated.timing(handX, { toValue: 88, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          Animated.timing(handY, { toValue: 70, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          Animated.timing(impactOp, { toValue: 0, duration: 300, useNativeDriver: false }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Svg viewBox="0 0 100 220" width="100%" height="100%">
      <Body />
      {/* Target zone */}
      <Ellipse cx="50" cy="113" rx="20" ry="9" fill={color} fillOpacity="0.2" />
      {/* Trajectory guide */}
      <Path d="M88 70 Q72 92 64 113" stroke={color} strokeWidth="1" strokeDasharray="3 2" fill="none" strokeOpacity="0.4" />
      {/* Impact burst */}
      <AnimatedEllipse cx="64" cy="113" rx="16" ry="8" fill={color} fillOpacity={impactOp} />
      {/* Moving palm (flat rectangle) */}
      <AnimatedRect x={handX} y={handY} width="12" height="7" rx="2" fill={color} fillOpacity="0.9" />
    </Svg>
  );
}

// ─── 6. Solarplexus ──────────────────────────────────────────────────────────
function SolarplexusAnim({ color }: { color: string }) {
  const handY = useRef(new Animated.Value(52)).current;
  const zoneOp = useRef(new Animated.Value(0.2)).current;
  const zonePulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(400),
        Animated.parallel([
          Animated.timing(handY, { toValue: 66, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: false }),
          Animated.timing(zoneOp, { toValue: 0.7, duration: 200, useNativeDriver: false }),
          Animated.timing(zonePulse, { toValue: 1.25, duration: 200, useNativeDriver: false }),
        ]),
        Animated.delay(100),
        Animated.parallel([
          Animated.timing(handY, { toValue: 52, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          Animated.timing(zoneOp, { toValue: 0.2, duration: 350, useNativeDriver: false }),
          Animated.timing(zonePulse, { toValue: 1, duration: 350, useNativeDriver: false }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Svg viewBox="0 0 100 220" width="100%" height="100%">
      <Body />
      {/* Solar plexus zone (upper abdomen) */}
      <AnimatedEllipse cx="50" cy="68" rx="20" ry="10" fill="#E67E22" fillOpacity={zoneOp} />
      {/* Zone label hint */}
      <Ellipse cx="50" cy="68" rx="20" ry="10" stroke="#E67E22" strokeWidth="1" fill="none" strokeDasharray="2 2" strokeOpacity="0.5" />
      {/* Lower target also shown */}
      <Ellipse cx="50" cy="113" rx="14" ry="7" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="0.8" strokeDasharray="2 2" />
      {/* Tapping hand */}
      <AnimatedRect x="42" y={handY} width="16" height="7" rx="2" fill="#E67E22" fillOpacity="0.9" />
      {/* Down arrow */}
      <Polygon points="50,49 46,43 54,43" fill="#E67E22" fillOpacity="0.5" />
    </Svg>
  );
}

// ─── Dispatch component ──────────────────────────────────────────────────────
const LABELS: Record<string, string> = {
  'qi-atmung': 'Dantian-Bereich · Atemrhythmus folgen',
  'bauchmassage': 'Kreisförmige Massage · Bauchbereich',
  'gewicht-haengen': 'Pendelbewegung · Gewicht hängt frei',
  'trommeln': 'Alternierende Fäuste · Zielzone pulsiert bei Treffer',
  'handflächen': 'Flache Hand schwingt zur Zielzone',
  'solarplexus': 'Solarplexus (oben) + Zielzone (unten)',
};

type Props = {
  animationType: string;
  color: string;
};

export default function ExerciseAnimation({ animationType, color }: Props) {
  const content = (() => {
    switch (animationType) {
      case 'qi-atmung':      return <QiAtmungAnim color={color} />;
      case 'bauchmassage':   return <BauchmassageAnim color={color} />;
      case 'gewicht-haengen': return <GewichtAnim color={color} />;
      case 'trommeln':       return <TrommelnAnim color={color} />;
      case 'handflächen':    return <HandflaechenAnim color={color} />;
      case 'solarplexus':    return <SolarplexusAnim color={color} />;
      default:               return null;
    }
  })();

  if (!content) return null;

  return (
    <View style={styles.container}>
      <View style={styles.svgWrapper}>{content}</View>
      <Text style={styles.label}>{LABELS[animationType] ?? ''}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111111',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  svgWrapper: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    color: '#555555',
    textAlign: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E1E1E',
    letterSpacing: 0.2,
  },
});
