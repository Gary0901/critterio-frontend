import { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  useWindowDimensions,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import Button from '../../components/ui/Button';
import { ThemeColors } from '../../constants/themes';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { FontFamily, FontSize } from '../../constants/typography';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Welcome'>;
};

const H_PAD = 24;
// 平板 / iPad 分割視窗上不讓內容無限拉寬，維持手機的閱讀寬度
const MAX_CONTENT_W = 520;
// 低於這個高度視為小螢幕（iPhone SE 之類），全部間距與圓形都縮一號
const COMPACT_H = 700;

// 依視窗尺寸算出雙圓拼貼的所有幾何值。
// 圓的大小同時受寬度與高度限制，避免小螢幕上把下方按鈕擠出畫面。
function getCollageLayout(width: number, height: number) {
  const contentW = Math.min(width, MAX_CONTENT_W) - H_PAD * 2;

  const circleL = Math.round(Math.min(contentW * 0.58, height * 0.26));
  const circleR = Math.round(circleL * 0.86);
  const overlap = Math.round(circleL * 0.28);
  const dropY   = Math.round(circleL * 0.31);
  const collageH = Math.max(circleL, dropY + circleR) + 8;

  // 讓雙圓整體在 contentW 內置中
  const span   = circleL + circleR - overlap;
  const startX = (contentW - span) / 2;

  return {
    contentW,
    circleL,
    circleR,
    collageH,
    lLeft: startX,
    rLeft: startX + circleL - overlap,
    dropY,
  };
}


// Metro 打包工具要求 require() 路徑必須寫死，不能動態組合檔名，
// 所以 14 張照片要先全部各自 require 好，再依星期幾挑當天那兩張
const photos = {
  w1:  require('../../../photo/welcome1.jpg'),
  w2:  require('../../../photo/welcome2.jpg'),
  w3:  require('../../../photo/welcome3.jpg'),
  w4:  require('../../../photo/welcome4.jpg'),
  w5:  require('../../../photo/welcome5.jpg'),
  w6:  require('../../../photo/welcome6.jpg'),
  w7:  require('../../../photo/welcome7.jpg'),
  w8:  require('../../../photo/welcome8.jpg'),
  w9:  require('../../../photo/welcome9.jpg'),
  w10: require('../../../photo/welcome10.jpg'),
  w11: require('../../../photo/welcome11.jpg'),
  w12: require('../../../photo/welcome12.jpg'),
  w13: require('../../../photo/welcome13.jpg'),
  w14: require('../../../photo/welcome14.jpg'),
};

// index 0 = 星期日（Date.getDay() 的順序），每天一組（左圓、右圓）；
// 想改哪天配哪兩張，調整這個陣列裡的順序即可
const DAILY_PHOTO_PAIRS: [any, any][] = [
  [photos.w1,  photos.w2],   // 日
  [photos.w3,  photos.w4],   // 一
  [photos.w5,  photos.w6],   // 二
  [photos.w7,  photos.w8],   // 三
  [photos.w9,  photos.w10],  // 四
  [photos.w11, photos.w12],  // 五
  [photos.w13, photos.w14],  // 六
];

const ENTER_DURATION = 1520;
const ENTER_STAGGER  = 110;
const ENTER_SLIDE    = 30;

// 測試用：改成 0-6 可以強制預覽該天的照片組合（0=日...6=六），測完記得改回 null 再存檔
const TEST_DAY_OVERRIDE: number | null = null;

