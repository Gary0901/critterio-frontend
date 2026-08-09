import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { ThemeColors } from '../../constants/themes';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { FontFamily, FontSize } from '../../constants/typography';

type Variant = 'primary' | 'outline' | 'ghost';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export default function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[styles.base, styles[variant], disabled && styles.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onPrimary : colors.primary} />
      ) : (
        <>
          {icon}
          <Text style={[styles.label, styles[`${variant}Text`], textStyle]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 9999,
  },
  primary: {
    backgroundColor: c.primary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: c.outline,
  },
  ghost: {
    backgroundColor: c.surfaceContainerLow,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: FontSize.bodyMD,
    fontFamily: FontFamily.headlineSemiBold,
  },
  primaryText: {
    color: c.onPrimary,
  },
  outlineText: {
    color: c.onSurface,
  },
  ghostText: {
    color: c.onSurface,
  },
});
