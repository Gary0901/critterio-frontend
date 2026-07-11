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
} from 'react-native';
import ClusteredMapView from 'react-native-map-clustering';
import { Marker } from 'react-native-maps';
import NearbyListScreen from './NearbyListScreen';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { getNearbyPlaces, getMapFavorites, addMapFavorite, removeMapFavorite } from '../../api';
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

const CATEGORY_CONFIG: Record<
  PlaceCategory,
  {
    icon: keyof typeof MaterialIcons.glyphMap;
    label: string;
    chipLabel: string;
    bgColor: string;
    iconColor: string;
  }
> = {
  vet: {
    icon: 'local-hospital',
    label: '寵物醫院',
    chipLabel: '醫院',
    bgColor: Colors.errorContainer,
    iconColor: Colors.error,
  },
  grooming: {
    icon: 'content-cut',
    label: '寵物美容',
    chipLabel: '美容',
    bgColor: '#E8DEF8',
    iconColor: '#6750A4',
  },
  petstore: {
    icon: 'shopping-bag',
    label: '寵物用品',
    chipLabel: '用品店',
    bgColor: Colors.primaryFixed,
    iconColor: Colors.onPrimaryContainer,
  },
  park: {
    icon: 'local-florist',
    label: '公園',
    chipLabel: '公園',
    bgColor: Colors.secondaryContainer,
    iconColor: Colors.secondary,
  },
  restaurant: {
    icon: 'restaurant',
    label: '友善餐廳',
    chipLabel: '餐廳',
    bgColor: '#FFF9C4',
    iconColor: '#F9A825',
  },
};

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
  r: { id: string; name: string; type: string; address: string; phone?: string; rating?: number; weekdayHours?: string[]; is24Hours?: boolean; exoticFriendly?: boolean; photoUrl?: string; photoRef?: string; lat: number; lng: number },
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

