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
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import AppBar from '../../components/layout/AppBar';
import PetCard from '../../components/pets/PetCard';
import Card from '../../components/ui/Card';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, LineHeight } from '../../constants/typography';
import { getPets, deletePet as apiDeletePet, reorderPets as apiReorderPets, getEvents, getWeightLogs } from '../../api';
import { Pet, PetStatus } from '../../types';
import { buildPetColorMap } from '../../constants/petColors';
import { useUser } from '../../context/UserContext';
import { useNotifications } from '../../context/NotificationContext';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

export default function MyPetsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { unreadCount } = useNotifications();
  const [pets, setPets] = useState<Pet[]>([]);
  const petColorMap = useMemo(() => buildPetColorMap(pets.map((p) => p.id)), [pets]);
  const [refreshing, setRefreshing] = useState(false);
  const breathAnim = useRef(new Animated.Value(1)).current;

  const [statusOverrides, setStatusOverrides] = useState<Record<string, { status: PetStatus; statusLabel: string }>>({});

  const computeStatuses = async (petsList: Pet[]) => {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const todayStr = now.toISOString().split('T')[0];
    const in7DaysStr = in7Days.toISOString().split('T')[0];
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
      const dueEvent = events.find((e) =>
        (e.petId === pet.id || e.petId === 'all') &&
        (e.category === 'vet' || e.category === 'medication') &&
        !e.done &&
        e.date >= todayStr && e.date <= in7DaysStr
      );

      let weightStatus: { status: PetStatus; statusLabel: string } | null = null;
      const logsRes = weightLogResults[i];
      if (logsRes.success && logsRes.data.length >= 2) {
        const [latest, previous] = logsRes.data; // API 回傳新到舊排序
        if (previous.weightKg > 0) {
          const changePct = ((latest.weightKg - previous.weightKg) / previous.weightKg) * 100;
          if (Math.abs(changePct) >= 5) {
            const rounded = Math.abs(changePct).toFixed(1);
            weightStatus = {
              status: 'warning',
              statusLabel: changePct > 0 ? `體重上升 ${rounded}%` : `體重下降 ${rounded}%`,
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
        onAvatarPress={() => navigation.navigate('Profile')}
        onNotificationPress={() => navigation.navigate('Notifications')}
        unreadCount={unreadCount}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
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
              <MaterialIcons name="add-circle" size={18} color={Colors.onPrimaryContainer} />
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
                <MaterialIcons name="pets" size={32} color={Colors.outline} />
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

        {/* Ask AI banner */}
        <View style={styles.aiBanner}>
          <View style={styles.aiLeft}>
            <MaterialIcons name="auto-awesome" size={28} color={Colors.onPrimaryContainer} />
            <View style={{ flex: 1 }}>
              <Text style={styles.aiTitle}>詢問 <Text style={styles.aiTitleBrand}>Critterio AI</Text></Text>
              <Text style={styles.aiSub}>為您的寵物提供個人化建議。</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.aiBtn} activeOpacity={0.85} onPress={() => navigation.navigate('MainTabs', { screen: 'AskAI' })}>
            <Text style={styles.aiBtnLabel}>立即聊天</Text>
          </TouchableOpacity>
        </View>
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
              <MaterialIcons name="arrow-downward" size={20} color={Colors.onSurface} />
              <Text style={styles.moreOptionLabel}>下移一位</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.moreOption} onPress={handleDeletePet} activeOpacity={0.75}>
              <MaterialIcons name="delete-outline" size={20} color={Colors.error} />
              <Text style={[styles.moreOptionLabel, { color: Colors.error }]}>刪除寵物檔案</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
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
    color: Colors.onSurface,
    lineHeight: LineHeight.headlineXL,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
  },
  addBtnLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: Colors.onPrimaryContainer,
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
    backgroundColor: Colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineMD,
    color: Colors.onSurface,
  },
  emptyBody: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  registerBtn: {
    marginTop: 4,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 9999,
    backgroundColor: Colors.outline,
  },
  registerLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: Colors.surfaceContainerLowest,
  },
  aiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primaryFixed,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  aiLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  aiTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: Colors.onSurface,
  },
  aiTitleBrand: {
    fontFamily: FontFamily.brand,
    fontSize: FontSize.bodyLG + 6,
    color: Colors.onSurface,
  },
  aiSub: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: Colors.onSurfaceVariant,
  },
  aiBtn: {
    backgroundColor: Colors.onPrimaryContainer,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 9999,
  },
  aiBtnLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: Colors.primaryFixed,
  },

  // Pet card "..." menu sheet
  moreSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderColor: Colors.surfaceVariant,
  },
  sheetHandleWrap: { alignItems: 'center', paddingVertical: 10 },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.outlineVariant,
  },
  moreOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceVariant,
  },
  moreOptionLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurface,
  },
});
