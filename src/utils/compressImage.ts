import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * 上傳前的圖片壓縮。
 *
 * 目標是「螢幕上看不出差別」而不是「檔案越小越好」：
 *
 * - 全螢幕寬度最多約 440pt，在 3x 裝置上 = 1320 實體像素。
 *   1440 已經超過任何 iPhone 顯示得出來的解析度，縮到這裡是視覺無損的。
 * - JPEG 0.85 在照片上幾乎看不出壓縮痕跡（0.75 以下才會開始出現色塊）。
 *
 * iPhone 原圖是 4032×3024、3–5 MB；壓完通常在 300–600 KB。
 *
 * ⚠️ 就醫報告不要用這支。那些圖是給 AI 做數值判讀的，
 *    縮圖會讓小字和小數點辨識失敗 —— 上傳原圖是刻意的取捨。
 */

const MAX_WIDTH = 1440;
const QUALITY = 0.85;

export type UploadImage = { uri: string; name: string; type: string };

function getSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

/**
 * 壓縮失敗時回傳原圖 —— 上傳成功比省流量重要，
 * 不該因為壓縮出錯就讓使用者的照片傳不上去。
 */
export async function compressForUpload(
  image: UploadImage,
  maxWidth: number = MAX_WIDTH,
): Promise<UploadImage> {
  try {
    const { width } = await getSize(image.uri);

    // 本來就比目標小就不要動 —— resize 會把小圖放大，檔案反而變大
    const actions: ImageManipulator.Action[] =
      width > maxWidth ? [{ resize: { width: maxWidth } }] : [];

    const result = await ImageManipulator.manipulateAsync(image.uri, actions, {
      compress: QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    });

    return { uri: result.uri, name: 'photo.jpg', type: 'image/jpeg' };
  } catch {
    return image;
  }
}
