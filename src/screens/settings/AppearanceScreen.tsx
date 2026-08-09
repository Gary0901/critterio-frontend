import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { ThemeColors, themeList } from '../../constants/themes';
import { AVATAR_COLOR_COUNT, autoColorIndexFor, avatarColorAt } from '../../constants/avatarColors';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { updateProfile } from '../../api';
import Avatar from '../../components/ui/Avatar';
import { FontFamily, FontSize } from '../../constants/typography';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Appearance'>;
};

/** 用主題自己的色畫一個小預覽：底色 + 卡片 + 主色圓點 */
function ThemeSwatch({ colors: t, styles }: { colors: ThemeColors; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={[styles.swatch, { backgroundColor: t.background, borderColor: t.outlineVariant }]}>
      <View style={[styles.swatchCard, { backgroundColor: t.surfaceContainer }]} />
      <View style={[styles.swatchDot, { backgroundColor: t.primary }]} />
    </View>
  );
}

export default function AppearanceScreen({ navigation }: Props) {
  const { colors, preference, setPreference, theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useUser();

  // 沒選過的話，草稿要從「自動配到的那個顏色」開始，
  // 不然預覽會顯示一個跟他現在看到的頭像不一樣的顏色
  const currentColor = user.avatarColor ?? autoColorIndexFor(user.id);
  const [draftColor, setDraftColor] = useState(currentColor);
  const [saving, setSaving] = useState(false);
  const dirty = draftColor !== user.avatarColor;

  const applyColor = async () => {
    setSaving(true);
    try {
      const res = await updateProfile({ avatarColor: draftColor });
      updateUser({ avatarColor: res.data.avatarColor ?? draftColor });
    } catch (e: any) {
      Alert.alert('更新失敗', e?.message ?? '請稍後再試');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={[styles.appBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>外觀</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>配色</Text>
        <View style={styles.card}>
          {themeList.map((t, i) => {
            const selected = preference === t.key;
            return (
              <View key={t.key}>
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => setPreference(t.key)}
                  activeOpacity={0.75}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={t.label}
                >
                  <ThemeSwatch colors={t.colors} styles={styles} />
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>{t.label}</Text>
                    <Text style={styles.rowDesc}>{t.description}</Text>
                  </View>
                  <MaterialIcons
                    name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
                    size={22}
                    color={selected ? colors.primary : colors.outline}
                  />
                </TouchableOpacity>
                {i < themeList.length - 1 && <View style={styles.divider} />}
              </View>
            );
          })}
        </View>

        <Text style={styles.hint}>登入與導覽頁面不受影響，一律使用暖橘配色。</Text>

        <Text style={[styles.sectionTitle, styles.sectionGap]}>頭像底色</Text>
        <View style={styles.card}>
          <View style={styles.swatchRow}>
            {Array.from({ length: AVATAR_COLOR_COUNT }, (_, i) => {
              const { bg } = avatarColorAt(i, theme.key);
              const picked = draftColor === i;
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => setDraftColor(i)}
                  activeOpacity={0.75}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: picked }}
                  accessibilityLabel={`頭像底色 ${i + 1}`}
                  style={[
                    styles.swatchDotWrap,
                    picked && { borderColor: colors.primary },
                  ]}
                >
                  <View style={[styles.swatchDot2, { backgroundColor: bg }]} />
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.divider} />

          <View style={styles.previewBox}>
            {/* 預覽用的是草稿值，套用前整個 App 不會變 */}
            <Avatar name={user.name} seed={user.id} colorIndex={draftColor} size={72} />
            <Text style={styles.previewName}>{user.name}</Text>
            {!!user.avatarUrl && (
              <Text style={styles.previewNote}>
                你目前使用上傳的照片。到個人檔案點一下頭像可以移除，之後就會顯示這個顏色。
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.applyBtn, (!dirty || saving) && styles.applyBtnDisabled]}
          onPress={applyColor}
          disabled={!dirty || saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.applyBtnLabel}>{dirty ? '套用' : '已套用'}</Text>
          )}
        </TouchableOpacity>
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

  content: { padding: 16, gap: 8 },
  sectionTitle: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
    marginBottom: 4,
    marginLeft: 4,
  },
  card: {
    backgroundColor: c.surfaceContainerLowest,
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: {
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

  swatch: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  swatchCard: {
    position: 'absolute',
    left: 5,
    right: 5,
    top: 7,
    height: 12,
    borderRadius: 4,
  },
  swatchDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: 5,
    marginBottom: 5,
  },

  hint: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
    marginTop: 4,
    marginHorizontal: 4,
    lineHeight: 18,
  },

  sectionGap: { marginTop: 20 },
  swatchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  swatchDotWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    // 未選中時邊框透明而不是拿掉，否則選中時尺寸會跳動
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchDot2: { width: 34, height: 34, borderRadius: 17 },

  previewBox: { alignItems: 'center', gap: 8, paddingVertical: 20, paddingHorizontal: 16 },
  previewName: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
  },
  previewNote: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
    textAlign: 'center',
  },

  applyBtn: {
    marginTop: 12,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnDisabled: { opacity: 0.4 },
  applyBtnLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.bodyMD,
    color: c.onPrimary,
  },
});
