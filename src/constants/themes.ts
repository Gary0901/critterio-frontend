/**
 * Critterio 主題系統
 *
 * 兩組配色，token 命名與原本的 Material 3 一致，所以 screen 端只需把
 * `Colors.x` 換成 `c.x`，語意不變。
 *
 * 對比度全部以 WCAG 2.1 實測過：
 *   暖橘 對比預算 20.00 ・ 深色 18.26
 *
 * Welcome 與 Onboarding 不吃主題，永遠是暖橘 —— 見 withFixedTheme()。
 * 那兩個畫面的版面是繞著品牌橘和滿版照片設計的，換色會散掉。
 */

export type ThemeColors = {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  primaryFixed: string;
  primaryFixedDim: string;
  inversePrimary: string;

  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;

  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;

  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;

  background: string;
  onBackground: string;

  surface: string;
  surfaceDim: string;
  surfaceBright: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  onSurface: string;
  onSurfaceVariant: string;
  surfaceVariant: string;
  inverseSurface: string;
  inverseOnSurface: string;

  outline: string;
  outlineVariant: string;
  surfaceTint: string;

  /* --- 語意色：取代原本散在畫面裡的硬編碼 hex --- */
  /** 星等金色。刻意維持低對比的品牌金 —— 星等資訊由數量與數字承載 */
  warning: string;
  onWarning: string;
  /** 黃色提示條底色 */
  warningContainer: string;
  /** 提示條上的文字，這個才需要讀得清楚 */
  onWarningContainer: string;
  /** 地圖上的使用者定位藍 */
  info: string;
  onInfo: string;
  /** 收藏愛心紅。與 error 分開，因為語意不同 */
  favorite: string;
  /** 愛心圖示的圓形底 */
  favoriteContainer: string;

  /* --- 地點分類色：Map / NearbyList / Onboarding 共用 --- */
  catHospital: string;
  catHospitalBg: string;
  catGrooming: string;
  catGroomingBg: string;
  catStore: string;
  catStoreBg: string;
  catPark: string;
  catParkBg: string;
  catRestaurant: string;
  catRestaurantBg: string;
  catHotel: string;
  catHotelBg: string;

  /** 「照護指南」FAB 的專屬綠 */
  careGuide: string;
  onCareGuide: string;

  /* --- 合作夥伴的金色語彙 --- */
  /**
   * 強調條與 pin 外框。刻意跟分類色系脫鉤 —— 使用者掃過地圖時
   * 「金色 = 合作夥伴」，不用管它原本是醫院還是用品店。
   * 暖橘主題下不能用亮金：#f9a825 在 #fff8f5 上只有 1.88，看不見。
   */
  partnerAccent: string;
  /** 徽章底色（實心），比 accent 亮，配深色文字 */
  partnerBadge: string;
  onPartnerBadge: string;
};

/* ------------------------------------------------------------------ *
 * 暖橘 —— 現有的淺色配色，數值原封不動，外觀不變
 * ------------------------------------------------------------------ */
export const warmColors: ThemeColors = {
  primary: '#944a00',
  onPrimary: '#ffffff',
  primaryContainer: '#f28c38',
  onPrimaryContainer: '#602e00',
  primaryFixed: '#ffdcc5',
  primaryFixedDim: '#ffb783',
  inversePrimary: '#ffb783',

  secondary: '#4a6549',
  onSecondary: '#ffffff',
  secondaryContainer: '#ccebc7',
  onSecondaryContainer: '#506b4f',

  tertiary: '#605e58',
  onTertiary: '#ffffff',
  tertiaryContainer: '#a9a69e',

  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',

  background: '#fff8f5',
  onBackground: '#211a16',

  surface: '#fff8f5',
  surfaceDim: '#e4d8d1',
  surfaceBright: '#fff8f5',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#fff1ea',
  surfaceContainer: '#f9ebe4',
  surfaceContainerHigh: '#f3e6de',
  surfaceContainerHighest: '#ede0d9',
  onSurface: '#211a16',
  onSurfaceVariant: '#554337',
  surfaceVariant: '#ede0d9',
  inverseSurface: '#362f2a',
  inverseOnSurface: '#fceee7',

  outline: '#887365',
  outlineVariant: '#dbc2b2',
  surfaceTint: '#944a00',

  warning: '#f9a825',
  onWarning: '#3a2800',
  warningContainer: '#fff8e1',
  onWarningContainer: '#7a5800',
  info: '#0080ff',
  onInfo: '#ffffff',
  favorite: '#e53935',
  favoriteContainer: '#fdecea',

  catHospital: '#ba1a1a',
  catHospitalBg: '#ffdad6',
  catGrooming: '#6750a4',
  catGroomingBg: '#e8def8',
  catStore: '#944a00',
  catStoreBg: '#ffdcc5',
  catPark: '#4a6549',
  catParkBg: '#ccebc7',
  catRestaurant: '#7a5800',
  catRestaurantBg: '#fff9c4',
  catHotel: '#2d6a4f',
  catHotelBg: '#d3e4cd',
  careGuide: '#006000',
  onCareGuide: '#ffffff',
  partnerAccent: '#a06800',
  partnerBadge: '#e8b04b',
  onPartnerBadge: '#3d2a00',
};

