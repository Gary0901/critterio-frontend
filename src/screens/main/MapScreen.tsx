import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Linking,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import ClusteredMapView from 'react-native-map-clustering';
import { Marker } from 'react-native-maps';
import NearbyListScreen from './NearbyListScreen';
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

type PlaceCategory = 'vet' | 'grooming' | 'petstore' | 'park' | 'restaurant';
type FilterOption = 'all' | PlaceCategory;

type Place = {
  id: string;
  name: string;
  category: PlaceCategory;
  coordinate: { latitude: number; longitude: number };
  address: string;
  phone?: string;
  hours?: string;       // today's hours (derived from weekdayHours)
  weekdayHours?: string[];
  is24Hours?: boolean;
  exoticFriendly?: boolean;
  distance?: string;
  rating?: number;
  photoUrl?: string;    // proxy URL via backend
  isPartner?: boolean;
  googleMapsUrl?: string;
  description?: string;
  tags?: string[];
  photos?: string[];
};

// ─── Config ───────────────────────────────────────────────────────────────────

const makeCategoryConfig = (
  c: ThemeColors,
): Record<
  PlaceCategory,
  {
    icon: keyof typeof MaterialIcons.glyphMap;
    label: string;
    chipLabel: string;
    bgColor: string;
    iconColor: string;
  }
> => ({
  vet: {
    icon: 'local-hospital',
    label: '寵物醫院',
    chipLabel: '醫院',
    bgColor: c.catHospitalBg,
    iconColor: c.catHospital,
  },
  grooming: {
    icon: 'content-cut',
    label: '寵物美容',
    chipLabel: '美容',
    bgColor: c.catGroomingBg,
    iconColor: c.catGrooming,
  },
  petstore: {
    icon: 'shopping-bag',
    label: '寵物用品',
    chipLabel: '用品店',
    bgColor: c.catStoreBg,
    iconColor: c.catStore,
  },
  park: {
    icon: 'local-florist',
    label: '公園',
    chipLabel: '公園',
    bgColor: c.catParkBg,
    iconColor: c.catPark,
  },
  restaurant: {
    icon: 'restaurant',
    label: '友善餐廳',
    chipLabel: '餐廳',
    bgColor: c.catRestaurantBg,
    iconColor: c.catRestaurant,
  },
});

const FILTER_OPTIONS: { key: FilterOption; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'vet', label: '醫院' },
  { key: 'grooming', label: '美容' },
  { key: 'petstore', label: '用品店' },
  { key: 'park', label: '公園' },
  { key: 'restaurant', label: '餐廳' },
];

// ─── Backend ↔ Frontend type mapping ─────────────────────────────────────────

const TYPE_TO_CATEGORY: Record<string, PlaceCategory> = {
  hospital:   'vet',
  hotel:      'petstore',
  petstore:   'petstore',
  grooming:   'grooming',
  park:       'park',
  restaurant: 'restaurant',
};

const CATEGORY_TO_APITYPE: Partial<Record<FilterOption, string>> = {
  vet:        'hospital',
  grooming:   'grooming',
  petstore:   'petstore',
  park:       'park',
  restaurant: 'restaurant',
};

