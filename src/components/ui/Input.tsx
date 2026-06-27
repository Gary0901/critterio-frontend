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
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';

interface Props extends TextInputProps {
  label?: string;
  isPassword?: boolean;
  error?: string;
}

export default function Input({ label, isPassword = false, error, style, ...rest }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.container, error ? styles.containerError : null]}>
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={Colors.outlineVariant}
          secureTextEntry={isPassword && !visible}
          {...rest}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setVisible((v) => !v)} style={styles.eyeBtn}>
            <MaterialIcons
              name={visible ? 'visibility' : 'visibility-off'}
              size={20}
              color={Colors.outline}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: Colors.onSurface,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  containerError: {
    borderColor: Colors.error,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurface,
  },
  eyeBtn: { padding: 4 },
  error: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: Colors.error,
  },
});
