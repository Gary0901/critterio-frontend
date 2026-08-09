import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  Modal,
  Animated,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg';
import { RootStackParamList } from '../../types/navigation';
import Card from '../../components/ui/Card';
import Chip from '../../components/ui/Chip';
import Badge from '../../components/ui/Badge';
import { ThemeColors } from '../../constants/themes';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { PET_COLOR_COUNT, petColorAt } from '../../constants/petColors';
import { FontFamily, FontSize } from '../../constants/typography';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPets, getWeightLogs, addWeightLog, updatePetData, deletePet as apiDeletePet, getDiaryEntries, getAiCare, updateCareTargets, AiCareResult } from '../../api';
import { Pet, WeightLog, DiaryEntry } from '../../types';

const LOCAL_PET_PHOTOS: Record<string, any> = {
  p1: require('../../../photo/mypets/mypets1.jpg'),
  p2: require('../../../photo/mypets/mypets2.jpg'),
  p3: require('../../../photo/mypets/mypets3.jpg'),
};

const CHART_H_INSET = 72;        // card inner width = 視窗寬 - 這個值
const POINT_SPACING = 64;        // px between each weekly point
const PAD_X = 24;
const DATA_TOP = 22;
const DATA_BOTTOM = 92;
const DATA_H = DATA_BOTTOM - DATA_TOP;
const SVG_H = DATA_BOTTOM + 24;

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
  route: RouteProp<RootStackParamList, 'PetDetail'>;
};

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const cx = ((pts[i - 1].x + pts[i].x) / 2).toFixed(1);
    d += ` C ${cx} ${pts[i - 1].y.toFixed(1)}, ${cx} ${pts[i].y.toFixed(1)}, ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
  }
  return d;
}

function speciesEmoji(species: string) {
  if (species === 'dog') return '🐶';
  if (species === 'cat') return '🐱';
  if (species === 'rabbit') return '🐰';
  if (species === 'small') return '🐹';
  if (species === 'bird') return '🐦';
  if (species === 'reptile') return '🦎';
  return '🐾';
}

type CareCategory = 'food' | 'activity' | 'medicine' | 'environment' | 'other';

type CareItem = {
  id: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  target: string;
  bgColor: string;
  iconColor: string;
  category: string;
};

const makeCategoryConfigCare = (
  c: ThemeColors,
): Record<CareCategory, { icon: keyof typeof MaterialIcons.glyphMap; bgColor: string; iconColor: string; label: string }> => ({
  food:        { icon: 'restaurant',       bgColor: c.surfaceContainerHigh, iconColor: c.onSurfaceVariant, label: '飲食' },
  activity:    { icon: 'directions-run',   bgColor: c.primaryFixed,         iconColor: c.primary,          label: '活動' },
  medicine:    { icon: 'medical-services', bgColor: c.secondaryContainer,   iconColor: c.onSurfaceVariant, label: '藥品' },
  environment: { icon: 'thermostat',       bgColor: c.secondaryContainer,   iconColor: c.secondary,        label: '環境' },
  other:       { icon: 'event-note',       bgColor: c.surfaceContainerHigh, iconColor: c.onSurfaceVariant, label: '其他' },
});

const INITIAL_CARE_ITEMS: CareItem[] = [];

const INITIAL_AI_SUGGESTIONS: CareItem[] = [];

export default function PetDetailScreen({ navigation, route }: Props) {
  const { colors, theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { petId } = route.params;
  const today = new Date().toISOString().split('T')[0];
  const [pet, setPet] = useState<Pet | null>(null);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [todayEntry, setTodayEntry] = useState<DiaryEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const checkedKey = `care_checked_${petId}_${today}`;
  const toggleCheck = async (id: string) => {
    setChecked(prev => {
      const next = { ...prev, [id]: !prev[id] };
      AsyncStorage.setItem(checkedKey, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };
  const [activeItems, setActiveItems] = useState<CareItem[]>(INITIAL_CARE_ITEMS);
  const [aiSuggestions, setAiSuggestions] = useState<CareItem[]>(INITIAL_AI_SUGGESTIONS);
  const [aiCareResult, setAiCareResult] = useState<AiCareResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAiSuggestions, setShowAiSuggestions] = useState(true);
  const autoCollapsed = useRef(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<CareCategory>('activity');

  useEffect(() => {
    if (activeItems.length > 0 && !autoCollapsed.current) {
      autoCollapsed.current = true;
      setShowAiSuggestions(false);
    }
  }, [activeItems.length]);

  const syncCareTargets = (items: CareItem[]) => {
    updateCareTargets(petId, items.map((item) => ({
      label: item.label,
      target: item.target,
      category: item.category,
    })));
  };

  const addFromSuggestion = (item: CareItem) => {
    const next = [...activeItems, item];
    setActiveItems(next);
    setAiSuggestions(prev => prev.filter(s => s.id !== item.id));
    syncCareTargets(next);
  };

  const saveCustomItem = () => {
    if (!newItemName.trim()) return;
    const cfg = makeCategoryConfigCare(colors)[newItemCategory];
    const next = [...activeItems, {
      id: `custom_${Date.now()}`,
      icon: cfg.icon,
      label: newItemName.trim(),
      target: cfg.label,
      bgColor: cfg.bgColor,
      iconColor: cfg.iconColor,
      category: newItemCategory,
    }];
    setActiveItems(next);
    syncCareTargets(next);
    setNewItemName('');
    setNewItemCategory('activity');
    setShowAddModal(false);
  };

  const [sheetVisible, setSheetVisible] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'g'>('kg');
  const [heightInput, setHeightInput] = useState('');
  const [recordError, setRecordError] = useState('');
  const slideAnim = useRef(new Animated.Value(500)).current;

  // Edit info sheet
  const [editSheetVisible, setEditSheetVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBreed, setEditBreed] = useState('');
  // 需要全部寵物才知道哪些顏色被佔走了
  const [allPets, setAllPets] = useState<Pet[]>([]);
  const [editColor, setEditColor] = useState<number | null>(null);
  const [editBirthYear, setEditBirthYear] = useState('');
  const [editBirthMonth, setEditBirthMonth] = useState('');
  const [editBirthDay, setEditBirthDay] = useState('');
  const [editJoinYear, setEditJoinYear] = useState('');
  const [editJoinMonth, setEditJoinMonth] = useState('');
  const [editJoinDay, setEditJoinDay] = useState('');
  const [editError, setEditError] = useState('');
  const editSlideAnim = useRef(new Animated.Value(500)).current;

  const clampMonth = (v: string) => {
    const n = parseInt(v, 10);
    if (isNaN(n)) return v;
    if (n < 1) return '1';
    if (n > 12) return '12';
    return v;
  };
  const clampDay = (v: string) => {
    const n = parseInt(v, 10);
    if (isNaN(n)) return v;
    if (n < 1) return '1';
    if (n > 31) return '31';
    return v;
  };

  const [photoUploading, setPhotoUploading] = useState(false);

  const pickPetPhoto = async () => {
    if (!pet || LOCAL_PET_PHOTOS[pet.id]) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('權限不足', '請允許存取相片庫以更換照片。');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      // iOS 會忽略 aspect（裁切框一律正方形），但 Android 吃這個設定，
      // 讓它跟 PetCard 的 16:9 對齊，Android 上就是所見即所得
      aspect: [16, 9],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPhotoUploading(true);
    try {
      const res = await updatePetData(petId, {
        photo: { uri: asset.uri, name: asset.fileName ?? 'photo.jpg', type: asset.mimeType ?? 'image/jpeg' },
      });
      if (res.success) {
        setPet((prev) => prev ? { ...prev, ...res.data } : prev);
      } else {
        Alert.alert('上傳失敗', res.message || '請稍後再試');
      }
    } catch {
      Alert.alert('上傳失敗', '請稍後再試');
    } finally {
      setPhotoUploading(false);
    }
  };

  const openEditSheet = () => {
    if (!pet) return;
    setEditError('');
    setEditName(pet.name);
    setEditBreed(pet.breed ?? '');
    setEditColor(pet.color ?? null);
    const bParts = pet.birthday ? pet.birthday.slice(0, 10).split('-') : ['', '', ''];
    setEditBirthYear(bParts[0]); setEditBirthMonth(bParts[1]); setEditBirthDay(bParts[2]);
    const jParts = pet.joinedAt ? pet.joinedAt.slice(0, 10).split('-') : ['', '', ''];
    setEditJoinYear(jParts[0]); setEditJoinMonth(jParts[1]); setEditJoinDay(jParts[2]);
    setEditSheetVisible(true);
    Animated.spring(editSlideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 150 }).start();
  };

  const closeEditSheet = () => {
    Animated.timing(editSlideAnim, { toValue: 500, duration: 240, useNativeDriver: true })
      .start(() => setEditSheetVisible(false));
  };

  const validateDate = (year: string, month: string, day: string, label: string): string | null => {
    if (!year && !month && !day) return null; // all empty = optional, OK
    if (!year || !month || !day) return `${label}：年、月、日請填完整或全部清空`;
    const y = parseInt(year, 10), m = parseInt(month, 10), d = parseInt(day, 10);
    if (isNaN(y) || y < 1900 || y > new Date().getFullYear()) return `${label}：年份不合理`;
    if (isNaN(m) || m < 1 || m > 12) return `${label}：月份須在 1–12 之間`;
    if (isNaN(d) || d < 1 || d > 31) return `${label}：日期須在 1–31 之間`;
    return null;
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;
    const birthErr = validateDate(editBirthYear, editBirthMonth, editBirthDay, '生日');
    const joinErr  = validateDate(editJoinYear,  editJoinMonth,  editJoinDay,  '加入家庭日');
    if (birthErr || joinErr) { setEditError((birthErr ?? joinErr)!); return; }
    setEditError('');
    setSaving(true);
    try {
      const updates: Parameters<typeof updatePetData>[1] = { name: editName.trim(), breed: editBreed.trim() };
      if (editColor !== null && editColor !== pet?.color) updates.color = editColor;
      if (editBirthYear && editBirthMonth && editBirthDay)
        updates.birthday = `${editBirthYear}-${editBirthMonth.padStart(2,'0')}-${editBirthDay.padStart(2,'0')}`;
      if (editJoinYear && editJoinMonth && editJoinDay)
        updates.joinedFamilyAt = `${editJoinYear}-${editJoinMonth.padStart(2,'0')}-${editJoinDay.padStart(2,'0')}`;
      const res = await updatePetData(petId, updates);
      if (res.success) {
        setPet((prev) => prev ? { ...prev, ...res.data } : prev);
        closeEditSheet();
      } else {
        setEditError(res.message || '儲存失敗，請再試一次');
      }
    } catch {
      setEditError('網路錯誤，請再試一次');
    } finally {
      setSaving(false);
    }
  };

  const [deletingPet, setDeletingPet] = useState(false);

  const handleDeletePet = () => {
    if (!pet) return;
    Alert.alert(
      '刪除寵物檔案',
      `此操作無法復原，${pet.name} 的所有資料（體重紀錄、每日日誌、行事曆事件）都會被永久刪除。確定要刪除嗎？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '確定刪除',
          style: 'destructive',
          onPress: async () => {
            setDeletingPet(true);
            const res = await apiDeletePet(petId);
            setDeletingPet(false);
            if (res.success) {
              navigation.goBack();
            } else {
              Alert.alert('刪除失敗', '請稍後再試');
            }
          },
        },
      ]
    );
  };

  const openSheet = () => {
    const defaultUnit: 'kg' | 'g' =
      pet && (pet.species === 'bird' || pet.species === 'reptile' || pet.species === 'small') ? 'g' : 'kg';
    setWeightUnit(defaultUnit);
    setWeightInput(
      pet ? (defaultUnit === 'g' ? String(Math.round(pet.weightKg * 1000)) : String(pet.weightKg)) : ''
    );
    setHeightInput(pet && pet.heightCm > 0 ? String(pet.heightCm) : '');
    setRecordError('');
    setSheetVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 150,
    }).start();
  };

  const toggleWeightUnit = () => {
    setWeightUnit((prevUnit) => {
      const nextUnit = prevUnit === 'kg' ? 'g' : 'kg';
      const current = parseFloat(weightInput);
      if (!isNaN(current)) {
        setWeightInput(
          nextUnit === 'g' ? String(Math.round(current * 1000)) : String(Math.round((current / 1000) * 1000) / 1000)
        );
      }
      return nextUnit;
    });
  };

  const closeSheet = () => {
    Animated.timing(slideAnim, {
      toValue: 500,
      duration: 240,
      useNativeDriver: true,
    }).start(() => setSheetVisible(false));
  };

  const handleSaveRecord = async () => {
    const enteredWeight = parseFloat(weightInput);
    const kg = weightUnit === 'g' ? enteredWeight / 1000 : enteredWeight;
    const cm = parseFloat(heightInput);
    const hasWeight = weightInput.trim() !== '' && !isNaN(kg) && kg > 0;
    const hasHeight = heightInput.trim() !== '' && !isNaN(cm) && cm > 0;
    if (!hasWeight && !hasHeight) return;
    setRecordError('');
    if (hasWeight && (kg < 0.01 || kg > 200)) {
      setRecordError(
        weightUnit === 'g' ? '體重請輸入 10–200000 g 的合理範圍' : '體重請輸入 0.01–200 kg 的合理範圍'
      );
      return;
    }
    if (hasHeight && (cm < 0.5 || cm > 300)) {
      setRecordError('身高請輸入 0.5–300 cm 的合理範圍');
      return;
    }
    setSaving(true);
    const tasks: Promise<any>[] = [];
    if (hasWeight) tasks.push(addWeightLog(petId, kg));
    if (hasHeight) tasks.push(updatePetData(petId, { heightCm: cm }));
    const results = await Promise.all(tasks);
    setSaving(false);
    let taskIdx = 0;
    if (hasWeight) {
      const res = results[taskIdx++];
      if (res.success) {
        setPet((prev) => prev ? { ...prev, weightKg: kg } : prev);
        setWeightLogs((prev) => [res.data, ...prev]);
      }
    }
    if (hasHeight) {
      const res = results[taskIdx++];
      if (res.success) {
        setPet((prev) => prev ? { ...prev, heightCm: cm } : prev);
      }
    }
    closeSheet();
  };

  const CATEGORY_ICON: Record<string, keyof typeof MaterialIcons.glyphMap> = {
    activity:    'directions-run',
    food:        'restaurant',
    grooming:    'content-cut',
    play:        'sports-esports',
    health:      'medical-services',
    environment: 'thermostat',
    other:       'event-note',
  };
  const CATEGORY_BG: Record<string, string> = {
    activity:    colors.primaryFixed,
    food:        colors.surfaceContainerHigh,
    grooming:    colors.surfaceContainerHigh,
    play:        colors.primaryFixed,
    health:      colors.secondaryContainer,
    environment: colors.secondaryContainer,
    other:       colors.surfaceContainerHigh,
  };
  const CATEGORY_COLOR: Record<string, string> = {
    activity:    colors.primary,
    food:        colors.onSurfaceVariant,
    grooming:    colors.onSurfaceVariant,
    play:        colors.primary,
    health:      colors.onSurfaceVariant,
    environment: colors.secondary,
    other:       colors.onSurfaceVariant,
  };

  useEffect(() => {
    getPets().then((res) => {
      if (res.success) {
        setAllPets(res.data);
        const found = res.data.find((p) => p.id === petId) ?? null;
        setPet(found);
        if (found?.careTargets && found.careTargets.length > 0) {
          setActiveItems(found.careTargets.map((ct, i) => ({
            id: `saved_${i}`,
            icon: CATEGORY_ICON[ct.category] ?? 'event-note',
            label: ct.label,
            target: ct.target,
            bgColor: CATEGORY_BG[ct.category] ?? colors.surfaceContainerHigh,
            iconColor: CATEGORY_COLOR[ct.category] ?? colors.onSurfaceVariant,
            category: ct.category,
          })));
        }
      }
    }).catch(() => {});
    getWeightLogs(petId).then((res) => {
      if (res.success) setWeightLogs(res.data);
    }).catch(() => {});
    getDiaryEntries(petId).then((res) => {
      if (res.success) setTodayEntry(res.data.find((e) => e.date === today) ?? null);
    }).catch(() => {});
    AsyncStorage.getItem(`care_checked_${petId}_${today}`)
      .then((v) => { if (v) setChecked(JSON.parse(v)); })
      .catch(() => {});
    loadAiCare(petId, today, false);
  }, [petId, today]);

  async function loadAiCare(id: string, date: string, forceRefresh: boolean) {
    const cacheKey = `ai_care_v3_${id}_${date}`;
    if (!forceRefresh) {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          applyAiCareResult(JSON.parse(cached) as AiCareResult);
          return;
        }
      } catch {}
    }
    setAiLoading(true);
    try {
      const res = await getAiCare(id);
      if (res.success) {
        applyAiCareResult(res.data);
        try { await AsyncStorage.setItem(cacheKey, JSON.stringify(res.data)); } catch {}
      } else if (res.message) {
        Alert.alert('AI 照護建議', res.message);
      }
    } catch {
      // 網路或伺服器錯誤時保持原本的建議清單，不整頁報錯
    } finally {
      setAiLoading(false);
    }
  }

  function applyAiCareResult(data: AiCareResult) {
    setAiCareResult(data);
    setAiSuggestions(
      data.suggestions.map((s, i) => ({
        id: `ai_${i}`,
        icon: CATEGORY_ICON[s.category] ?? 'event-note',
        label: s.label,
        target: s.target,
        bgColor: CATEGORY_BG[s.category] ?? colors.surfaceContainerHigh,
        iconColor: CATEGORY_COLOR[s.category] ?? colors.onSurfaceVariant,
        category: s.category,
      }))
    );
  }

  // Aggregate weight logs by week (keep latest per week), newest-first from API
  const weeklyLogs = (() => {
    const grouped: Record<string, WeightLog> = {};
    for (const log of weightLogs) {
      const d = new Date(log.recordedAt);
      const day = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      const key = monday.toISOString().split('T')[0];
      if (!grouped[key]) grouped[key] = log; // first = latest (array is newest-first)
    }
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, log]) => {
        const d = new Date(key);
        return { ...log, weekLabel: `${d.getMonth() + 1}/${d.getDate()}` };
      });
  })();

  // Build SVG chart points — fixed spacing per week so chart can scroll horizontally
  const chartSvgW = Math.max(width - CHART_H_INSET, PAD_X * 2 + (weeklyLogs.length - 1) * POINT_SPACING);
  const chartPoints = (() => {
    if (weeklyLogs.length < 2) return [];
    const weights = weeklyLogs.map((l) => l.weightKg);
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const range = max - min || 1;
    return weeklyLogs.map((l, i) => ({
      x: PAD_X + i * POINT_SPACING,
      y: DATA_BOTTOM - ((l.weightKg - min) / range) * DATA_H,
      weight: l.weightKg,
      month: l.weekLabel,
    }));
  })();

  if (!pet) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{pet.name}</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Pet info card ── */}
        <Card style={styles.infoCard}>
          <TouchableOpacity style={styles.editInfoBtn} onPress={openEditSheet} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="edit" size={16} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
          <View style={styles.infoRow}>
            <TouchableOpacity
              style={styles.avatarWrap}
              onPress={pickPetPhoto}
              activeOpacity={LOCAL_PET_PHOTOS[pet.id] ? 1 : 0.75}
              disabled={photoUploading}
            >
              {LOCAL_PET_PHOTOS[pet.id] ? (
                <Image source={LOCAL_PET_PHOTOS[pet.id]} style={styles.avatar} />
              ) : pet.photoUrl ? (
                <Image source={{ uri: pet.photoUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarEmpty]}>
                  <Text style={styles.avatarEmoji}>{speciesEmoji(pet.species)}</Text>
                </View>
              )}
              {photoUploading && (
                <View style={[styles.avatar, styles.avatarUploadingOverlay]}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
              {!LOCAL_PET_PHOTOS[pet.id] && !photoUploading && (
                <View style={styles.avatarEditBadge}>
                  <MaterialIcons name="photo-camera" size={12} color={colors.onPrimary} />
                </View>
              )}
              <View style={styles.pawBadge}>
                <MaterialIcons name="pets" size={11} color={colors.primary} />
              </View>
            </TouchableOpacity>
            <View style={styles.infoRight}>
              <Text style={styles.petName}>{pet.name}</Text>
              <Text style={styles.petSub}>{pet.age} 歲 • {pet.breed}</Text>
              {(pet.birthday || pet.joinedAt) && (
                <View style={styles.petMetaRow}>
                  {pet.birthday && (
                    <Text style={styles.petMeta}>
                      🎂 {pet.birthday.slice(0, 10).replace(/-/g, '/')}
                    </Text>
                  )}
                  {pet.joinedAt && (
                    <Text style={styles.petMeta}>
                      🏠 {pet.joinedAt.slice(0, 10).replace(/-/g, '/')}
                    </Text>
                  )}
                </View>
              )}
              <View style={{ marginTop: 4 }}>
                <Badge status={pet.status} label={pet.statusLabel} />
              </View>
              <View style={styles.chips}>
                {pet.traits.map((t) => <Chip key={t} label={t} />)}
              </View>
            </View>
          </View>
        </Card>

        {/* ── Today's Log card ── */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => navigation.navigate('DailyLog', { petId: pet.id, petName: pet.name })}
        >
          {todayEntry ? (
            <Card style={styles.logCardDone}>
              {todayEntry.photoUrl ? (
                <Image source={{ uri: todayEntry.photoUrl }} style={styles.logThumbDone} />
              ) : (
                <View style={[styles.logThumbDone, styles.logThumbEmpty]}>
                  <MaterialIcons name="pets" size={22} color={colors.primary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={styles.logDoneRow}>
                  <MaterialIcons name="check-circle" size={15} color={colors.primary} />
                  <Text style={styles.logDoneLabel}>今日已完成</Text>
                </View>
                <Text style={styles.logDoneSub} numberOfLines={1}>
                  點擊觀看更多與 {pet.name} 的回憶
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
            </Card>
          ) : (
            <Card style={styles.logCard}>
              <View style={styles.logLeft}>
                <View style={[styles.logThumb, styles.logThumbEmpty]}>
                  <MaterialIcons name="photo-camera" size={22} color={colors.outline} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.logTitle}>今日日誌</Text>
                  <Text style={styles.logSub}>記錄今天的精彩時刻</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.outline} />
            </Card>
          )}
        </TouchableOpacity>

        {/* ── Vet visits entry card ── */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => navigation.navigate('VetVisits', { petId: pet.id, petName: pet.name })}
        >
          <Card style={styles.logCard}>
            <View style={styles.logLeft}>
              <View style={[styles.logThumb, styles.logThumbEmpty]}>
                <MaterialIcons name="description" size={22} color={colors.outline} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.logTitle}>就醫紀錄</Text>
                <Text style={styles.logSub}>記錄看診內容、用藥與檢驗報告</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.outline} />
          </Card>
        </TouchableOpacity>

        {/* ── AI Daily Care card ── */}
        <Card style={styles.card}>
          <View style={styles.careHeader}>
            <View style={styles.careHeaderLeft}>
              <MaterialIcons name="auto-awesome" size={16} color={colors.primary} />
              <Text style={styles.careTitle}>每日照護</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[styles.careAddBtn, { backgroundColor: showAiSuggestions ? colors.primaryFixed : colors.surfaceContainerHigh }]}
                onPress={() => setShowAiSuggestions(v => !v)}
              >
                <MaterialIcons name="auto-awesome" size={15} color={showAiSuggestions ? colors.primary : colors.outlineVariant} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.careAddBtn} onPress={() => setShowAddModal(true)}>
                <MaterialIcons name="add" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Active items */}
          {activeItems.map((item) => {
            const done = !!checked[item.id];
            return (
              <TouchableOpacity key={item.id} style={styles.careRow} onPress={() => toggleCheck(item.id)} activeOpacity={0.75}>
                <View style={[styles.pawCheck, done && styles.pawCheckDone]}>
                  {done && <MaterialIcons name="pets" size={13} color={colors.onPrimary} />}
                </View>
                <View style={[styles.careIconCircle, { backgroundColor: item.bgColor }]}>
                  <MaterialIcons name={item.icon} size={16} color={item.iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.careLabel, done && styles.careLabelDone]}>{item.label}</Text>
                  <Text style={styles.careTarget}>{item.target}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    const next = activeItems.filter(i => i.id !== item.id);
                    setActiveItems(next);
                    syncCareTargets(next);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="delete-outline" size={18} color={colors.outlineVariant} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}

          {/* AI suggestions */}
          {showAiSuggestions && (
            <>
              <View style={styles.careDivider} />
              <View style={styles.suggestionHeader}>
                <MaterialIcons name="auto-awesome" size={13} color={colors.primary} />
                <Text style={styles.suggestionHeaderText}>AI 推薦</Text>
                <TouchableOpacity onPress={() => setShowAiSuggestions(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <MaterialIcons name="close" size={16} color={colors.outlineVariant} />
                </TouchableOpacity>
              </View>
              {aiLoading ? (
                <Text style={styles.noteText}>AI 正在分析你的寵物資料...</Text>
              ) : (
                <>
                  {aiCareResult?.healthNote && (
                    <Text style={[styles.noteText, { marginBottom: 4 }]}>💡 {aiCareResult.healthNote}</Text>
                  )}
                  {aiSuggestions.filter(s => !activeItems.some(a => a.label === s.label)).map((item) => (
                    <View key={item.id} style={styles.suggestionRow}>
                      <View style={[styles.careIconCircle, { backgroundColor: item.bgColor, opacity: 0.6 }]}>
                        <MaterialIcons name={item.icon} size={16} color={item.iconColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.suggestionLabel}>{item.label}</Text>
                        <Text style={styles.careTarget}>{item.target}</Text>
                      </View>
                      <TouchableOpacity style={styles.suggestionAddBtn} onPress={() => addFromSuggestion(item)}>
                        <MaterialIcons name="add" size={18} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}
            </>
          )}
        </Card>

        {/* ── Weight card ── */}
        <Card style={styles.card}>
          <View style={styles.cardHead}>
            <View>
              <Text style={styles.cardLabel}>目前體重</Text>
              <Text style={styles.bigNum}>
                {pet.weightKg}{' '}
                <Text style={styles.unit}>kg</Text>
              </Text>
              {aiCareResult && (
                <Text style={styles.idealRange}>
                  理想範圍 {aiCareResult.idealWeightMin}–{aiCareResult.idealWeightMax} kg
                </Text>
              )}
            </View>
            <View style={styles.iconCircle}>
              <MaterialIcons name="show-chart" size={20} color={colors.primary} />
            </View>
          </View>

          {chartPoints.length >= 2 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled
              contentContainerStyle={{ paddingRight: 8 }}
              ref={(ref) => ref?.scrollToEnd({ animated: false })}
            >
              <Svg width={chartSvgW} height={SVG_H}>
                {[0.3, 0.65].map((t) => (
                  <Path
                    key={t}
                    d={`M ${PAD_X} ${(DATA_TOP + t * DATA_H).toFixed(1)} H ${chartSvgW - PAD_X}`}
                    stroke={colors.surfaceVariant}
                    strokeWidth={1}
                    strokeDasharray="4 3"
                  />
                ))}
                <Path
                  d={smoothPath(chartPoints)}
                  stroke={colors.primary}
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {chartPoints.map((p, i) => (
                  <React.Fragment key={i}>
                    <Circle cx={p.x} cy={p.y} r={5} fill={colors.primary} />
                    <Circle cx={p.x} cy={p.y} r={2.5} fill={colors.surfaceContainerLowest} />
                    <SvgText
                      x={p.x}
                      y={p.y - 10}
                      textAnchor={i === 0 ? 'start' : i === chartPoints.length - 1 ? 'end' : 'middle'}
                      fontSize={9.5}
                      fill={colors.onSurface}
                    >
                      {p.weight}
                    </SvgText>
                    <SvgText
                      x={p.x}
                      y={DATA_BOTTOM + 18}
                      textAnchor={i === 0 ? 'start' : i === chartPoints.length - 1 ? 'end' : 'middle'}
                      fontSize={10}
                      fill={colors.onSurfaceVariant}
                    >
                      {p.month}
                    </SvgText>
                  </React.Fragment>
                ))}
              </Svg>
            </ScrollView>
          ) : (
            <Text style={styles.noteText}>新增兩週以上記錄後即可看到體重趨勢圖</Text>
          )}
        </Card>

        {/* ── Height card（爬蟲類沒有「身高」概念，不顯示） ── */}
        {pet.species !== 'reptile' && (
          <Card style={styles.card}>
            <View style={styles.cardHead}>
              <View>
                <Text style={styles.cardLabel}>身高</Text>
                <Text style={styles.bigNum}>
                  {pet.heightCm > 0 ? pet.heightCm : '—'}{' '}
                  {pet.heightCm > 0 && <Text style={styles.unit}>cm</Text>}
                </Text>
                {aiCareResult && (
                  <Text style={styles.idealRange}>
                    理想範圍 {aiCareResult.idealHeightMin}–{aiCareResult.idealHeightMax} cm
                  </Text>
                )}
              </View>
              <View style={[styles.iconCircle, { backgroundColor: colors.secondaryContainer }]}>
                <MaterialIcons name="straighten" size={20} color={colors.secondary} />
              </View>
            </View>
            {pet.heightCm === 0 && (
              <Text style={styles.noteText}>點「新增記錄」輸入身高</Text>
            )}
          </Card>
        )}

        {/* ── Log vitals button ── */}
        <TouchableOpacity style={styles.logBtn} activeOpacity={0.85} onPress={openSheet}>
          <MaterialIcons name="add-circle-outline" size={20} color={colors.onPrimary} />
          <Text style={styles.logBtnLabel}>新增記錄</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Add Care Item Modal ── */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowAddModal(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>新增照護項目</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>項目名稱</Text>
              <View style={[styles.inputWrap, { paddingVertical: 12 }]}>
                <TextInput
                  style={[styles.inputField, { fontSize: FontSize.bodyMD }]}
                  value={newItemName}
                  onChangeText={setNewItemName}
                  placeholder="例：洗澡、服藥..."
                  placeholderTextColor={colors.outline}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>類別</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(Object.entries(makeCategoryConfigCare(colors)) as [CareCategory, ReturnType<typeof makeCategoryConfigCare>[CareCategory]][]).map(([key, cfg]) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.catChip, newItemCategory === key && styles.catChipActive]}
                    onPress={() => setNewItemCategory(key)}
                  >
                    <MaterialIcons name={cfg.icon} size={14} color={newItemCategory === key ? colors.onPrimary : colors.onSurfaceVariant} />
                    <Text style={[styles.catChipLabel, newItemCategory === key && styles.catChipLabelActive]}>{cfg.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, !newItemName.trim() && { backgroundColor: colors.outlineVariant }]}
              onPress={saveCustomItem}
              disabled={!newItemName.trim()}
            >
              <Text style={styles.saveBtnLabel}>加入照護清單</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Log Entry Bottom Sheet ── */}
      {/* ── Edit Info Sheet ── */}
      <Modal visible={editSheetVisible} transparent animationType="none" onRequestClose={closeEditSheet}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeEditSheet} />
          <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 24, transform: [{ translateY: editSlideAnim }] }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>編輯基本資料</Text>

            {/* Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>名字</Text>
              <View style={[styles.inputWrap, { paddingVertical: 12 }]}>
                <MaterialIcons name="pets" size={18} color={colors.onSurfaceVariant} />
                <TextInput
                  style={[styles.inputField, { fontSize: FontSize.bodyLG }]}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="寵物名字"
                  placeholderTextColor={colors.outline}
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Breed */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>品種</Text>
              <View style={[styles.inputWrap, { paddingVertical: 12 }]}>
                <MaterialIcons name="category" size={18} color={colors.onSurfaceVariant} />
                <TextInput
                  style={[styles.inputField, { fontSize: FontSize.bodyLG }]}
                  value={editBreed}
                  onChangeText={setEditBreed}
                  placeholder="品種（可空白）"
                  placeholderTextColor={colors.outline}
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* 識別色 */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>識別色</Text>
              <Text style={styles.colorHint}>用於寵物卡片下緣與行事曆標籤，每隻寵物不能重複</Text>
              <View style={styles.colorRow}>
                {Array.from({ length: PET_COLOR_COUNT }, (_, i) => {
                  const takenBy = allPets.find((p) => p.id !== petId && p.color === i);
                  const picked = editColor === i;
                  return (
                    <TouchableOpacity
                      key={i}
                      onPress={() => !takenBy && setEditColor(i)}
                      disabled={!!takenBy}
                      activeOpacity={0.75}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: picked, disabled: !!takenBy }}
                      accessibilityLabel={takenBy ? `此顏色已是 ${takenBy.name} 的` : `識別色 ${i + 1}`}
                      style={[styles.colorDotWrap, picked && { borderColor: colors.primary }]}
                    >
                      <View
                        style={[
                          styles.colorDot,
                          { backgroundColor: petColorAt(i, theme.key) },
                          !!takenBy && styles.colorDotTaken,
                        ]}
                      />
                      {!!takenBy && (
                        <MaterialIcons name="block" size={16} color={colors.onSurface} style={styles.colorDotBlock} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Birthday */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>生日（可空白）</Text>
              <View style={styles.dateRow}>
                <TextInput
                  style={styles.dateInput}
                  value={editBirthYear}
                  onChangeText={setEditBirthYear}
                  placeholder="年"
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholderTextColor={colors.outline}
                />
                <Text style={styles.dateSep}>/</Text>
                <TextInput
                  style={styles.dateInputSm}
                  value={editBirthMonth}
                  onChangeText={setEditBirthMonth}
                  onBlur={() => setEditBirthMonth(v => clampMonth(v))}
                  placeholder="月"
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholderTextColor={colors.outline}
                />
                <Text style={styles.dateSep}>/</Text>
                <TextInput
                  style={styles.dateInputSm}
                  value={editBirthDay}
                  onChangeText={setEditBirthDay}
                  onBlur={() => setEditBirthDay(v => clampDay(v))}
                  placeholder="日"
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholderTextColor={colors.outline}
                />
              </View>
            </View>

            {/* Joined family */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>加入家庭日（可空白）</Text>
              <View style={styles.dateRow}>
                <TextInput
                  style={styles.dateInput}
                  value={editJoinYear}
                  onChangeText={setEditJoinYear}
                  placeholder="年"
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholderTextColor={colors.outline}
                />
                <Text style={styles.dateSep}>/</Text>
                <TextInput
                  style={styles.dateInputSm}
                  value={editJoinMonth}
                  onChangeText={setEditJoinMonth}
                  onBlur={() => setEditJoinMonth(v => clampMonth(v))}
                  placeholder="月"
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholderTextColor={colors.outline}
                />
                <Text style={styles.dateSep}>/</Text>
                <TextInput
                  style={styles.dateInputSm}
                  value={editJoinDay}
                  onChangeText={setEditJoinDay}
                  onBlur={() => setEditJoinDay(v => clampDay(v))}
                  placeholder="日"
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholderTextColor={colors.outline}
                />
              </View>
            </View>

            {editError ? (
              <Text style={{ color: colors.error, fontSize: FontSize.labelSM, fontFamily: FontFamily.bodyMedium }}>
                {editError}
              </Text>
            ) : null}

            <TouchableOpacity
              style={[styles.saveBtn, (!editName.trim() || saving) && { opacity: 0.5 }]}
              activeOpacity={0.85}
              onPress={handleSaveEdit}
              disabled={!editName.trim() || saving}
            >
              <Text style={styles.saveBtnLabel}>{saving ? '儲存中...' : '儲存'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.deletePetBtn, deletingPet && { opacity: 0.5 }]}
              activeOpacity={0.75}
              onPress={handleDeletePet}
              disabled={deletingPet}
            >
              <MaterialIcons name="delete-outline" size={16} color={colors.error} />
              <Text style={styles.deletePetBtnLabel}>{deletingPet ? '刪除中...' : '刪除寵物檔案'}</Text>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={sheetVisible} transparent animationType="none" onRequestClose={closeSheet}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeSheet} />
          <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 24, transform: [{ translateY: slideAnim }] }]}>
            {/* Handle */}
            <View style={styles.sheetHandle} />

            {/* Title */}
            <Text style={styles.sheetTitle}>新增記錄 · {pet.name}</Text>

            {/* Weight */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>體重</Text>
              <View style={styles.inputWrap}>
                <MaterialIcons name="show-chart" size={20} color={colors.onSurfaceVariant} />
                <TextInput
                  style={styles.inputField}
                  value={weightInput}
                  onChangeText={setWeightInput}
                  placeholder={pet ? String(pet.weightKg) : '0.0'}
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.outline}
                  returnKeyType="next"
                />
                <TouchableOpacity onPress={toggleWeightUnit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={[styles.inputSuffix, styles.inputSuffixToggle]}>{weightUnit}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Height（爬蟲類沒有「身高」概念，不顯示） */}
            {pet.species !== 'reptile' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>身高</Text>
                <View style={styles.inputWrap}>
                  <MaterialIcons name="straighten" size={20} color={colors.onSurfaceVariant} />
                  <TextInput
                    style={styles.inputField}
                    value={heightInput}
                    onChangeText={setHeightInput}
                    placeholder={pet && pet.heightCm > 0 ? String(pet.heightCm) : '0'}
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.outline}
                    returnKeyType="done"
                    onSubmitEditing={handleSaveRecord}
                  />
                  <Text style={styles.inputSuffix}>cm</Text>
                </View>
              </View>
            )}

            {/* Error */}
            {recordError !== '' && (
              <Text style={styles.recordErrorText}>{recordError}</Text>
            )}

            {/* Save */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              activeOpacity={0.85}
              onPress={handleSaveRecord}
              disabled={saving}
            >
              <Text style={styles.saveBtnLabel}>{saving ? '儲存中...' : '儲存記錄'}</Text>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  colorHint: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
    marginBottom: 10,
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDotWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    // 未選中時邊框透明而非不畫，否則選中時尺寸會跳動
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotTaken: { opacity: 0.28 },
  colorDotBlock: { position: 'absolute' },
  container: { flex: 1, backgroundColor: c.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: c.onSurface,
  },

  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },

  // Pet info
  infoCard: {},
  infoRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: c.primaryContainer,
  },
  avatarEmpty: {
    backgroundColor: c.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 36 },
  avatarUploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: c.surfaceContainerLowest,
  },
  pawBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: c.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: c.surfaceContainerLowest,
  },
  infoRight: { flex: 1, gap: 2 },
  petName: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineMD,
    color: c.onSurface,
  },
  petSub: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
  },
  petMetaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 2,
  },
  petMeta: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },

  // Card shared
  card: { gap: 12 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
    marginBottom: 2,
  },
  cardTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
  },
  bigNum: {
    fontFamily: FontFamily.headlineBold,
    fontSize: 40,
    color: c.onSurface,
    lineHeight: 48,
  },
  unit: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.bodyLG },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Height
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
  },
  progressPct: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: c.onSurface,
  },
  noteText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
    lineHeight: 22,
  },
  idealRange: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: c.primary,
    marginTop: 2,
  },

  // AI Daily Care
  careHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  careHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  careTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
  },
  aiBadge: {
    backgroundColor: c.primaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  aiBadgeText: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: 11,
    color: c.onPrimaryContainer,
  },
  careRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 2,
  },
  pawCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: c.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pawCheckDone: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  careIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  careLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
  },
  careLabelDone: {
    color: c.outline,
    textDecorationLine: 'line-through' as const,
  },
  careTarget: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
    marginTop: 1,
  },
  careDivider: {
    height: 1,
    backgroundColor: c.surfaceContainerHigh,
    marginVertical: 4,
  },
  aiSuggest: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  aiSuggestText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
    lineHeight: 20,
    fontStyle: 'italic' as const,
  },

  // Today's Log
  logCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logCardDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.primaryFixed,
  },
  logLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  logThumb: { width: 56, height: 56, borderRadius: 12 },
  logThumbDone: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  logThumbEmpty: {
    backgroundColor: c.surfaceContainerHigh,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  logTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
  },
  logSub: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
    marginTop: 2,
  },
  logDoneRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  logDoneLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.primary,
  },
  logDoneSub: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: c.onPrimaryContainer,
    marginTop: 2,
  },

  // Bottom sheet
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: c.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 20,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.outline,
    alignSelf: 'center',
    marginBottom: 4,
  },
  sheetTitle: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineMD,
    color: c.onSurface,
  },
  inputGroup: { gap: 8 },
  inputLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surfaceContainerHigh,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  inputField: {
    flex: 1,
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: 28,
    color: c.onSurface,
    padding: 0,
  },
  inputSuffix: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyLG,
    color: c.onSurfaceVariant,
  },
  inputSuffixToggle: {
    color: c.primary,
    fontFamily: FontFamily.headlineSemiBold,
    textDecorationLine: 'underline',
  },
  saveBtn: {
    backgroundColor: c.primary,
    borderRadius: 9999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.onPrimary,
  },
  deletePetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  deletePetBtnLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.bodyMD,
    color: c.error,
  },
  recordErrorText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: c.error,
    marginBottom: 8,
    textAlign: 'center',
  },

  // Care add button
  careAddBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: c.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // AI suggestion section header
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  suggestionHeaderText: {
    flex: 1,
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: c.primary,
  },

  // AI suggestion row
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 2,
    opacity: 0.8,
  },
  suggestionLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
  },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: c.primaryContainer,
    backgroundColor: c.primaryFixed,
  },
  aiTagText: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: 10,
    color: c.primary,
  },
  suggestionAddBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Category chips in modal
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: c.outlineVariant,
    backgroundColor: c.surface,
  },
  catChipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  catChipLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
  },
  catChipLabelActive: { color: c.onPrimary },

  // Edit info button
  editInfoBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 6,
    zIndex: 1,
  },

  // Date inputs in edit sheet
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surfaceContainerHigh,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  dateInput: {
    flex: 2,
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: c.onSurface,
    padding: 0,
    textAlign: 'center',
  },
  dateInputSm: {
    flex: 1,
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: c.onSurface,
    padding: 0,
    textAlign: 'center',
  },
  dateSep: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyLG,
    color: c.onSurfaceVariant,
  },

  // CTA button
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: c.primary,
    borderRadius: 9999,
    paddingVertical: 16,
    marginTop: 4,
  },
  logBtnLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.onPrimary,
  },
});