function calcDistance(lat1: number, lon1: number, lat2: number, lon2: number): string {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  const m = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

function todayHours(weekdayHours?: string[]): string | undefined {
  if (!weekdayHours?.length) return undefined;
  // weekdayHours[0]=一 weekdayHours[6]=日; JS getDay() 0=Sun → index 6
  const idx = (new Date().getDay() + 6) % 7;
  const entry = weekdayHours[idx];
  if (!entry) return undefined;
  // format: "一 09:00–21:00" → strip day prefix
  return entry.replace(/^[一二三四五六日]\s*/, '');
}

function mapApiPlace(
  r: ApiPlace,
  userLoc?: { latitude: number; longitude: number }
): Place {
  const resolvedPhotoUrl =
    r.photoUrl ??
    (r.photoRef ? `${BASE_URL}/map/photo?ref=${encodeURIComponent(r.photoRef)}` : undefined);
  return {
    id: String(r.id),
    name: r.name,
    category: (TYPE_TO_CATEGORY[r.type] ?? 'petstore') as PlaceCategory,
    coordinate: { latitude: r.lat, longitude: r.lng },
    address: r.address,
    phone: r.phone,
    rating: r.rating,
    weekdayHours: r.weekdayHours,
    is24Hours: r.is24Hours,
    exoticFriendly: r.exoticFriendly,
    // 合作夥伴欄位。沒接這幾行的話 isPartner 永遠是 undefined，
    // PartnerPlaceCard 就不會被觸發
    isPartner: r.isPartner,
    description: r.description,
    tags: r.tags,
    photos: r.photos,
    hours: todayHours(r.weekdayHours),
    photoUrl: resolvedPhotoUrl,
    distance: userLoc ? calcDistance(userLoc.latitude, userLoc.longitude, r.lat, r.lng) : undefined,
    googleMapsUrl: `https://maps.google.com/?q=${encodeURIComponent(r.name + ' ' + r.address)}`,
  };
}

void ([
  {
    id: '1',
    name: '大安動物醫院',
    category: 'vet',
    coordinate: { latitude: 25.028, longitude: 121.532 },
    address: '台北市大安區和平東路一段 86 號',
    hours: '09:00 – 21:00',
    distance: '0.4 km',
    rating: 4.8,
    isPartner: true,
    googleMapsUrl: 'https://maps.google.com/?q=大安動物醫院',
    description: '提供全方位寵物醫療服務，包含一般診療、外科手術、牙科與預防接種，院內設備新穎，讓毛小孩在舒適環境中接受最好的照護。',
    tags: ['24H急診', '外科手術', '牙科', '預防接種', '停車場'],
    phone: '02-2391-5678',
    photos: [
      'https://picsum.photos/seed/vetclinic1/800/400',
      'https://picsum.photos/seed/vetclinic2/800/400',
      'https://picsum.photos/seed/vetclinic3/800/400',
    ],
  },
  {
    id: '2',
    name: '信義動物醫院',
    category: 'vet',
    coordinate: { latitude: 25.034, longitude: 121.564 },
    address: '台北市信義區忠孝東路五段 236 號',
    hours: '08:30 – 20:00',
    distance: '1.2 km',
    rating: 4.6,
    isPartner: false,
    googleMapsUrl: 'https://maps.google.com/?q=信義動物醫院',
  },
  {
    id: '3',
    name: '毛孩沙龍',
    category: 'grooming',
    coordinate: { latitude: 25.045, longitude: 121.548 },
    address: '台北市中山區南京東路三段 42 號',
    hours: '10:00 – 19:00',
    distance: '0.8 km',
    rating: 4.9,
    isPartner: true,
    googleMapsUrl: 'https://maps.google.com/?q=毛孩沙龍',
    description: '專業寵物美容造型，使用天然有機洗浴產品，讓您的毛孩煥然一新。提供基礎美容、造型剪毛、SPA 護理與指甲修剪等多項服務。',
    tags: ['有機產品', 'SPA護理', '造型剪毛', '指甲修剪', '預約制'],
    phone: '02-2507-8899',
    photos: [
      'https://picsum.photos/seed/grooming1/800/400',
      'https://picsum.photos/seed/grooming2/800/400',
      'https://picsum.photos/seed/grooming3/800/400',
    ],
  },
  {
    id: '4',
    name: '寵愛美容 Da\'an',
    category: 'grooming',
    coordinate: { latitude: 25.038, longitude: 121.521 },
    address: '台北市大安區復興南路二段 18 號',
    hours: '11:00 – 18:00',
    distance: '1.5 km',
    rating: 4.4,
    isPartner: false,
    googleMapsUrl: 'https://maps.google.com/?q=寵愛美容',
  },
  {
    id: '5',
    name: '寵物家族旗艦店',
    category: 'petstore',
    coordinate: { latitude: 25.041, longitude: 121.559 },
    address: '台北市信義區松仁路 28 號 B1',
    hours: '11:00 – 22:00',
    distance: '0.6 km',
    rating: 4.5,
    isPartner: true,
    googleMapsUrl: 'https://maps.google.com/?q=寵物家族',
    description: '台北最大寵物用品旗艦店，超過 5,000 種商品，涵蓋飼料、玩具、保健品與居家用品，Critterio 會員享獨家折扣與積點回饋。',
    tags: ['會員優惠', '飼料專區', '保健品', '玩具', '刷卡消費'],
    phone: '02-2722-3456',
    photos: [
      'https://picsum.photos/seed/petshop1/800/400',
      'https://picsum.photos/seed/petshop2/800/400',
      'https://picsum.photos/seed/petshop3/800/400',
    ],
  },
  {
    id: '6',
    name: '汪寵樂園',
    category: 'petstore',
    coordinate: { latitude: 25.02, longitude: 121.55 },
    address: '台北市文山區木柵路一段 48 號',
    hours: '10:00 – 20:00',
    distance: '2.1 km',
    rating: 4.3,
    isPartner: false,
    googleMapsUrl: 'https://maps.google.com/?q=汪寵樂園',
  },
  {
    id: '7',
    name: '大安森林公園',
    category: 'park',
    coordinate: { latitude: 25.0265, longitude: 121.5362 },
    address: '台北市大安區新生南路二段 1 號',
    hours: '全天開放',
    distance: '0.7 km',
    rating: 4.9,
    isPartner: false,
    googleMapsUrl: 'https://maps.google.com/?q=大安森林公園',
  },
  {
    id: '8',
    name: '中山美術公園',
    category: 'park',
    coordinate: { latitude: 25.06, longitude: 121.542 },
    address: '台北市中山區中山北路三段',
    hours: '全天開放',
    distance: '2.8 km',
    rating: 4.6,
    isPartner: false,
    googleMapsUrl: 'https://maps.google.com/?q=中山美術公園',
  },
  {
    id: '9',
    name: '汪喵好食',
    category: 'restaurant',
    coordinate: { latitude: 25.049, longitude: 121.552 },
    address: '台北市中山區民生東路二段 147 號',
    hours: '11:30 – 21:30',
    distance: '1.1 km',
    rating: 4.7,
    isPartner: true,
    googleMapsUrl: 'https://maps.google.com/?q=汪喵好食',
    description: '台北最受歡迎的寵物友善餐廳，提供戶外座位區，歡迎毛孩入內用餐。菜單精選台灣在地食材，並附設寵物專屬輕食點心。',
    tags: ['戶外座位', '寵物輕食', '台灣食材', '寵物水碗', '可帶入店'],
    phone: '02-2516-7788',
    photos: [
      'https://picsum.photos/seed/petcafe1/800/400',
      'https://picsum.photos/seed/petcafe2/800/400',
      'https://picsum.photos/seed/petcafe3/800/400',
    ],
  },
  {
    id: '10',
    name: '毛小孩餐廳',
    category: 'restaurant',
    coordinate: { latitude: 25.032, longitude: 121.548 },
    address: '台北市大安區敦化南路一段 187 號',
    hours: '12:00 – 22:00',
    distance: '0.3 km',
    rating: 4.5,
    isPartner: false,
    googleMapsUrl: 'https://maps.google.com/?q=毛小孩餐廳',
  },
] as Place[]);

// 切分類時常常只是回到剛剛看過的分類，或地圖根本沒動，快取幾分鐘可以避免重打一樣的請求；
// 經緯度四捨五入到小數點後 3 位（約 111m），半徑取整到 500m 一階，這樣同一個分類來回切換時容易命中快取
const PLACES_CACHE_TTL_MS = 3 * 60 * 1000;

function placesCacheKey(
  center: { latitude: number; longitude: number; radiusM: number },
  apiType: string | undefined,
  is24hr: boolean,
  exotic: boolean
): string {
  const lat = center.latitude.toFixed(3);
  const lng = center.longitude.toFixed(3);
  const radius = Math.round(center.radiusM / 500) * 500;
  return `${apiType ?? 'all'}|${is24hr}|${exotic}|${lat}|${lng}|${radius}`;
}

const TAIPEI_REGION = {
  latitude: 25.037,
  longitude: 121.548,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

const TAB_BAR_HEIGHT = 60;

// ─── Component ────────────────────────────────────────────────────────────────

export default function MapScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const mapRef = useRef<any>(null);
  const cardAnim = useRef(new Animated.Value(0)).current;
  const markerJustPressed = useRef(false);
  const mapReady = useRef(false);
  const didFlyToUser = useRef(false);

  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');
  const [is24hrOnly, setIs24hrOnly] = useState(false);
  const [exoticOnly, setExoticOnly] = useState(false);

  // 切離「醫院」分類時，24hr／特殊寵物友善篩選一併清除，避免使用者看不到按鈕卻仍套用篩選
  useEffect(() => {
    if (activeFilter !== 'vet') {
      if (is24hrOnly) setIs24hrOnly(false);
      if (exoticOnly) setExoticOnly(false);
    }
  }, [activeFilter]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  // FAB 要疊在卡片上方，卡片高度會隨介紹文展開而變，所以用量的不用寫死
  const [cardHeight, setCardHeight] = useState(0);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapCenter, setMapCenter] = useState({ latitude: TAIPEI_REGION.latitude, longitude: TAIPEI_REGION.longitude, radiusM: 5000 });
  const [places, setPlaces] = useState<Place[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const placesCacheRef = useRef<Map<string, { raw: ApiPlace[]; timestamp: number }>>(new Map());
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoritePlaces, setFavoritePlaces] = useState<Place[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const favAnim = useRef(new Animated.Value(0)).current;

  const isFavorite = (id: string) => favoriteIds.has(id);

  const toggleFavorite = (id: string) => {
    const isCurrentlyFav = favoriteIds.has(id);
    if (isCurrentlyFav) {
      setFavoriteIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      setFavoritePlaces(prev => prev.filter(p => p.id !== id));
      removeMapFavorite(id).catch(() => {
        setFavoriteIds(prev => new Set([...prev, id]));
        const place = places.find(p => p.id === id);
        if (place) setFavoritePlaces(prev => [...prev, place]);
      });
    } else {
      setFavoriteIds(prev => new Set([...prev, id]));
      const place = places.find(p => p.id === id);
      if (place) setFavoritePlaces(prev => [...prev, place]);
      addMapFavorite(id).catch(() => {
        setFavoriteIds(prev => { const next = new Set(prev); next.delete(id); return next; });
        setFavoritePlaces(prev => prev.filter(p => p.id !== id));
      });
    }
  };

  // Request location permission on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    })();
  }, []);

  // Load favorites from API on mount
  useEffect(() => {
    getMapFavorites()
      .then((res) => {
        if (res.success) {
          setFavoriteIds(new Set(res.data.map((p) => String(p.id))));
          setFavoritePlaces(res.data.map((r) => mapApiPlace(r)));
        }
      })
      .catch(() => {});
  }, []);

  const flyToUser = (loc: { latitude: number; longitude: number }) => {
    if (!mapReady.current || didFlyToUser.current) return;
    didFlyToUser.current = true;
    mapRef.current?.animateToRegion(
      { latitude: loc.latitude, longitude: loc.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      800
    );
  };

  // 當 GPS 取得後，把地圖中心更新為使用者位置並飛過去
  useEffect(() => {
    if (userLocation) {
      setMapCenter({ latitude: userLocation.latitude, longitude: userLocation.longitude, radiusM: 5000 });
      flyToUser(userLocation);
    }
  }, [userLocation]);

  // 地圖滑動停止時更新中心點與半徑
  const handleRegionChangeComplete = (region: { latitude: number; longitude: number; latitudeDelta: number }) => {
    const radiusM = Math.min(Math.round((region.latitudeDelta / 2) * 111000), 30000);
    setMapCenter({ latitude: region.latitude, longitude: region.longitude, radiusM });
  };

  // 地圖中心或篩選變更時重新查詢（cleanup 避免過期請求覆蓋新結果）；
  // 先查記憶體快取，命中就直接套用不用打 API，切分類來回切換會感覺是即時的
  useEffect(() => {
    let cancelled = false;
    const apiType = activeFilter !== 'all' ? CATEGORY_TO_APITYPE[activeFilter] : undefined;
    const key = placesCacheKey(mapCenter, apiType, is24hrOnly, exoticOnly);
    const cached = placesCacheRef.current.get(key);

    // distance 永遠用「目前」的 userLocation 現算，即使套用快取也不會顯示過期的距離
    const applyRaw = (raw: ApiPlace[]) => setPlaces(raw.map((r) => mapApiPlace(r, userLocation ?? undefined)));

    if (cached && Date.now() - cached.timestamp < PLACES_CACHE_TTL_MS) {
      applyRaw(cached.raw);
      return;
    }

    setPlacesLoading(true);
    getNearbyPlaces(mapCenter.latitude, mapCenter.longitude, apiType, mapCenter.radiusM, is24hrOnly, exoticOnly)
      .then((res) => {
        if (cancelled || !res.success) return;
        placesCacheRef.current.set(key, { raw: res.data, timestamp: Date.now() });
        applyRaw(res.data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPlacesLoading(false); });
    return () => { cancelled = true; };
  }, [mapCenter, activeFilter, is24hrOnly, exoticOnly, userLocation]);

  // Animate preview card in/out
  useEffect(() => {
    Animated.spring(cardAnim, {
      toValue: selectedPlace ? 1 : 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [selectedPlace]);

  // Animate favorites sheet in/out
  useEffect(() => {
    Animated.spring(favAnim, {
      toValue: showFavorites ? 1 : 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [showFavorites]);

  const favTranslateY = favAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [500, 0],
  });

  const cardTranslateY = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [420, 0],
  });

  const filteredPlaces = places;

  const handlePinPress = (place: Place) => {
    markerJustPressed.current = true;
    setSelectedPlace(place);
    setTimeout(() => { markerJustPressed.current = false; }, 300);
  };

  /**
   * 從收藏清單挑一個地點：關面板、選中、並把地圖移過去。
   *
   * 原本只有前兩件事 —— 收藏的地點常常在畫面外，不移動地圖的話
   * 卡片跳出來了但使用者根本看不到那個 pin 在哪。
   * 點 pin 不需要移動（本來就在畫面上），所以這條路徑跟 handlePinPress 分開。
   */
  const handleFavoritePress = (place: Place) => {
    setShowFavorites(false);
    setSelectedPlace(place);
    mapRef.current?.animateToRegion(
      { ...place.coordinate, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      500,
    );
  };

  const handleMapPress = () => {
    if (markerJustPressed.current) return;
    setSelectedPlace(null);
  };

  const goToMyLocation = () => {
    const target = userLocation ?? { latitude: 25.037, longitude: 121.548 };
    mapRef.current?.animateToRegion(
      { ...target, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      500
    );
  };

  const openGoogleMaps = (place: Place) => {
    const fallbackUrl = place.googleMapsUrl ?? `https://maps.google.com/?q=${place.coordinate.latitude},${place.coordinate.longitude}`;
    if (Platform.OS === 'android') {
      // Android 的 geo: intent 會讓使用者選擇已安裝的地圖 App（含 Google Maps），iOS 沒有對應的 Google Maps scheme，
      // 用 maps: 反而會強制開啟 Apple 內建地圖，所以 iOS 一律直接開 Google Maps 網址（若有裝 Google Maps App 會透過 Universal Link 自動接手）
      const url = `geo:${place.coordinate.latitude},${place.coordinate.longitude}?q=${encodeURIComponent(place.name)}`;
      Linking.canOpenURL(url).then((supported) => {
        Linking.openURL(supported ? url : fallbackUrl);
      });
    } else {
      Linking.openURL(fallbackUrl);
    }
  };

  const cardBottom = TAB_BAR_HEIGHT + insets.bottom + 12;

  if (viewMode === 'list') {
    return (
      <NearbyListScreen
        onSwitchToMap={() => setViewMode('map')}
        favoriteIds={favoriteIds}
        onToggleFavorite={toggleFavorite}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Map ─────────────────────────────────────────────────── */}
      <ClusteredMapView
        ref={mapRef}
        style={styles.map}
        initialRegion={TAIPEI_REGION}
        onPress={handleMapPress}
        onRegionChangeComplete={handleRegionChangeComplete}
        onMapReady={() => {
          mapReady.current = true;
          if (userLocation) flyToUser(userLocation);
        }}
        showsUserLocation
        showsMyLocationButton={false}
        zoomEnabled
        scrollEnabled
        pitchEnabled
        rotateEnabled
        radius={60}
        minPoints={3}
        animationEnabled
        renderCluster={(cluster: any) => {
          const { id, geometry, onPress, properties } = cluster;
          const count: number = properties.point_count;
          return (
            <Marker
              key={`cluster-${id}`}
              coordinate={{ latitude: geometry.coordinates[1], longitude: geometry.coordinates[0] }}
              onPress={onPress}
              tracksViewChanges={false}
            >
              <View pointerEvents="none" style={styles.cluster}>
                <Text style={styles.clusterText}>{count}</Text>
              </View>
            </Marker>
          );
        }}
      >
        {filteredPlaces.map((place) => {
          const cfg = makeCategoryConfig(colors)[place.category];
          const isSelected = selectedPlace?.id === place.id;
          return (
            <Marker
              key={place.id}
              coordinate={place.coordinate}
              onPress={() => handlePinPress(place)}
              onSelect={() => handlePinPress(place)}
              tracksViewChanges={false}
            >
              <View pointerEvents="none" style={[styles.pin, isSelected && styles.pinSelected]}>
                <View
                  style={[
                    styles.pinInner,
                    { backgroundColor: cfg.bgColor },
                    isSelected && styles.pinInnerSelected,
                    // 合作夥伴選中時外框改金色，跟徽章同一套語彙；
                    // 一般地點維持 primary，兩者一眼分得出來
                    isSelected && place.isPartner && styles.pinInnerSelectedPartner,
                  ]}
                >
                  <MaterialIcons name={cfg.icon} size={isSelected ? 22 : 18} color={cfg.iconColor} />
                </View>
                {place.isPartner && (
                  <View style={styles.partnerStar}>
                    <MaterialIcons name="star" size={11} color={colors.onPartnerBadge} />
                  </View>
                )}
              </View>
            </Marker>
          );
        })}
      </ClusteredMapView>

      {/* ── Filter Chips ─────────────────────────────────────────── */}
      <View style={[styles.filterWrapper, { top: insets.top + 12 }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {FILTER_OPTIONS.map((opt) => {
            const isActive = activeFilter === opt.key;
            const cfg = opt.key !== 'all' ? makeCategoryConfig(colors)[opt.key as PlaceCategory] : null;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => setActiveFilter(opt.key)}
                activeOpacity={0.8}
              >
                {cfg && (
                  <MaterialIcons
                    name={cfg.icon}
                    size={15}
                    color={isActive ? colors.onPrimary : colors.primary}
                  />
                )}
                <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {placesLoading && (
          <View style={styles.loadingNotice}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingNoticeText}>搜尋店家中...</Text>
          </View>
        )}

        {activeFilter === 'restaurant' && (
          <View style={styles.restaurantNotice}>
            <MaterialIcons name="info-outline" size={13} color="#7A5800" />
            <Text style={styles.restaurantNoticeText}>各店對寵物接受度不同，建議事先來電確認</Text>
          </View>
        )}
      </View>

      {/* ── FAB Group ─────────────────────────────────────────────── */}
      {(() => {
        // 原本寫死 350 / 150，介紹文展開後卡片會長高、FAB 就疊上去了。
        // 改成量測實際高度，之後卡片內容再變也不用回來調這個數字。
        const fabOffset = selectedPlace ? cardHeight + 12 : 0;
        return (
          <View style={[styles.fabGroup, { bottom: cardBottom + fabOffset }]}>
            <TouchableOpacity style={styles.fab} onPress={goToMyLocation} activeOpacity={0.85}>
              <MaterialIcons name="my-location" size={22} color={colors.onPrimary} />
            </TouchableOpacity>
            {(activeFilter === 'vet' || activeFilter === 'petstore' || activeFilter === 'grooming') && (
              <TouchableOpacity
                style={[styles.fab, styles.fabCareGuide]}
                onPress={() => navigation.navigate('PetCareGuide', { category: activeFilter })}
                activeOpacity={0.85}
              >
                <MaterialIcons name="menu-book" size={22} color={colors.onPrimary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.fab, styles.fabHeart]}
              onPress={() => { setShowFavorites(true); setSelectedPlace(null); }}
              activeOpacity={0.85}
            >
              <MaterialIcons
                name={favoriteIds.size > 0 ? 'favorite' : 'favorite-border'}
                size={22}
                color={colors.onPrimary}
              />
              {favoriteIds.size > 0 && (
                <View style={styles.fabBadge}>
                  <Text style={styles.fabBadgeText}>{favoriteIds.size}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* 切換列表模式 */}
            <TouchableOpacity
              style={styles.listToggleBtn}
              onPress={() => setViewMode('list')}
              activeOpacity={0.85}
            >
              <MaterialIcons name="format-list-bulleted" size={20} color={colors.onSurface} />
            </TouchableOpacity>

            {/* 24hr 篩選（僅醫院分類顯示） */}
            {activeFilter === 'vet' && (
              <TouchableOpacity
                style={[styles.listToggleBtn, styles.hour24Btn, is24hrOnly && styles.listToggleBtnActive]}
                onPress={() => {
                  setIs24hrOnly((v) => !v);
                  setExoticOnly(false);
                }}
                activeOpacity={0.85}
              >
                <MaterialIcons
                  name="schedule"
                  size={18}
                  color={is24hrOnly ? colors.onPrimary : colors.onSurface}
                />
                <Text style={[styles.hour24Label, is24hrOnly && styles.hour24LabelActive]}>24hr</Text>
              </TouchableOpacity>
            )}

            {/* 特殊寵物友善篩選（僅醫院分類顯示） */}
            {activeFilter === 'vet' && (
              <TouchableOpacity
                style={[styles.listToggleBtn, styles.hour24Btn, exoticOnly && styles.listToggleBtnActive]}
                onPress={() => {
                  setExoticOnly((v) => !v);
                  setIs24hrOnly(false);
                }}
                activeOpacity={0.85}
              >
                <MaterialIcons
                  name="egg"
                  size={18}
                  color={exoticOnly ? colors.onPrimary : colors.onSurface}
                />
                <Text style={[styles.hour24Label, exoticOnly && styles.hour24LabelActive]}>特寵</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })()}

      {/* ── Preview Card ──────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.card,
          { bottom: cardBottom, transform: [{ translateY: cardTranslateY }] },
          !selectedPlace && styles.cardHidden,
        ]}
        pointerEvents={selectedPlace ? 'auto' : 'none'}
        onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}
      >
        {selectedPlace && (
          selectedPlace.isPartner
            ? <PartnerPlaceCard
                place={selectedPlace}
                onClose={() => setSelectedPlace(null)}
                onNavigate={openGoogleMaps}
                isFav={isFavorite(selectedPlace.id)}
                onToggleFavorite={() => toggleFavorite(selectedPlace.id)}
                onPartnerInfo={() => navigation.navigate('PartnerProgram')}
              />
            : <PlaceCard
                place={selectedPlace}
                onClose={() => setSelectedPlace(null)}
                onNavigate={openGoogleMaps}
                isFav={isFavorite(selectedPlace.id)}
                onToggleFavorite={() => toggleFavorite(selectedPlace.id)}
              />
        )}
      </Animated.View>

      {/* ── Favorites Sheet ───────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.card,
          { bottom: cardBottom, transform: [{ translateY: favTranslateY }] },
          !showFavorites && styles.cardHidden,
        ]}
        pointerEvents={showFavorites ? 'auto' : 'none'}
      >
        {showFavorites && (
          <FavoritesSheet
            favoritePlaces={favoritePlaces}
            onClose={() => setShowFavorites(false)}
            onSelectPlace={handleFavoritePress}
            onToggleFavorite={toggleFavorite}
          />
        )}
      </Animated.View>
    </View>
  );
}

// ─── Place Card ───────────────────────────────────────────────────────────────

function PlaceCard({
  place,
  onClose,
  onNavigate,
  isFav,
  onToggleFavorite,
}: {
  place: Place;
  onClose: () => void;
  onNavigate: (p: Place) => void;
  isFav: boolean;
  onToggleFavorite: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const cfg = makeCategoryConfig(colors)[place.category];

  return (
    <View style={styles.cardInner}>
      {/* Photo area */}
      <View style={[styles.cardPhoto, { backgroundColor: cfg.bgColor }]}>
        {place.photoUrl ? (
          <Image source={{ uri: place.photoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <MaterialIcons name={cfg.icon} size={44} color={cfg.iconColor} />
        )}
        {place.isPartner && (
          <View style={styles.partnerBadge}>
            <MaterialIcons name="star" size={11} color={colors.onPartnerBadge} />
            <Text style={styles.partnerBadgeText}>合作夥伴</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.cardHeartBtn}
          onPress={onToggleFavorite}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons
            name={isFav ? 'favorite' : 'favorite-border'}
            size={16}
            color={isFav ? colors.favorite : colors.onSurface}
          />
        </TouchableOpacity>
      </View>

      {/* Info area */}
      <View style={styles.cardInfo}>
        {/* Top row: category tag + rating */}
        <View style={styles.cardTopRow}>
          <View style={[styles.categoryTag, { backgroundColor: cfg.bgColor }]}>
            <Text style={[styles.categoryTagText, { color: cfg.iconColor }]}>{cfg.label}</Text>
          </View>
          {place.rating != null && (
            <View style={styles.ratingRow}>
              <MaterialIcons name="star" size={13} color="#F9A825" />
              <Text style={styles.ratingText}>{place.rating.toFixed(1)}</Text>
            </View>
          )}
        </View>

        {/* Name */}
        <Text style={styles.cardName} numberOfLines={1}>{place.name}</Text>

        {/* Phone */}
        {place.phone && (
          <Text style={styles.cardMeta} numberOfLines={1}>
            <MaterialIcons name="phone" size={11} color={colors.outline} /> {place.phone}
          </Text>
        )}

        {/* Hours + distance */}
        {(place.distance || place.hours) && (
          <Text style={styles.cardMeta} numberOfLines={1}>
            {[place.hours, place.distance].filter(Boolean).join(' · ')}
          </Text>
        )}

        {/* Buttons */}
        <View style={styles.cardButtons}>
          <TouchableOpacity
            style={styles.btnMaps}
            onPress={() => onNavigate(place)}
            activeOpacity={0.85}
          >
            <MaterialIcons name="map" size={14} color={colors.onPrimary} />
            <Text style={styles.btnMapsText}>Google Maps</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnClose}
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons name="close" size={18} color={colors.outline} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Partner Place Card ───────────────────────────────────────────────────────

function PartnerPlaceCard({
  place,
  onClose,
  onNavigate,
  isFav,
  onToggleFavorite,
  onPartnerInfo,
}: {
  place: Place;
  onClose: () => void;
  onNavigate: (p: Place) => void;
  isFav: boolean;
  onToggleFavorite: () => void;
  onPartnerInfo: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const cfg = makeCategoryConfig(colors)[place.category];
  const [photoIndex, setPhotoIndex] = useState(0);
  const photoOpacity = useRef(new Animated.Value(1)).current;
  const [descExpanded, setDescExpanded] = useState(false);
  // onTextLayout 量到超過 2 行才算被截斷
  const [descTruncated, setDescTruncated] = useState(false);
  const hasPhotos = !!(place.photos && place.photos.length > 0);

  useEffect(() => {
    setPhotoIndex(0);
    photoOpacity.setValue(1);
  }, [place.id]);

  useEffect(() => {
    if (!place.photos || place.photos.length <= 1) return;
    const interval = setInterval(() => {
      Animated.timing(photoOpacity, {
        toValue: 0.1,
        duration: 350,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setPhotoIndex(prev => (prev + 1) % place.photos!.length);
        Animated.timing(photoOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }).start();
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [place.id, place.photos?.length]);

  // 換一家店時收回展開狀態，否則下一家會直接是展開的
  useEffect(() => {
    setDescExpanded(false);
    setDescTruncated(false);
  }, [place.id]);

  return (
    <View style={styles.partnerCard}>
      {/* ── Hero ── */}
      <View style={[styles.partnerHero, { backgroundColor: cfg.bgColor }]}>
        {/* Decorative circles (no-photo fallback) */}
        {!hasPhotos && (
          <>
            <View style={[styles.heroBubble1, { backgroundColor: cfg.iconColor }]} />
            <View style={[styles.heroBubble2, { backgroundColor: cfg.iconColor }]} />
          </>
        )}

        {/* Photo slideshow */}
        {hasPhotos && (
          <Animated.Image
            source={{ uri: place.photos![photoIndex] }}
            style={[styles.heroImage, { opacity: photoOpacity }]}
            resizeMode="cover"
          />
        )}
        {hasPhotos && <View style={styles.heroOverlay} />}

        {/* Heart button (top-left) */}
        <TouchableOpacity
          style={styles.heroHeartBtn}
          onPress={onToggleFavorite}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons
            name={isFav ? 'favorite' : 'favorite-border'}
            size={16}
            color={isFav ? colors.favorite : (hasPhotos ? '#fff' : colors.onSurface)}
          />
        </TouchableOpacity>

        {/* Close button (top-right) */}
        <TouchableOpacity
          style={styles.heroCloseBtn}
          onPress={onClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons name="close" size={16} color={hasPhotos ? '#fff' : colors.onSurface} />
        </TouchableOpacity>

        {/* Main icon (no-photo fallback) */}
        {!hasPhotos && (
          <View style={[styles.heroIconCircle, { backgroundColor: cfg.iconColor + '30' }]}>
            <MaterialIcons name={cfg.icon} size={54} color={cfg.iconColor} />
          </View>
        )}

        {/* Partner badge */}
        <TouchableOpacity
          style={styles.heroPartnerBadge}
          onPress={onPartnerInfo}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="了解合作夥伴方案"
        >
          <MaterialIcons name="star" size={11} color={colors.onPartnerBadge} />
          <Text style={styles.heroPartnerText}>合作夥伴</Text>
        </TouchableOpacity>

        {/* Rating badge */}
        {place.rating != null && (
          <View style={styles.heroRatingBadge}>
            <MaterialIcons name="star" size={12} color="#F9A825" />
            <Text style={styles.heroRatingText}>{place.rating}</Text>
          </View>
        )}

        {/* Photo dots indicator */}
        {hasPhotos && place.photos!.length > 1 && (
          <View style={styles.photoDots}>
            {place.photos!.map((_, i) => (
              <View key={i} style={[styles.photoDot, i === photoIndex && styles.photoDotActive]} />
            ))}
          </View>
        )}
      </View>

      {/* ── Content ── */}
      <View style={styles.partnerContent}>
        {/* Name + category */}
        <View style={styles.partnerNameRow}>
          <Text style={styles.partnerName} numberOfLines={1}>{place.name}</Text>
          <View style={[styles.categoryTag, { backgroundColor: cfg.bgColor }]}>
            <Text style={[styles.categoryTagText, { color: cfg.iconColor }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* Stats: distance + hours */}
        <View style={styles.partnerStatsRow}>
          {place.distance && (
            <View style={styles.partnerStat}>
              <MaterialIcons name="place" size={13} color={colors.outline} />
              <Text style={styles.partnerStatText}>{place.distance}</Text>
            </View>
          )}
          {place.distance && place.hours && <View style={styles.partnerStatDivider} />}
          {place.hours && (
            <View style={styles.partnerStat}>
              <MaterialIcons name="access-time" size={13} color={colors.outline} />
              <Text style={styles.partnerStatText}>{place.hours}</Text>
            </View>
          )}
          {(place.distance || place.hours) && place.phone && <View style={styles.partnerStatDivider} />}
          {place.phone && (
            <>
              <View style={styles.partnerStatDivider} />
              <View style={styles.partnerStat}>
                <MaterialIcons name="phone" size={13} color={colors.outline} />
                <Text style={styles.partnerStatText}>{place.phone}</Text>
              </View>
            </>
          )}
        </View>

        {/* Description —— 收合時 2 行，點「展開」看完整內容 */}
        {place.description && (
          <View>
            {/*
              量測用的隱形副本。onTextLayout 在有 numberOfLines 時只會回傳
              「可見的那幾行」，所以不能直接在下面那個 Text 上量 —— 永遠量到 2，
              判斷不出有沒有被截斷。這裡用一份沒有行數限制的副本量真實行數。
            */}
            <Text
              style={[styles.partnerDesc, styles.descMeasure]}
              pointerEvents="none"
              onTextLayout={(e) => {
                const truncated = e.nativeEvent.lines.length > 2;
                if (truncated !== descTruncated) setDescTruncated(truncated);
              }}
            >
              {place.description}
            </Text>
            <Text style={styles.partnerDesc} numberOfLines={descExpanded ? undefined : 2}>
              {place.description}
            </Text>
            {descTruncated && (
              <TouchableOpacity onPress={() => setDescExpanded((v) => !v)} activeOpacity={0.7}>
                <Text style={styles.descToggle}>{descExpanded ? '收合' : '展開'}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Tags */}
        {place.tags && place.tags.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsScroll}>
            {place.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Buttons */}
        <View style={styles.partnerButtons}>
          <TouchableOpacity style={styles.btnPartnerSolid} onPress={() => onNavigate(place)} activeOpacity={0.85}>
            <MaterialIcons name="map" size={14} color={colors.onPartnerCta} />
            <Text style={styles.btnPartnerSolidText}>Google Maps</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPartnerOutline} onPress={() => place.phone && Linking.openURL(`tel:${place.phone}`)} activeOpacity={0.85}>
            <MaterialIcons name="phone" size={14} color={colors.partnerCta} />
            <Text style={styles.btnPartnerOutlineText}>立即聯絡</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Favorites Sheet ──────────────────────────────────────────────────────────

function FavoritesSheet({
  favoritePlaces,
  onClose,
  onSelectPlace,
  onToggleFavorite,
}: {
  favoritePlaces: Place[];
  onClose: () => void;
  onSelectPlace: (place: Place) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [catFilter, setCatFilter] = useState<FilterOption>('all');
  const allFavPlaces = favoritePlaces;
  const favPlaces = catFilter === 'all'
    ? allFavPlaces
    : allFavPlaces.filter(p => p.category === catFilter);

  const availableCats = FILTER_OPTIONS.filter(opt =>
    opt.key === 'all' || allFavPlaces.some(p => p.category === opt.key)
  );

  return (
    <View style={styles.favSheet}>
      <View style={styles.favHandle} />
      <View style={styles.favHeader}>
        <MaterialIcons name="favorite" size={18} color="#E53935" />
        <Text style={styles.favTitle}>我的最愛</Text>
        <Text style={styles.favCount}>{allFavPlaces.length} 個景點</Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name="close" size={20} color={colors.onSurface} />
        </TouchableOpacity>
      </View>

      {allFavPlaces.length === 0 ? (
        <View style={styles.favEmpty}>
          <MaterialIcons name="favorite-border" size={44} color={colors.outlineVariant} />
          <Text style={styles.favEmptyText}>尚未加入任何景點</Text>
          <Text style={styles.favEmptyHint}>點選地圖圖示上的 ♡ 即可收藏</Text>
        </View>
      ) : (
        <>
          {/* Category filter chips */}
          {availableCats.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.favChipRow}
            >
              {availableCats.map(opt => {
                const isActive = catFilter === opt.key;
                const cfg = opt.key !== 'all' ? makeCategoryConfig(colors)[opt.key as PlaceCategory] : null;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.favChip, isActive && styles.favChipActive]}
                    onPress={() => setCatFilter(opt.key)}
                    activeOpacity={0.8}
                  >
                    {cfg && (
                      <MaterialIcons
                        name={cfg.icon}
                        size={13}
                        color={isActive ? colors.onPrimary : colors.primary}
                      />
                    )}
                    <Text style={[styles.favChipLabel, isActive && styles.favChipLabelActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <ScrollView style={styles.favList} showsVerticalScrollIndicator={false}>
            {favPlaces.length === 0 ? (
              <View style={styles.favCatEmpty}>
                <Text style={styles.favEmptyHint}>此分類尚無收藏</Text>
              </View>
            ) : (
              favPlaces.map(place => {
                const cfg = makeCategoryConfig(colors)[place.category];
                return (
                  <TouchableOpacity
                    key={place.id}
                    style={styles.favItem}
                    onPress={() => onSelectPlace(place)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.favItemIcon, { backgroundColor: cfg.bgColor }]}>
                      <MaterialIcons name={cfg.icon} size={20} color={cfg.iconColor} />
                    </View>
                    <View style={styles.favItemInfo}>
                      <View style={styles.favItemNameRow}>
                        <Text style={styles.favItemName} numberOfLines={1}>{place.name}</Text>
                        {place.isPartner && (
                          <MaterialIcons name="verified" size={13} color={colors.primary} />
                        )}
                      </View>
                      <Text style={styles.favItemMeta} numberOfLines={1}>
                        {[place.distance, place.hours].filter(Boolean).join(' · ') || place.address}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => onToggleFavorite(place.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialIcons name="favorite" size={20} color="#E53935" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1 },
  map: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  // Filter chips
  filterWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    gap: 8,
  },
  loadingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: c.surfaceContainerLowest,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: c.outlineVariant,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  loadingNoticeText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: c.onSurfaceVariant,
  },
  restaurantNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: c.warningContainer,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: c.warning,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  restaurantNoticeText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: c.onWarningContainer,
  },
  listToggleBtn: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: c.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.outlineVariant,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  listToggleBtnActive: {
    backgroundColor: c.info,
    borderColor: c.info,
  },
  hour24Btn: {
    height: 54,
    gap: 1,
  },
  hour24Label: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: 10,
    color: c.onSurface,
  },
  hour24LabelActive: {
    color: c.onPrimary,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: c.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: c.outlineVariant,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  chipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  chipLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
  },
  chipLabelActive: {
    color: c.onPrimary,
  },

  // Map pins
  pin: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinSelected: {
    zIndex: 10,
  },
  pinInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: c.surfaceContainerLowest,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  pinInnerSelected: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: c.primary,
  },
  pinInnerSelectedPartner: {
    // 白框對淺桃內圈只有 1.29、對地圖底 1.15，單靠顏色會消失。
    // Google / Apple 地圖的白框是靠陰影撐出來的，不是靠對比 ——
    // 所以這裡必須連陰影一起給，拿掉陰影這個樣式就失效。
    borderWidth: 5,
    borderColor: c.partnerRing,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  // 星星本身有縫隙，直接放在地圖上會糊掉 —— 外面包一個 primary 圓底，
  // 再用底色描邊跟地圖分離，跟原本的圓點一樣醒目但語意更明確
  partnerStar: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: c.partnerBadge,
    borderWidth: 2,
    borderColor: c.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // FAB
  fab: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },

  // Preview card
  card: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 20,
  },
  cardHidden: {
    opacity: 0,
  },
  cardInner: {
    flexDirection: 'row',
    backgroundColor: c.surfaceContainerLowest,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: c.outlineVariant + '40',
  },
  cardPhoto: {
    width: '32%',
    minHeight: 130,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPartnerSolid: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: c.partnerCta,
    paddingVertical: 9,
    borderRadius: 10,
  },
  btnPartnerSolidText: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: c.onPartnerCta,
  },
  btnPartnerOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderColor: c.partnerCta,
    paddingVertical: 9,
    borderRadius: 10,
  },
  btnPartnerOutlineText: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: c.partnerCta,
  },
  partnerBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.partnerBadge,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  partnerBadgeText: {
    fontFamily: FontFamily.headlineBold,
    fontSize: 10,
    color: c.onPartnerBadge,
  },
  cardInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  categoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  categoryTagText: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelSM,
    color: c.onSurface,
  },
  cardName: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
    marginBottom: 2,
  },
  cardMeta: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
    marginBottom: 8,
  },
  cardButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnMaps: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: c.primary,
    paddingVertical: 9,
    borderRadius: 10,
  },
  btnMapsText: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: c.onPrimary,
  },
  btnClose: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: c.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Partner card ──────────────────────────────────────────────
  partnerCard: {
    backgroundColor: c.surfaceContainerLowest,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: c.outlineVariant + '30',
  },
  partnerHero: {
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroBubble1: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.12,
    top: -60,
    right: -40,
  },
  heroBubble2: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.08,
    bottom: -40,
    left: -20,
  },
  heroCloseBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.surfaceContainerLowest + 'CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPartnerBadge: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.partnerBadge,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  heroPartnerText: {
    fontFamily: FontFamily.headlineBold,
    fontSize: 10,
    color: c.onPartnerBadge,
  },
  heroRatingBadge: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: c.surfaceContainerLowest + 'E6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  heroRatingText: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.labelMD,
    color: c.onSurface,
  },
  partnerContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 8,
  },
  partnerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  partnerName: {
    flex: 1,
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.bodyLG,
    color: c.partnerTitle,
  },
  partnerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  partnerStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  partnerStatText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
  },
  partnerStatDivider: {
    width: 1,
    height: 12,
    backgroundColor: c.outlineVariant,
  },
  partnerDesc: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
    lineHeight: 20,
  },
  // 佔 0 空間、看不見，純粹拿來量行數
  descMeasure: {
    position: 'absolute',
    left: 0,
    right: 0,
    opacity: 0,
    zIndex: -1,
  },
  descToggle: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: c.primary,
    marginTop: 4,
  },
  tagsScroll: {
    flexGrow: 0,
  },
  tag: {
    backgroundColor: c.surfaceContainerHigh,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    marginRight: 6,
  },
  tagText: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
  },
  partnerButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  btnCall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderColor: c.primary,
    paddingVertical: 9,
    borderRadius: 10,
  },
  btnCallText: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: c.primary,
  },

  // Photo slideshow
  heroImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  photoDots: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  photoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  photoDotActive: {
    width: 16,
    backgroundColor: '#fff',
  },

  // FAB group
  fabGroup: {
    position: 'absolute',
    right: 20,
    alignItems: 'center',
    gap: 10,
  },
  fabHeart: {
    backgroundColor: c.favorite,
  },
  fabCareGuide: {
    backgroundColor: c.careGuide,
  },
  fabBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: c.onPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: c.favorite,
  },
  fabBadgeText: {
    fontFamily: FontFamily.headlineBold,
    fontSize: 10,
    color: c.favorite,
  },

  // Heart buttons on cards
  cardHeartBtn: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.surfaceContainerLowest + 'CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroHeartBtn: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.surfaceContainerLowest + 'CC',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Favorites sheet
  favSheet: {
    backgroundColor: c.surfaceContainerLowest,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
    maxHeight: 380,
  },
  favHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.outlineVariant,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  favHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceVariant,
  },
  favTitle: {
    flex: 1,
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
  },
  favEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 8,
  },
  favEmptyText: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
  },
  favEmptyHint: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: c.outline,
  },
  favList: {
    maxHeight: 300,
  },
  favItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceVariant + '80',
  },
  favItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favItemInfo: {
    flex: 1,
    gap: 3,
  },
  favItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  favItemName: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
  },
  favItemMeta: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
  },
  favCount: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: c.outline,
  },
  favChipRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  favChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: c.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: c.outlineVariant,
  },
  favChipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  favChipLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
  },
  favChipLabelActive: {
    color: c.onPrimary,
  },
  favCatEmpty: {
    alignItems: 'center',
    paddingVertical: 24,
  },

  // Cluster bubble
  cluster: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: c.onPrimary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  clusterText: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.bodyMD,
    color: c.onPrimary,
  },
});