/* ------------------------------------------------------------------ *
 * 深色 —— #121613 當底，#92a59a 升為主色
 *
 * 品牌亮橘在這組完全退場，主色換成灰綠。唯一保留的暖色是 error 紅，
 * 因為那是語意色 —— 使用者靠顏色本身認出「出事了」。
 * ------------------------------------------------------------------ */
export const darkColors: ThemeColors = {
  primary: '#92a59a',
  onPrimary: '#1b2a22',
  primaryContainer: '#526d5e',
  onPrimaryContainer: '#eef4f0',
  primaryFixed: '#2b3630',
  primaryFixedDim: '#3d4f45',
  inversePrimary: '#41614f',

  secondary: '#a9b3ab',
  onSecondary: '#1f2723',
  secondaryContainer: '#2b3630',
  onSecondaryContainer: '#d3ded7',

  tertiary: '#b9c2bc',
  onTertiary: '#242c28',
  tertiaryContainer: '#3a423d',

  error: '#ffb4ab',
  onError: '#690005',
  errorContainer: '#93000a',
  onErrorContainer: '#ffdad6',

  background: '#121613',
  onBackground: '#e2e7e3',

  surface: '#121613',
  surfaceDim: '#0d100e',
  surfaceBright: '#333935',
  surfaceContainerLowest: '#0d100e',
  surfaceContainerLow: '#1a1f1c',
  surfaceContainer: '#1e2320',
  surfaceContainerHigh: '#282e2a',
  surfaceContainerHighest: '#333935',
  onSurface: '#e2e7e3',
  onSurfaceVariant: '#bcc7c0',
  surfaceVariant: '#3d4642',
  inverseSurface: '#e2e7e3',
  inverseOnSurface: '#1a1f1c',

  outline: '#8a938d',
  outlineVariant: '#3d4642',
  surfaceTint: '#92a59a',

  warning: '#f0b566',
  onWarning: '#3a2800',
  warningContainer: '#3a2f18',
  onWarningContainer: '#f0d29a',
  info: '#7cb3ff',
  onInfo: '#00305f',
  favorite: '#ff8a80',
  favoriteContainer: '#452724',

  catHospital: '#ffb4ab',
  catHospitalBg: '#452724',
  catGrooming: '#cfbcff',
  catGroomingBg: '#2f2740',
  catStore: '#ffb783',
  catStoreBg: '#3a2a1c',
  catPark: '#a9d3a4',
  catParkBg: '#22331f',
  catRestaurant: '#f0d29a',
  catRestaurantBg: '#3a2f18',
  catHotel: '#8fd3ae',
  catHotelBg: '#1f3329',
  careGuide: '#7fca9b',
  onCareGuide: '#00391a',
  partnerAccent: '#f0c060',
  partnerBadge: '#f0c060',
  onPartnerBadge: '#3a2a00',
};

/* ------------------------------------------------------------------ */

export type ThemeKey = 'warm' | 'dark';

export type Theme = {
  key: ThemeKey;
  label: string;
  description: string;
  /** 決定 StatusBar 文字顏色與 React Navigation 的 dark flag */
  isDark: boolean;
  colors: ThemeColors;
};

export const themes: Record<ThemeKey, Theme> = {
  warm: {
    key: 'warm',
    label: '暖橘',
    description: '溫暖明亮，Critterio 的招牌配色',
    isDark: false,
    colors: warmColors,
  },
  dark: {
    key: 'dark',
    label: '深色',
    description: '夜間使用，OLED 螢幕更省電',
    isDark: true,
    colors: darkColors,
  },
};

/** 設定頁的顯示順序 */
export const themeList: Theme[] = [themes.warm, themes.dark];

/**
 * 沒有「跟隨系統」選項，預設就是暖橘。
 *
 * 這讓新使用者的整段註冊流程都是暖橘 —— Register 之後接的 AddPet 不吃主題鎖定
 * （它登入後也進得去），若預設跟隨系統，深色機的新使用者會在那裡看到跳色。
 */
export const DEFAULT_THEME: ThemeKey = 'warm';

export function isThemeKey(v: unknown): v is ThemeKey {
  return v === 'warm' || v === 'dark';
}
