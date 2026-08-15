import { ImageSourcePropType } from 'react-native';

/**
 * 分享卡的背景款式。
 *
 * 刻意不跟隨 App 的深淺主題——分享出去的卡片是品牌的門面，
 * 不該因為使用者選了深色模式就變成另一種長相。
 *
 * 漸層款完全是程式碼、不佔任何檔案空間；照片款會增加 bundle 體積，
 * 所以「花花」重用 Welcome 頁已經在打包裡的那張，不另外放素材。
 */
export type ShareCardTheme = {
  key: string;
  label: string;
  /** 兩到三個色碼的漸層。照片款也要給，當作圖片載入前的底色 */
  gradient: readonly [string, string, ...string[]];
  /** 選填的背景照片。一律會壓一層遮罩，避免跟寵物照搶戲、也保證文字讀得到 */
  photo?: ImageSourcePropType;
  /** 照片上的遮罩顏色。愈深文字愈清楚，但材質感愈弱 */
  photoScrim?: string;
  /** 主要文字色。每一款都要各自指定——淺底要深字、深底要白字，沒辦法自動判斷 */
  text: string;
  /** 次要文字（日期、網址）。用同色系但降低對比 */
  textMuted: string;
  /** 色票在挑選器上的代表色 */
  swatch: string;
};

/**
 * 用寵物的識別色生成漸層。
 * 每隻寵物天生就有一款專屬背景，而且跟行事曆、我的寵物是同一套色，
 * 養兩隻的人分享出去朋友一眼分得出誰是誰——零檔案成本的個人化。
 */
export function petColorTheme(petColor: string): ShareCardTheme {
  return {
    key: 'pet',
    label: '寵物色',
    // 識別色本身偏深，往上收斂到接近白色，文字才有地方站
    gradient: [`${petColor}33`, `${petColor}14`, '#fffaf7'] as const,
    text: '#241a14',
    textMuted: '#6b5a4e',
    swatch: petColor,
  };
}

export const SHARE_CARD_THEMES: ShareCardTheme[] = [
  {
    key: 'warm',
    label: '暖陽',
    gradient: ['#ffdcc5', '#fff1e6', '#fff8f5'] as const,
    text: '#241a14',
    textMuted: '#6b5a4e',
    swatch: '#ffb783',
  },
  {
    key: 'vivid',
    label: '豔彩',
    gradient: ['#ff8a5c', '#f2649b', '#8b5cf6'] as const,
    text: '#ffffff',
    textMuted: 'rgba(255,255,255,0.82)',
    swatch: '#f2649b',
  },
  {
    key: 'floral',
    label: '花花',
    gradient: ['#3a2f28', '#241c17'] as const,
    // 重用 Welcome 頁的花卉背景，不增加 bundle 體積
    photo: require('../../photo/welcome_bottom.jpg'),
    photoScrim: 'rgba(0,0,0,0.42)',
    text: '#ffffff',
    textMuted: 'rgba(255,255,255,0.8)',
    swatch: '#c9d67a',
  },
];