const TAIPEI_REGION = {
  latitude: 25.037,
  longitude: 121.548,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

const TAB_BAR_HEIGHT = 60;

// ─── Component ────────────────────────────────────────────────────────────────

export default function MapScreen() {
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
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapCenter, setMapCenter] = useState({ latitude: TAIPEI_REGION.latitude, longitude: TAIPEI_REGION.longitude, radiusM: 5000 });
  const [places, setPlaces] = useState<Place[]>([]);
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

  // 地圖中心或篩選變更時重新查詢（cleanup 避免過期請求覆蓋新結果）
  useEffect(() => {
    let cancelled = false;
    const apiType = activeFilter !== 'all' ? CATEGORY_TO_APITYPE[activeFilter] : undefined;
    getNearbyPlaces(mapCenter.latitude, mapCenter.longitude, apiType, mapCenter.radiusM, is24hrOnly, exoticOnly)
      .then((res) => {
        if (!cancelled && res.success)
          setPlaces(res.data.map((r) => mapApiPlace(r, userLocation ?? undefined)));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [mapCenter, activeFilter, is24hrOnly, exoticOnly]);

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
          const cfg = CATEGORY_CONFIG[place.category];
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
                  ]}
                >
                  <MaterialIcons name={cfg.icon} size={isSelected ? 22 : 18} color={cfg.iconColor} />
                </View>
                {place.isPartner && <View style={styles.partnerDot} />}
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
            const cfg = opt.key !== 'all' ? CATEGORY_CONFIG[opt.key as PlaceCategory] : null;
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
                    color={isActive ? Colors.onPrimary : Colors.primary}
                  />
                )}
                <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {activeFilter === 'restaurant' && (
          <View style={styles.restaurantNotice}>
            <MaterialIcons name="info-outline" size={13} color="#7A5800" />
            <Text style={styles.restaurantNoticeText}>各店對寵物接受度不同，建議事先來電確認</Text>
          </View>
        )}
      </View>

      {/* ── FAB Group ─────────────────────────────────────────────── */}
      {(() => {
        const fabOffset = selectedPlace ? (selectedPlace.isPartner ? 350 : 150) : 0;
        return (
          <View style={[styles.fabGroup, { bottom: cardBottom + fabOffset }]}>
            <TouchableOpacity style={styles.fab} onPress={goToMyLocation} activeOpacity={0.85}>
              <MaterialIcons name="my-location" size={22} color={Colors.onPrimary} />
            </TouchableOpacity>
            {(activeFilter === 'vet' || activeFilter === 'petstore' || activeFilter === 'grooming') && (
              <TouchableOpacity
                style={[styles.fab, styles.fabCareGuide]}
                onPress={() => navigation.navigate('PetCareGuide', { category: activeFilter })}
                activeOpacity={0.85}
              >
                <MaterialIcons name="menu-book" size={22} color={Colors.onPrimary} />
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
                color={Colors.onPrimary}
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
              <MaterialIcons name="format-list-bulleted" size={20} color={Colors.onSurface} />
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
                  color={is24hrOnly ? Colors.onPrimary : Colors.onSurface}
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
                  color={exoticOnly ? Colors.onPrimary : Colors.onSurface}
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
      >
        {selectedPlace && (
          selectedPlace.isPartner
            ? <PartnerPlaceCard
                place={selectedPlace}
                onClose={() => setSelectedPlace(null)}
                onNavigate={openGoogleMaps}
                isFav={isFavorite(selectedPlace.id)}
                onToggleFavorite={() => toggleFavorite(selectedPlace.id)}
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
            onSelectPlace={(place) => { setSelectedPlace(place); setShowFavorites(false); }}
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
  const cfg = CATEGORY_CONFIG[place.category];

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
            <MaterialIcons name="verified" size={10} color={Colors.onPrimary} />
            <Text style={styles.partnerBadgeText}>合作</Text>
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
            color={isFav ? '#E53935' : Colors.onSurface}
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
            <MaterialIcons name="phone" size={11} color={Colors.outline} /> {place.phone}
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
            <MaterialIcons name="map" size={14} color={Colors.onPrimary} />
            <Text style={styles.btnMapsText}>Google Maps</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnClose}
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons name="close" size={18} color={Colors.outline} />
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
}: {
  place: Place;
  onClose: () => void;
  onNavigate: (p: Place) => void;
  isFav: boolean;
  onToggleFavorite: () => void;
}) {
  const cfg = CATEGORY_CONFIG[place.category];
  const [photoIndex, setPhotoIndex] = useState(0);
  const photoOpacity = useRef(new Animated.Value(1)).current;
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
            color={isFav ? '#E53935' : (hasPhotos ? '#fff' : Colors.onSurface)}
          />
        </TouchableOpacity>

        {/* Close button (top-right) */}
        <TouchableOpacity
          style={styles.heroCloseBtn}
          onPress={onClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons name="close" size={16} color={hasPhotos ? '#fff' : Colors.onSurface} />
        </TouchableOpacity>

        {/* Main icon (no-photo fallback) */}
        {!hasPhotos && (
          <View style={[styles.heroIconCircle, { backgroundColor: cfg.iconColor + '30' }]}>
            <MaterialIcons name={cfg.icon} size={54} color={cfg.iconColor} />
          </View>
        )}

        {/* Partner badge */}
        <View style={styles.heroPartnerBadge}>
          <MaterialIcons name="verified" size={11} color={Colors.onPrimary} />
          <Text style={styles.heroPartnerText}>合作夥伴</Text>
        </View>

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
              <MaterialIcons name="place" size={13} color={Colors.outline} />
              <Text style={styles.partnerStatText}>{place.distance}</Text>
            </View>
          )}
          {place.distance && place.hours && <View style={styles.partnerStatDivider} />}
          {place.hours && (
            <View style={styles.partnerStat}>
              <MaterialIcons name="access-time" size={13} color={Colors.outline} />
              <Text style={styles.partnerStatText}>{place.hours}</Text>
            </View>
          )}
          {(place.distance || place.hours) && place.phone && <View style={styles.partnerStatDivider} />}
          {place.phone && (
            <>
              <View style={styles.partnerStatDivider} />
              <View style={styles.partnerStat}>
                <MaterialIcons name="phone" size={13} color={Colors.outline} />
                <Text style={styles.partnerStatText}>{place.phone}</Text>
              </View>
            </>
          )}
        </View>

        {/* Description */}
        {place.description && (
          <Text style={styles.partnerDesc} numberOfLines={2}>{place.description}</Text>
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
          <TouchableOpacity style={styles.btnMaps} onPress={() => onNavigate(place)} activeOpacity={0.85}>
            <MaterialIcons name="map" size={14} color={Colors.onPrimary} />
            <Text style={styles.btnMapsText}>Google Maps</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnCall} onPress={() => place.phone && Linking.openURL(`tel:${place.phone}`)} activeOpacity={0.85}>
            <MaterialIcons name="phone" size={14} color={Colors.primary} />
            <Text style={styles.btnCallText}>立即聯絡</Text>
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
          <MaterialIcons name="close" size={20} color={Colors.onSurface} />
        </TouchableOpacity>
      </View>

      {allFavPlaces.length === 0 ? (
        <View style={styles.favEmpty}>
          <MaterialIcons name="favorite-border" size={44} color={Colors.outlineVariant} />
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
                const cfg = opt.key !== 'all' ? CATEGORY_CONFIG[opt.key as PlaceCategory] : null;
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
                        color={isActive ? Colors.onPrimary : Colors.primary}
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
                const cfg = CATEGORY_CONFIG[place.category];
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
                          <MaterialIcons name="verified" size={13} color={Colors.primary} />
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

const styles = StyleSheet.create({
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
  restaurantNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: '#FFF8E1',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#F9A825',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  restaurantNoticeText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: '#7A5800',
  },
  listToggleBtn: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: Colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  listToggleBtnActive: {
    backgroundColor: '#0080FF',
    borderColor: '#0080FF',
  },
  hour24Btn: {
    height: 54,
    gap: 1,
  },
  hour24Label: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: 10,
    color: Colors.onSurface,
  },
  hour24LabelActive: {
    color: Colors.onPrimary,
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
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: Colors.onSurfaceVariant,
  },
  chipLabelActive: {
    color: Colors.onPrimary,
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
    borderColor: Colors.surfaceContainerLowest,
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
    borderColor: Colors.primary,
  },
  partnerDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.surfaceContainerLowest,
  },

  // FAB
  fab: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: Colors.primary,
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
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '40',
  },
  cardPhoto: {
    width: '32%',
    minHeight: 130,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.primary,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  partnerBadgeText: {
    fontFamily: FontFamily.headlineBold,
    fontSize: 9,
    color: Colors.onPrimary,
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
    color: Colors.onSurface,
  },
  cardName: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurface,
    marginBottom: 2,
  },
  cardMeta: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: Colors.onSurfaceVariant,
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
    backgroundColor: Colors.primary,
    paddingVertical: 9,
    borderRadius: 10,
  },
  btnMapsText: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: Colors.onPrimary,
  },
  btnClose: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Partner card ──────────────────────────────────────────────
  partnerCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '30',
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
    backgroundColor: Colors.surfaceContainerLowest + 'CC',
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
    backgroundColor: Colors.primary,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  heroPartnerText: {
    fontFamily: FontFamily.headlineBold,
    fontSize: 10,
    color: Colors.onPrimary,
  },
  heroRatingBadge: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.surfaceContainerLowest + 'E6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  heroRatingText: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.labelMD,
    color: Colors.onSurface,
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
    color: Colors.onSurface,
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
    color: Colors.onSurfaceVariant,
  },
  partnerStatDivider: {
    width: 1,
    height: 12,
    backgroundColor: Colors.outlineVariant,
  },
  partnerDesc: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: Colors.onSurfaceVariant,
    lineHeight: 20,
  },
  tagsScroll: {
    flexGrow: 0,
  },
  tag: {
    backgroundColor: Colors.surfaceContainerHigh,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    marginRight: 6,
  },
  tagText: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: Colors.onSurfaceVariant,
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
    borderColor: Colors.primary,
    paddingVertical: 9,
    borderRadius: 10,
  },
  btnCallText: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: Colors.primary,
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
    backgroundColor: '#E53935',
  },
  fabCareGuide: {
    backgroundColor: '#006000',
  },
  fabBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.onPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#E53935',
  },
  fabBadgeText: {
    fontFamily: FontFamily.headlineBold,
    fontSize: 10,
    color: '#E53935',
  },

  // Heart buttons on cards
  cardHeartBtn: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceContainerLowest + 'CC',
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
    backgroundColor: Colors.surfaceContainerLowest + 'CC',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Favorites sheet
  favSheet: {
    backgroundColor: Colors.surfaceContainerLowest,
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
    backgroundColor: Colors.outlineVariant,
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
    borderBottomColor: Colors.surfaceVariant,
  },
  favTitle: {
    flex: 1,
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurface,
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
    color: Colors.onSurfaceVariant,
  },
  favEmptyHint: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: Colors.outline,
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
    borderBottomColor: Colors.surfaceVariant + '80',
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
    color: Colors.onSurface,
  },
  favItemMeta: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: Colors.onSurfaceVariant,
  },
  favCount: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: Colors.outline,
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
    backgroundColor: Colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  favChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  favChipLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: Colors.onSurfaceVariant,
  },
  favChipLabelActive: {
    color: Colors.onPrimary,
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
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.onPrimary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  clusterText: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.bodyMD,
    color: Colors.onPrimary,
  },
});
