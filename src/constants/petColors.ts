// 依寵物在列表中的順序分配顏色，讓同一隻寵物在行事曆、我的寵物列表等畫面顏色一致
export const PET_COLOR_PALETTE = ['#E07B39', '#4CAF50', '#2196F3', '#AB47BC', '#EF5350'];
export const ALL_PETS_COLOR = '#9E9E9E';

export function buildPetColorMap(petIds: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  petIds.forEach((id, i) => { map[id] = PET_COLOR_PALETTE[i % PET_COLOR_PALETTE.length]; });
  return map;
}
