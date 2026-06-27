import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Terms'>;
};

const SECTIONS = [
  {
    title: '1. 接受條款',
    body: '使用 Critterio（以下簡稱「本服務」）即表示您已閱讀、理解並同意遵守本服務條款。若您不同意，請停止使用本服務。',
  },
  {
    title: '2. 服務說明',
    body: 'Critterio 提供寵物健康紀錄、AI 照護建議、寵物日誌、社群討論及行事曆提醒等功能，協助飼主管理寵物日常照護。',
  },
  {
    title: '3. 帳號與安全',
    body: '您須提供真實資訊完成註冊，並負責妥善保管帳號密碼。如發現帳號遭未授權使用，請立即聯絡我們。每個帳號僅供個人使用，不得轉讓。',
  },
  {
    title: '4. 使用者內容',
    body: '您在社群發布的文字、照片等內容，著作權仍屬於您。您授予 Critterio 在本服務範圍內展示與傳播該內容的非專屬授權。您不得發布違法、侵權、騷擾或不實的內容。',
  },
  {
    title: '5. AI 助理免責聲明',
    body: 'AI 助理提供的建議僅供參考，不構成專業獸醫診斷或醫療意見。若您的寵物出現緊急或嚴重症狀，請立即就醫。Critterio 不對因採用 AI 建議而產生的任何損害負責。',
  },
  {
    title: '6. 禁止行為',
    body: '您同意不得：利用本服務從事違法活動、干擾或破壞服務運作、使用自動化工具大量存取資料、冒充他人或散布惡意軟體。',
  },
  {
    title: '7. 服務變更與終止',
    body: 'Critterio 保留隨時修改或終止服務的權利，並將提前以 App 通知告知重大變更。若您違反本條款，我們有權暫停或終止您的帳號。',
  },
  {
    title: '8. 法律適用',
    body: '本條款依中華民國法律解釋與執行。如有爭議，雙方同意以台灣台北地方法院為第一審管轄法院。',
  },
];

export default function TermsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={[styles.appBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>服務條款</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: Colors.background,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  appBarTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: Colors.primary,
  },
  content: { padding: 20, gap: 20, paddingBottom: 40 },
  lastUpdated: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: Colors.onSurfaceVariant,
  },
  section: { gap: 6 },
  sectionTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurface,
  },
  sectionBody: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurfaceVariant,
    lineHeight: 24,
  },
  contact: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: Colors.onSurfaceVariant,
    marginTop: 8,
  },
});
