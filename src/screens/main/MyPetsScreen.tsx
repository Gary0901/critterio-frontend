import { useEffect, useRef, useState } from 'react';
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
import { getPets } from '../../api';
import { Pet } from '../../types';
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
  const [refreshing, setRefreshing] = useState(false);
  const breathAnim = useRef(new Animated.Value(1)).current;

  const load = async () => {
    const res = await getPets();
    if (res.success) setPets(res.data);
  };

  useEffect(() => { load(); }, []);

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
          {pets.map((pet) => (
            <PetCard
              key={pet.id}
              pet={pet}
              onPress={() => navigation.navigate('PetDetail', { petId: pet.id })}
            />
          ))}

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
});
