import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../types/navigation';
import { ThemeColors } from '../../constants/themes';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { FontFamily, FontSize } from '../../constants/typography';
import { PetCareArticle, CARE_ARTICLES_BY_CATEGORY, CARE_GUIDE_TITLE_BY_CATEGORY } from '../../constants/petCareArticles';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PetCareGuide'>;
  route: RouteProp<RootStackParamList, 'PetCareGuide'>;
};

// 將簡易的 **粗體** 標記轉成分段渲染（不需要額外的 markdown 套件）
function renderContent(content: string, styles: ReturnType<typeof makeStyles>) {
  return content.split('\n\n').map((block, i) => {
    const headingMatch = block.match(/^\*\*(.+?)\*\*\n([\s\S]*)$/);
    if (headingMatch) {
      return (
        <View key={i} style={styles.block}>
          <Text style={styles.blockHeading}>{headingMatch[1]}</Text>
          <Text style={styles.blockBody}>{headingMatch[2]}</Text>
        </View>
      );
    }
    if (block.startsWith('>')) {
      return (
        <View key={i} style={styles.quoteBox}>
          <Text style={styles.quoteText}>{block.replace(/^>\s*/, '')}</Text>
        </View>
      );
    }
    return (
      <Text key={i} style={styles.blockBody}>
        {block}
      </Text>
    );
  });
}

export default function PetCareGuideScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<PetCareArticle | null>(null);
  const category = route.params.category;
  const articles = CARE_ARTICLES_BY_CATEGORY[category] ?? [];
  const guideTitle = CARE_GUIDE_TITLE_BY_CATEGORY[category] ?? '照護指南';

  if (selected) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <View style={[styles.appBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setSelected(null)}>
            <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.appBarTitle} numberOfLines={1}>{selected.title}</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
          {renderContent(selected.content, styles)}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={[styles.appBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>{guideTitle}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.disclaimer}>
          <MaterialIcons name="info-outline" size={13} color={colors.onSurfaceVariant} />
          <Text style={styles.disclaimerText}>
            內容僅供一般性參考，不構成獸醫診斷或醫療建議，實際狀況請諮詢專業獸醫。
          </Text>
        </View>

        <View style={styles.card}>
          {articles.map((article, i) => (
            <View key={article.id}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => setSelected(article)}
                activeOpacity={0.75}
              >
                <View style={styles.rowIcon}>
                  <MaterialIcons name={article.icon as any} size={20} color={colors.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{article.title}</Text>
                  <Text style={styles.rowDesc}>{article.summary}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={colors.outlineVariant} />
              </TouchableOpacity>
              {i < articles.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
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
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: c.primary,
  },
  content: { padding: 20, gap: 16 },

  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: c.surfaceContainerHigh,
    borderRadius: 12,
    padding: 12,
  },
  disclaimerText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
    lineHeight: 18,
  },

  card: {
    backgroundColor: c.surfaceContainerLowest,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.surfaceVariant,
    overflow: 'hidden',
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
  divider: { height: 1, backgroundColor: c.surfaceVariant, marginLeft: 64 },

  detailContent: { padding: 20, gap: 16, paddingBottom: 40 },
  block: { gap: 6 },
  blockHeading: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
  },
  blockBody: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
    lineHeight: 23,
  },
  quoteBox: {
    backgroundColor: c.surfaceContainerHigh,
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: c.primary,
  },
  quoteText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
    lineHeight: 20,
  },
});
