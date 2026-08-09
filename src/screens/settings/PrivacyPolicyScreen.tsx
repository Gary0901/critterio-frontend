import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { ThemeColors } from '../../constants/themes';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { FontFamily, FontSize } from '../../constants/typography';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PrivacyPolicy'>;
};

const SECTIONS = [
  {
    title: '1. 我們收集哪些資料',
    body: '我們收集您在註冊與使用過程中提供的資料，包含：\n・帳號資料：姓名、電子郵件、頭像\n・寵物資料：名稱、品種、生日、體重、照片\n・使用資料：日誌內容、行事曆事件、社群貼文\n・裝置資訊：App 版本、作業系統（用於問題排查）',
  },
  {
    title: '2. 資料使用方式',
    body: '我們使用您的資料以：\n・提供並改善本服務功能\n・透過 AI 分析提供個人化照護建議\n・發送您訂閱的提醒通知\n・維護服務安全性與偵測異常行為\n\n我們不會將您的個人資料出售給第三方。',
  },
  {
    title: '3. 第三方服務',
    body: '本服務使用以下第三方服務處理特定功能：\n・Cloudinary：儲存您上傳的圖片\n・Resend：發送系統郵件（如密碼重設）\n・Groq / Anthropic：提供 AI 分析功能\n\n上述服務商均有各自的隱私政策，您的資料僅在提供服務所需範圍內共享。',
  },
  {
    title: '4. 資料安全',
    body: '我們採用業界標準措施保護您的資料，包含密碼加密儲存（bcrypt）及 JWT 身份驗證。儘管如此，網路傳輸無法保證絕對安全，請妥善保管您的帳號密碼。',
  },
  {
    title: '5. 資料保留',
    body: '您的帳號資料在帳號存續期間保留。AI 對話紀錄在最後活躍後 90 天自動刪除。您可隨時於「設定 > 隱私與安全」內直接刪除帳號，所有相關資料將立即永久刪除。',
  },
  {
    title: '6. 您的權利',
    body: '您有權：\n・查閱我們持有的您的個人資料\n・要求更正不正確的資料\n・於 App 內直接刪除您的帳號與資料\n・撤回對通知推播的同意\n\n如需協助，請聯絡 critterioyourpets@gmail.com。',
  },
  {
    title: '7. 隱私政策更新',
    body: '我們可能不定期更新本政策，重大變更將透過 App 通知告知。繼續使用本服務即表示您接受更新後的政策。',
  },
];

export default function PrivacyPolicyScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={[styles.appBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>隱私政策</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lastUpdated}>最後更新：2026 年 6 月</Text>
        {SECTIONS.map((s) => (
          <View key={s.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}
        <Text style={styles.contact}>
          如有任何疑問，請聯絡 critterioyourpets@gmail.com
        </Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: c.background,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  appBarTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: c.primary,
  },
  content: { padding: 20, gap: 20, paddingBottom: 40 },
  lastUpdated: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
  },
  section: { gap: 6 },
  sectionTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
  },
  sectionBody: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
    lineHeight: 24,
  },
  contact: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
    marginTop: 8,
  },
});
