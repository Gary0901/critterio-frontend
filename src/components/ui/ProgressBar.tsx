import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemeColors } from '../../constants/themes';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';

interface Props {
  percent: number; // 0–100
  height?: number;
  color?: string;
}

export default function ProgressBar({ percent, height = 4, color }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const clamped = Math.min(100, Math.max(0, percent));
  // 預設值不能寫在參數上 —— 那裡取不到 theme
  const fillColor = color ?? colors.primaryContainer;
  return (
    <View style={[styles.track, { height }]}>
      <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: fillColor, height }]} />
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: c.surfaceContainer,
    borderRadius: 9999,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 9999,
  },
});
