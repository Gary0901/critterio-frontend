import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { PetCareArticle, CARE_ARTICLES_BY_CATEGORY, CARE_GUIDE_TITLE_BY_CATEGORY } from '../../constants/petCareArticles';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PetCareGuide'>;
  route: RouteProp<RootStackParamList, 'PetCareGuide'>;
};

// 將簡易的 **粗體** 標記轉成分段渲染（不需要額外的 markdown 套件）
function renderContent(content: string) {
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
            <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.appBarTitle} numberOfLines={1}>{selected.title}</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
          {renderContent(selected.content)}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={[styles.appBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>{guideTitle}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.disclaimer}>
          <MaterialIcons name="info-outline" size={13} color={Colors.onSurfaceVariant} />
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
                  <MaterialIcons name={article.icon as any} size={20} color={Colors.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{article.title}</Text>
                  <Text style={styles.rowDesc}>{article.summary}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={Colors.outlineVariant} />
              </TouchableOpacity>
              {i < articles.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>
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
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: Colors.primary,
  },
  content: { padding: 20, gap: 16 },

  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: 12,
    padding: 12,
  },
  disclaimerText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: Colors.onSurfaceVariant,
    lineHeight: 18,
  },

  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceVariant,
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
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: {
    flex: 1,
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurface,
  },
  rowDesc: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: Colors.onSurfaceVariant,
  },
  divider: { height: 1, backgroundColor: Colors.surfaceVariant, marginLeft: 64 },

  detailContent: { padding: 20, gap: 16, paddingBottom: 40 },
  block: { gap: 6 },
  blockHeading: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurface,
  },
  blockBody: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurfaceVariant,
    lineHeight: 23,
  },
  quoteBox: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  quoteText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: Colors.onSurfaceVariant,
    lineHeight: 20,
  },
});
