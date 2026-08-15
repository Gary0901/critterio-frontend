import { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ScrollView, Linking, ActivityIndicator, Image, PanResponder, Animated, Easing,
  useWindowDimensions,
  GestureResponderEvent, PanResponderGestureState,
} from 'react-native';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemeColors } from '../../constants/themes';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { FontFamily, FontSize } from '../../constants/typography';
import { getNearbyPlaces, getMapFavorites, addMapFavorite, removeMapFavorite, ApiPlace } from '../../api';
import { BASE_URL } from '../../api/client';
import { RootStackParamList } from '../../types/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlaceCategory = 'vet' | 'grooming' | 'petstore' | 'hotel' | 'park' | 'restaurant';
type FilterOption = 'all' | 'favorites' | PlaceCategory;

interface ListPlace extends ApiPlace {
  category: PlaceCategory;
  distanceM: number;
  todayHours?: string;
}

/**
 * 合作夥伴置頂的距離上限。超過這個距離就照一般距離排序 ——
 * 把 10 公里外的夥伴排在 200 公尺的醫院前面，對使用者是幫倒忙，
 * 「附近地點」這個功能也就失去意義了。
 */
const PARTNER_PIN_RADIUS_M = 3000;

/** 置頂範圍內的夥伴排最前面，其餘一律照距離 */
function byPartnerThenDistance(a: ListPlace, b: ListPlace): number {
  const rank = (p: ListPlace) => (p.isPartner && p.distanceM <= PARTNER_PIN_RADIUS_M ? 0 : 1);
  return rank(a) - rank(b) || a.distanceM - b.distanceM;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const makeCategoryConfig = (c: ThemeColors): Record<PlaceCategory, {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  bgColor: string;
  iconColor: string;
}> => ({
  vet:        { icon: 'local-hospital', label: '醫院',   bgColor: c.catHospitalBg, iconColor: c.catHospital },
  grooming:   { icon: 'content-cut',    label: '美容',   bgColor: c.catGroomingBg, iconColor: c.catGrooming },
  petstore:   { icon: 'shopping-bag',   label: '用品店', bgColor: c.catStoreBg, iconColor: c.catStore },
  hotel:      { icon: 'pets',           label: '旅館',   bgColor: c.catHotelBg, iconColor: c.catHotel },
  park:       { icon: 'local-florist',  label: '公園',   bgColor: c.catParkBg, iconColor: c.catPark },
  restaurant: { icon: 'restaurant',     label: '餐廳',   bgColor: c.catRestaurantBg, iconColor: c.warning },
});

/** 分類清單的快取存活時間。跟地圖頁一致 */
const PLACES_CACHE_TTL_MS = 3 * 60 * 1000;

const FILTERS: { key: FilterOption; label: string }[] = [
  { key: 'all',        label: '全部' },
  { key: 'favorites',  label: '最愛' },
  { key: 'vet',        label: '醫院' },
  { key: 'grooming',   label: '美容' },
  { key: 'petstore',   label: '用品店' },
  { key: 'hotel',      label: '旅館' },
  { key: 'park',       label: '公園' },
  { key: 'restaurant', label: '餐廳' },
];

const TYPE_TO_CATEGORY: Record<string, PlaceCategory> = {
  hospital:   'vet',
  grooming:   'grooming',
  petstore:   'petstore',
  hotel:      'hotel',
  park:       'park',
  restaurant: 'restaurant',
};

const FILTER_TO_API_TYPE: Record<FilterOption, string | undefined> = {
  all:        undefined,
  favorites:  undefined,
  vet:        'hospital',
  grooming:   'grooming',
  petstore:   'petstore',
  hotel:      'hotel',
  park:       'park',
  restaurant: 'restaurant',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

function todayHours(weekdayHours?: string[]): string | undefined {
  if (!weekdayHours?.length) return undefined;
  const idx = (new Date().getDay() + 6) % 7;
  const entry = weekdayHours[idx];
  if (!entry) return undefined;
  return entry.replace(/^[一二三四五六日]\s*/, '');
}

// ─── Row Component ────────────────────────────────────────────────────────────

function PlaceRow({
  place,
  isFav,
  onToggleFavorite,
  onPartnerInfo,
}: {
  place: ListPlace;
  isFav: boolean;
  onToggleFavorite: () => void;
  onPartnerInfo: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const cfg = makeCategoryConfig(colors)[place.category];

  function openPhone() {
    if (place.phone) Linking.openURL(`tel:${place.phone.replace(/\s/g, '')}`);
  }

  function openMaps() {
    const q = encodeURIComponent(place.address);
    Linking.openURL(`https://maps.google.com/?q=${q}`);
  }

  return (
    <TouchableOpacity style={styles.row} onPress={openMaps} activeOpacity={0.75}>
      {/* 左側圖示 */}
      <View style={[styles.iconWrap, { backgroundColor: cfg.bgColor }]}>
        {place.photoUrl || place.photoRef ? (
          <Image
            source={{
              uri: place.photoUrl ?? `${BASE_URL}/map/photo?ref=${place.photoRef}&maxwidth=80`,
            }}
            style={styles.photo}
          />
        ) : (
          <MaterialIcons name={cfg.icon} size={24} color={cfg.iconColor} />
        )}
      </View>

      {/* 內容 */}
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          {place.isPartner && (
            <MaterialIcons name="verified" size={16} color={colors.primary} style={styles.partnerIcon} />
          )}
          <Text style={styles.name} numberOfLines={1}>{place.name}</Text>
          <View style={styles.distBadge}>
            <Text style={styles.distText}>{formatDistance(place.distanceM)}</Text>
          </View>
        </View>

        <View style={styles.tagRow}>
          {place.isPartner && (
            <TouchableOpacity
              style={styles.partnerTag}
              onPress={onPartnerInfo}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="了解合作夥伴方案"
            >
              <MaterialIcons name="star" size={11} color={colors.onPartnerBadge} />
              <Text style={styles.partnerTagText}>合作夥伴</Text>
            </TouchableOpacity>
          )}
          <View style={[styles.catTag, { backgroundColor: cfg.bgColor }]}>
            <Text style={[styles.catTagText, { color: cfg.iconColor }]}>{cfg.label}</Text>
          </View>
          {place.rating != null && (
            <View style={styles.ratingRow}>
              <MaterialIcons name="star" size={12} color="#F9A825" />
              <Text style={styles.ratingText}>{place.rating.toFixed(1)}</Text>
            </View>
          )}
        </View>

        <Text style={styles.address} numberOfLines={1}>{place.address}</Text>

        <View style={styles.metaRow}>
          {place.phone ? (
            <TouchableOpacity style={styles.metaItem} onPress={openPhone}>
              <MaterialIcons name="phone" size={12} color={colors.primary} />
              <Text style={[styles.metaText, { color: colors.primary }]}>{place.phone}</Text>
            </TouchableOpacity>
          ) : null}
          {place.todayHours ? (
            <View style={styles.metaItem}>
              <MaterialIcons name="access-time" size={12} color={colors.onSurfaceVariant} />
              <Text style={styles.metaText}>{place.todayHours}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* 右側：愛心 + 箭頭 */}
      <View style={styles.rowRight}>
        <TouchableOpacity
          style={styles.heartBtn}
          onPress={onToggleFavorite}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons
            name={isFav ? 'favorite' : 'favorite-border'}
            size={20}
            color={isFav ? colors.favorite : colors.outline}
          />
        </TouchableOpacity>
        <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

interface Props {
  onSwitchToMap?: () => void;
  favoriteIds?: Set<string>;
  onToggleFavorite?: (id: string) => void;
}

export default function NearbyListScreen({ onSwitchToMap, favoriteIds, onToggleFavorite }: Props = {}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [places, setPlaces] = useState<ListPlace[]>([]);
  const [favoritePlaces, setFavoritePlaces] = useState<ListPlace[]>([]);
  const [localFavIds, setLocalFavIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');
  const [is24hrOnly, setIs24hrOnly] = useState(false);

  // 分類結果的記憶體快取（比照地圖頁的作法）。沒有它的話左右來回切都在重打 API，
  // 明明剛剛才看過的清單還是要再等一次網路
  const placesCacheRef = useRef<Map<string, ListPlace[]>>(new Map());
  // places 目前這份資料屬於哪個分類。跟 activeFilter 不一致就代表還在等新分類的結果，
  // 這時要顯示載入中而不是把舊分類的清單掛在新分類底下
  const placesFilterRef = useRef<FilterOption | null>(null);
  const cacheTimeRef = useRef<Map<string, number>>(new Map());

  // 翻頁位移。拖曳時即時跟著手指，放開後再決定要翻過去還是彈回來。
  // 只播「放開後的固定動畫」不會有翻頁感——手指移動時畫面必須有反應
  const dragX = useRef(new Animated.Value(0)).current;
  const { width: screenW } = useWindowDimensions();
  const screenWRef = useRef(screenW);
  screenWRef.current = screenW;

  // 左右滑切換分類。用內建 PanResponder 而不是 pager 套件——只是換一個字串狀態，
  // 不需要真的把六份清單同時掛在畫面上。
  // 用 Capture 版本才搶得贏底下的 FlatList，但條件收得很緊（水平位移要大於垂直的兩倍
  // 且超過 24），確保垂直捲動完全不受影響。
  const chipScrollRef = useRef<ScrollView>(null);
  const chipXRef = useRef<Record<string, number>>({});

  const selectFilter = (key: FilterOption) => {
    setActiveFilter(key);
    // 膠囊列跟著捲過去，否則滑了半天不知道現在在哪一類
    const x = chipXRef.current[key];
    if (x !== undefined) chipScrollRef.current?.scrollTo({ x: Math.max(0, x - 16), animated: true });
  };

  const settle = (toValue: number) =>
    // 拖曳靠 dragX.setValue() 從 JS 更新，transform 就不能宣告成原生驅動——
    // 同一個值被兩邊寫會每幀跨橋同步，反而更卡
    Animated.spring(dragX, { toValue, useNativeDriver: false, bounciness: 0, speed: 14 });

  /** 放開手：超過門檻就翻頁，否則彈回原位 */
  const finishSwipe = (dx: number, vx: number) => {
    const w = screenWRef.current;
    const i = FILTERS.findIndex((f) => f.key === activeFilterRef.current);
    // 位移過半、或甩得夠快，都算翻頁——只看位移的話快速輕甩會沒反應
    const passed = Math.abs(dx) > w * 0.16 || Math.abs(vx) > 0.3;
    const dir = dx < 0 ? 1 : -1;
    const target = FILTERS[i + dir];

    if (!passed || !target) {
      settle(0).start();
      return;
    }
    // 先把舊內容推出畫面，換完資料再從另一側彈進來
    Animated.timing(dragX, {
      toValue: -dir * w,
      duration: 160,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start(() => {
      selectFilterRef.current(target.key);
      dragX.setValue(dir * w);
      settle(0).start();
    });
  };

  // PanResponder 只建立一次，閉包會抓到第一次 render 的值，用 ref 轉一手才拿得到最新的
  const activeFilterRef = useRef(activeFilter);
  activeFilterRef.current = activeFilter;
  const selectFilterRef = useRef(selectFilter);
  selectFilterRef.current = selectFilter;
  const finishSwipeRef = useRef(finishSwipe);
  finishSwipeRef.current = finishSwipe;

  const swipeResponder = useRef(
    PanResponder.create({
      // 條件收緊，確保垂直捲清單不受影響
      onMoveShouldSetPanResponderCapture: (_e: GestureResponderEvent, g: PanResponderGestureState) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        const i = FILTERS.findIndex((f) => f.key === activeFilterRef.current);
        const hasTarget = g.dx < 0 ? i < FILTERS.length - 1 : i > 0;
        // 已經在頭尾時給阻尼，讓使用者感覺得到「沒有下一頁了」而不是完全不動
        dragX.setValue(hasTarget ? g.dx : g.dx / 4);
      },
      onPanResponderRelease: (_e: GestureResponderEvent, g: PanResponderGestureState) =>
        finishSwipeRef.current(g.dx, g.vx),
      onPanResponderTerminate: () => settle(0).start(),
    }),
  ).current;
  const [exoticOnly, setExoticOnly] = useState(false);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);

  const effectiveFavIds = favoriteIds ?? localFavIds;

  // 切離「醫院」分類時，24hr／特殊寵物友善篩選一併清除，避免使用者看不到 chip 卻仍套用篩選
  useEffect(() => {
    if (activeFilter !== 'vet') {
      if (is24hrOnly) setIs24hrOnly(false);
      if (exoticOnly) setExoticOnly(false);
    }
  }, [activeFilter]);

  // 取得定位：先用快取 GPS 立即顯示，再用精確 GPS 刷新
  useEffect(() => {
    async function getLocation() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setUserLoc({ lat: 25.0330, lng: 121.5654 });
        return;
      }
      // 快取位置 → 立即顯示
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        setUserLoc({ lat: last.coords.latitude, lng: last.coords.longitude });
      }
      // 精確位置 → 背景刷新
      const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLoc({ lat: fresh.coords.latitude, lng: fresh.coords.longitude });
    }
    getLocation();
  }, []);

  // 若無父元件提供 favoriteIds，自行從 API 載入（standalone 模式）
  useEffect(() => {
    if (favoriteIds !== undefined) return;
    getMapFavorites()
      .then(res => {
        if (res.success) setLocalFavIds(new Set(res.data.map(p => String(p.id))));
      })
      .catch(() => {});
  }, []);

  // 每次切換分類或取得定位時重新向後端查詢（最愛分類不走此路徑）
  useEffect(() => {
    if (!userLoc || activeFilter === 'favorites') return;
    let cancelled = false;
    const apiType = FILTER_TO_API_TYPE[activeFilter];

    // 位置取到小數第三位（約 100 公尺）就好——使用者小幅移動不該讓快取失效
    const cacheKey = [
      apiType ?? 'all',
      is24hrOnly ? '1' : '0',
      exoticOnly ? '1' : '0',
      userLoc.lat.toFixed(3),
      userLoc.lng.toFixed(3),
    ].join('|');

    const cached = placesCacheRef.current.get(cacheKey);
    const cachedAt = cacheTimeRef.current.get(cacheKey) ?? 0;
    if (cached && Date.now() - cachedAt < PLACES_CACHE_TTL_MS) {
      setPlaces(cached);
      placesFilterRef.current = activeFilter;
      setLoading(false);
      setRefreshing(false);
      return; // 命中就完全不打 API，切換是即時的
    }

    // 換到別的分類但沒有快取：先清空並顯示載入中。
    // 不清空的話新分類會先渲染舊分類的清單，等 API 回來才瞬間跳掉
    const switchedFilter = placesFilterRef.current !== activeFilter;
    if (switchedFilter) {
      setPlaces([]);
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    getNearbyPlaces(userLoc.lat, userLoc.lng, apiType, 20000, is24hrOnly, exoticOnly)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          const mapped: ListPlace[] = res.data.map((p) => ({
            ...p,
            category: (TYPE_TO_CATEGORY[p.type] ?? 'petstore') as PlaceCategory,
            distanceM: haversineM(userLoc.lat, userLoc.lng, p.lat, p.lng),
            todayHours: todayHours(p.weekdayHours),
          }));
          mapped.sort(byPartnerThenDistance);
          placesCacheRef.current.set(cacheKey, mapped);
          cacheTimeRef.current.set(cacheKey, Date.now());
          placesFilterRef.current = activeFilter;
          setPlaces(mapped);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) { setLoading(false); setRefreshing(false); }
      });
    return () => { cancelled = true; };
  }, [userLoc, activeFilter, is24hrOnly, exoticOnly]);

  /**
   * 預抓左右相鄰的分類。
   * 有快取後「回到看過的分類」是即時的，但「第一次滑到某分類」還是要等網路。
   * 使用者停在某一頁時，背景先把隔壁兩頁抓好，實際滑過去就幾乎都命中快取。
   * 只寫進快取、不碰畫面狀態，所以不會干擾目前這一頁。
   */
  useEffect(() => {
    if (!userLoc || activeFilter === 'favorites') return;
    const i = FILTERS.findIndex((f) => f.key === activeFilter);
    const neighbours = [FILTERS[i - 1], FILTERS[i + 1]].filter(
      (f): f is typeof FILTERS[number] => !!f && f.key !== 'favorites',
    );

    const timer = setTimeout(() => {
      for (const n of neighbours) {
        const apiType = FILTER_TO_API_TYPE[n.key];
        const key = [apiType ?? 'all', '0', '0', userLoc.lat.toFixed(3), userLoc.lng.toFixed(3)].join('|');
        const at = cacheTimeRef.current.get(key) ?? 0;
        if (Date.now() - at < PLACES_CACHE_TTL_MS) continue; // 已經有新鮮的快取

        // 先佔位，避免同一輪重複發送
        cacheTimeRef.current.set(key, Date.now());
        getNearbyPlaces(userLoc.lat, userLoc.lng, apiType, 20000, false, false)
          .then((res) => {
            if (!res.success || !res.data) { cacheTimeRef.current.delete(key); return; }
            const mapped: ListPlace[] = res.data.map((p) => ({
              ...p,
              category: (TYPE_TO_CATEGORY[p.type] ?? 'petstore') as PlaceCategory,
              distanceM: haversineM(userLoc.lat, userLoc.lng, p.lat, p.lng),
              todayHours: todayHours(p.weekdayHours),
            }));
            mapped.sort(byPartnerThenDistance);
            placesCacheRef.current.set(key, mapped);
          })
          .catch(() => { cacheTimeRef.current.delete(key); });
      }
    }, 400); // 等目前這頁先載完，不要跟它搶頻寬

    return () => clearTimeout(timer);
  }, [userLoc, activeFilter]);

  // 切換到「最愛」時從 API 取完整收藏清單
  useEffect(() => {
    if (activeFilter !== 'favorites') return;
    // 沒有 cancelled 守衛的話，快速滑過「最愛」時它的 finally 會在別的分類身上
    // 把 loading 關掉（兩個 effect 都在寫同一個狀態），轉圈圈就會提早消失或殘留
    let cancelled = false;
    setLoading(true);
    getMapFavorites()
      .then(res => {
        if (cancelled) return;
        if (res.success) {
          const mapped: ListPlace[] = res.data.map(p => ({
            ...p,
            category: (TYPE_TO_CATEGORY[p.type] ?? 'petstore') as PlaceCategory,
            distanceM: userLoc ? haversineM(userLoc.lat, userLoc.lng, p.lat, p.lng) : 0,
            todayHours: todayHours(p.weekdayHours),
          }));
          if (userLoc) mapped.sort(byPartnerThenDistance);
          setFavoritePlaces(mapped);
          if (favoriteIds === undefined) setLocalFavIds(new Set(mapped.map(p => String(p.id))));
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeFilter]);

  function handleToggleFavorite(id: string) {
    if (onToggleFavorite) {
      // 讓 MapScreen 統一管理狀態
      onToggleFavorite(id);
      // 若目前在最愛篩選中，立即移除已取消收藏的項目
      if (activeFilter === 'favorites' && effectiveFavIds.has(id)) {
        setFavoritePlaces(prev => prev.filter(p => String(p.id) !== id));
      }
    } else {
      // standalone 模式：自行管理
      const isFav = localFavIds.has(id);
      if (isFav) {
        setLocalFavIds(prev => { const n = new Set(prev); n.delete(id); return n; });
        if (activeFilter === 'favorites') setFavoritePlaces(prev => prev.filter(p => String(p.id) !== id));
        removeMapFavorite(id).catch(() => setLocalFavIds(prev => new Set([...prev, id])));
      } else {
        setLocalFavIds(prev => new Set([...prev, id]));
        addMapFavorite(id).catch(() => {
          setLocalFavIds(prev => { const n = new Set(prev); n.delete(id); return n; });
        });
      }
    }
  }

  const filtered = useMemo(() => {
    const source = activeFilter === 'favorites' ? favoritePlaces : places;
    if (!search.trim()) return source;
    const q = search.trim().toLowerCase();
    return source.filter(p => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q));
  }, [places, favoritePlaces, activeFilter, search]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 搜尋列 */}
      <View style={styles.searchBar}>
        <MaterialIcons name="search" size={20} color={colors.onSurfaceVariant} />
        <TextInput
          style={styles.searchInput}
          placeholder="搜尋附近地點..."
          placeholderTextColor={colors.outline}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <MaterialIcons name="close" size={18} color={colors.outline} />
          </TouchableOpacity>
        )}
        {(activeFilter === 'vet' || activeFilter === 'petstore' || activeFilter === 'grooming') && (
          <TouchableOpacity
            style={[styles.mapToggleBtn, styles.careGuideBtn]}
            onPress={() => navigation.navigate('PetCareGuide', { category: activeFilter })}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons name="menu-book" size={20} color="#fff" />
          </TouchableOpacity>
        )}
        {onSwitchToMap && (
          <TouchableOpacity
            style={styles.mapToggleBtn}
            onPress={onSwitchToMap}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons name="map" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* 分類篩選 */}
      <ScrollView
        ref={chipScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {FILTERS.map((f) => {
          const isActive = activeFilter === f.key;
          const isFavFilter = f.key === 'favorites';
          const cfg = (!isFavFilter && f.key !== 'all') ? makeCategoryConfig(colors)[f.key as PlaceCategory] : null;
          // 選取時用該分類自己的顏色，跟地圖上的圖釘同一組色。
          // 用 bgColor + iconColor 這個配對（淺色主題是淡底深字，深色主題自動反過來），
          // 不能拿 iconColor 當實心底配白字——深色主題的 iconColor 是淡色，會看不見
          const accent = isFavFilter ? colors.favorite : cfg ? cfg.iconColor : colors.primary;
          const accentBg = isFavFilter ? colors.favoriteContainer : cfg ? cfg.bgColor : colors.primaryFixed;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, isActive && { backgroundColor: accentBg, borderColor: accent }]}
              onLayout={(e) => { chipXRef.current[f.key] = e.nativeEvent.layout.x; }}
              onPress={() => selectFilter(f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              {isFavFilter ? (
                <MaterialIcons
                  name={isActive ? 'favorite' : 'favorite-border'}
                  size={16}
                  color={isActive ? accent : colors.favorite}
                />
              ) : cfg ? (
                <MaterialIcons
                  name={cfg.icon}
                  size={16}
                  color={isActive ? accent : colors.onSurfaceVariant}
                />
              ) : null}
              <Text style={[styles.chipText, isActive && [styles.chipTextActive, { color: accent }]]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        {activeFilter === 'vet' && (
          <TouchableOpacity
            style={[styles.chip, is24hrOnly && styles.chipActive]}
            onPress={() => {
              setIs24hrOnly((v) => !v);
              setExoticOnly(false);
            }}
          >
            <MaterialIcons
              name="schedule"
              size={16}
              color={is24hrOnly ? colors.onSecondary : colors.onSurfaceVariant}
            />
            <Text style={[styles.chipText, is24hrOnly && styles.chipTextActive]}>24hr</Text>
          </TouchableOpacity>
        )}
        {activeFilter === 'vet' && (
          <TouchableOpacity
            style={[styles.chip, exoticOnly && styles.chipActive]}
            onPress={() => {
              setExoticOnly((v) => !v);
              setIs24hrOnly(false);
            }}
          >
            <MaterialIcons
              name="egg"
              size={16}
              color={exoticOnly ? colors.onSecondary : colors.onSurfaceVariant}
            />
            <Text style={[styles.chipText, exoticOnly && styles.chipTextActive]}>特殊寵物友善</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* 餐廳提示 */}
      {activeFilter === 'restaurant' && (
        <View style={styles.noticeBanner}>
          <MaterialIcons name="info-outline" size={14} color="#7A5800" />
          <Text style={styles.noticeText}>各店對寵物的接受度不同，建議事先來電確認</Text>
        </View>
      )}

      {/* 結果數 */}
      {!loading && (
        <Text style={styles.resultCount}>
          {activeFilter === 'favorites'
            ? `${filtered.length} 個收藏地點`
            : `${filtered.length} 個地點${userLoc ? '（20km 範圍內）' : ''}`
          }
        </Text>
      )}

      {/* 列表 */}
      {/* 手勢容器一律渲染，載入中也要能繼續往下一頁滑——
          原本 loading 時整塊連同手勢一起被換掉，等資料的期間完全滑不動 */}
      <Animated.View
        style={{
          flex: 1,
          transform: [{ translateX: dragX }],
          // 推出去的過程順便淡出，換頁的分界比較清楚
          opacity: dragX.interpolate({
            inputRange: [-screenW, 0, screenW],
            outputRange: [0.25, 1, 0.25],
          }),
        }}
        {...swipeResponder.panHandlers}
      >
        {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            {activeFilter === 'favorites' ? '載入收藏清單...' : '載入附近地點...'}
          </Text>
        </View>
        ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PlaceRow
              place={item}
              isFav={effectiveFavIds.has(String(item.id))}
              onToggleFavorite={() => handleToggleFavorite(String(item.id))}
              onPartnerInfo={() => navigation.navigate('PartnerProgram')}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListFooterComponent={
            refreshing ? (
              <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelSM, color: colors.onSurfaceVariant, marginTop: 4 }}>
                  更新中...
                </Text>
              </View>
            ) : (
              /*
                招商入口放在清單最底下 —— 使用者剛掃完一整排店家，
                「我的店／我常去的店不在這裡」這個念頭就是在這一刻產生的。
                同時打到兩種人：飼主會想推薦，老闆會想加入。
              */
              <TouchableOpacity
                style={styles.partnerCta}
                onPress={() => navigation.navigate('PartnerProgram')}
                activeOpacity={0.8}
              >
                <View style={styles.partnerCtaIcon}>
                  <MaterialIcons name="storefront" size={20} color={colors.onPartnerBadge} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.partnerCtaTitle}>沒看到你常去的店嗎？</Text>
                  <Text style={styles.partnerCtaDesc}>讓它出現在 Critterio</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
              </TouchableOpacity>
            )
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons
                name={activeFilter === 'favorites' ? 'favorite-border' : 'search-off'}
                size={48}
                color={colors.outline}
              />
              <Text style={styles.emptyText}>
                {activeFilter === 'favorites' ? '尚未收藏任何地點' : '找不到符合的地點'}
              </Text>
              {activeFilter === 'favorites' && (
                <Text style={styles.emptyHint}>點選列表或地圖上的 ♡ 即可收藏</Text>
              )}
            </View>
          }
        />
        )}
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    backgroundColor: c.surfaceContainerHigh,
    borderRadius: 28, paddingHorizontal: 14, paddingVertical: 10,
  },
  mapToggleBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: c.primaryFixed,
    alignItems: 'center', justifyContent: 'center',
  },
  careGuideBtn: {
    backgroundColor: c.careGuide,
  },
  searchInput: {
    flex: 1, fontFamily: FontFamily.bodyMedium, fontSize: FontSize.bodyMD,
    color: c.onSurface, padding: 0,
  },

  filterScroll: { flexGrow: 0, flexShrink: 0, marginTop: 12 },
  filterContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9,
    backgroundColor: c.surfaceContainerLowest,
    borderWidth: 1.5, borderColor: c.outline,
  },
  chipActive: { backgroundColor: c.secondary, borderColor: c.secondary },
  chipText: { fontFamily: FontFamily.headlineMedium, fontSize: FontSize.labelMD, color: c.onSurfaceVariant },
  // color 由呼叫端依分類帶入，這裡只管字重
  chipTextActive: { fontFamily: FontFamily.headlineBold },

  noticeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 16, marginTop: 10,
    backgroundColor: c.warningContainer,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    borderLeftWidth: 3, borderLeftColor: c.warning,
  },
  noticeText: {
    flex: 1, fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelSM,
    color: c.onWarningContainer,
  },

  resultCount: {
    fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
    marginHorizontal: 16, marginTop: 10, marginBottom: 4,
  },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: c.surfaceContainerLowest,
  },
  iconWrap: {
    width: 52, height: 52, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  photo: { width: 52, height: 52 },

  rowContent: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: {
    flex: 1, fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.bodyMD, color: c.onSurface,
  },
  distBadge: {
    backgroundColor: c.surfaceContainerHigh,
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
  },
  distText: { fontFamily: FontFamily.bodyMedium, fontSize: 11, color: c.onSurfaceVariant },

  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  partnerIcon: { marginRight: 4 },
  partnerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    padding: 14,
    borderRadius: 16,
    backgroundColor: c.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: c.outlineVariant,
  },
  partnerCtaIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.partnerBadge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerCtaTitle: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
  },
  partnerCtaDesc: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
    marginTop: 2,
  },
  partnerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: c.partnerBadge,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  partnerTagText: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM - 1,
    color: c.onPartnerBadge,
  },
  catTag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  catTagText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontFamily: FontFamily.bodyMedium, fontSize: 11, color: c.onSurfaceVariant },

  address: {
    fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
  },

  metaRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: FontFamily.bodyMedium, fontSize: 11, color: c.onSurfaceVariant },

  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heartBtn: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
  },

  separator: { height: 1, backgroundColor: c.surfaceVariant, marginLeft: 80 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.bodyMD, color: c.onSurfaceVariant },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.bodyMD, color: c.outline },
  emptyHint: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelSM, color: c.outlineVariant },
});
