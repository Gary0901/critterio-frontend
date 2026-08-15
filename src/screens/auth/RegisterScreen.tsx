import { useState, useEffect } from 'react';
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
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { RootStackParamList } from '../../types/navigation';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import AppleSignInButton from '../../components/auth/AppleSignInButton';
import { ThemeColors } from '../../constants/themes';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { FontFamily, FontSize } from '../../constants/typography';
import { useAuth } from '../../context/AuthContext';

WebBrowser.maybeCompleteAuthSession();

const googleExtra = (Constants.expoConfig?.extra as any)?.google ?? {};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PASSWORD_MAX = 100;

const PASSWORD_RULES = [
  { key: 'length', label: '至少 8 個字元',              test: (p: string) => p.length >= 8 },
  { key: 'max',    label: `不超過 ${PASSWORD_MAX} 個字元`, test: (p: string) => p.length <= PASSWORD_MAX },
  { key: 'upper',  label: '至少一個大寫字母（A–Z）',     test: (p: string) => /[A-Z]/.test(p) },
  { key: 'number', label: '至少一個數字（0–9）',         test: (p: string) => /[0-9]/.test(p) },
];

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Register'>;
};

export default function RegisterScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { register, loginWithGoogle } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');

  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    iosClientId: googleExtra.iosClientId,
    androidClientId: googleExtra.androidClientId,
    webClientId: googleExtra.webClientId,
  });

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const idToken = googleResponse.params?.id_token;
      if (!idToken) return;
      setGoogleLoading(true);
      setError('');
      loginWithGoogle(idToken)
        .then(() => navigation.navigate('AddPet', { isOnboarding: true }))
        .catch((e: any) => setError(e?.response?.data?.message || e?.message || 'Google 註冊失敗，請再試一次。'))
        .finally(() => setGoogleLoading(false));
    } else if (googleResponse?.type === 'error') {
      setError('Google 註冊失敗，請再試一次。');
    }
  }, [googleResponse]);

  const passwordRulesMet = PASSWORD_RULES.map((r) => r.test(password));
  const allPasswordRulesMet = passwordRulesMet.every(Boolean);
  const showPasswordRules = password.length > 0;

  const handleEmailBlur = () => {
    if (email && !EMAIL_REGEX.test(email)) {
      setEmailError('請輸入有效的電子郵件格式');
    } else {
      setEmailError('');
    }
  };

  const handleRegister = async () => {
    if (!name || !email || !password) {
      setError('請填寫所有欄位。');
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      setEmailError('請輸入有效的電子郵件格式');
      return;
    }
    if (!allPasswordRulesMet) {
      setError('請確認密碼符合所有規則。');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await register(name, email, password);
      navigation.navigate('AddPet', { isOnboarding: true });
    } catch (e: any) {
      setError((e as any)?.response?.data?.message || '註冊失敗，請再試一次。');
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
        <View style={styles.logoBox}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoEmoji}>🐾</Text>
          </View>
          <Text style={styles.title}>加入 <Text style={styles.titleBrand}>Critterio</Text></Text>
          <Text style={styles.sub}>
            成為最溫暖寵物愛好者社群的一員。
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="姓名"
            placeholder="例如：王小明"
            autoCapitalize="words"
            value={name}
            onChangeText={setName}
          />
          <Input
            label="電子郵件"
            placeholder="yourname@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (emailError) setEmailError('');
            }}
            onBlur={handleEmailBlur}
            error={emailError}
          />
          <Input
            label="設定密碼"
            placeholder="至少 8 個字元"
            isPassword
            maxLength={PASSWORD_MAX}
            value={password}
            onChangeText={setPassword}
          />

          {showPasswordRules && (
            <View style={styles.rulesBox}>
              {PASSWORD_RULES.map((rule, i) => {
                const met = passwordRulesMet[i];
                return (
                  <View key={rule.key} style={styles.ruleRow}>
                    <MaterialIcons
                      name={met ? 'check-circle' : 'radio-button-unchecked'}
                      size={16}
                      color={met ? colors.secondary : colors.outline}
                    />
                    <Text style={[styles.ruleText, met && styles.ruleTextMet]}>
                      {rule.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Button label="立即開始 →" onPress={handleRegister} loading={loading} />

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>或使用以下方式註冊</Text>
            <View style={styles.line} />
          </View>

          {/* 改為直向排列：Apple 原生按鈕的文案較長，半寬會擠；
              Apple 的規範也要求它的顯著程度不低於其他第三方登入方式 */}
          <View style={styles.socialCol}>
            <Button
              label="使用 Google 註冊"
              variant="outline"
              loading={googleLoading}
              disabled={!googleRequest}
              onPress={() => promptGoogleAsync()}
            />
            <AppleSignInButton type="signUp" onError={(m) => setError(m)} />
          </View>
        </View>

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>已有帳號？</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}>立即登入</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.terms}>
          建立帳號即表示您同意 Critterio 的{' '}
          <Text style={styles.termsLink} onPress={() => navigation.navigate('Terms')}>服務條款</Text>
          {' '}與{' '}
          <Text style={styles.termsLink} onPress={() => navigation.navigate('PrivacyPolicy')}>隱私政策</Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: c.background,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
    gap: 24,
  },
  logoBox: { alignItems: 'center', gap: 8 },
  logoIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: c.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: { fontSize: 28 },
  title: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineMD,
    color: c.onSurface,
  },
  titleBrand: {
    fontFamily: FontFamily.brand,
    fontSize: FontSize.headlineMD + 10,
    color: c.primary,
  },
  sub: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
    textAlign: 'center',
  },
  form: {
    width: '100%',
    backgroundColor: c.surfaceContainerLowest,
    borderRadius: 24,
    padding: 24,
    gap: 16,
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  rulesBox: {
    backgroundColor: c.surfaceContainerLow,
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
    color: c.outline,
  },
  ruleTextMet: {
    color: c.secondary,
  },
  errorText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.error,
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  line: { flex: 1, height: 1, backgroundColor: c.outlineVariant },
  dividerText: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
  },
  socialCol: { gap: 12 },
  loginRow: { flexDirection: 'row' },
  loginText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
  },
  loginLink: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSize.bodyMD,
    color: c.primary,
  },
  terms: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
    textAlign: 'center',
  },
  termsLink: { color: c.primary },
});
