import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemeColors } from '../../constants/themes';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { FontFamily, FontSize } from '../../constants/typography';

interface Props extends TextInputProps {
  label?: string;
  isPassword?: boolean;
  error?: string;
}

export default function Input({ label, isPassword = false, error, style, ...rest }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.container, error ? styles.containerError : null]}>
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={colors.outlineVariant}
          secureTextEntry={isPassword && !visible}
          {...rest}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setVisible((v) => !v)} style={styles.eyeBtn}>
            <MaterialIcons
              name={visible ? 'visibility' : 'visibility-off'}
              size={20}
              color={colors.outline}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  wrapper: { gap: 6 },
  label: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurface,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surfaceContainerLow,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  containerError: {
    borderColor: c.error,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
  },
  eyeBtn: { padding: 4 },
  error: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.error,
  },
});
