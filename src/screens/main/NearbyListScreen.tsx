import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ScrollView, Linking, ActivityIndicator, Image,
} from 'react-native';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { getNearbyPlaces, getMapFavorites, addMapFavorite, removeMapFavorite, ApiPlace } from '../../api';
import { BASE_URL } from '../../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlaceCategory = 'vet' | 'grooming' | 'petstore' | 'hotel' | 'park' | 'restaurant';
type FilterOption = 'all' | 'favorites' | PlaceCategory;

interface ListPlace extends ApiPlace {
  category: PlaceCategory;
  distanceM: number;
  todayHours?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<PlaceCategory, {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  bgColor: string;
  iconColor: string;
}> = {
  vet:        { icon: 'local-hospital', label: '醫院',   bgColor: '#FFDAD6', iconColor: '#BA1A1A' },
  grooming:   { icon: 'content-cut',    label: '美容',   bgColor: '#E8DEF8', iconColor: '#6750A4' },
  petstore:   { icon: 'shopping-bag',   label: '用品店', bgColor: '#FFDCC5', iconColor: '#602E00' },
  hotel:      { icon: 'pets',           label: '旅館',   bgColor: '#D3E4CD', iconColor: '#2D6A4F' },
  park:       { icon: 'local-florist',  label: '公園',   bgColor: '#CCE8C4', iconColor: '#4A6549' },
  restaurant: { icon: 'restaurant',     label: '餐廳',   bgColor: '#FFF9C4', iconColor: '#F9A825' },
};

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
}: {
  place: ListPlace;
  isFav: boolean;
  onToggleFavorite: () => void;
}) {
  const cfg = CATEGORY_CONFIG[place.category];

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
        {place.photoRef ? (
          <Image
            source={{ uri: `${BASE_URL}/map/photo?ref=${place.photoRef}&maxwidth=80` }}
            style={styles.photo}
          />
        ) : (
          <MaterialIcons name={cfg.icon} size={24} color={cfg.iconColor} />
        )}
      </View>

      {/* 內容 */}
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={styles.name} numberOfLines={1}>{place.name}</Text>
          <View style={styles.distBadge}>
            <Text style={styles.distText}>{formatDistance(place.distanceM)}</Text>
          </View>
        </View>

        <View style={styles.tagRow}>
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
              <MaterialIcons name="phone" size={12} color={Colors.primary} />
              <Text style={[styles.metaText, { color: Colors.primary }]}>{place.phone}</Text>
            </TouchableOpacity>
          ) : null}
          {place.todayHours ? (
            <View style={styles.metaItem}>
              <MaterialIcons name="access-time" size={12} color={Colors.onSurfaceVariant} />
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
            color={isFav ? '#E53935' : Colors.outline}
          />
        </TouchableOpacity>
        <MaterialIcons name="chevron-right" size={20} color={Colors.outline} />
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
  const insets = useSafeAreaInsets();
  const [places, setPlaces] = useState<ListPlace[]>([]);
  const [favoritePlaces, setFavoritePlaces] = useState<ListPlace[]>([]);
  const [localFavIds, setLocalFavIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);

  const effectiveFavIds = favoriteIds ?? localFavIds;

  // 取得定位，只跑一次
  useEffect(() => {
    async function getLocation() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLoc({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } else {
        setUserLoc({ lat: 25.0330, lng: 121.5654 });
      }
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
    async function fetchPlaces() {
      setLoading(true);
      try {
        const apiType = FILTER_TO_API_TYPE[activeFilter];
        const res = await getNearbyPlaces(userLoc!.lat, userLoc!.lng, apiType, 20000);
        if (res.success && res.data) {
          const mapped: ListPlace[] = res.data.map((p) => ({
            ...p,
            category: (TYPE_TO_CATEGORY[p.type] ?? 'petstore') as PlaceCategory,
            distanceM: haversineM(userLoc!.lat, userLoc!.lng, p.lat, p.lng),
            todayHours: todayHours(p.weekdayHours),
          }));
          mapped.sort((a, b) => a.distanceM - b.distanceM);
          setPlaces(mapped);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchPlaces();
  }, [userLoc, activeFilter]);

  // 切換到「最愛」時從 API 取完整收藏清單
  useEffect(() => {
    if (activeFilter !== 'favorites') return;
    setLoading(true);
    getMapFavorites()
      .then(res => {
        if (res.success) {
          const mapped: ListPlace[] = res.data.map(p => ({
            ...p,
            category: (TYPE_TO_CATEGORY[p.type] ?? 'petstore') as PlaceCategory,
            distanceM: userLoc ? haversineM(userLoc.lat, userLoc.lng, p.lat, p.lng) : 0,
            todayHours: todayHours(p.weekdayHours),
          }));
          if (userLoc) mapped.sort((a, b) => a.distanceM - b.distanceM);
          setFavoritePlaces(mapped);
          if (favoriteIds === undefined) setLocalFavIds(new Set(mapped.map(p => String(p.id))));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
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
        <MaterialIcons name="search" size={20} color={Colors.onSurfaceVariant} />
        <TextInput
          style={styles.searchInput}
          placeholder="搜尋附近地點..."
          placeholderTextColor={Colors.outline}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <MaterialIcons name="close" size={18} color={Colors.outline} />
          </TouchableOpacity>
        )}
        {onSwitchToMap && (
          <TouchableOpacity
            style={styles.mapToggleBtn}
            onPress={onSwitchToMap}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons name="map" size={20} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* 分類篩選 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {FILTERS.map((f) => {
          const isActive = activeFilter === f.key;
          const isFavFilter = f.key === 'favorites';
          const cfg = (!isFavFilter && f.key !== 'all') ? CATEGORY_CONFIG[f.key as PlaceCategory] : null;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => setActiveFilter(f.key)}
            >
              {isFavFilter ? (
                <MaterialIcons
                  name={isActive ? 'favorite' : 'favorite-border'}
                  size={16}
                  color={isActive ? Colors.onSecondary : '#E53935'}
                />
              ) : cfg ? (
                <MaterialIcons
                  name={cfg.icon}
                  size={16}
                  color={isActive ? Colors.onSecondary : Colors.onSurfaceVariant}
                />
              ) : null}
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
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
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
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
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons
                name={activeFilter === 'favorites' ? 'favorite-border' : 'search-off'}
                size={48}
                color={Colors.outline}
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
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: 28, paddingHorizontal: 14, paddingVertical: 10,
  },
  mapToggleBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center', justifyContent: 'center',
  },
  searchInput: {
    flex: 1, fontFamily: FontFamily.bodyMedium, fontSize: FontSize.bodyMD,
    color: Colors.onSurface, padding: 0,
  },

  filterScroll: { flexGrow: 0, flexShrink: 0, marginTop: 12 },
  filterContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1.5, borderColor: Colors.outline,
  },
  chipActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  chipText: { fontFamily: FontFamily.headlineMedium, fontSize: FontSize.labelMD, color: Colors.onSurfaceVariant },
  chipTextActive: { color: Colors.onSecondary, fontFamily: FontFamily.headlineBold },

  noticeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 16, marginTop: 10,
    backgroundColor: '#FFF8E1',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    borderLeftWidth: 3, borderLeftColor: '#F9A825',
  },
  noticeText: {
    flex: 1, fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelSM,
    color: '#7A5800',
  },

  resultCount: {
    fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelSM,
    color: Colors.onSurfaceVariant,
    marginHorizontal: 16, marginTop: 10, marginBottom: 4,
  },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.surfaceContainerLowest,
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
    fontSize: FontSize.bodyMD, color: Colors.onSurface,
  },
  distBadge: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
  },
  distText: { fontFamily: FontFamily.bodyMedium, fontSize: 11, color: Colors.onSurfaceVariant },

  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  catTag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  catTagText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontFamily: FontFamily.bodyMedium, fontSize: 11, color: Colors.onSurfaceVariant },

  address: {
    fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelSM,
    color: Colors.onSurfaceVariant,
  },

  metaRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: FontFamily.bodyMedium, fontSize: 11, color: Colors.onSurfaceVariant },

  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heartBtn: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
  },

  separator: { height: 1, backgroundColor: Colors.surfaceVariant, marginLeft: 80 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.bodyMD, color: Colors.onSurfaceVariant },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.bodyMD, color: Colors.outline },
  emptyHint: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelSM, color: Colors.outlineVariant },
});
