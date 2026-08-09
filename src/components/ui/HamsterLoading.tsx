import { useEffect, useRef } from 'react';
import { ThemeColors } from '../../constants/themes';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import {
  View,
  Image,
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
  ImageSourcePropType,
} from 'react-native';

interface Props {
  size?: number;
  color?: string;
  hamsterSource?: ImageSourcePropType;
  wheelSource?: ImageSourcePropType;
  spinDuration?: number;
  showProgress?: boolean;
}

export default function HamsterLoading({
  size = 200,
  color: colorProp,
  hamsterSource,
  wheelSource,
  spinDuration = 1300,
  showProgress = true,
}: Props) {
  const { colors: themeColors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { width: screenW } = useWindowDimensions();
  const scale = size / 200;
  // 預設值不能寫在參數上 —— 那裡取不到 theme
  const color = colorProp ?? themeColors.primary;

  const spinAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const bobAnim = useRef(new Animated.Value(0)).current;   // 整體上下 bob（有圖時用）
  const leg1Anim = useRef(new Animated.Value(0)).current;  // 無圖時顯示的腳塊
  const leg2Anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: spinDuration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const progress = Animated.loop(
      Animated.sequence([
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(progressAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    );

    // 有圖：整體小幅上下 bob 模擬跑步
    const bob = Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, {
          toValue: 1,
          duration: 160,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bobAnim, {
          toValue: 0,
          duration: 160,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const legStep = { duration: 140, easing: Easing.inOut(Easing.ease), useNativeDriver: true as const };

    // 無圖：腳塊動畫
    const leg1 = Animated.loop(
      Animated.sequence([
        Animated.timing(leg1Anim, { toValue: 1, ...legStep }),
        Animated.timing(leg1Anim, { toValue: 0, ...legStep }),
      ])
    );

    const leg2 = Animated.loop(
      Animated.sequence([
        Animated.timing(leg2Anim, { toValue: 0, ...legStep }),
        Animated.timing(leg2Anim, { toValue: 1, ...legStep }),
      ])
    );

    spin.start();
    progress.start();
    bob.start();
    leg1.start();
    leg2.start();

    return () => {
      spin.stop();
      progress.stop();
      bob.stop();
      leg1.stop();
      leg2.stop();
    };
  }, [spinDuration]);

  const spinDeg = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const BAR_W = screenW * 0.7;
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, BAR_W],
  });

  const bobY = bobAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4 * scale],
  });

  const W = 200 * scale;
  const wheelR = 60 * scale;
  const cx = W * 0.5;
  const cy = 80 * scale;

  return (
    <View style={[styles.container, { width: W, height: 210 * scale }]}>

      {/* 滾輪 */}
      <Animated.View
        style={[
          styles.abs,
          {
            width: wheelR * 2,
            height: wheelR * 2,
            left: cx - wheelR,
            top: cy - wheelR,
            transform: [{ rotate: spinDeg }],
          },
        ]}
      >
        {wheelSource ? (
          <Image
            source={wheelSource}
            style={{ width: wheelR * 2, height: wheelR * 2, tintColor: color }}
            resizeMode="contain"
          />
        ) : (
          <WheelDrawing size={wheelR * 2} color={color} />
        )}
      </Animated.View>

      {/* 輪軸中心點 */}
      <View
        style={[
          styles.abs,
          {
            width: 10 * scale,
            height: 10 * scale,
            borderRadius: 5 * scale,
            backgroundColor: color,
            left: cx - 5 * scale,
            top: cy - 5 * scale,
          },
        ]}
      />

      {/* 倉鼠主體 */}
      <Animated.View
        style={[
          styles.abs,
          {
            width: 100 * scale,
            height: 75 * scale,
            left: cx - 50 * scale,
            top: cy - 15 * scale,
            transform: hamsterSource ? [{ translateY: bobY }] : [],
          },
        ]}
      >
        {hamsterSource ? (
          <Image
            source={hamsterSource}
            style={{ width: 100 * scale, height: 75 * scale, tintColor: color }}
            resizeMode="contain"
          />
        ) : (
          <View
            style={{
              width: 100 * scale,
              height: 75 * scale,
              borderRadius: 8 * scale,
              borderColor: color,
              borderWidth: 1.5 * scale,
              backgroundColor: 'transparent',
            }}
          />
        )}
      </Animated.View>

      {/* 站架 */}
      <View style={[styles.abs, { left: cx - 14 * scale, top: cy + wheelR - 4 * scale, width: 7 * scale, height: 22 * scale, borderRadius: 3 * scale, backgroundColor: color }]} />
      <View style={[styles.abs, { left: cx + 7 * scale, top: cy + wheelR - 4 * scale, width: 7 * scale, height: 22 * scale, borderRadius: 3 * scale, backgroundColor: color }]} />
      <View style={[styles.abs, { left: cx - 22 * scale, top: cy + wheelR + 14 * scale, width: 44 * scale, height: 7 * scale, borderRadius: 3.5 * scale, backgroundColor: color }]} />

      {/* 進度條 */}
      {showProgress && (
        <View
          style={[
            styles.abs,
            {
              left: cx - BAR_W / 2,
              top: 182 * scale,
              width: BAR_W,
              height: 5 * scale,
              borderRadius: 2.5 * scale,
              backgroundColor: color + '33',
              overflow: 'hidden',
            },
          ]}
        >
          <Animated.View
            style={{
              height: 5 * scale,
              borderRadius: 2.5 * scale,
              backgroundColor: color,
              width: progressWidth,
            }}
          />
        </View>
      )}
    </View>
  );
}

function WheelDrawing({ size, color }: { size: number; color: string }) {
  const r = size / 2;
  const strokeW = size * 0.04;
  const spokeW = size * 0.018;

  // 4 條輻條，各旋轉 45°，轉換中心剛好在輪心（RN transform 預設繞元素中心）
  const spokes = [0, 45, 90, 135].map((deg) => (
    <View
      key={deg}
      style={{
        position: 'absolute',
        width: spokeW,
        height: size - strokeW * 2,
        backgroundColor: color,
        left: r - spokeW / 2,
        top: strokeW,
        borderRadius: spokeW / 2,
        transform: [{ rotate: `${deg}deg` }],
      }}
    />
  ));

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: r,
          borderWidth: strokeW,
          borderColor: color,
        }}
      />
      {spokes}
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    position: 'relative',
  },
  abs: {
    position: 'absolute',
  },
});
