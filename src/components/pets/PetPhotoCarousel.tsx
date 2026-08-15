import { useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ImageSourcePropType,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemeColors } from '../../constants/themes';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { FontFamily, FontSize } from '../../constants/typography';
import { Pet, DiaryEntry } from '../../types';

export type PetPhoto = {
  source: ImageSourcePropType;
  /** YYYY-MM-DD。主照片沒有日期，只有日誌照片才有 */
  date?: string;
};

/**
 * 組出一隻寵物可以瀏覽的照片。
 *
 * Pet 本身只有一張 photoUrl，但今日日誌每篇都有照片且掛在同一個 petId 底下，
 * 等於 App 早就在累積相簿。這裡把「主照片 + 最近的日誌照片」串成一份清單，
 * 不需要動後端 schema，而且使用者寫愈多日誌，寵物頁的照片就愈豐富。
 */
export function buildPetPhotos(
  pet: Pet,
  entries: DiaryEntry[] | undefined,
  localPhoto?: ImageSourcePropType,
  max = 8,
): PetPhoto[] {
  const photos: PetPhoto[] = [];
  const seenUris = new Set<string>();

  if (localPhoto) {
    photos.push({ source: localPhoto });
  } else if (pet.photoUrl) {
    photos.push({ source: { uri: pet.photoUrl } });
    seenUris.add(pet.photoUrl);
  }

  for (const e of entries ?? []) {
    // 主照片剛好也是某篇日誌的照片時不要重複出現
    if (!e.photoUrl || seenUris.has(e.photoUrl)) continue;
    seenUris.add(e.photoUrl);
    photos.push({ source: { uri: e.photoUrl }, date: e.date });
    if (photos.length >= max) break;
  }

  return photos;
}

function formatPhotoDate(date: string): string {
  return date.slice(0, 10).replace(/-/g, '/');
}

/**
 * 寵物照片輪播。單寵大卡與多寵列表卡共用，兩邊的瀏覽行為才會一致。
 * `width` 必須由呼叫端給實際像素值——分頁捲動要靠它算出每一頁的位移。
 */
export default function PetPhotoCarousel({
  photos,
  width,
  height,
  color,
  placeholder,
  onPhotoPress,
}: {
  photos: PetPhoto[];
  width: number;
  height: number;
  color?: string;
  /** 完全沒有照片時顯示的內容 */
  placeholder?: React.ReactNode;
  /**
   * 點照片時的行為。務必透過這個 prop 傳進來，不要在外面用 TouchableOpacity
   * 把整個輪播包起來——巢狀在觸控元件內的橫向 ScrollView，pan 手勢會被外層的
   * 觸控回應器攔走，變成滑不動。放在 ScrollView 內部就沒有這個問題：
   * 捲動交給 ScrollView、點擊交給 TouchableOpacity，兩者不衝突。
   */
  onPhotoPress?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [index, setIndex] = useState(0);

  if (photos.length === 0) {
    return <View style={[styles.wrap, { height }]}>{placeholder}</View>;
  }

  const current = photos[Math.min(index, photos.length - 1)];

  return (
    <View style={[styles.wrap, { height }]}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        // 單張時關掉捲動，否則會有一段沒有意義的回彈
        scrollEnabled={photos.length > 1}
        onMomentumScrollEnd={(e) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
        }
      >
        {photos.map((p, i) => (
          <TouchableOpacity key={i} activeOpacity={onPhotoPress ? 0.92 : 1} onPress={onPhotoPress}>
            <Image source={p.source} style={{ width, height }} resizeMode="cover" />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 半透明日期框。主照片沒有日期，只有日誌照片顯示 */}
      {!!current.date && (
        <View style={styles.dateBadge}>
          <MaterialIcons name="event" size={11} color="#fff" />
          <Text style={styles.dateText}>{formatPhotoDate(current.date)}</Text>
        </View>
      )}

      {photos.length > 1 && (
        <View style={styles.dots}>
          {photos.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === index && { backgroundColor: color ?? colors.primary }]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  wrap: {
    width: '100%',
    backgroundColor: c.surfaceContainerHigh,
    overflow: 'hidden',
  },
  dateBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9999,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  dateText: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: '#fff',
  },
  dots: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.65)',
  },
});
