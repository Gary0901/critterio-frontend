import { useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemeColors } from '../../constants/themes';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { FontFamily, FontSize } from '../../constants/typography';
import { SHARE_CARD_THEMES, petColorTheme, ShareCardTheme } from '../../constants/shareCardThemes';
import DiaryShareCard, { CARD_W, CARD_H } from './DiaryShareCard';

export default function ShareCardSheet({
  visible,
  onClose,
  petName,
  petColor,
  photoUri,
  date,
  moods,
  note,
}: {
  visible: boolean;
  onClose: () => void;
  petName: string;
  petColor: string;
  photoUri: string;
  date: string;
  moods?: string[];
  note?: string;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();

  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  const [showNote, setShowNote] = useState(true);

  // 寵物識別色那款排第一並設為預設——每隻寵物天生有一款專屬背景
  const themes: ShareCardTheme[] = [petColorTheme(petColor), ...SHARE_CARD_THEMES];
  const [themeKey, setThemeKey] = useState(themes[0].key);
  const activeTheme = themes.find((t) => t.key === themeKey) ?? themes[0];

  // 預覽只是把同一張卡等比例縮小，確保所見即所得
  const previewW = Math.min(screenW - 96, 260);
  const previewScale = previewW / CARD_W;

  const handleShare = async () => {
    if (!cardRef.current) return;
    setSharing(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('無法分享', '這台裝置不支援分享功能');
        return;
      }
      // width/height 收邏輯像素，實際輸出 = 邏輯 × PixelRatio，
      // 所以任何機型都會穩定產出 1080×1920
      const uri = await captureRef(cardRef, {
        format: 'jpg',
        quality: 0.95,
        result: 'tmpfile',
        width: CARD_W,
        height: CARD_H,
      });
      await Sharing.shareAsync(uri, {
        mimeType: 'image/jpeg',
        dialogTitle: `分享 ${petName} 的日記`,
        UTI: 'public.jpeg',
      });
    } catch {
      Alert.alert('分享失敗', '製作圖片時發生問題，請稍後再試');
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />

        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />

          <View style={styles.titleRow}>
            <Text style={styles.title}>分享卡</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="close" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          {/* 預覽：把實際尺寸的卡片縮小顯示，所見即所得 */}
          <View style={[styles.previewWrap, { width: previewW, height: CARD_H * previewScale }]}>
            <View style={{ transform: [{ scale: previewScale }], transformOrigin: 'top left' } as any}>
              <DiaryShareCard
                ref={cardRef}
                petName={petName}
                photoUri={photoUri}
                date={date}
                moods={moods}
                note={note}
                theme={activeTheme}
                showNote={showNote}
              />
            </View>
          </View>

          {/* 背景款式 */}
          <View style={styles.swatchRow}>
            {themes.map((t) => (
              <TouchableOpacity
                key={t.key}
                onPress={() => setThemeKey(t.key)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={t.label}
                accessibilityState={{ selected: t.key === themeKey }}
                style={[styles.swatchWrap, t.key === themeKey && { borderColor: colors.primary }]}
              >
                <View style={[styles.swatch, { backgroundColor: t.swatch }]} />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.swatchLabel}>{activeTheme.label}</Text>

          {!!note?.trim() && (
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>顯示日記文字</Text>
                <Text style={styles.toggleHint}>關掉的話卡片只會有照片、名字與心情</Text>
              </View>
              <Switch
                value={showNote}
                onValueChange={setShowNote}
                trackColor={{ false: colors.surfaceVariant, true: colors.primaryContainer }}
                thumbColor={showNote ? colors.primary : colors.outline}
                ios_backgroundColor={colors.surfaceVariant}
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.shareBtn, sharing && { opacity: 0.6 }]}
            onPress={handleShare}
            disabled={sharing}
            activeOpacity={0.85}
          >
            {sharing ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <>
                <MaterialIcons name="ios-share" size={18} color={colors.onPrimary} />
                <Text style={styles.shareBtnLabel}>分享</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 10,
    alignItems: 'center',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: c.outlineVariant,
    marginBottom: 12,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', justifyContent: 'space-between' },
  title: { fontFamily: FontFamily.headlineSemiBold, fontSize: FontSize.bodyLG, color: c.onSurface },
  previewWrap: {
    overflow: 'hidden',
    borderRadius: 16,
    marginTop: 14,
    backgroundColor: c.surfaceContainerHigh,
  },
  swatchRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  swatchWrap: {
    padding: 3,
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatch: { width: 30, height: 30, borderRadius: 15 },
  swatchLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
    marginTop: 6,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 12,
    marginTop: 16,
  },
  toggleLabel: { fontFamily: FontFamily.headlineSemiBold, fontSize: FontSize.labelMD, color: c.onSurface },
  toggleHint: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelSM, color: c.onSurfaceVariant, marginTop: 1 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
    marginTop: 18,
    paddingVertical: 15,
    borderRadius: 9999,
    backgroundColor: c.primary,
  },
  shareBtnLabel: { fontFamily: FontFamily.headlineSemiBold, fontSize: FontSize.bodyMD, color: c.onPrimary },
});
