import { ThemeColors, ThemeKey } from './themes';

/**
 * 寵物識別色 —— 卡片下緣的色條、行事曆的事件左邊條與寵物標籤。
 *
 * 顏色由後端的 `pet.color`（索引）決定，建立寵物時自動配一個未使用的值，
 * 之後使用者可以在寵物詳情頁改。**不再依陣列順序推算** —— 舊版用索引分配，
 * 使用者調整寵物順序或刪掉一隻，其他寵物的顏色就會跟著跑掉。
 *
 * 兩組主題各一套值。這些色會被當「文字」用（行事曆的寵物名稱標籤），
 * 所以驗的是 4.5:1 而不是圖形元素的 3:1 —— 16 個組合全數通過。
 */

const PALETTES: Record<ThemeKey, string[]> = {
  warm: [
    '#b35a10', // 橘
    '#2e6b34', // 綠
    '#1d5b8f', // 藍
    '#7b3f8c', // 紫
    '#b02a2a', // 紅
    '#17635f', // 青
    '#a8456a', // 桃
    '#7a5320', // 褐
  ],
  dark: [
    '#ffb877',
    '#8fd095',
    '#8ec5f0',
    '#d9a6e6',
    '#ff9d9d',
    '#79cfc9',
    '#f3a3bd',
    '#d9bb85',
  ],
};

/** 後端 petsController 的 PET_COLOR_COUNT 要跟這個一致 */
export const PET_COLOR_COUNT = PALETTES.warm.length;

/**
 * @param index 後端的 `pet.color`。null/undefined 代表還沒配到（理論上只會出現在
 *              getPets 回填之前的極短時間），退回第一個顏色而不是崩掉。
 */
export function petColorAt(index: number | null | undefined, themeKey: ThemeKey): string {
  const palette = PALETTES[themeKey] ?? PALETTES.warm;
  if (index === null || index === undefined || !Number.isFinite(index)) return palette[0];
  return palette[((index % palette.length) + palette.length) % palette.length];
}

/**
 * 建 petId → 色碼 的對照表。
 * 注意輸入是「寵物物件」不是 id 陣列 —— 顏色來自 pet.color，
 * 跟寵物在陣列裡的位置無關，所以排序或刪除都不會讓其他寵物變色。
 */
export function buildPetColorMap(
  pets: { id: string; color?: number | null }[],
  themeKey: ThemeKey,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of pets) map[p.id] = petColorAt(p.color, themeKey);
  return map;
}

/** 行事曆「全部寵物」篩選用的中性色。跟著主題走，不寫死灰色 */
export function allPetsColor(colors: ThemeColors): string {
  return colors.outline;
}
