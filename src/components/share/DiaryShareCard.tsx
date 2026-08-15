import { forwardRef } from 'react';
import { View, Text, Image, StyleSheet, PixelRatio } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontFamily } from '../../constants/typography';
import { ShareCardTheme } from '../../constants/shareCardThemes';

/**
 * 日記分享卡（IG 限動比例 1080×1920）。
 *
 * 這張卡是**離屏渲染**的固定尺寸畫面，不是截目前的畫面——
 * 截畫面會連 App 的 UI 一起截進去，而且不同機型解析度不一。
 *
 * 尺寸換算：captureRef 的 width/height 收的是邏輯像素，
 * 實際輸出 = 邏輯像素 × PixelRatio。所以反推邏輯尺寸，
 * 任何機型（@2x / @3x）都能穩定輸出 1080×1920。
 */
export const CARD_PX_W = 1080;
export const CARD_PX_H = 1920;

const scale = PixelRatio.get();
export const CARD_W = Math.round(CARD_PX_W / scale);
export const CARD_H = Math.round(CARD_PX_H / scale);

/** 以 360dp 寬為基準的設計單位，讓版面在 @2x / @3x 上比例一致 */
const u = CARD_W / 360;

/**
 * IG 限動上下會被它自己的 UI 蓋住（上方頭像與關閉鍵、下方回覆列）。
 * 內容要收在這個範圍內，否則浮水印發到限動就整條看不見。
 *
 * 一開始上下各留 13.5%（Apple 官方建議的保守值），但那讓卡片有一大塊空白、
 * 照片被壓得很小。實測 IG 真正遮到的約 10%，這裡取 9%：
 * 照片放得更大，浮水印也還在安全區內。
 */
const SAFE_TOP = CARD_H * 0.09;
const SAFE_BOTTOM = CARD_H * 0.09;

const MOOD_LABELS: Record<string, { emoji: string; label: string }> = {
  happy:   { emoji: '😊', label: '開心' },
  playful: { emoji: '🐾', label: '好動' },
  sunny:   { emoji: '☀️', label: '精神好' },
  sleepy:  { emoji: '😴', label: '懶洋洋' },
  unwell:  { emoji: '🤒', label: '不舒服' },
};

/**
 * 分享卡的標語。看到卡片的人多半沒聽過 Critterio，
 * 這句要回答「這是什麼」，而不是叫人加入——對還不知道是什麼的人，「加入」沒有意義。
 * 用中文是因為卡片其餘內容（寵物名、日期、心情、日記）都是中文，插英文會斷掉。
 */
const TAGLINE = '記錄毛孩的每一天';

function formatDate(date: string) {
  return date.slice(0, 10).replace(/-/g, '/');
}

export type DiaryShareCardProps = {
  petName: string;
  photoUri: string;
  date: string;
  moods?: string[];
  note?: string;
  theme: ShareCardTheme;
  /** 使用者可以關掉——日記常常是寫給自己看的私密心情 */
  showNote: boolean;
};

