import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * 懸浮分頁列的版面常數。
 *
 * 刻意放在這個「誰都不依賴」的模組裡，不要放回 navigation/index.tsx——
 * navigation 匯入各個畫面，畫面又要用這些值，直接放在 navigation 會造成循環相依。
 * 循環本身 Metro 允許，但 MapScreen 是在**模組層級**就取用 FLOATING_TAB_BAR_HEIGHT，
 * 載入順序不對時會拿到 undefined，卡片位置直接變成 NaN。
 */

/**
 * 分頁項目的固定高度。
 * 給定值而不是讓內容自然撐開——中央的 AI 按鈕比一般分頁高，
 * 靠內容撐開的話 FLOATING_TAB_BAR_HEIGHT 一定會跟實際不符，
 * 地圖那種依賴它做絕對定位的畫面就會壓到膠囊上。
 */
export const TAB_ITEM_HEIGHT = 50;
export const TAB_PILL_V_PADDING = 8;
export const TAB_WRAP_V_PADDING = 6;

/**
 * 懸浮分頁列的視覺高度（不含安全區）。
 * 分頁列是絕對定位、浮在內容上方，所以每個分頁畫面都要自己讓出這個高度，
 * 包含貼底的絕對定位元素（FAB、輸入列、滿版側邊欄的清單）。
 */
export const FLOATING_TAB_BAR_HEIGHT =
  TAB_ITEM_HEIGHT + TAB_PILL_V_PADDING * 2 + 2 /* 上下框線 */ + TAB_WRAP_V_PADDING * 2;

/** 分頁畫面的底部留白：膠囊高度 + 安全區 */
export function useFloatingTabBarPadding() {
  return FLOATING_TAB_BAR_HEIGHT + useSafeAreaInsets().bottom;
}
