import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { RootStackParamList } from '../../types/navigation';
import { ThemeColors } from '../../constants/themes';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { FontFamily, FontSize } from '../../constants/typography';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'HelpSupport'>;
};

const FAQ_ITEMS = [
  {
    q: '如何新增寵物？',
    a: '在「我的寵物」頁面點選右上角的「新增寵物」按鈕，填寫基本資料後即可完成。',
  },
  {
    q: '如何使用 AI 健康諮詢？',
    a: '切換到底部導覽的「AI 助理」頁面，可以直接輸入問題，也可以上傳寵物照片讓 AI 分析。',
  },
  {
    q: '如何設定用藥與疫苗提醒？',
    a: '在「提醒」頁面點選右上角新增按鈕，選擇提醒類型（藥物、疫苗、回診）並設定時間即可。',
  },
  {
    q: '如何分享貼文到社群？',
    a: '在「社群」頁面點選上方的「分享你和寵物的精彩時刻...」輸入框，撰寫內容並可附上照片或標籤寵物。',
  },
  {
    q: 'Critterio 支援哪些寵物？',
    a: '目前支援犬、貓、兔子、倉鼠、鳥類和爬蟲類。未來將陸續新增更多特殊寵物的健康資料庫。',
  },
  {
    q: '我的資料安全嗎？',
    a: '我們使用業界標準加密儲存您的個人資料，不會將資料出售給第三方。詳情請參閱隱私政策。',
  },
];

const CONTACT_EMAIL = 'critterioyourpets@gmail.com';

const openEmail = async (subject?: string) => {
  const url = subject
    ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`
    : `mailto:${CONTACT_EMAIL}`;
  const supported = await Linking.canOpenURL(url);
  if (supported) {
    Linking.openURL(url);
  } else {
    Alert.alert('無法開啟', `請手動寄信至 ${CONTACT_EMAIL}`);
  }
};

export default function HelpSupportScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const toggleFaq = (i: number) =>
    setExpanded((prev) => ({ ...prev, [i]: !prev[i] }));

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={[styles.appBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>幫助與支援</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* FAQ */}
        <View>
          <Text style={styles.sectionTitle}>常見問題</Text>
          <View style={styles.card}>
            {FAQ_ITEMS.map((item, i) => (
              <View key={i}>
                <TouchableOpacity
                  style={styles.faqRow}
                  onPress={() => toggleFaq(i)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.faqQuestion}>{item.q}</Text>
                  <MaterialIcons
                    name={expanded[i] ? 'expand-less' : 'expand-more'}
                    size={22}
                    color={colors.onSurfaceVariant}
                  />
                </TouchableOpacity>
                {expanded[i] && (
                  <View style={styles.faqAnswer}>
                    <Text style={styles.faqAnswerText}>{item.a}</Text>
                  </View>
                )}
                {i < FAQ_ITEMS.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        </View>

        {/* 聯絡我們 */}
        <View>
          <Text style={styles.sectionTitle}>聯絡我們</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => openEmail('回報問題')}
              activeOpacity={0.75}
            >
              <View style={styles.rowIcon}>
                <MaterialIcons name="flag" size={20} color={colors.primary} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>回報問題</Text>
                <Text style={styles.rowDesc}>{CONTACT_EMAIL}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.outlineVariant} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.row}
              onPress={() => openEmail('合作邀約')}
              activeOpacity={0.75}
            >
              <View style={styles.rowIcon}>
                <MaterialIcons name="business" size={20} color={colors.primary} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>合作邀約</Text>
                <Text style={styles.rowDesc}>{CONTACT_EMAIL}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.outlineVariant} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 關於 */}
        <View>
          <Text style={styles.sectionTitle}>關於</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <MaterialIcons name="info-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.rowLabel}>版本</Text>
              <Text style={styles.valueText}>1.0.0</Text>
            </View>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Terms')} activeOpacity={0.75}>
              <View style={styles.rowIcon}>
                <MaterialIcons name="description" size={20} color={colors.primary} />
              </View>
              <Text style={styles.rowLabel}>服務條款</Text>
              <MaterialIcons name="chevron-right" size={20} color={colors.outlineVariant} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('PrivacyPolicy')} activeOpacity={0.75}>
              <View style={styles.rowIcon}>
                <MaterialIcons name="privacy-tip" size={20} color={colors.primary} />
              </View>
              <Text style={styles.rowLabel}>隱私政策</Text>
              <MaterialIcons name="chevron-right" size={20} color={colors.outlineVariant} />
            </TouchableOpacity>
          </View>
        </View>
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
  content: { padding: 20, gap: 16 },

  sectionTitle: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: c.surfaceContainerLowest,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.surfaceVariant,
    overflow: 'hidden',
  },

  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  faqQuestion: {
    flex: 1,
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  faqAnswerText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
    lineHeight: 22,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: c.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: {
    flex: 1,
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
  },
  rowDesc: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
  },
  valueText: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
  },
  divider: { height: 1, backgroundColor: c.surfaceVariant, marginLeft: 64 },

});
