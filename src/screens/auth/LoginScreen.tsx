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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { RootStackParamList } from '../../types/navigation';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { ThemeColors } from '../../constants/themes';
import { useThemedStyles } from '../../context/ThemeContext';
import { FontFamily, FontSize } from '../../constants/typography';
import { useAuth } from '../../context/AuthContext';

WebBrowser.maybeCompleteAuthSession();

const googleExtra = (Constants.expoConfig?.extra as any)?.google ?? {};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

export default function LoginScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

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
        .then(() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] }))
        .catch((e: any) => setError(e?.response?.data?.message || e?.message || 'Google 登入失敗，請再試一次。'))
        .finally(() => setGoogleLoading(false));
    } else if (googleResponse?.type === 'error') {
      setError('Google 登入失敗，請再試一次。');
    }
  }, [googleResponse]);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('請填寫所有欄位。');
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      setError('請輸入有效的電子郵件格式。');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } catch (e: any) {
      setError(e?.response?.data?.message || '登入失敗，請再試一次。');
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
        {/* Header */}
        <Text style={styles.logo}>🐾 Critterio</Text>
        <Text style={styles.tagline}>歡迎回到您的寵物快樂天地。</Text>

        {/* Form */}
        <View style={styles.form}>
          <Input
            label="電子郵件"
            placeholder="hello@pawfriend.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            label="密碼"
            placeholder="••••••••"
            isPassword
            value={password}
            onChangeText={setPassword}
            error={error}
          />
          <TouchableOpacity style={styles.forgotRow} onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.forgot}>忘記密碼？</Text>
          </TouchableOpacity>

          <Button label="登入 →" onPress={handleLogin} loading={loading} />

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>或使用以下方式繼續</Text>
            <View style={styles.line} />
          </View>

          {/* Social */}
          <Button
            label="使用 Google 繼續"
            variant="outline"
            loading={googleLoading}
            disabled={!googleRequest}
            onPress={() => promptGoogleAsync()}
          />
          <Button
            label="使用 Apple 繼續（即將推出）"
            variant="outline"
            disabled
            onPress={() => {}}
          />
        </View>

        {/* Sign up link */}
        <View style={styles.signupRow}>
          <Text style={styles.signupText}>還沒有帳號？</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.signupLink}>立即註冊</Text>
          </TouchableOpacity>
        </View>
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
    paddingTop: 80,
    paddingBottom: 40,
  },
  logo: {
    fontFamily: FontFamily.brand,
    fontSize: FontSize.headlineMD + 4,
    color: c.primary,
    marginBottom: 8,
  },
  tagline: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
    marginBottom: 32,
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
  forgotRow: { alignSelf: 'flex-end' },
  forgot: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: c.primary,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  line: { flex: 1, height: 1, backgroundColor: c.outlineVariant },
  dividerText: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
  },
  signupRow: {
    flexDirection: 'row',
    marginTop: 24,
  },
  signupText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
  },
  signupLink: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSize.bodyMD,
    color: c.primary,
  },
});
