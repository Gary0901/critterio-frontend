import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Animated,
  Easing,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import AppBar from '../../components/layout/AppBar';
import PetCard from '../../components/pets/PetCard';
import Card from '../../components/ui/Card';
import { ThemeColors } from '../../constants/themes';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { FontFamily, FontSize, LineHeight } from '../../constants/typography';
import { getPets, deletePet as apiDeletePet, reorderPets as apiReorderPets, getEvents, getWeightLogs } from '../../api';
import { Pet, PetStatus, Species } from '../../types';
import { buildPetColorMap } from '../../constants/petColors';
import { useUser } from '../../context/UserContext';
import { useNotifications } from '../../context/NotificationContext';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

// 幼體發育期間體重「增加」是正常成長，不該當異常警示；數字是抓一般發育到成年體重的大致月齡上限
// （狗依品種差很多，抓 18 個月當保守值；貓/兔約 12-13 個月；small 涵蓋倉鼠/天竺鼠等，差異很大，抓 6 個月當折衷）。
// 鳥類/爬蟲類物種間發育期落差太大（月鳥 vs 大型鸚鵡、守宮 vs 陸龜），沒有足夠可靠的通則，先不套用
const GROWTH_PERIOD_MONTHS: Partial<Record<Species, number>> = {
  dog: 18,
  cat: 12,
  rabbit: 12,
  small: 6,
};

function ageInMonths(birthday?: string): number | null {
  if (!birthday) return null;
  const birth = new Date(birthday);
  const now = new Date();
  return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
}

