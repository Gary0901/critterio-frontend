import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../types/navigation';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import client from '../../api/client';

const PASSWORD_RULES = [
  { key: 'length', label: '至少 8 個字元',        test: (p: string) => p.length >= 8 },
  { key: 'upper',  label: '至少一個大寫字母（A–Z）', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'number', label: '至少一個數字（0–9）',    test: (p: string) => /[0-9]/.test(p) },
];

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ResetPassword'>;
  route: RouteProp<RootStackParamList, 'ResetPassword'>;
};

export default function ResetPasswordScreen({ navigation, route }: Props) {
  const { token } = route.params;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const rulesMet = PASSWORD_RULES.map((r) => r.test(password));
  const allRulesMet = rulesMet.every(Boolean);
  const showRules = password.length > 0;

  const handleReset = async () => {
    if (!password || !confirm) {
      setError('請填寫所有欄位。');
      return;
    }
    if (!allRulesMet) {
      setError('請確認密碼符合所有規則。');
      return;
    }
    if (password !== confirm) {
      setError('兩次輸入的密碼不一致。');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await client.post('/auth/reset-password', { token, newPassword: password });
      setDone(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || '重設失敗，連結可能已過期。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.logo}>🐾 Critterio</Text>

        {done ? (
          <View style={styles.form}>
            <View style={styles.successIcon}>
              <MaterialIcons name="check-circle" size={36} color={Colors.secondary} />
            </View>
            <Text style={styles.successTitle}>密碼重設成功！</Text>
            <Text style={styles.successDesc}>請使用新密碼重新登入。</Text>
            <Button label="前往登入 →" onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })} />
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.formTitle}>設定新密碼</Text>
            <Text style={styles.formSub}>請輸入您的新密碼，完成後即可重新登入。</Text>

            <Input
              label="新密碼"
              placeholder="至少 8 個字元"
              isPassword
              value={password}
              onChangeText={setPassword}
            />

            {showRules && (
              <View style={styles.rulesBox}>
                {PASSWORD_RULES.map((rule, i) => {
                  const met = rulesMet[i];
                  return (
                    <View key={rule.key} style={styles.ruleRow}>
                      <MaterialIcons
                        name={met ? 'check-circle' : 'radio-button-unchecked'}
                        size={16}
                        color={met ? Colors.secondary : Colors.outline}
                      />
                      <Text style={[styles.ruleText, met && styles.ruleTextMet]}>
                        {rule.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            <Input
              label="確認新密碼"
              placeholder="再輸入一次"
              isPassword
              value={confirm}
              onChangeText={setConfirm}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Button label="確認重設 →" onPress={handleReset} loading={loading} />
          </View>
        )}

        {!done && (
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}>返回登入</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 80,
    paddingBottom: 40,
    gap: 24,
  },
  logo: {
    fontFamily: FontFamily.brand,
    fontSize: FontSize.headlineMD + 4,
    color: Colors.primary,
  },
  form: {
    width: '100%',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 24,
    padding: 24,
    gap: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  formTitle: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineMD,
    color: Colors.onSurface,
  },
  formSub: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurfaceVariant,
    lineHeight: 22,
  },
  rulesBox: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ruleText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: Colors.outline,
  },
  ruleTextMet: {
    color: Colors.secondary,
  },
  errorText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: Colors.error,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  successTitle: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineMD,
    color: Colors.onSurface,
    textAlign: 'center',
  },
  successDesc: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
  },
  loginLink: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: Colors.onSurfaceVariant,
  },
});