export default function WelcomeScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = height < COMPACT_H;
  const L = getCollageLayout(width, height);

  const [todayW1, todayW2] = DAILY_PHOTO_PAIRS[TEST_DAY_OVERRIDE ?? new Date().getDay()];
  const breathe = useRef(new Animated.Value(0)).current;
  // 4 entrance anims: logo, collage, text, buttons
  const enters = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Entrance: staggered fade + slide-up
    Animated.stagger(
      ENTER_STAGGER,
      enters.map(a =>
        Animated.timing(a, {
          toValue: 1,
          duration: ENTER_DURATION,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      )
    ).start();

    // Breathing loop starts simultaneously
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const enterStyle = (i: number) => ({
    opacity: enters[i],
    transform: [{
      translateY: enters[i].interpolate({ inputRange: [0, 1], outputRange: [ENTER_SLIDE, 0] }),
    }],
  });

  const leftY  = breathe.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const rightY = breathe.interpolate({ inputRange: [0, 1], outputRange: [0,  10] });

  return (
    <View style={styles.container}>
      {/* Full-screen floral background */}
      <Image
        source={require('../../../photo/welcome_bottom.jpg')}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      {/* Peach → semi-transparent white → fully transparent, flowers show through */}
      <LinearGradient
        colors={[colors.primaryFixed, colors.primaryFixed, 'rgba(255,248,245,0.88)', 'rgba(255,248,245,0.30)', 'rgba(255,248,245,0)']}
        locations={[0, 0.32, 0.54, 0.76, 1.0]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Logo */}
      <Animated.View style={[styles.logoRow, { paddingTop: insets.top + 16, marginBottom: compact ? 16 : 28 }, enterStyle(0)]}>
        <Text style={styles.logo} maxFontSizeMultiplier={1.3}>Critterio</Text>
      </Animated.View>

      {/* Two-circle photo collage */}
      <Animated.View style={[styles.collage, { height: L.collageH, width: L.contentW }, enterStyle(1)]}>
        {/* Right circle — behind, breathes downward */}
        <Animated.View style={[styles.circleWrap, {
          width: L.circleR, height: L.circleR, borderRadius: L.circleR / 2,
          left: L.rLeft, top: L.dropY,
          transform: [{ translateY: rightY }],
        }]}>
          <Image source={todayW2} style={styles.circleImg} resizeMode="cover" />
        </Animated.View>

        {/* Left circle — front, breathes upward */}
        <Animated.View style={[styles.circleWrap, {
          width: L.circleL, height: L.circleL, borderRadius: L.circleL / 2,
          left: L.lLeft, top: 0,
          transform: [{ translateY: leftY }],
        }]}>
          <Image source={todayW1} style={styles.circleImg} resizeMode="cover" />
        </Animated.View>
      </Animated.View>

      {/* Headline */}
      <Animated.View style={[styles.textSection, { marginTop: compact ? 20 : 32 }, enterStyle(2)]}>
        <Text style={styles.headline} maxFontSizeMultiplier={1.3} accessibilityRole="header">
          歡迎來到 <Text style={[styles.headlineBrand, compact && { fontSize: 36 }]}>Critterio</Text>
        </Text>
        <Text style={styles.sub} maxFontSizeMultiplier={1.4}>您的寵物照護與社群全方位夥伴。</Text>
      </Animated.View>

      {/* 把 CTA 推到畫面底部；小螢幕上會自動壓到最小值 */}
      <View style={{ flex: 1, minHeight: 24 }} />

      {/* CTA buttons */}
      <Animated.View style={[styles.actions, { paddingBottom: insets.bottom + 20 }, enterStyle(3)]}>
        <Button
          label="立即開始 →"
          onPress={() => navigation.navigate('Onboarding')}
          style={styles.mainBtn}
        />
        <Button
          label="登入"
          onPress={() => navigation.navigate('Login')}
          variant="outline"
          style={styles.loginBtn}
        />
        <View style={styles.joinRow}>
          <View style={styles.avatarStack}>
            {['#F4A460', '#98D8C8', '#C8A8E9'].map((color, i) => (
              <View key={i} style={[styles.miniAvatar, { backgroundColor: color, marginLeft: i === 0 ? 0 : -10 }]}>
                <MaterialIcons name="person" size={14} color="white" />
              </View>
            ))}
          </View>
          <Text style={styles.joinText}>加入 100+ 位寵物家長</Text>
        </View>
      </Animated.View>

    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },

  logoRow: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MAX_CONTENT_W,
    paddingHorizontal: H_PAD,
  },
  logo: {
    fontFamily: FontFamily.brand,
    fontSize: 32,
    lineHeight: 40,
    color: c.primary,
  },

  collage: {
    alignSelf: 'center',
  },

  circleWrap: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  circleImg: {
    width: '100%',
    height: '100%',
  },

  textSection: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MAX_CONTENT_W,
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: H_PAD,
  },
  headline: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineLG,
    // 內嵌的 42px 品牌字比本文大，行高要吃得下，否則 Android 上會被裁掉上緣
    lineHeight: 52,
    color: c.onSurface,
    textAlign: 'center',
  },
  headlineBrand: {
    fontFamily: FontFamily.brand,
    fontSize: 42,
    color: c.primary,
  },
  sub: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
    textAlign: 'center',
  },

  actions: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MAX_CONTENT_W,
    gap: 12,
    alignItems: 'center',
    paddingHorizontal: H_PAD,
  },
  mainBtn: {
    alignSelf: 'stretch',
  },
  loginBtn: {
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderColor: '#a3796b',
  },
  joinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  miniAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: '#FFFFFF',
    // 這行壓在花卉背景（漸層已完全透明）上，加陰影才不會被亮色花朵吃掉
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
