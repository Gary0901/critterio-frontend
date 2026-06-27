import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';

interface Props {
  percent: number; // 0–100
  height?: number;
  color?: string;
}

export default function ProgressBar({ percent, height = 4, color = Colors.primaryContainer }: Props) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <View style={[styles.track, { height }]}>
      <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: color, height }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: Colors.surfaceContainer,
    borderRadius: 9999,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 9999,
  },
});
