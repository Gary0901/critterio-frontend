import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { ThemeColors } from '../../constants/themes';
import { useThemedStyles } from '../../context/ThemeContext';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'dashed';
}

export default function Card({ children, style, variant = 'default' }: Props) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.card, variant === 'dashed' && styles.dashed, style]}>
      {children}
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: c.surfaceContainerLowest,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: c.surfaceVariant,
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  },
  dashed: {
    backgroundColor: c.surfaceContainerHigh,
    borderStyle: 'dashed',
    borderColor: c.outlineVariant,
  },
});
