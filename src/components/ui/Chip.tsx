import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemeColors } from '../../constants/themes';
import { useThemedStyles } from '../../context/ThemeContext';
import { FontFamily, FontSize } from '../../constants/typography';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export default function Chip({ label, selected = false, onPress }: Props) {
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={[styles.chip, selected && styles.selected]}
    >
      <Text style={[styles.text, selected && styles.selectedText]}>{label}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
    backgroundColor: `${c.secondary}1A`,
  },
  selected: {
    backgroundColor: c.secondaryContainer,
  },
  text: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: c.secondary,
  },
  selectedText: {
    color: c.onSecondaryContainer,
  },
});