const DiaryShareCard = forwardRef<View, DiaryShareCardProps>(function DiaryShareCard(
  { petName, photoUri, date, moods, note, theme, showNote },
  ref,
) {
  const moodList = (moods ?? []).map((m) => MOOD_LABELS[m]).filter(Boolean);
  const noteText = showNote ? note?.trim() : '';
  // 沒有日記文字時下方會空出一大塊，品牌改成置中放大填補，
  // 有文字時則靠左縮小，讓日記本身當主角
  const compact = !noteText;
  // 名字太長就縮字級，避免換行把版面撐開
  const nameSize = petName.length > 8 ? 40 * u : petName.length > 5 ? 48 * u : 58 * u;

  return (
    <View ref={ref} collapsable={false} style={[styles.card, { width: CARD_W, height: CARD_H }]}>
      <LinearGradient colors={theme.gradient} style={StyleSheet.absoluteFill} />

      {theme.photo && (
        <>
          <Image source={theme.photo} style={StyleSheet.absoluteFill} resizeMode="cover" />
          {/* 遮罩讓背景照退成材質，不跟寵物照搶戲，也保證文字讀得到 */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.photoScrim }]} />
        </>
      )}

      <View style={[styles.body, { paddingTop: SAFE_TOP, paddingBottom: SAFE_BOTTOM }]}>
        {/*
          滿版寬的 4:3 照片。原本左右各留 32u 的邊，照片只佔卡片 35% 高度，
          整張卡看起來很空。改成齊邊後佔到 42%，照片才是主角。
          比例維持 4:3 不再裁一次——日記照片在挑選時就已經裁成 4:3 了
        */}
        {/*
          照片做成有框的卡片，而不是滿版硬切或漸變淡出。
          漸變要成立的前提是背景色完全吻合，只要有一點色差就會看到一條帶子；
          框線是刻意的設計語言，反而不會有「沒渲染好」的觀感。
          陰影與圓角要拆兩層——同一層設 overflow:hidden 會把陰影一起裁掉
        */}
        <View style={[styles.photoShadow, { marginHorizontal: 18 * u, borderRadius: 20 * u }]}>
          <View style={[styles.photoFrame, { borderRadius: 20 * u, borderWidth: 3 * u }]}>
            <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
          </View>
        </View>

        <View style={[styles.textBlock, { paddingHorizontal: 32 * u, paddingTop: 26 * u }]}>
          <Text style={[styles.name, { fontSize: nameSize, color: theme.text }]} numberOfLines={1}>
            {petName}
          </Text>

          <View style={[styles.metaRow, { marginTop: 6 * u, gap: 12 * u }]}>
            <Text style={[styles.date, { fontSize: 17 * u, color: theme.textMuted }]}>
              {formatDate(date)}
            </Text>
            {moodList.map((m) => (
              <Text key={m.label} style={[styles.mood, { fontSize: 17 * u, color: theme.textMuted }]}>
                {m.emoji} {m.label}
              </Text>
            ))}
          </View>

          {!!noteText && (
            <Text
              style={[styles.note, { fontSize: 19 * u, lineHeight: 30 * u, marginTop: 16 * u, color: theme.text }]}
              numberOfLines={3}
            >
              {noteText}
            </Text>
          )}

          {/* 把品牌推到文字區底部，關掉日記文字時也不會浮在半空中 */}
          <View style={{ flex: 1 }} />

          <View
            style={{
              alignSelf: compact ? 'center' : 'flex-start',
              alignItems: compact ? 'center' : 'flex-start',
              marginBottom: compact ? 22 * u : 0,
            }}
          >
            <Text style={[styles.brand, { fontSize: (compact ? 46 : 20) * u, color: theme.text }]}>
              Critterio
            </Text>
            {compact && (
              <Text style={[styles.tagline, { fontSize: 18 * u, marginTop: 4 * u, color: theme.text }]}>
                {TAGLINE}
              </Text>
            )}
            <Text
              style={[
                styles.brandUrl,
                { fontSize: (compact ? 14 : 12) * u, marginTop: compact ? 8 * u : 0, color: theme.textMuted },
              ]}
            >
              critterio.org
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
});

export default DiaryShareCard;

const styles = StyleSheet.create({
  card: { overflow: 'hidden', backgroundColor: '#fff8f5' },
  body: { flex: 1 },
  textBlock: { flex: 1 },
  photoShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  // 白框在深色背景（豔彩、花花）上負責分離，陰影則在淺色背景上負責
  photoFrame: {
    overflow: 'hidden',
    borderColor: 'rgba(255,255,255,0.9)',
  },
  photo: { width: '100%', aspectRatio: 4 / 3 },
  name: { fontFamily: FontFamily.headlineBold },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  date: { fontFamily: FontFamily.bodyMedium },
  mood: { fontFamily: FontFamily.bodyMedium },
  note: { fontFamily: FontFamily.bodyMedium },
  brand: { fontFamily: FontFamily.brand },
  tagline: { fontFamily: FontFamily.taglineTC },
  brandUrl: { fontFamily: FontFamily.bodyMedium },
});
