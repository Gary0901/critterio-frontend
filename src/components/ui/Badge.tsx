import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemeColors } from '../../constants/themes';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { FontFamily, FontSize } from '../../constants/typography';
import { PetStatus } from '../../types';

interface Props {
  status: PetStatus;
  label: string;
}

const makeStatusConfig = (
  c: ThemeColors,
): Record<PetStatus, { bg: string; text: string; icon: keyof typeof MaterialIcons.glyphMap }> => ({
  healthy: {
    bg: c.secondaryContainer,
    text: c.onSecondaryContainer,
    icon: 'check-circle',
  },
  due_soon: {
    bg: c.errorContainer,
    text: c.onErrorContainer,
    icon: 'event-repeat',
  },
  warning: {
    bg: c.primaryFixed,
    text: c.primary,
    icon: 'info',
  },
});

export default function Badge({ status, label }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const config = makeStatusConfig(colors)[status];
  return (
    <View style={[styles.container, { backgroundColor: config.bg }]}>
      <MaterialIcons name={config.icon} size={12} color={config.text} />
      <Text style={[styles.text, { color: config.text }]}>{label}</Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  text: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
  },
});
