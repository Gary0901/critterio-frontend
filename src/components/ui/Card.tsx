import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../constants/colors';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'dashed';
}

export default function Card({ children, style, variant = 'default' }: Props) {
  return (
    <View style={[styles.card, variant === 'dashed' && styles.dashed, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceVariant,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  },
  dashed: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderStyle: 'dashed',
    borderColor: Colors.outlineVariant,
  },
});
