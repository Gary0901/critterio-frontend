import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import HamsterLoading from '../../components/ui/HamsterLoading';
import { ThemeColors } from '../../constants/themes';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { FontFamily, FontSize } from '../../constants/typography';
import client from '../../api/client';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ForgotPassword'>;
};

export default function ForgotPasswordScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!email) {
      setError('請輸入您的電子郵件地址。');
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      setError('請輸入有效的電子郵件格式。');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await client.post('/auth/forgot-password', { email });
      setSent(true);
    } catch {
      setError('發生錯誤，請再試一次。');
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
        {/* Back button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backText}>返回登入</Text>
        </TouchableOpacity>

        {/* Logo */}
        <Text style={styles.logo}>🐾 Critterio</Text>
        <Text style={styles.tagline}>別擔心，我們來幫您找回帳號。</Text>

        {sent ? (
          /* ── Success state ── */
          <View style={styles.form}>
            <View style={styles.successIcon}>
              <MaterialIcons name="mark-email-read" size={36} color={colors.secondary} />
            </View>
            <Text style={styles.successTitle}>請查看您的收件匣！</Text>
            <Text style={styles.successDesc}>
              {"我們已將密碼重設連結寄至\n"}
              <Text style={styles.successEmail}>{email}</Text>
            </Text>
            <Text style={styles.successHint}>
              沒有收到？請檢查{' '}
              <Text style={styles.successHintHighlight}>垃圾郵件</Text>
              {' '}資料夾或再試一次。
            </Text>
            <Button
              label="返回登入"
              onPress={() => navigation.navigate('Login')}
            />
            <TouchableOpacity onPress={() => { setSent(false); setEmail(''); }}>
              <Text style={styles.retryText}>使用其他電子郵件</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ── Form state ── */
          <View style={styles.form}>
            <Text style={styles.formTitle}>忘記密碼？</Text>
            <Text style={styles.formSub}>
              輸入您帳號綁定的電子郵件，我們將寄送重設連結給您。
            </Text>
            <Input
              label="電子郵件"
              placeholder="hello@pawfriend.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              error={error}
            />
            <Button label="寄送重設連結 →" onPress={handleSend} loading={loading} />
          </View>
        )}

        {/* Bottom link */}
        {!sent && (
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>記起密碼了？</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>立即登入</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      {/* Loading overlay */}
      <Modal visible={loading} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <HamsterLoading
            hamsterSource={require('../../../photo/loading.png')}
            color={colors.primary}
            size={180}
          />
        </View>
      </Modal>
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
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 32,
  },
  backText: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: c.primary,
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
    alignItems: 'stretch',
  },
  formTitle: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineMD,
    color: c.onSurface,
  },
  formSub: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
    lineHeight: 22,
  },
  // Success state
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: c.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  successTitle: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineMD,
    color: c.onSurface,
    textAlign: 'center',
  },
  successDesc: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
  },
  successEmail: {
    fontFamily: FontFamily.bodySemiBold,
    color: c.onSurface,
  },
  successHint: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
    textAlign: 'center',
  },
  successHintHighlight: {
    fontFamily: FontFamily.headlineBold,
    color: c.primary,
  },
  retryText: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
    textAlign: 'center',
  },
  loginRow: {
    flexDirection: 'row',
    marginTop: 24,
  },
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
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
