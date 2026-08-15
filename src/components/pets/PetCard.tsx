import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Chip from '../ui/Chip';
import { ThemeColors } from '../../constants/themes';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { FontFamily, FontSize } from '../../constants/typography';
import { Pet, DiaryEntry } from '../../types';
import PetPhotoCarousel, { buildPetPhotos } from './PetPhotoCarousel';

interface Props {
  pet: Pet;
  color?: string;
  /** 這隻寵物的日誌，用來組出可左右瀏覽的照片。沒給就只顯示主照片 */
  diaryEntries?: DiaryEntry[];
  onPress?: () => void;
  onMenuPress?: () => void;
}

const LOCAL_PET_PHOTOS: Record<string, any> = {
  p1: require('../../../photo/mypets/mypets1.jpg'),
  p2: require('../../../photo/mypets/mypets2.jpg'),
  p3: require('../../../photo/mypets/mypets3.jpg'),
};

export default function PetCard({ pet, color, diaryEntries, onPress, onMenuPress }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  // 卡片左右各離頁面 20，圖片再滿版鋪滿卡片
  const photoW = width - 40;
  const photos = buildPetPhotos(pet, diaryEntries, LOCAL_PET_PHOTOS[pet.id]);
  return (
    // 整張卡不再包在 TouchableOpacity 裡——橫向 ScrollView 巢狀在觸控元件內，
    // pan 手勢會被外層的觸控回應器攔走，照片就滑不動。
    // 改成照片交給輪播的 onPhotoPress、下半部資訊各自綁點擊。
    <View>
      <Card style={styles.card}>
        {/* Photo + status badge */}
        <View style={styles.imageContainer}>
          <PetPhotoCarousel
            photos={photos}
            width={photoW}
            height={photoW * 9 / 16}
            color={color}
            placeholder={
              /*
                沒照片時用這隻寵物的識別色鋪底 —— 灰底加淡爪印看起來像沒載入完，
                帶顏色就成為刻意的設計，而且每隻寵物長得不一樣。
                '22' 是約 13% 透明度，跟行事曆的寵物標籤同一個手法。
              */
              <View
                style={[
                  styles.imagePlaceholder,
                  color ? { backgroundColor: color + '22' } : null,
                ]}
              >
                <MaterialIcons name="pets" size={48} color={color ?? colors.outlineVariant} />
              </View>
            }
            onPhotoPress={onPress}
          />
          <View style={styles.badgeOverlay}>
            <Badge status={pet.status} label={pet.statusLabel} />
          </View>
        </View>

        {/* Name + menu。選單鍵獨立於下方的整片可點擊區之外 */}
        <View style={styles.row}>
          <TouchableOpacity style={{ flex: 1 }} onPress={onPress} activeOpacity={0.7}>
            <Text style={styles.name}>{pet.name}</Text>
            <Text style={styles.sub}>{pet.age} 歲 • {pet.breed}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onMenuPress} style={styles.menuBtn}>
            <MaterialIcons name="more-vert" size={20} color={colors.outline} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
          {/* Traits */}
          <View style={styles.chips}>
            {pet.traits.map((t) => (
              <Chip key={t} label={t} />
            ))}
          </View>

          {color && <View style={[styles.colorBand, { backgroundColor: color }]} />}

          {pet.nextEvent && (
            <Text style={styles.nextEvent}>{pet.nextEvent}</Text>
          )}
          {!pet.nextEvent && <View style={{ height: 12 }} />}
        </TouchableOpacity>
      </Card>
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  card: { padding: 0, overflow: 'hidden' },
  imageContainer: {
    position: 'relative',
    marginBottom: 0,
    // 圓角從 image 移到這裡——照片現在包在輪播元件裡，要靠外層裁切
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  imagePlaceholder: {
    flex: 1,
    backgroundColor: c.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  name: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.headlineMD,
    color: c.onSurface,
  },
  sub: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
    marginTop: 2,
  },
  menuBtn: { padding: 4 },
  chips: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  colorBand: {
    height: 3,
    width: '100%',
  },
  nextEvent: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 16,
  },
});
