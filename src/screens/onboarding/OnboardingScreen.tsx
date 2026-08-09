import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  ScrollView,
  useWindowDimensions,
  TouchableOpacity,
  Animated,
  Easing,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import Button from '../../components/ui/Button';
import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg';
import MapView, { Marker } from 'react-native-maps';

const AnimatedPath   = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedSvgText = Animated.createAnimatedComponent(SvgText);

function bezierLength(
  p0: { x: number; y: number }, c1: { x: number; y: number },
  c2: { x: number; y: number }, p3: { x: number; y: number },
): number {
  let len = 0, prev = p0;
  for (let k = 1; k <= 20; k++) {
    const t = k / 20, mt = 1 - t;
    const x = mt ** 3 * p0.x + 3 * mt ** 2 * t * c1.x + 3 * mt * t ** 2 * c2.x + t ** 3 * p3.x;
    const y = mt ** 3 * p0.y + 3 * mt ** 2 * t * c1.y + 3 * mt * t ** 2 * c2.y + t ** 3 * p3.y;
    const dx = x - prev.x, dy = y - prev.y;
    len += Math.sqrt(dx * dx + dy * dy);
    prev = { x, y };
  }
  return len;
}
import { ThemeColors } from '../../constants/themes';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { FontFamily, FontSize, LineHeight } from '../../constants/typography';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;
};

const { width } = Dimensions.get('window');

// ── Shared layout constants ───────────────────────────────────────────────────
const SLIDE_PAD = 32;
const CARD_W = width - SLIDE_PAD * 2;
const CARD_H = 288;
const PHOTO_H = 160;
const CARD_GAP = 16;
const STEP = CARD_W + CARD_GAP;

// ── Slide 5 — 健檢報告：版面常數 ─────────────────────────────────────────────
const REPORT_THUMB_H = 96;

// ── Slide 2 — 智慧新夥伴：版面常數 ────────────────────────────────────────────
const AI_IMAGE_SIZE   = 240;
const AI_IMAGE_TOP    = 20;
const AI_IMAGE_LEFT   = (CARD_W - AI_IMAGE_SIZE) / 2;
const AI_CONTAINER_H  = AI_IMAGE_SIZE + AI_IMAGE_TOP * 2;

// ── Slide 1 — 建立寵物專屬空間 ───────────────────────────────────────────────
// Components : PetCard, PetCardCarousel
// Styles     : cardStyles (bottom of file)
type PetData = {
  name: string; age: string; breed: string;
  traits: string[]; nextGrooming: string;
  photo: ReturnType<typeof require>;
};

const PETS_DATA: PetData[] = [
  {
    name: 'Sunny',
    age: '1 歲',
    breed: '黃鸝',
    traits: ['活力充沛', '愛唱歌'],
    nextGrooming: '6月15日',
    photo: require('../../../photo/onboard/create1.jpg')
  },
  {
    name: 'Coco',
    age: '2 歲',
    breed: '天竺鼠',
    traits: ['毛茸茸', '好奇寶寶'],
    nextGrooming: '6月22日',
    photo: require('../../../photo/onboard/create2.jpg')
  },
  {
    name: 'Snowy',
    age: '1 歲',
    breed: '米克斯',
    traits: ['活潑好動', '精力旺盛'],
    nextGrooming: '6月18日',
    photo: require('../../../photo/onboard/create3.jpg')
  },
  {
    name: 'Mochi',
    age: '3 歲',
    breed: '虎斑貓',
    traits: ['獨立自主', '溫柔體貼'],
    nextGrooming: '6月25日',
    photo: require('../../../photo/onboard/create4.jpg')
  },
];

function PetCard({ pet }: { pet: PetData }) {
  const { colors } = useTheme();
  const cardStyles = useThemedStyles(makeCardStyles);
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.photoWrap}>
        <Image source={pet.photo} style={cardStyles.photo} resizeMode="cover" />
        <View style={cardStyles.healthBadge}>
          <MaterialIcons name="check-circle" size={13} color="#4A8F5B" />
          <Text style={cardStyles.healthText}>健康</Text>
        </View>
      </View>
      <View style={cardStyles.info}>
        <View style={cardStyles.nameRow}>
          <Text style={cardStyles.petName}>{pet.name}</Text>
          <MaterialIcons name="more-vert" size={18} color={colors.onSurfaceVariant} />
        </View>
        <Text style={cardStyles.petSub}>{pet.age} • {pet.breed}</Text>
        <View style={cardStyles.traits}>
          {pet.traits.map(t => (
            <View key={t} style={cardStyles.chip}>
              <Text style={cardStyles.chipText}>{t}</Text>
            </View>
          ))}
        </View>
        <View style={cardStyles.divider} />
        <Text style={cardStyles.nextApptText}>下次美容：{pet.nextGrooming}</Text>
      </View>
    </View>
  );
}

