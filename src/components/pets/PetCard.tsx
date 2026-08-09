import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Chip from '../ui/Chip';
import { ThemeColors } from '../../constants/themes';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { FontFamily, FontSize } from '../../constants/typography';
import { Pet } from '../../types';

interface Props {
  pet: Pet;
  color?: string;
  onPress?: () => void;
  onMenuPress?: () => void;
}

const LOCAL_PET_PHOTOS: Record<string, any> = {
  p1: require('../../../photo/mypets/mypets1.jpg'),
  p2: require('../../../photo/mypets/mypets2.jpg'),
  p3: require('../../../photo/mypets/mypets3.jpg'),
};

export default function PetCard({ pet, color, onPress, onMenuPress }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.92}>
      <Card style={styles.card}>
        {/* Photo + status badge */}
        <View style={styles.imageContainer}>
          {LOCAL_PET_PHOTOS[pet.id] ? (
            <Image source={LOCAL_PET_PHOTOS[pet.id]} style={styles.image} />
          ) : pet.photoUrl ? (
            <Image source={{ uri: pet.photoUrl }} style={styles.image} />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <MaterialIcons name="pets" size={48} color={colors.outlineVariant} />
            </View>
          )}
          <View style={styles.badgeOverlay}>
            <Badge status={pet.status} label={pet.statusLabel} />
          </View>
        </View>

        {/* Name + menu */}
        <View style={styles.row}>
          <View>
            <Text style={styles.name}>{pet.name}</Text>
            <Text style={styles.sub}>{pet.age} 歲 • {pet.breed}</Text>
          </View>
          <TouchableOpacity onPress={onMenuPress} style={styles.menuBtn}>
            <MaterialIcons name="more-vert" size={20} color={colors.outline} />
          </TouchableOpacity>
        </View>

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
      </Card>
    </TouchableOpacity>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  card: { padding: 0, overflow: 'hidden' },
  imageContainer: { position: 'relative', marginBottom: 0 },
  image: {
    width: '100%',
    // 寬幅是這張卡的設計重點，不要改成 4:3 那種通用相片比例。
    // 但用比例而非原本的固定 height:180 —— 固定高度會讓實際比例隨機型跑，
    // 小螢幕 1.86:1、Pro Max 2.22:1。16:9 讓所有機型一致，
    // 順便把 cover 切掉的部分從 55% 降到 44%。
    aspectRatio: 16 / 9,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  imagePlaceholder: {
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
