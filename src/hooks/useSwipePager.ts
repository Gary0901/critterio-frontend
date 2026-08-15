import { useRef } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  useWindowDimensions,
} from 'react-native';

/**
 * 左右滑動翻頁的共用手勢。
 *
 * 內容在拖曳過程中即時跟著手指位移，放開後才決定翻頁或彈回——
 * 只在放開後播一段固定動畫的話沒有翻頁感，那是「切換」不是「翻頁」。
 *
 * 用 PanResponder 而不是 pager 套件：這些畫面翻的是「同一份 UI 換一組資料」，
 * 不需要真的把多頁同時掛在畫面上，也就不必為此引入原生模組。
 *
 * 全部走 useNativeDriver: false —— PanResponder 的拖曳只能用 dragX.setValue() 從 JS 更新，
 * 若 transform 又宣告成原生驅動，同一個 Animated.Value 會同時被兩邊寫，
 * 每幀都要跨橋同步，反而比純 JS 驅動更卡。
 */
export function useSwipePager({
  onPrev,
  onNext,
  canPrev = true,
  canNext = true,
  distanceRatio = 0.14,
  velocityThreshold = 0.3,
  fade = true,
}: {
  onPrev: () => void;
  onNext: () => void;
  /** 到頭時給阻尼而不是完全不動，使用者才知道是沒有上一頁而不是卡住 */
  canPrev?: boolean;
  canNext?: boolean;
  /**
   * 要翻頁需要滑過螢幕寬的幾成。
   * 一開始設 0.25 太重——那是「整頁換頁」的手感，套在卡片內的日曆上會變成要用力刷。
   */
  distanceRatio?: number;
  /** 甩動速度門檻。快速輕甩也該翻頁，不然只看位移會有一半的手勢沒反應 */
  velocityThreshold?: number;
  /**
   * 位移時要不要一起淡出。動畫 opacity 會讓整個子樹每幀重新合成，
   * 內容複雜（例如 42 格的月曆）時是明顯的成本，這種情況設 false 只留位移。
   */
  fade?: boolean;
}) {
  const { width } = useWindowDimensions();
  const dragX = useRef(new Animated.Value(0)).current;

  // PanResponder 只建立一次，回呼會抓到第一次 render 的值，用 ref 轉一手才拿得到最新的
  const stateRef = useRef({ onPrev, onNext, canPrev, canNext, width, distanceRatio, velocityThreshold });
  stateRef.current = { onPrev, onNext, canPrev, canNext, width, distanceRatio, velocityThreshold };

  const settle = (toValue: number) =>
    Animated.spring(dragX, { toValue, useNativeDriver: false, bounciness: 0, speed: 18 });

  const panResponder = useRef(
    PanResponder.create({
      // 水平位移超過 8 且明顯大於垂直就接手。門檻太高會讓手勢「要滑一段才開始有反應」，
      // 那正是不絲滑的來源；1.5 倍的比例仍足以讓垂直捲動優先
      onMoveShouldSetPanResponderCapture: (_e: GestureResponderEvent, g: PanResponderGestureState) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,

      onPanResponderMove: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        const { canPrev: cp, canNext: cn } = stateRef.current;
        const allowed = g.dx < 0 ? cn : cp;
        dragX.setValue(allowed ? g.dx : g.dx / 4);
      },

      onPanResponderRelease: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        const s = stateRef.current;
        const forward = g.dx < 0;
        const allowed = forward ? s.canNext : s.canPrev;
        // 位移過門檻、或甩得夠快都算翻頁——只看位移的話快速輕甩會沒反應
        const passed =
          Math.abs(g.dx) > s.width * s.distanceRatio || Math.abs(g.vx) > s.velocityThreshold;

        if (!passed || !allowed) {
          settle(0).start();
          return;
        }
        // 舊內容先推出畫面，換完資料再從另一側彈進來
        Animated.timing(dragX, {
          toValue: forward ? -s.width : s.width,
          duration: 130,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }).start(() => {
          (forward ? s.onNext : s.onPrev)();
          dragX.setValue(forward ? s.width : -s.width);
          settle(0).start();
        });
      },

      onPanResponderTerminate: () => settle(0).start(),
    }),
  ).current;

  return {
    panHandlers: panResponder.panHandlers,
    /**
     * 套在「不動的外層」。裁切一定要放在靜止的父層——
     * 放在會位移的那一層等於裁切框跟著一起滑出去，完全沒有效果
     */
    clipStyle: { overflow: 'hidden' as const },
    /** 套在會跟著手指位移的內層 */
    animatedStyle: {
      transform: [{ translateX: dragX }],
      ...(fade
        ? {
            opacity: dragX.interpolate({
              inputRange: [-width, 0, width],
              outputRange: [0.3, 1, 0.3],
            }),
          }
        : null),
    },
    /**
     * 套在位移的內層上，把子樹先光柵化成一張點陣圖再搬移。
     * 內容在拖曳期間不會變，所以「畫一次、之後只移動」比每幀重畫整個網格便宜非常多。
     */
    rasterProps: { shouldRasterizeIOS: true, renderToHardwareTextureAndroid: true },
  };
}