function PetCardCarousel() {
  const cardStyles = useThemedStyles(makeCardStyles);
  const translateX = useRef(new Animated.Value(0)).current;
  const idxRef = useRef(0);
  // Append duplicate of first card for seamless loop
  const loopData = [...PETS_DATA, PETS_DATA[0]];

  useEffect(() => {
    const advance = () => {
      const next = idxRef.current + 1;
      Animated.timing(translateX, {
        toValue: -next * STEP,
        duration: 750,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        if (next === PETS_DATA.length) {
          // Snap back to real first card invisibly
          translateX.setValue(0);
          idxRef.current = 0;
        } else {
          idxRef.current = next;
        }
      });
    };

    const timer = setInterval(advance, 2800);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={cardStyles.carouselOuter}>
      <Animated.View style={[cardStyles.track, { transform: [{ translateX }] }]}>
        {loopData.map((pet, i) => <PetCard key={i} pet={pet} />)}
      </Animated.View>
    </View>
  );
}

// ── Slide 2 — 智慧新夥伴 ─────────────────────────────────────────────────────
// Components : AISlide
// Styles     : aiStyles (bottom of file)
const FEATURES = [
  { icon: 'health-and-safety', title: '健康偵測',  body: '及早發現皮膚問題、體重變化或異常狀況。' },
  { icon: 'sentiment-satisfied', title: '心情分析', body: '理解您寵物的肢體語言，掌握牠的情緒狀態。' },
] as const;

function AISlide({ title, titleAccent, body }: { title: string; titleAccent?: string; body: string }) {
  const { colors } = useTheme();
  const aiStyles = useThemedStyles(makeAiStyles);
  const pulseAnim  = useRef(new Animated.Value(0)).current;
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const floatAnim2 = useRef(new Animated.Value(0)).current;
  const [featureIdx, setFeatureIdx] = useState(0);
  const fadeAnim   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim,  { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulseAnim,  { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(floatAnim1, { toValue: -8, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(floatAnim1, { toValue:  0, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(floatAnim2, { toValue:  8, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(floatAnim2, { toValue:  0, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();

    const cycle = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        setFeatureIdx(prev => (prev + 1) % FEATURES.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    }, 3500);

    return () => clearInterval(cycle);
  }, []);

  const pulseScale   = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.9] });

  return (
    <View style={aiStyles.wrapper}>
      {/* ── Illustration ── */}
      <View style={aiStyles.illustrationOuter}>
        <View style={aiStyles.imageBox}>
          <Image source={require('../../../photo/onboard/askai.jpg')} style={aiStyles.petImage} resizeMode="cover" />
          <View style={aiStyles.dashedFrame} />
          <View style={aiStyles.scanCenter}>
            <Animated.View style={[aiStyles.scanCircle, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]}>
              <MaterialIcons name="crop-free" size={48} color="rgba(255,255,255,0.92)" />
            </Animated.View>
          </View>
        </View>

        {/* Health Insight chip */}
        <Animated.View style={[aiStyles.chip, aiStyles.chipTR, { transform: [{ translateY: floatAnim1 }] }]}>
          <View style={[aiStyles.chipIcon, { backgroundColor: colors.secondaryContainer }]}>
            <MaterialIcons name="health-and-safety" size={18} color={colors.secondary} />
          </View>
          <View>
            <Text style={aiStyles.chipLabel}>健康分析</Text>
            <Text style={aiStyles.chipValue}>生命指數正常</Text>
          </View>
        </Animated.View>

        {/* Behavior Tip chip */}
        <Animated.View style={[aiStyles.chip, aiStyles.chipBL, { transform: [{ translateY: floatAnim2 }] }]}>
          <View style={[aiStyles.chipIcon, { backgroundColor: colors.primaryFixed }]}>
            <MaterialIcons name="psychology" size={18} color={colors.primary} />
          </View>
          <View>
            <Text style={aiStyles.chipLabel}>行為建議</Text>
            <Text style={aiStyles.chipValue}>需要多玩耍！</Text>
          </View>
        </Animated.View>
      </View>

      {/* ── New Feature badge ── */}
      <View style={aiStyles.badge}>
        <MaterialIcons name="auto-awesome" size={13} color={colors.secondary} />
        <Text style={aiStyles.badgeText}>全新功能</Text>
      </View>

      {/* ── Title ── */}
      <Text style={aiStyles.title}>
        {title}
        {titleAccent && <Text style={aiStyles.titleAccent}>{titleAccent}</Text>}
      </Text>

      {/* ── Description ── */}
      <Text style={aiStyles.description}>{body}</Text>

      {/* ── Feature row (cycling) ── */}
      <Animated.View style={[aiStyles.featureRow, { opacity: fadeAnim }]}>
        <View style={aiStyles.featureIconBox}>
          <MaterialIcons name={FEATURES[featureIdx].icon} size={20} color={colors.primary} />
        </View>
        <View style={aiStyles.featureTextBox}>
          <Text style={aiStyles.featureTitle}>{FEATURES[featureIdx].title}</Text>
          <Text style={aiStyles.featureBody}>{FEATURES[featureIdx].body}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ── Slide 4 — 健康數據追蹤 ───────────────────────────────────────────────────
// Components : WeightChart, ReminderItem, VitalsSlide
// Styles     : vitStyles (bottom of file)
const WEIGHT_DATA = [
  { month: 'JAN', value: 3.1  },
  { month: 'FEB', value: 28.3 },
  { month: 'MAR', value: 28.2 },
  { month: 'APR', value: 28.5 },
  { month: 'MAY', value: 30.8 },
];
const CHART_INNER_W = CARD_W - 32;
const CHART_H       = 48;
const CHART_V_PAD   = 10;
const CHART_H_PAD   = 12;
const CHART_MAX     = 35;

function WeightChart({ isVisible }: { isVisible: boolean }) {
  const { colors } = useTheme();
  const dotAnims = useRef(Array.from({ length: 5 }, () => new Animated.Value(0))).current;
  const segAnims = useRef(Array.from({ length: 4 }, () => new Animated.Value(0))).current;
  const cancelledRef = useRef(false);

  const cx = (i: number) => CHART_H_PAD + (i / (WEIGHT_DATA.length - 1)) * (CHART_INNER_W - CHART_H_PAD * 2);
  const cy = (v: number) => CHART_V_PAD + CHART_H - (v / CHART_MAX) * CHART_H;
  const pts = WEIGHT_DATA.map((d, i) => ({ x: cx(i), y: cy(d.value) }));

  // Per-segment bezier paths + lengths for strokeDashoffset animation
  const segments = pts.slice(1).map((_, idx) => {
    const i = idx + 1;
    const p0 = i >= 2 ? pts[i - 2] : pts[i - 1];
    const p1 = pts[i - 1];
    const p2 = pts[i];
    const p3 = i < pts.length - 1 ? pts[i + 1] : pts[i];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    return {
      d: `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`,
      len: bezierLength(p1, c1, c2, p2),
    };
  });

  useEffect(() => {
    if (!isVisible) return;
    cancelledRef.current = false;

    const playOnce = () => {
      if (cancelledRef.current) return;
      dotAnims.forEach(a => a.setValue(0));
      segAnims.forEach(a => a.setValue(0));

      const seq: Animated.CompositeAnimation[] = [
        Animated.timing(dotAnims[0], { toValue: 1, duration: 350, useNativeDriver: false }),
      ];
      for (let i = 0; i < 4; i++) {
        seq.push(Animated.timing(segAnims[i], {
          toValue: 1, duration: 650, easing: Easing.inOut(Easing.cubic), useNativeDriver: false,
        }));
        seq.push(Animated.timing(dotAnims[i + 1], { toValue: 1, duration: 350, useNativeDriver: false }));
      }

      Animated.sequence(seq).start(({ finished }) => {
        if (finished && !cancelledRef.current) {
          setTimeout(playOnce, 1200);
        }
      });
    };

    playOnce();
    return () => { cancelledRef.current = true; };
  }, [isVisible]);

  return (
    <Svg width={CHART_INNER_W} height={CHART_H + CHART_V_PAD + 2}>
      {segments.map((seg, i) => (
        <AnimatedPath
          key={i}
          d={seg.d}
          stroke={colors.primary}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${seg.len.toFixed(1)},${(seg.len + 1).toFixed(1)}`}
          strokeDashoffset={segAnims[i].interpolate({ inputRange: [0, 1], outputRange: [seg.len, 0] })}
        />
      ))}
      {pts.map((p, i) => (
        <React.Fragment key={i}>
          <AnimatedSvgText x={p.x} y={p.y - 6} fontSize={9} fill={colors.onSurface} textAnchor="middle" opacity={dotAnims[i]}>
            {String(WEIGHT_DATA[i].value)}
          </AnimatedSvgText>
          <AnimatedCircle cx={p.x} cy={p.y} r={3.5} fill={colors.primaryFixed} stroke={colors.primary} strokeWidth={1.5} opacity={dotAnims[i]} />
        </React.Fragment>
      ))}
    </Svg>
  );
}

interface ReminderProps {
  iconName: React.ComponentProps<typeof MaterialIcons>['name'];
  iconBg: string;
  iconColor: string;
  title: string;
  time: string;
  desc: string;
  right: React.ReactNode;
}

function ReminderItem({ iconName, iconBg, iconColor, title, time, desc, right }: ReminderProps) {
  const vitStyles = useThemedStyles(makeVitStyles);
  return (
    <View style={vitStyles.reminderItem}>
      <View style={[vitStyles.reminderIcon, { backgroundColor: iconBg }]}>
        <MaterialIcons name={iconName} size={20} color={iconColor} />
      </View>
      <View style={vitStyles.reminderText}>
        <View style={vitStyles.reminderTitleRow}>
          <Text style={vitStyles.reminderTitle}>{title}</Text>
          <Text style={vitStyles.reminderTime}>{time}</Text>
        </View>
        <Text style={vitStyles.reminderDesc}>{desc}</Text>
      </View>
      {right}
    </View>
  );
}

function VitalsSlide({ isVisible }: { isVisible: boolean }) {
  const { colors } = useTheme();
  const vitStyles = useThemedStyles(makeVitStyles);
  const itemAnims = useRef(
    Array.from({ length: 3 }, () => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(20),
    }))
  ).current;
  const pawScale = useRef(new Animated.Value(0)).current;
  const remCancelledRef = useRef(false);

  useEffect(() => {
    if (!isVisible) return;
    remCancelledRef.current = false;

    const play = () => {
      if (remCancelledRef.current) return;
      itemAnims.forEach(a => { a.opacity.setValue(0); a.translateY.setValue(20); });
      pawScale.setValue(0);

      Animated.sequence([
        Animated.stagger(300, itemAnims.map(a =>
          Animated.parallel([
            Animated.timing(a.opacity, { toValue: 1, duration: 380, useNativeDriver: true }),
            Animated.timing(a.translateY, { toValue: 0, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          ])
        )),
        // Paw stamp: press down → bounce → settle
        Animated.sequence([
          Animated.timing(pawScale, { toValue: 1.45, duration: 140, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(pawScale, { toValue: 0.82, duration: 90,  useNativeDriver: true }),
          Animated.timing(pawScale, { toValue: 1.0,  duration: 80,  useNativeDriver: true }),
        ]),
        Animated.delay(1800),
        // Fade everything out before next loop
        Animated.parallel([
          ...itemAnims.map(a => Animated.timing(a.opacity, { toValue: 0, duration: 280, useNativeDriver: true })),
          Animated.timing(pawScale, { toValue: 0, duration: 220, useNativeDriver: true }),
        ]),
      ]).start(({ finished }) => {
        if (finished && !remCancelledRef.current) setTimeout(play, 350);
      });
    };

    play();
    return () => { remCancelledRef.current = true; };
  }, [isVisible]);

  return (
    <View style={vitStyles.container}>
      {/* Weight Card */}
      <View style={vitStyles.card}>
        <View style={vitStyles.weightHeader}>
          <View>
            <Text style={vitStyles.weightLabel}>目前體重</Text>
            <Text style={vitStyles.weightValue}>
              {'28.4 '}
              <Text style={vitStyles.weightUnit}>kg</Text>
            </Text>
          </View>
          <View style={vitStyles.chartIconBtn}>
            <MaterialIcons name="bar-chart" size={22} color={colors.onSurface} />
          </View>
        </View>
        <WeightChart isVisible={isVisible} />
        <View style={vitStyles.monthRow}>
          {WEIGHT_DATA.map(d => (
            <Text key={d.month} style={vitStyles.monthLabel}>{d.month}</Text>
          ))}
        </View>
      </View>

      {/* Reminders Card */}
      <View style={vitStyles.card}>
        <View style={vitStyles.remindersHeader}>
          <Text style={vitStyles.remindersTitle}>即將到來的提醒</Text>
          <Text style={vitStyles.todayLabel}>今日</Text>
        </View>
        <Animated.View style={{ opacity: itemAnims[0].opacity, transform: [{ translateY: itemAnims[0].translateY }] }}>
          <ReminderItem
            iconName="bathtub"
            iconBg="#dbeafe"
            iconColor="#3b82f6"
            title="洗澡時間"
            time="16:00"
            desc="幫 Charlie 洗澡美容"
            right={<View style={vitStyles.checkbox} />}
          />
        </Animated.View>
        <Animated.View style={{ opacity: itemAnims[1].opacity, transform: [{ translateY: itemAnims[1].translateY }] }}>
          <ReminderItem
            iconName="medical-services"
            iconBg={colors.primaryFixed}
            iconColor={colors.onPrimaryContainer}
            title="獸醫回診"
            time="10:30"
            desc="Cooper 年度疫苗施打"
            right={<View style={vitStyles.checkbox} />}
          />
        </Animated.View>
        <Animated.View style={{ opacity: itemAnims[2].opacity, transform: [{ translateY: itemAnims[2].translateY }] }}>
          <ReminderItem
            iconName="medication"
            iconBg={colors.secondaryContainer}
            iconColor={colors.secondary}
            title="心絲蟲預防藥"
            time="08:00"
            desc="Bella 每月服藥"
            right={
              <Animated.View style={[vitStyles.pawCircle, { transform: [{ scale: pawScale }] }]}>
                <MaterialCommunityIcons name="paw" size={15} color="white" />
              </Animated.View>
            }
          />
        </Animated.View>
      </View>
    </View>
  );
}

// ── Slide 3 — 寵物景點地圖 ───────────────────────────────────────────────────

const MAP_SPOTS = [
  {
    region: { latitude: 25.044, longitude: 121.531, latitudeDelta: 0.012, longitudeDelta: 0.012 },
    category: 'vet'        as const,
    name: '台北動物醫院',
  },
  {
    region: { latitude: 25.027, longitude: 121.536, latitudeDelta: 0.012, longitudeDelta: 0.012 },
    category: 'park'       as const,
    name: '大安森林公園',
  },
  {
    region: { latitude: 25.050, longitude: 121.558, latitudeDelta: 0.012, longitudeDelta: 0.012 },
    category: 'grooming'   as const,
    name: '毛孩美容沙龍',
  },
  {
    region: { latitude: 25.038, longitude: 121.563, latitudeDelta: 0.012, longitudeDelta: 0.012 },
    category: 'restaurant' as const,
    name: '寵物友善餐廳',
  },
];

const makeMapCategoryConfig = (
  c: ThemeColors,
): Record<string, { icon: keyof typeof MaterialIcons.glyphMap; bgColor: string; iconColor: string; label: string }> => ({
  vet:        { icon: 'local-hospital', bgColor: c.catHospitalBg, iconColor: c.catHospital, label: '動物醫院' },
  park:       { icon: 'local-florist',  bgColor: c.catParkBg, iconColor: c.catPark, label: '寵物公園' },
  grooming:   { icon: 'content-cut',    bgColor: c.catGroomingBg, iconColor: c.catGrooming, label: '寵物美容' },
  restaurant: { icon: 'restaurant',     bgColor: c.catRestaurantBg, iconColor: c.catRestaurant, label: '友善餐廳' },
});

const DEMO_PLACES = [
  { name: '信義廣場狗活動區', category: 'park',       rating: 4.1, distance: '79 m',   address: '台北市信義區信義路五段11號' },
  { name: '台北動物醫院',     category: 'vet',        rating: 4.6, distance: '350 m',  address: '台北市中山區民生東路三段' },
  { name: '毛孩美容沙龍',     category: 'grooming',   rating: 4.7, distance: '520 m',  address: '台北市大安區忠孝東路四段' },
  { name: '寵物友善咖啡廳',   category: 'restaurant', rating: 4.5, distance: '680 m',  address: '台北市信義區松仁路28號' },
  { name: '大安森林公園',     category: 'park',       rating: 4.9, distance: '1.2 km', address: '台北市大安區新生南路二段' },
  { name: '愛兔之家動物醫院', category: 'vet',        rating: 4.8, distance: '1.5 km', address: '台北市松山區南京東路五段' },
];
const LIST_ITEM_H = 72;

function MapSlide({ isVisible, title, titleAccent }: { isVisible: boolean; title: string; titleAccent?: string; body: string }) {
  const { colors } = useTheme();
  const mapSlStyles = useThemedStyles(makeMapSlStyles);
  const styles = useThemedStyles(makeStyles);
  const mapRef = useRef<MapView>(null);
  const spotIdxRef = useRef(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const [currentSpot, setCurrentSpot] = useState(0);

  useEffect(() => {
    if (!isVisible) return;

    // Map panning
    const advance = () => {
      const next = (spotIdxRef.current + 1) % MAP_SPOTS.length;
      spotIdxRef.current = next;
      mapRef.current?.animateToRegion(MAP_SPOTS[next].region, 1800);
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setCurrentSpot(next);
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    };
    const timer = setInterval(advance, 3000);

    // List auto-scroll (linear loop)
    scrollAnim.setValue(0);
    Animated.loop(
      Animated.timing(scrollAnim, {
        toValue: -(DEMO_PLACES.length * LIST_ITEM_H),
        duration: DEMO_PLACES.length * 2400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    return () => {
      clearInterval(timer);
      scrollAnim.stopAnimation();
      scrollAnim.setValue(0);
    };
  }, [isVisible]);

  const spot = MAP_SPOTS[currentSpot];
  const cfg = makeMapCategoryConfig(colors)[spot.category];
  const loopPlaces = [...DEMO_PLACES, ...DEMO_PLACES];

  return (
    <View style={mapSlStyles.wrapper}>
      {/* Map */}
      <View style={mapSlStyles.mapContainer}>
        <MapView
          ref={mapRef}
          style={mapSlStyles.map}
          initialRegion={MAP_SPOTS[0].region}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          showsCompass={false}
          showsPointsOfInterests={false}
          showsBuildings={false}
        >
          {MAP_SPOTS.map((s, i) => {
            const c = makeMapCategoryConfig(colors)[s.category];
            return (
              <Marker key={i} coordinate={{ latitude: s.region.latitude, longitude: s.region.longitude }} tracksViewChanges={false}>
                <View style={[mapSlStyles.pin, { backgroundColor: c.bgColor }]}>
                  <MaterialIcons name={c.icon} size={16} color={c.iconColor} />
                </View>
              </Marker>
            );
          })}
        </MapView>
        <LinearGradient colors={['transparent', 'rgba(255,255,255,0.85)']} style={mapSlStyles.fadeBottom} pointerEvents="none" />
        <Animated.View style={[mapSlStyles.spotCard, { opacity: fadeAnim }]}>
          <View style={[mapSlStyles.spotIcon, { backgroundColor: cfg.bgColor }]}>
            <MaterialIcons name={cfg.icon} size={14} color={cfg.iconColor} />
          </View>
          <Text style={mapSlStyles.spotLabel}>{cfg.label}</Text>
          <Text style={mapSlStyles.spotName}>{spot.name}</Text>
        </Animated.View>
      </View>

      {/* Title */}
      <Text style={[styles.title, { marginBottom: 4 }]}>
        {title}
        {titleAccent && <Text style={styles.titleAccent}>{titleAccent}</Text>}
      </Text>

      {/* Auto-scrolling place list */}
      <View style={mapSlStyles.listClip}>
        <Animated.View style={{ transform: [{ translateY: scrollAnim }] }}>
          {loopPlaces.map((place, i) => {
            const c = makeMapCategoryConfig(colors)[place.category];
            return (
              <View key={i} style={mapSlStyles.listItem}>
                <View style={[mapSlStyles.listIcon, { backgroundColor: c.bgColor }]}>
                  <MaterialIcons name={c.icon} size={20} color={c.iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={mapSlStyles.listName} numberOfLines={1}>{place.name}</Text>
                  <View style={mapSlStyles.listMeta}>
                    <View style={[mapSlStyles.categoryBadge, { backgroundColor: c.bgColor }]}>
                      <Text style={[mapSlStyles.categoryText, { color: c.iconColor }]}>{c.label}</Text>
                    </View>
                    <MaterialIcons name="star" size={12} color="#F59E0B" />
                    <Text style={mapSlStyles.ratingText}>{place.rating}</Text>
                  </View>
                  <Text style={mapSlStyles.listAddress} numberOfLines={1}>{place.address}</Text>
                </View>
                <Text style={mapSlStyles.distanceText}>{place.distance}</Text>
              </View>
            );
          })}
        </Animated.View>
      </View>
    </View>
  );
}

const makeMapSlStyles = (c: ThemeColors) => StyleSheet.create({
  wrapper: { flex: 1, justifyContent: 'flex-start' },
  mapContainer: {
    height: 260,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 14,
    position: 'relative',
  },
  map: { ...StyleSheet.absoluteFill },
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  spotCard: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  spotIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: c.onSurfaceVariant,
  },
  spotName: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: 13,
    color: c.onSurface,
  },
  pin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  // Scrolling place list
  listClip: {
    height: LIST_ITEM_H * 4,
    overflow: 'hidden',
    marginTop: 10,
  },
  listItem: {
    height: LIST_ITEM_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.outlineVariant,
  },
  listIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  listName: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: 14,
    color: c.onSurface,
    marginBottom: 3,
  },
  listMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  categoryBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  categoryText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
  },
  ratingText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: c.onSurfaceVariant,
  },
  listAddress: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: c.onSurfaceVariant,
  },
  distanceText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: c.onSurfaceVariant,
    flexShrink: 0,
  },
});

// ── Slide 5 — 看得懂的健檢報告 ───────────────────────────────────────────────
// Components : HealthReportSlide
// Styles     : reportStyles (bottom of file)
// 對應 VetVisitsScreen：拍照上傳檢驗單 → 解析成項目表 → 使用者確認/修正 → 存檔
// 只放兩列：一列偏高、一列正常，剛好示範兩種狀態，小螢幕也塞得下
const LAB_ITEMS = [
  { name: '白血球', abbr: 'WBC',  value: '12.4', unit: 'K/µL',  status: 'HIGH'   as const, explain: '偏高，常見於發炎或感染' },
  { name: '肌酸酐', abbr: 'CREA', value: '1.1',  unit: 'mg/dL', status: 'NORMAL' as const, explain: '腎臟代謝指標正常' },
];

// 與 VetVisitsScreen 的 STATUS_COLOR / STATUS_LABEL 對齊
const makeLabStatus = (c: ThemeColors) => ({
  NORMAL: { label: '正常', color: c.secondary, bg: c.secondaryContainer },
  HIGH:   { label: '偏高', color: c.error,     bg: c.errorContainer     },
});

function HealthReportSlide({ isVisible }: { isVisible: boolean }) {
  const { colors } = useTheme();
  const reportStyles = useThemedStyles(makeReportStyles);
  const rowAnims = useRef(
    LAB_ITEMS.map(() => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(16),
    }))
  ).current;
  // 掃描光條由上往下掃過報告縮圖
  const sweep = useRef(new Animated.Value(0)).current;
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!isVisible) return;
    cancelledRef.current = false;

    const play = () => {
      if (cancelledRef.current) return;
      rowAnims.forEach(a => { a.opacity.setValue(0); a.translateY.setValue(16); });
      sweep.setValue(0);

      Animated.sequence([
        // 先掃描，掃完才逐列吐出解析結果
        Animated.timing(sweep, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.stagger(260, rowAnims.map(a =>
          Animated.parallel([
            Animated.timing(a.opacity, { toValue: 1, duration: 360, useNativeDriver: true }),
            Animated.timing(a.translateY, { toValue: 0, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          ])
        )),
        Animated.delay(2000),
        Animated.parallel(
          rowAnims.map(a => Animated.timing(a.opacity, { toValue: 0, duration: 280, useNativeDriver: true }))
        ),
      ]).start(({ finished }) => {
        if (finished && !cancelledRef.current) setTimeout(play, 350);
      });
    };

    play();
    return () => { cancelledRef.current = true; };
  }, [isVisible]);

  const sweepY = sweep.interpolate({ inputRange: [0, 1], outputRange: [0, REPORT_THUMB_H] });

  return (
    <View style={reportStyles.container}>
      {/* 報告卡：縮圖 + 掃描光條 */}
      <View style={reportStyles.card}>
        <View style={reportStyles.reportHeader}>
          <View style={reportStyles.reportIcon}>
            <MaterialIcons name="description" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={reportStyles.reportTitle}>血液生化檢驗</Text>
            <Text style={reportStyles.reportMeta}>幸福動物醫院 · 2026/08/06</Text>
          </View>
        </View>

        <View style={reportStyles.thumbWrap}>
          {/* 用線條模擬報告單上的文字列 */}
          {[0.92, 0.68, 0.84, 0.55, 0.78, 0.46].map((w, i) => (
            <View key={i} style={[reportStyles.thumbLine, { width: `${w * 100}%` }]} />
          ))}
          <Animated.View style={[reportStyles.sweepBar, { transform: [{ translateY: sweepY }] }]} />
        </View>
      </View>

      {/* 解析結果卡 */}
      <View style={reportStyles.card}>
        <Text style={reportStyles.resultTitle}>解析結果</Text>
        {LAB_ITEMS.map((item, i) => {
          const s = makeLabStatus(colors)[item.status];
          return (
            <Animated.View
              key={item.abbr}
              style={[
                reportStyles.row,
                { opacity: rowAnims[i].opacity, transform: [{ translateY: rowAnims[i].translateY }] },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={reportStyles.itemName}>
                  {item.name}
                  <Text style={reportStyles.itemAbbr}>{`（${item.abbr}）`}</Text>
                </Text>
                <Text style={reportStyles.itemExplain}>{item.explain}</Text>
              </View>
              <View style={reportStyles.valueBox}>
                <Text style={reportStyles.itemValue}>{item.value}</Text>
                <Text style={reportStyles.itemUnit}>{item.unit}</Text>
              </View>
              <View style={[reportStyles.statusChip, { backgroundColor: s.bg }]}>
                <Text style={[reportStyles.statusLabel, { color: s.color }]}>{s.label}</Text>
              </View>
            </Animated.View>
          );
        })}

        <View style={reportStyles.reviewHint}>
          <MaterialIcons name="edit" size={13} color={colors.onSurfaceVariant} />
          <Text style={reportStyles.reviewHintText}>每一項都能自己核對、修正後再存檔</Text>
        </View>
      </View>
    </View>
  );
}

// ── Slide 6 — 寵物家族社群 ───────────────────────────────────────────────────
// Components : CommunitySlide
// Styles     : commStyles (bottom of file)
const JOIN_PHOTOS = [
  require('../../../photo/onboard/join1.jpg'),
  require('../../../photo/onboard/join2.jpg'),
  require('../../../photo/onboard/join3.jpg'),
  require('../../../photo/onboard/join4.jpg'),
] as const;

const COMMUNITY_FEATURES = [
  { icon: 'groups'          as const, label: '專家圈'    },
  { icon: 'place'           as const, label: '在地聚會'  },
  { icon: 'tips-and-updates' as const, label: '每日小知識' },
] satisfies { icon: React.ComponentProps<typeof MaterialIcons>['name']; label: string }[];

function CommunitySlide({ title, titleAccent, body }: { title: string; titleAccent?: string; body: string }) {
  const { colors } = useTheme();
  const commStyles = useThemedStyles(makeCommStyles);
  const [photoIdx, setPhotoIdx] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const cycle = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 450, useNativeDriver: true }).start(() => {
        setPhotoIdx(prev => (prev + 1) % JOIN_PHOTOS.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
      });
    }, 4800);
    return () => clearInterval(cycle);
  }, []);

  return (
    <View style={commStyles.wrapper}>
      {/* IG-style post card */}
      <View style={commStyles.postCard}>
        <View style={commStyles.postHeader}>
          <View style={commStyles.postAvatar}>
            <MaterialCommunityIcons name="paw" size={13} color="#fff" />
          </View>
          <Text style={commStyles.postUser}>Critterio</Text>
          <MaterialIcons name="more-horiz" size={20} color={colors.onSurfaceVariant} />
        </View>
        <Animated.View style={[commStyles.postPhotoWrap, { opacity: fadeAnim }]}>
          <Image source={JOIN_PHOTOS[photoIdx]} style={commStyles.postPhoto} resizeMode="cover" />
        </Animated.View>
        <View style={commStyles.postFooter}>
          <MaterialIcons name="favorite" size={22} color="#e53935" />
          <MaterialIcons name="chat-bubble-outline" size={20} color={colors.onSurface} />
          <MaterialIcons name="near-me" size={20} color={colors.onSurface} />
        </View>
      </View>

      {/* Title */}
      <Text style={commStyles.title}>
        {title}
        {titleAccent && <Text style={commStyles.titleAccent}>{titleAccent}</Text>}
      </Text>
      <Text style={commStyles.desc}>{body}</Text>

      {/* Feature rows */}
      <View style={commStyles.featureList}>
        {COMMUNITY_FEATURES.map(f => (
          <View key={f.label} style={commStyles.featureItem}>
            <View style={commStyles.featureIconWrap}>
              <MaterialIcons name={f.icon} size={22} color={colors.secondary} />
            </View>
            <Text style={commStyles.featureLabel}>{f.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Slide 文案（每張的 title / titleAccent / body / cta）─────────────────────
const STEPS = [
  {
    key: '1',
    title: '建立您的寵物',
    titleAccent: '專屬空間',
    body: '首先，讓我們認識您的毛小孩！新增基本資料，開啟專屬的健康管理旅程。',
    cta: '下一步 →',
  },
  {
    key: '2',
    title: '認識您寵物的',
    titleAccent: '智慧新夥伴',
    body: 'AI 相機即時掃描您的寵物，提供即時健康分析與個人化行為建議。',
    cta: '下一步 →',
  },
  {
    key: '3',
    title: '探索周遭的',
    titleAccent: '寵物景點秘境',
    body: '一鍵找到附近的動物醫院、寵物公園、美容沙龍與友善餐廳，隨時掌握在地資訊。',
    cta: '下一步 →',
  },
  {
    key: '4',
    title: '追蹤牠的',
    titleAccent: '健康數據',
    body: '記錄體重、身高與日常活動，透過精美的成長圖表看著牠茁壯成長。',
    cta: '下一步 →',
  },
  {
    key: '5',
    title: '看得懂的',
    titleAccent: '健檢報告',
    body: '拍下獸醫給的檢驗單，自動整理成項目表，偏高偏低一眼看懂，每項都能自己核對修正。',
    cta: '下一步 →',
  },
  {
    key: '6',
    title: '加入',
    titleAccent: '寵物家族',
    body: '與 100+ 位寵物家長建立連結，分享故事、尋求建議，為您的毛孩找到玩伴。',
    cta: '立即開始 →',
  },
];

// ── Screen component ─────────────────────────────────────────────────────────
export default function OnboardingScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [index, setIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  // slideW 決定分頁寬度，必須跟著視窗走（iPad 分割視窗會即時改變寬度）
  const { width: slideW } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const goTo = (i: number) => {
    flatListRef.current?.scrollToIndex({ index: i, animated: true });
    setIndex(i);
  };

  const goNext = () => {
    if (index < STEPS.length - 1) {
      goTo(index + 1);
    } else {
      navigation.navigate('Register');
    }
  };

  const goPrev = () => {
    if (index > 0) goTo(index - 1);
  };

  const skip = () => {
    navigation.navigate('Register');
  };

  return (
    <LinearGradient
      colors={[colors.primaryFixed + 'AA', colors.background]}
      style={styles.container}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 0.5 }}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.logoText}>Critterio</Text>
        <TouchableOpacity onPress={skip}>
          <Text style={styles.skipText}>跳過</Text>
        </TouchableOpacity>
      </View>

      {/* Left ghost-pill nav */}
      {index > 0 && (
        <TouchableOpacity style={styles.tapLeft} onPress={goPrev} />
      )}

      {/* Right ghost-pill nav — hidden on last slide */}
      {index < STEPS.length - 1 && (
        <TouchableOpacity style={styles.tapRight} onPress={goNext} />
      )}

      <FlatList
        ref={flatListRef}
        data={STEPS}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key}
        style={{ flex: 1, alignSelf: 'stretch' }}
        getItemLayout={(_, i) => ({ length: slideW, offset: slideW * i, index: i })}
        // 滑動翻頁：停下來後把 index 同步回來，各 slide 的進場動畫靠 index 觸發
        onMomentumScrollEnd={(e) => {
          const next = Math.round(e.nativeEvent.contentOffset.x / slideW);
          if (next !== index) setIndex(next);
        }}
        renderItem={({ item }) => (
          // 每張 slide 包一層垂直 ScrollView：大螢幕上 flexGrow 讓它填滿、外觀不變，
          // 小螢幕（iPhone SE）內容放不下時改成可捲動，而不是被裁掉
          <ScrollView
            style={{ width: slideW }}
            contentContainerStyle={
              item.key === '3'
                ? [styles.slideMapContent, { paddingHorizontal: slideW * 0.05 }]
                : styles.slideContent
            }
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {item.key === '1' ? (
              <>
                <PetCardCarousel />
                <Text style={styles.title}>
                  {item.title}
                  {item.titleAccent && <Text style={styles.titleAccent}>{item.titleAccent}</Text>}
                </Text>
                <Text style={styles.body}>{item.body}</Text>
              </>
            ) : item.key === '2' ? (
              <AISlide title={item.title} titleAccent={item.titleAccent} body={item.body} />
            ) : item.key === '3' ? (
              <MapSlide isVisible={index === 2} title={item.title} titleAccent={item.titleAccent} body={item.body} />
            ) : item.key === '4' ? (
              <>
                <VitalsSlide isVisible={index === 3} />
                <Text style={styles.title}>
                  {item.title}
                  {item.titleAccent && <Text style={styles.titleAccent}>{item.titleAccent}</Text>}
                </Text>
                <Text style={styles.body}>{item.body}</Text>
              </>
            ) : item.key === '5' ? (
              <>
                <HealthReportSlide isVisible={index === 4} />
                <Text style={styles.title}>
                  {item.title}
                  {item.titleAccent && <Text style={styles.titleAccent}>{item.titleAccent}</Text>}
                </Text>
                <Text style={styles.body}>{item.body}</Text>
              </>
            ) : (
              <CommunitySlide title={item.title} titleAccent={item.titleAccent} body={item.body} />
            )}
          </ScrollView>
        )}
      />

      {/* Dots */}
      <View style={styles.dots}>
        {STEPS.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => goTo(i)} activeOpacity={0.7}>
            {i === index ? (
              <MaterialCommunityIcons name="paw" size={20} color={colors.primary} />
            ) : (
              <View style={styles.dot} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* CTA */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + 20 }]}>
        <Button label={STEPS[index].cta} onPress={goNext} style={{ width: slideW - 40 }} />
        <TouchableOpacity onPress={skip}>
          <Text style={styles.skipLink}>跳過</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

// ── Shared screen styles (header / slide wrapper / dots / CTA) ───────────────
const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  logoText: {
    fontFamily: FontFamily.brand,
    fontSize: 40,
    lineHeight: 42,
    color: c.primary,
  },
  skipText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
  },
  // 這兩個是 ScrollView 的 contentContainerStyle：寬度由外層 ScrollView 給，
  // 這裡用 flexGrow 取代 flex，內容不足時填滿、超過時可捲動
  slideContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 24,
  },
  slideMapContent: {
    flexGrow: 1,
    paddingTop: 16,
  },
  title: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineLG,
    color: c.onSurface,
    textAlign: 'center',
    lineHeight: LineHeight.headlineLG,
    marginBottom: 12,
  },
  titleAccent: {
    color: c.primary,
  },
  body: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 24,
  },
  dots: { flexDirection: 'row', gap: 6, marginTop: 24, alignItems: 'center' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.outlineVariant,
  },
  tapLeft: {
    position: 'absolute',
    left: 0,
    top: 80,
    bottom: 140,
    width: 52,
    justifyContent: 'center',
    alignItems: 'flex-start',
    zIndex: 2,
  },
  tapRight: {
    position: 'absolute',
    right: 0,
    top: 80,
    bottom: 140,
    width: 52,
    justifyContent: 'center',
    alignItems: 'flex-end',
    zIndex: 2,
  },
  arrowPill: {
    width: 32,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  actions: { gap: 12, alignItems: 'center', marginTop: 24 },
  skipLink: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
  },
});

// ── Slide 1 樣式（建立寵物專屬空間）──────────────────────────────────────────
const makeCardStyles = (c: ThemeColors) => StyleSheet.create({
  carouselOuter: {
    width: CARD_W,
    overflow: 'hidden',
    marginBottom: 32,
  },
  track: {
    flexDirection: 'row',
    gap: CARD_GAP,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 5,
  },
  photoWrap: {
    width: '100%',
    height: PHOTO_H,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  healthBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.catParkBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  healthText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSize.labelSM,
    color: c.catPark,
  },
  info: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  petName: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.bodyLG,
    color: c.onSurface,
  },
  petSub: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
    marginBottom: 8,
  },
  traits: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  chip: {
    backgroundColor: c.surfaceContainerHigh,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  chipText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
  },
  divider: {
    height: 1.5,
    backgroundColor: c.outlineVariant,
    marginBottom: 8,
    borderRadius: 1,
    opacity: 0.6,
  },
  nextApptText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSize.labelMD,
    color: c.onSurface,
  },
});

// ── Slide 2 樣式（智慧新夥伴）────────────────────────────────────────────────
const makeAiStyles = (c: ThemeColors) => StyleSheet.create({
  wrapper: {
    width: CARD_W,
    alignSelf: 'center',
  },
  // Illustration
  illustrationOuter: {
    width: CARD_W,
    height: AI_CONTAINER_H,
    marginBottom: 8,
  },
  imageBox: {
    position: 'absolute',
    left: AI_IMAGE_LEFT,
    right: AI_IMAGE_LEFT,
    top: AI_IMAGE_TOP,
    height: AI_IMAGE_SIZE,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: c.surfaceContainerHigh,
  },
  petImage: { width: '100%', height: '100%' },
  dashedFrame: {
    position: 'absolute',
    top: 8, left: 8, right: 8, bottom: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: 12,
  },
  scanCenter: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.82)',
    backgroundColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Floating chips
  chip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.93)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09,
    shadowRadius: 8,
    elevation: 3,
  },
  chipTR: { top: 0, right: 0 },
  chipBL: { bottom: 0, left: 0 },
  chipIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
  },
  chipValue: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: c.primary,
  },
  // Badge
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: c.secondaryContainer + '50',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: c.secondaryContainer,
    marginBottom: 8,
  },
  badgeText: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: 10,
    color: c.secondary,
    letterSpacing: 0.8,
  },
  // Title
  title: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineMD,
    color: c.onSurface,
    lineHeight: LineHeight.headlineMD,
    marginBottom: 12,
  },
  titleAccent: {
    color: c.primary,
    fontStyle: 'italic',
  },
  // Description
  description: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
    lineHeight: 20,
    marginBottom: 12,
  },
  descriptionBold: {
    fontFamily: FontFamily.bodySemiBold,
    color: c.onSurface,
  },
  // Feature rows
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  featureIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: c.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureTextBox: { flex: 1 },
  featureTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: c.onSurface,
    marginBottom: 1,
  },
  featureBody: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
    lineHeight: 20,
  },
});

// ── Slide 4 樣式（健康數據追蹤）──────────────────────────────────────────────
const makeVitStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    width: CARD_W,
    gap: 8,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  // Weight card
  weightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  weightLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSize.labelMD,
    color: c.onSurface,
    marginBottom: 2,
  },
  weightValue: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineLG,
    color: c.onPrimaryContainer,
  },
  weightUnit: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onPrimaryContainer,
  },
  chartIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: CHART_H_PAD,
    marginTop: 2,
  },
  monthLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    color: c.onSurfaceVariant,
  },
  // Reminders card
  remindersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  remindersTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
  },
  todayLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelSM,
    color: c.primary,
    letterSpacing: 0.6,
  },
  reminderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.surfaceContainerLow,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
  },
  reminderIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  reminderText: { flex: 1 },
  reminderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  reminderTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: c.onSurface,
  },
  reminderTime: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
  },
  reminderDesc: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
    marginTop: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: c.outlineVariant,
    flexShrink: 0,
  },
  pawCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});

// ── Slide 5 樣式（看得懂的健檢報告）──────────────────────────────────────────
const makeReportStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    width: CARD_W,
    gap: 8,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },

  // 報告卡
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  reportIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: c.onSurface,
  },
  reportMeta: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
    marginTop: 1,
  },
  thumbWrap: {
    height: REPORT_THUMB_H,
    borderRadius: 12,
    backgroundColor: c.surfaceContainerLow,
    borderWidth: 1,
    borderColor: c.outlineVariant,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 9,
  },
  thumbLine: {
    height: 5,
    borderRadius: 3,
    backgroundColor: c.outlineVariant,
  },
  sweepBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -3,
    height: 3,
    backgroundColor: c.primaryContainer,
    shadowColor: c.primaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 3,
  },

  // 解析結果卡
  resultTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: c.onSurface,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: c.surfaceContainerHigh,
  },
  itemName: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSize.labelMD,
    color: c.onSurface,
  },
  itemAbbr: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
  },
  itemExplain: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: c.onSurfaceVariant,
    marginTop: 1,
  },
  valueBox: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  itemValue: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: c.onSurface,
  },
  itemUnit: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 10,
    color: c.onSurfaceVariant,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    flexShrink: 0,
  },
  statusLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.labelSM,
  },
  reviewHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: c.surfaceContainerHigh,
  },
  reviewHintText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
  },
});

// ── Slide 6 樣式（寵物家族社群）──────────────────────────────────────────────
const makeCommStyles = (c: ThemeColors) => StyleSheet.create({
  wrapper: {
    width: CARD_W,
    alignSelf: 'center',
  },
  // IG post card
  postCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 10,
    elevation: 4,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  postAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postUser: {
    flex: 1,
    fontFamily: FontFamily.brand,
    fontSize: FontSize.labelMD + 2,
    color: c.onSurface,
  },
  postPhotoWrap: {
    width: '100%',
    height: 200,
  },
  postPhoto: {
    width: '100%',
    height: '100%',
  },
  postFooter: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  // Title + description
  title: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineMD,
    color: c.onSurface,
    lineHeight: LineHeight.headlineMD,
    marginBottom: 6,
  },
  titleAccent: { color: c.primary },
  desc: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
    lineHeight: 20,
    marginBottom: 8,
  },
  // Feature row (horizontal, 3 items side-by-side)
  featureList: {
    flexDirection: 'row',
    gap: 8,
  },
  featureItem: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.surfaceContainerHigh,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  featureIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: c.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelSM,
    color: c.onSurface,
    textAlign: 'center',
  },
});
