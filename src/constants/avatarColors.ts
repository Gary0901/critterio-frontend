import { ThemeKey } from './themes';

/**
 * 沒有頭像時，圓形底色依使用者身分推導 —— 讓動態牆上一排空頭像看起來是設計，
 * 而不是沒載入完。
 *
 * 跟 [petColors.ts] 的 buildPetColorMap() 不同：那個是把寵物列成陣列後按順序
 * 分配，能成立是因為寵物總是一起被列出來。使用者不是 —— 動態、留言、封鎖名單、
 * AppBar 各自獨立渲染，沒有共同清單，所以顏色必須能單獨從 id 算出來。
 *
 * 對比度都驗過（縮寫/底色 ≥ 5.0，圓圈/背景 ≥ 1.7）。
 */

export type AvatarColor = { bg: string; fg: string };

// bg 與 fg 成對定義，對比度由組合本身保證，不會因為誰改了單一個值而失衡
const PALETTES: Record<ThemeKey, AvatarColor[]> = {
  warm: [
    { bg: '#f28c38', fg: '#4a2200' }, // 橘（品牌色）
    { bg: '#e0876f', fg: '#4a1a0e' }, // 陶土
    { bg: '#b48ead', fg: '#3d2038' }, // 藕紫
    { bg: '#7fa8c9', fg: '#12354f' }, // 霧藍
    { bg: '#86b189', fg: '#17351a' }, // 草綠
    { bg: '#d4a843', fg: '#40300a' }, // 芥黃
  ],
  dark: [
    { bg: '#7a4a1e', fg: '#ffd0a8' },
    { bg: '#6e3a2c', fg: '#ffc9b4' },
    { bg: '#58406b', fg: '#e2cdf0' },
    { bg: '#2a4a63', fg: '#c3dced' },
    { bg: '#33543a', fg: '#c2e0c4' },
    { bg: '#5e4a1e', fg: '#efd79a' },
  ],
};

/**
 * djb2。要的是「同樣字串永遠得到同樣數字、不同字串盡量分散」，
 * 不需要密碼學強度。
 */
function hashSeed(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** 調色盤長度。後端 authController 的 AVATAR_COLOR_COUNT 要跟這個一致 */
export const AVATAR_COLOR_COUNT = PALETTES.warm.length;

/**
 * 沒選過顏色時，系統依 id 自動配到第幾號。
 * 選擇器要用它當草稿的起點 —— 否則預覽會顯示一個跟使用者現在看到的頭像不同的顏色。
 */
export function autoColorIndexFor(seed: string): number {
  return hashSeed(seed || '?') % PALETTES.warm.length;
}

/** 給選擇器用：某個索引在指定主題下長什麼樣 */
export function avatarColorAt(index: number, themeKey: ThemeKey): AvatarColor {
  const palette = PALETTES[themeKey] ?? PALETTES.warm;
  // 取模當保險：後端存進來的舊索引若超出範圍，也還是會拿到一個合法的顏色
  return palette[((index % palette.length) + palette.length) % palette.length];
}

/**
 * @param seed  優先傳使用者 id。id 是穩定的，改名不會換色；
 *              只有在拿不到 id 的地方（例如 Post.authorId 是選填）才退回名字。
 * @param index 使用者自己挑的顏色。沒挑過（null/undefined）才依 seed 雜湊自動配。
 */
export function avatarColorFor(seed: string, themeKey: ThemeKey, index?: number | null): AvatarColor {
  if (index !== undefined && index !== null && Number.isFinite(index)) {
    return avatarColorAt(index, themeKey);
  }
  const palette = PALETTES[themeKey] ?? PALETTES.warm;
  return palette[hashSeed(seed || '?') % palette.length];
}

/** 中日韓統一表意文字 + 假名 + 諺文 */
const CJK = /[㐀-䶿一-鿿豈-﫿぀-ゟ゠-ヿ가-힯]/;

/**
 * 取頭像上顯示的字。
 *
 * CJK 只取一個字 —— 這些文字沒有「縮寫」的概念，取兩個字會變成在讀一個詞
 * （「測試帳號」→「測試」），而不是看一個標記。LINE、Gmail 對 CJK 也都是取一個字。
 * 拉丁字母才有縮寫慣例，取到兩個字母。
 */
export function initialsFor(name: string): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '?';

  // 用 Array.from 而不是 [0]，否則遇到 emoji 之類的代理對會切出半個字元
  const chars = Array.from(trimmed);
  if (CJK.test(chars[0])) return chars[0];

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return (Array.from(words[0])[0] + Array.from(words[1])[0]).toUpperCase();
  }
  return chars[0].toUpperCase();
}
