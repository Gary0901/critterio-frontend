import { useEffect, useState } from 'react';
import { Platform, Alert, StyleSheet } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

type Props = {
  /** 登入頁用 SIGN_IN、註冊頁用 SIGN_UP，文案會跟著變 */
  type?: 'signIn' | 'signUp';
  onError?: (message: string) => void;
};

/**
 * Sign in with Apple 按鈕。
 *
 * 用 Apple 提供的原生按鈕而不是自家的 Button 元件——Apple 的人機介面指南
 * 對這顆按鈕的外觀有規範，自己刻一顆有被退件的風險。
 *
 * Android／不支援的裝置上會回傳 null（整顆不顯示），
 * 這同時也滿足了「Android 要隱藏 Apple 登入」那項上架需求。
 */
export default function AppleSignInButton({ type = 'signIn', onError }: Props) {
  const { loginWithApple } = useAuth();
  const { isDark } = useTheme();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then(setAvailable)
      .catch(() => setAvailable(false));
  }, []);

  if (!available) return null;

  const handlePress = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        onError?.('Apple 登入失敗，請稍後再試');
        return;
      }

      // fullName 只有第一次授權才拿得到，之後永遠是 null——
      // 所以這裡拿到就要立刻送給後端存起來，錯過補不回來
      const fullName = [credential.fullName?.familyName, credential.fullName?.givenName]
        .filter(Boolean)
        .join('');

      await loginWithApple(credential.identityToken, fullName || undefined);
    } catch (e: any) {
      // 使用者自己取消不是錯誤，不要跳警告打擾他
      if (e?.code === 'ERR_REQUEST_CANCELED') return;
      const message = e?.message ?? 'Apple 登入失敗，請稍後再試';
      if (onError) onError(message);
      else Alert.alert('Apple 登入失敗', message);
    }
  };

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={
        type === 'signUp'
          ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
          : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
      }
      // 深色底要用白色按鈕才看得見，反之亦然
      buttonStyle={
        isDark
          ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
          : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
      }
      cornerRadius={9999}
      style={styles.button}
      onPress={handlePress}
    />
  );
}

const styles = StyleSheet.create({
  // 高度與圓角對齊自家的 Button（paddingVertical 16 + 文字行高 ≈ 52、borderRadius 9999）
  button: { width: '100%', height: 52 },
});
