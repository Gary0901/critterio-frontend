import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
} from '@expo-google-fonts/quicksand';
import { Ole_400Regular } from '@expo-google-fonts/ole';

import AppNavigation from './src/navigation';
import { AuthProvider } from './src/context/AuthContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://f67cfce74c01b6b7657ec977d7ca370b@o4511717702893568.ingest.us.sentry.io/4511717815484416',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: false,

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

/**
 * 字型與主題偏好都是非同步載入的，兩邊都好了才渲染 App，
 * 否則第一幀會閃一下錯誤的配色。
 */
function AppContent({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { colors, isDark, ready } = useTheme();

  if (!fontsLoaded || !ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <AuthProvider>
      <NotificationProvider>
        {/* style="auto" 只認系統的深淺，認不出我們的自訂主題，所以顯式指定 */}
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <AppNavigation />
      </NotificationProvider>
    </AuthProvider>
  );
}

export default Sentry.wrap(function App() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
    Ole_400Regular,
    // 分享卡標語專用。這是 jf open 粉圓子集化後的版本，只含標語那 12 個字（6KB）。
    // 全字重繁中字型要 4.7MB，只為一句固定文案不值得——動態內容（寵物名、日記）
    // 維持系統的蘋方即可。授權與更名要求見 assets/fonts/OFL.txt
    CritterioTagline: require('./assets/fonts/CritterioTagline.ttf'),
  });

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent fontsLoaded={fontsLoaded} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
});
