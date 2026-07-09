// app/(tabs)/energy.tsx
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import ModuleStub from '../../components/ModuleStub';
import { MODULES } from '../../constants/theme';

const mod = MODULES.find((m) => m.key === 'energy')!;

export default function EnergyScreen() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ModuleStub emoji={mod.emoji} color={mod.color} />
    </SafeAreaView>
  );
}