export default function MyPetsScreen({ navigation }: Props) {
  const { colors, theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { unreadCount } = useNotifications();
  const [pets, setPets] = useState<Pet[]>([]);
  const petColorMap = useMemo(() => buildPetColorMap(pets, theme.key), [pets, theme.key]);
  const [refreshing, setRefreshing] = useState(false);
  const breathAnim = useRef(new Animated.Value(1)).current;

  const [statusOverrides, setStatusOverrides] = useState<Record<string, { status: PetStatus; statusLabel: string }>>({});

  // AI banner 預設顯示，關掉後記在本機、不再出現。
  // null = 偏好還沒讀完：先不渲染，避免已關閉的使用者看到 banner 閃一下才消失
  const AI_BANNER_KEY = 'mypets_ai_banner_dismissed';
  const [aiBannerVisible, setAiBannerVisible] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(AI_BANNER_KEY)
      .then((v) => setAiBannerVisible(v !== '1'))
      .catch(() => setAiBannerVisible(true)); // 讀取失敗就照預設顯示
  }, []);

  const dismissAiBanner = () => {
    setAiBannerVisible(false);
    AsyncStorage.setItem(AI_BANNER_KEY, '1').catch(() => {});
  };

  const computeStatuses = async (petsList: Pet[]) => {
    const now = new Date();
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const todayStr = now.toISOString().split('T')[0];
    const in3DaysStr = in3Days.toISOString().split('T')[0];
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [thisMonthRes, nextMonthRes] = await Promise.all([
      getEvents(now.getFullYear(), now.getMonth() + 1),
      getEvents(nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1),
    ]);
    const events = [
      ...(thisMonthRes.success ? thisMonthRes.data : []),
      ...(nextMonthRes.success ? nextMonthRes.data : []),
    ];

    const overrides: Record<string, { status: PetStatus; statusLabel: string }> = {};

    // 體重過重/過瘦需要觸診才能判斷，AI 光憑數字給的「理想範圍」不夠可靠；
    // 改成跟上一筆紀錄比較，變化幅度超過 5% 才提醒使用者留意，不做「胖/瘦」的診斷式判斷
    const weightLogResults = await Promise.all(petsList.map((pet) => getWeightLogs(pet.id)));

    petsList.forEach((pet, i) => {
      // !e.done 排除已完成、e.date >= todayStr 排除已逾期（日期在今天之前），
      // 只看今天起 3 天內、還沒完成也還沒過期的回診/驅蟲事件
      const dueEvent = events.find((e) =>
        (e.petId === pet.id || e.petId === 'all') &&
        (e.category === 'vet' || e.category === 'medication') &&
        !e.done &&
        e.date >= todayStr && e.date <= in3DaysStr
      );

      let weightStatus: { status: PetStatus; statusLabel: string } | null = null;
      const logsRes = weightLogResults[i];
      if (logsRes.success && logsRes.data.length >= 2) {
        const [latest, previous] = logsRes.data; // API 回傳新到舊排序
        const daysBetween = (new Date(latest.recordedAt).getTime() - new Date(previous.recordedAt).getTime()) / (24 * 60 * 60 * 1000);
        const daysSinceLatest = (Date.now() - new Date(latest.recordedAt).getTime()) / (24 * 60 * 60 * 1000);
        // 兩筆紀錄間隔太久（超過 7 天）就不比較，避免把長時間的正常變化誤判成異常；
        // 最新一筆超過 5 天沒更新的話，警示也該自動淡出，不然沒有新紀錄會一直掛著舊訊息
        if (previous.weightKg > 0 && daysBetween <= 7 && daysSinceLatest <= 5) {
          const changePct = ((latest.weightKg - previous.weightKg) / previous.weightKg) * 100;
          const absChangePct = Math.abs(changePct);
          const growthCutoff = GROWTH_PERIOD_MONTHS[pet.species];
          const months = ageInMonths(pet.birthday);
          const isGrowingJuvenile = growthCutoff !== undefined && months !== null && months < growthCutoff;
          // 還在發育期的幼體，體重「上升」是正常成長不當異常；但體重「下降」不管年紀都要留意，不能因為是幼體就跳過
          const shouldSkip = isGrowingJuvenile && changePct > 0;
          if (!shouldSkip && absChangePct >= 5) {
            const rounded = absChangePct.toFixed(1);
            const direction = changePct > 0 ? '上升' : '下降';
            // 變化幅度達到 10% 以上，屬於短時間內的劇烈變化，額外提醒就醫諮詢
            const isSevere = absChangePct >= 10;
            weightStatus = {
              status: 'warning',
              statusLabel: isSevere ? `體重${direction} ${rounded}%，建議儘快就醫` : `體重${direction} ${rounded}%`,
            };
          }
        }
      }

      overrides[pet.id] = {
        status: dueEvent ? 'due_soon' : (weightStatus?.status ?? 'healthy'),
        statusLabel: dueEvent ? `「${dueEvent.title}」時間快到了` : (weightStatus?.statusLabel ?? '健康'),
      };
    });

    setStatusOverrides(overrides);
  };

  const load = async () => {
    const res = await getPets();
    if (res.success) {
      setPets(res.data);
      computeStatuses(res.data).catch(() => {});
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const [menuPetId, setMenuPetId] = useState<string | null>(null);
  const menuPet = pets.find((p) => p.id === menuPetId) ?? null;
  const menuPetIndex = pets.findIndex((p) => p.id === menuPetId);
  const canMoveDown = menuPetIndex >= 0 && menuPetIndex < pets.length - 1;

  const moveDown = async () => {
    if (!canMoveDown) return;
    const next = [...pets];
    [next[menuPetIndex], next[menuPetIndex + 1]] = [next[menuPetIndex + 1], next[menuPetIndex]];
    setPets(next);
    setMenuPetId(null);
    apiReorderPets(next.map((p) => p.id)).catch(() => {});
  };

  const handleDeletePet = () => {
    if (!menuPet) return;
    const pet = menuPet;
    setMenuPetId(null);
    Alert.alert(
      '刪除寵物檔案',
      `此操作無法復原，${pet.name} 的所有資料（體重紀錄、每日日誌、行事曆事件）都會被永久刪除。確定要刪除嗎？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '確定刪除',
          style: 'destructive',
          onPress: async () => {
            const res = await apiDeletePet(pet.id);
            if (res.success) {
              setPets((prev) => prev.filter((p) => p.id !== pet.id));
            } else {
              Alert.alert('刪除失敗', '請稍後再試');
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, {
          toValue: 1.18,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breathAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [breathAnim]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <AppBar
        avatarUrl={user.avatarUrl}
        userName={user.name}
        userId={user.id}
        userColor={user.avatarColor}
        onAvatarPress={() => navigation.navigate('Profile')}
        onNotificationPress={() => navigation.navigate('Notifications')}
        unreadCount={unreadCount}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero header */}
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <Text style={styles.title}>我的寵物</Text>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => {
                if (pets.length >= 3) {
                  Alert.alert('已達上限', '免費方案最多新增 3 隻寵物');
                  return;
                }
                navigation.navigate('AddPet', {});
              }}
              activeOpacity={0.85}
            >
              <MaterialIcons name="add-circle" size={18} color={colors.onPrimaryContainer} />
              <Text style={styles.addBtnLabel}>新增寵物</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Pet cards */}
        <View style={styles.cards}>
          {pets.map((pet) => {
            const override = statusOverrides[pet.id];
            const displayPet = override
              ? { ...pet, status: override.status, statusLabel: override.statusLabel }
              : pet;
            return (
              <PetCard
                key={pet.id}
                pet={displayPet}
                color={petColorMap[pet.id]}
                onPress={() => navigation.navigate('PetDetail', { petId: pet.id })}
                onMenuPress={() => setMenuPetId(pet.id)}
              />
            );
          })}

          {/* Empty state card — only shown when no pets exist */}
          {pets.length === 0 && (
            <Card variant="dashed" style={styles.emptyCard}>
              <Animated.View style={[styles.pawCircle, { transform: [{ scale: breathAnim }] }]}>
                <MaterialIcons name="pets" size={32} color={colors.outline} />
              </Animated.View>
              <Text style={styles.emptyTitle}>新增毛小孩？</Text>
              <Text style={styles.emptyBody}>
                新增另一隻寵物，追蹤牠的健康、活動與每日狀況。
              </Text>
              <TouchableOpacity
                style={styles.registerBtn}
                onPress={() => navigation.navigate('AddPet', {})}
                activeOpacity={0.85}
              >
                <Text style={styles.registerLabel}>登記寵物</Text>
              </TouchableOpacity>
            </Card>
          )}
        </View>

        {/* Ask AI banner — 可關閉，關掉後不再出現 */}
        {aiBannerVisible && (
          <View style={styles.aiBanner}>
            <View style={styles.aiLeft}>
              <MaterialIcons name="auto-awesome" size={28} color={colors.onPrimaryContainer} />
              <View style={{ flex: 1 }}>
                <Text style={styles.aiTitle}>詢問 <Text style={styles.aiTitleBrand}>Critterio AI</Text></Text>
                <Text style={styles.aiSub}>為您的寵物提供個人化建議。</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.aiBtn} activeOpacity={0.85} onPress={() => navigation.navigate('MainTabs', { screen: 'AskAI' })}>
              <Text style={styles.aiBtnLabel}>立即聊天</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.aiDismissBtn}
              onPress={dismissAiBanner}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="不再顯示這個提示"
            >
              <MaterialIcons name="close" size={18} color={colors.onPrimaryContainer} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={menuPetId !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setMenuPetId(null)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
            activeOpacity={1}
            onPress={() => setMenuPetId(null)}
          />
          <View style={[styles.moreSheet, { paddingBottom: insets.bottom + 8 }]}>
            <View style={styles.sheetHandleWrap}>
              <View style={styles.sheetHandle} />
            </View>
            <TouchableOpacity
              style={[styles.moreOption, !canMoveDown && { opacity: 0.4 }]}
              onPress={moveDown}
              disabled={!canMoveDown}
              activeOpacity={0.75}
            >
              <MaterialIcons name="arrow-downward" size={20} color={colors.onSurface} />
              <Text style={styles.moreOptionLabel}>下移一位</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.moreOption} onPress={handleDeletePet} activeOpacity={0.75}>
              <MaterialIcons name="delete-outline" size={20} color={colors.error} />
              <Text style={[styles.moreOptionLabel, { color: colors.error }]}>刪除寵物檔案</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  hero: { marginBottom: 20 },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  title: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineXL,
    color: c.onSurface,
    lineHeight: LineHeight.headlineXL,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.primaryContainer,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
  },
  addBtnLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: c.onPrimaryContainer,
  },
  cards: { gap: 16, marginBottom: 24 },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 10,
  },
  pawCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: c.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineMD,
    color: c.onSurface,
  },
  emptyBody: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  registerBtn: {
    marginTop: 4,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 9999,
    backgroundColor: c.outline,
  },
  registerLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: c.surfaceContainerLowest,
  },
  aiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.primaryFixed,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  aiLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  // 排在「立即聊天」右邊而不是絕對定位到右上角——banner 是垂直置中的單列，
  // 絕對定位會跟按鈕的右上角重疊
  aiDismissBtn: { padding: 2, opacity: 0.55, marginLeft: -4 },
  aiTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: c.onSurface,
  },
  aiTitleBrand: {
    fontFamily: FontFamily.brand,
    fontSize: FontSize.bodyLG + 6,
    color: c.onSurface,
  },
  aiSub: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
  },
  aiBtn: {
    backgroundColor: c.onPrimaryContainer,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 9999,
  },
  aiBtnLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: c.primaryFixed,
  },

  // Pet card "..." menu sheet
  moreSheet: {
    backgroundColor: c.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderColor: c.surfaceVariant,
  },
  sheetHandleWrap: { alignItems: 'center', paddingVertical: 10 },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.outlineVariant,
  },
  moreOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceVariant,
  },
  moreOptionLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
  },
});
