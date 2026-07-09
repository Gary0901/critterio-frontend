import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Chip from '../ui/Chip';
import { Colors } from '../../constants/colors';
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
              <MaterialIcons name="pets" size={48} color={Colors.outlineVariant} />
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
            <Text style={styles.sub}>{pet.age} years • {pet.breed}</Text>
          </View>
          <TouchableOpacity onPress={onMenuPress} style={styles.menuBtn}>
            <MaterialIcons name="more-vert" size={20} color={Colors.outline} />
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

const styles = StyleSheet.create({
  card: { padding: 0, overflow: 'hidden' },
  imageContainer: { position: 'relative', marginBottom: 0 },
  image: {
    width: '100%',
    height: 180,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  imagePlaceholder: {
    backgroundColor: Colors.surfaceContainer,
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
    color: Colors.onSurface,
  },
  sub: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurfaceVariant,
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
    color: Colors.onSurfaceVariant,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 16,
  },
});
