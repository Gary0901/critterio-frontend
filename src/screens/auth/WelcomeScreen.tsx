import { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import Button from '../../components/ui/Button';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Welcome'>;
};

const { width } = Dimensions.get('window');
const H_PAD = 24;
const AVAILABLE_W = width - H_PAD * 2;

// Circle dimensions
const CIRCLE_L = Math.round(AVAILABLE_W * 0.58);
const CIRCLE_R = Math.round(AVAILABLE_W * 0.50);
const OVERLAP   = Math.round(AVAILABLE_W * 0.16);
const DROP_Y    = Math.round(AVAILABLE_W * 0.18);
const COLLAGE_H = Math.max(CIRCLE_L, DROP_Y + CIRCLE_R) + 8;

// Horizontal centering of the two-circle group
const SPAN    = CIRCLE_L + CIRCLE_R - OVERLAP;
const START_X = (AVAILABLE_W - SPAN) / 2;
const L_LEFT  = START_X;
const R_LEFT  = START_X + CIRCLE_L - OVERLAP;


const photos = {
  w1: require('../../../photo/welcome1.jpg'),
  w2: require('../../../photo/welcome2.jpg'),
};

const ENTER_DURATION = 1520;
const ENTER_STAGGER  = 110;
const ENTER_SLIDE    = 30;

export default function WelcomeScreen({ navigation }: Props) {
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
        colors={[Colors.primaryFixed, Colors.primaryFixed, 'rgba(255,248,245,0.88)', 'rgba(255,248,245,0.30)', 'rgba(255,248,245,0)']}
        locations={[0, 0.32, 0.54, 0.76, 1.0]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Logo */}
      <Animated.View style={[styles.logoRow, enterStyle(0)]}>
        <Text style={styles.logo}>Critterio</Text>
      </Animated.View>

      {/* Two-circle photo collage */}
      <Animated.View style={[styles.collage, enterStyle(1)]}>
        {/* Right circle — behind, breathes downward */}
        <Animated.View style={[styles.circleWrap, {
          width: CIRCLE_R, height: CIRCLE_R, borderRadius: CIRCLE_R / 2,
          left: R_LEFT, top: DROP_Y,
          transform: [{ translateY: rightY }],
        }]}>
          <Image source={photos.w2} style={styles.circleImg} resizeMode="cover" />
        </Animated.View>

        {/* Left circle — front, breathes upward */}
        <Animated.View style={[styles.circleWrap, {
          width: CIRCLE_L, height: CIRCLE_L, borderRadius: CIRCLE_L / 2,
          left: L_LEFT, top: 0,
          transform: [{ translateY: leftY }],
        }]}>
          <Image source={photos.w1} style={styles.circleImg} resizeMode="cover" />
        </Animated.View>
      </Animated.View>

      {/* Headline */}
      <Animated.View style={[styles.textSection, enterStyle(2)]}>
        <Text style={styles.headline}>歡迎來到 <Text style={styles.headlineBrand}>Critterio</Text></Text>
        <Text style={styles.sub}>您的寵物照護與社群全方位夥伴。</Text>
      </Animated.View>

      {/* Spacer */}
      <View style={{ height: 32 }} />

      {/* CTA buttons */}
      <Animated.View style={[styles.actions, enterStyle(3)]}>
        <Button
          label="立即開始 →"
          onPress={() => navigation.navigate('Onboarding')}
          style={styles.mainBtn}
        />
        <Button
          label="登入"
          onPress={() => navigation.navigate('Login')}
          variant="outline"
          style={styles.mainBtn}
        />
        <View style={styles.joinRow}>
          <View style={styles.avatarStack}>
            {['#F4A460', '#98D8C8', '#C8A8E9'].map((color, i) => (
              <View key={i} style={[styles.miniAvatar, { backgroundColor: color, marginLeft: i === 0 ? 0 : -10 }]}>
                <MaterialIcons name="person" size={14} color="white" />
              </View>
            ))}
          </View>
          <Text style={styles.joinText}>加入 10,000+ 位寵物家長</Text>
        </View>
      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  logoRow: {
    paddingTop: 64,
    paddingHorizontal: H_PAD,
    marginBottom: 28,
  },
  logo: {
    fontFamily: FontFamily.brand,
    fontSize: 32,
    color: Colors.primary,
  },

  collage: {
    height: COLLAGE_H,
    marginHorizontal: H_PAD,
  },

  decoTR: {
    position: 'absolute',
    right: 0,
    top: 0,
    opacity: 0.65,
  },
  decoBL: {
    position: 'absolute',
    left: 0,
    bottom: 4,
    opacity: 0.65,
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
    marginTop: 32,
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: H_PAD,
  },
  headline: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineLG,
    color: Colors.onSurface,
    textAlign: 'center',
  },
  headlineBrand: {
    fontFamily: FontFamily.brand,
    fontSize: 42,
    color: Colors.primary,
  },
  sub: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
  },

  actions: {
    gap: 12,
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    paddingBottom: 28,
  },
  mainBtn: {
    width: width * 0.82,
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
    color: Colors.onSurfaceVariant,
  },
});
