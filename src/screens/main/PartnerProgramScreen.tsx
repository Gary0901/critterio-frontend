import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { ThemeColors } from '../../constants/themes';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { FontFamily, FontSize } from '../../constants/typography';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PartnerProgram'>;
};

// 跟 HelpSupportScreen 用同一個信箱，之後改只要改一處
const CONTACT_EMAIL = 'critterioyourpets@gmail.com';

const BENEFITS: { icon: keyof typeof MaterialIcons.glyphMap; title: string; desc: string }[] = [
  {
    icon: 'star',
    title: '地圖上的專屬標記',
    desc: '金色星徽讓你的店在地圖上一眼被認出，和一般地點區隔開來。',
  },
  {
    icon: 'vertical-align-top',
    title: '附近清單優先曝光',
    desc: '使用者在 3 公里內搜尋時，你的店會排在清單最前面。',
  },
  {
    icon: 'photo-library',
    title: '多張照片輪播',
    desc: '不只一張 Google 街景，可以放 3–5 張自己挑的店內照片。',
  },
  {
    icon: 'description',
    title: '完整介紹與特色標籤',
    desc: '用自己的文字說明服務與理念，而不是只有地址和營業時間。',
  },
  {
    icon: 'phone-in-talk',
    title: '一鍵撥號',
    desc: '卡片上有專屬的聯絡按鈕，讓有意願的飼主直接打給你。',
  },
];

export default function PartnerProgramScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  const contact = async () => {
    const subject = '想成為 Critterio 合作夥伴';
    const body =
      '您好，我想了解成為 Critterio 合作夥伴的方式。\n\n' +
      '店名：\n' +
      '地址：\n' +
      '聯絡人與電話：\n' +
      '想了解的內容：\n';
    const url = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) throw new Error();
      await Linking.openURL(url);
    } catch {
      // 模擬器與沒設定郵件帳號的機器打不開 mailto，至少讓對方拿得到信箱
      Alert.alert('無法開啟郵件 App', `請直接來信：\n${CONTACT_EMAIL}`);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={[styles.appBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>合作夥伴</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <MaterialIcons name="star" size={13} color={colors.onPartnerBadge} />
            <Text style={styles.heroBadgeText}>合作夥伴</Text>
          </View>
          <Text style={styles.heroTitle}>想成為合作夥伴嗎？</Text>
          <Text style={styles.heroSub}>
            讓在意毛孩的飼主，在找地方的那一刻就看見你。
          </Text>
        </View>

        <Text style={styles.sectionTitle}>合作夥伴享有</Text>
        <View style={styles.card}>
          {BENEFITS.map((b, i) => (
            <View key={b.title}>
              <View style={styles.row}>
                <View style={styles.rowIcon}>
                  <MaterialIcons name={b.icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{b.title}</Text>
                  <Text style={styles.rowDesc}>{b.desc}</Text>
                </View>
              </View>
              {i < BENEFITS.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.cta} onPress={contact} activeOpacity={0.85}>
          <MaterialIcons name="mail-outline" size={18} color={colors.onPrimary} />
          <Text style={styles.ctaText}>聯絡 Critterio</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          我們會在收到來信後與你聯繫，說明合作方式與所需資料。
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
    paddingHorizontal: 8,
    paddingBottom: 8,
    backgroundColor: c.background,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  appBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: c.onSurface,
  },

  content: { padding: 16, gap: 10 },

  hero: { gap: 10, paddingVertical: 8, alignItems: 'flex-start' },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.partnerBadge,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  heroBadgeText: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.labelSM,
    color: c.onPartnerBadge,
  },
  heroTitle: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineMD,
    color: c.onSurface,
  },
  heroSub: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
    lineHeight: 24,
  },

  sectionTitle: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
    marginTop: 8,
    marginLeft: 4,
  },
  card: { backgroundColor: c.surfaceContainerLowest, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: c.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 3 },
  rowLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
  },
  rowDesc: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
    lineHeight: 19,
  },
  divider: { height: 1, backgroundColor: c.surfaceVariant, marginLeft: 64 },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    height: 52,
    borderRadius: 26,
    backgroundColor: c.primary,
  },
  ctaText: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.onPrimary,
  },
  hint: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 8,
    lineHeight: 18,
  },
});
