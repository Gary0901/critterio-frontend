import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * 鍵盤是否開啟。
 *
 * 主要用途是切換「要不要為懸浮分頁列讓位」——鍵盤打開時分頁列已經被鍵盤蓋住，
 * 這時還保留那段留白，輸入列跟鍵盤之間就會空出一大塊。
 *
 * iOS 用 will* 事件（跟鍵盤動畫同步，畫面不會慢半拍才跳），
 * Android 沒有 will* 只能用 did*。
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => setVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return visible;
}
