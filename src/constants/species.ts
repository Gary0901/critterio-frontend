import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Species } from '../types';

/**
 * 物種的顯示資料（標籤 + 圖示）。
 *
 * 這份表原本各自散在 AddPetScreen（label + icon）與 CommunityScreen（只有 label），
 * AI 助理頁也需要圖示當作沒有照片時的頭像退回，所以集中到這裡避免第三份複製品。
 * 陣列順序 = 新增寵物頁的選擇順序，改動會影響該頁的排列。
 */
export type SpeciesItem = {
  value: Species;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
};

export const SPECIES_LIST: SpeciesItem[] = [
  { value: 'dog',     label: '狗',     icon: 'dog' },
  { value: 'cat',     label: '貓',     icon: 'cat' },
  { value: 'rabbit',  label: '兔子',   icon: 'rabbit' },
  { value: 'small',   label: '小動物', icon: 'rodent' },
  { value: 'bird',    label: '鳥類',   icon: 'bird' },
  { value: 'reptile', label: '爬蟲類', icon: 'turtle' },
  { value: 'other',   label: '其他',   icon: 'paw' },
];

export const ALL_SPECIES: Species[] = SPECIES_LIST.map((s) => s.value);

export const SPECIES_LABEL = Object.fromEntries(
  SPECIES_LIST.map((s) => [s.value, s.label]),
) as Record<Species, string>;

const SPECIES_ICON = Object.fromEntries(
  SPECIES_LIST.map((s) => [s.value, s.icon]),
) as Record<Species, SpeciesItem['icon']>;

/** 後端若回了預期外的 species 字串，退回爪印而不是讓圖示變空白 */
export function speciesIcon(species: Species | undefined): SpeciesItem['icon'] {
  return (species && SPECIES_ICON[species]) || 'paw';
}
