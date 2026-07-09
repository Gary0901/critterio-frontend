import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { PetStatus } from '../../types';

interface Props {
  status: PetStatus;
  label: string;
}

const statusConfig: Record<PetStatus, { bg: string; text: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  healthy: {
    bg: Colors.secondaryContainer,
    text: Colors.onSecondaryContainer,
    icon: 'check-circle',
  },
  due_soon: {
    bg: Colors.errorContainer,
    text: Colors.onErrorContainer,
    icon: 'event-repeat',
  },
  warning: {
    bg: Colors.primaryFixed,
    text: Colors.primary,
    icon: 'info',
  },
};

export default function Badge({ status, label }: Props) {
  const config = statusConfig[status];
  return (
    <View style={[styles.container, { backgroundColor: config.bg }]}>
      <MaterialIcons name={config.icon} size={12} color={config.text} />
      <Text style={[styles.text, { color: config.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
