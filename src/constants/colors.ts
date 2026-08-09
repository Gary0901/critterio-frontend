import { warmColors } from './themes';

/**
 * @deprecated 靜態匯入的色票無法跟著主題切換 —— `StyleSheet.create()` 在
 * 模組載入時就把值算完了，之後改主題不會重跑。
 *
 * 請改用：
 *   const styles = useThemedStyles(makeStyles);   // 樣式
 *   const { colors } = useTheme();                // JSX 內的 color prop
 *
 * 這裡保留只是為了讓尚未遷移的檔案不會編譯失敗，遷移完成後應該刪掉。
 */
export const Colors = warmColors;
