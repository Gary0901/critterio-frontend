import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Dimensions,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, LineHeight } from '../../constants/typography';
import { getDiaryEntries, addDiaryEntry } from '../../api';
import { DiaryEntry } from '../../types';

const { width } = Dimensions.get('window');
const DATE_ITEM_W = 62;

// ─── Mood config ─────────────────────────────────────────────────────────────
const MOODS = [
  { id: 'happy',   emoji: '😊', label: '開心' },
  { id: 'playful', emoji: '🐾', label: '好動' },
  { id: 'sunny',   emoji: '☀️', label: '精神好' },
  { id: 'sleepy',  emoji: '😴', label: '懶洋洋' },
  { id: 'unwell',  emoji: '🤒', label: '不舒服' },
];

// ─── Date helpers ─────────────────────────────────────────────────────────────
const DAY_SHORT = ['日', '一', '二', '三', '四', '五', '六'];

function generateRecentDates(): string[] {
  const today = new Date();
  const result: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    result.push(d.toISOString().split('T')[0]);
  }
  return result;
}

function dayName(dateStr: string) {
  return DAY_SHORT[new Date(dateStr).getDay()];
}

function dateNum(dateStr: string) {
  return new Date(dateStr).getDate();
}

function monthLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('zh-TW', { month: 'long' });
}

// ─── Types ───────────────────────────────────────────────────────────────────
type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
  route: RouteProp<RootStackParamList, 'DailyLog'>;
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function DailyLogScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { petId, petName } = route.params;

  const today = new Date().toISOString().split('T')[0];
  const dates = generateRecentDates();

  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [note, setNote] = useState('');
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [justSavedPhoto, setJustSavedPhoto] = useState<string | null>(null);

  const stripRef = useRef<FlatList>(null);

  const selectedEntry = entries.find((e) => e.date === selectedDate);
  const entryDates = new Set(entries.map((e) => e.date));
  const isToday = selectedDate === today;

  useEffect(() => {
    getDiaryEntries(petId).then((res) => {
      if (res.success) setEntries(res.data);
    });
  }, [petId]);

  // Scroll date strip to today on mount
  useEffect(() => {
    const idx = dates.indexOf(today);
    if (idx >= 0) {
      setTimeout(() => {
        stripRef.current?.scrollToIndex({ index: idx, viewPosition: 0.5, animated: false });
      }, 100);
    }
  }, []);

  const toggleMood = (id: string) =>
    setSelectedMoods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('需要相簿權限', '請在設定中允許存取相簿');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!note.trim() && !photoUri) {
      Alert.alert('請輸入內容', '至少需要新增照片或文字記錄');
      return;
    }
    setSaving(true);
    const photo = photoUri
      ? { uri: photoUri, name: `log_${Date.now()}.jpg`, type: 'image/jpeg' }
      : undefined;
    const res = await addDiaryEntry(petId, {
      content: note.trim() || '今日日誌',
      date: today,
      mood: selectedMoods,
      photo,
    });
    setSaving(false);
    if (res.success) {
      setEntries((prev) => [res.data, ...prev]);
      setNote('');
      setSelectedMoods([]);
      setJustSaved(true);
      setJustSavedPhoto(photoUri);
      setPhotoUri(null);
    } else {
      Alert.alert('儲存失敗', res.message || '請稍後再試');
    }
  };

  const handleShareToCommunity = () => {
    const sharePhoto = justSavedPhoto
      ? { uri: justSavedPhoto, name: `diary_${Date.now()}.jpg`, type: 'image/jpeg' }
      : undefined;
    setJustSaved(false);
    setJustSavedPhoto(null);
    navigation.navigate('MainTabs', { screen: 'Community', params: { sharePhoto, sharePetName: petName } } as any);
  };

  // ── Date strip item ────────────────────────────────────────────────────────
  const renderDateItem = ({ item }: { item: string }) => {
    const active = item === selectedDate;
    const hasEntry = entryDates.has(item);
    return (
      <TouchableOpacity
        style={styles.dateItem}
        onPress={() => setSelectedDate(item)}
        activeOpacity={0.75}
      >
        <Text style={[styles.dayName, active && styles.dayNameActive]}>
          {dayName(item)}
        </Text>
        <View style={[styles.datePill, active && styles.datePillActive]}>
          <Text style={[styles.dateNum, active && styles.dateNumActive]}>
            {dateNum(item)}
          </Text>
        </View>
        {hasEntry && <View style={[styles.entryDot, active && styles.entryDotActive]} />}
        {!hasEntry && <View style={styles.entryDotPlaceholder} />}
      </TouchableOpacity>
    );
  };

  const diaryPhoto = selectedEntry
    ? (selectedEntry.photos?.[0] ?? { url: selectedEntry.photoUrl, time: '' })
    : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{monthLabel(selectedDate)}日誌</Text>
        <View style={styles.iconBtn} />
      </View>

      {/* Date strip — fixed, does not scroll with content */}
      <FlatList
        ref={stripRef}
        data={dates}
        keyExtractor={(d) => d}
        renderItem={renderDateItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateStrip}
        getItemLayout={(_, index) => ({
          length: DATE_ITEM_W,
          offset: DATE_ITEM_W * index,
          index,
        })}
        onScrollToIndexFailed={() => {}}
        style={styles.dateStripWrap}
      />

      {/* Scrollable content */}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {selectedEntry && diaryPhoto ? (
          /* ── Diary view (has entry) ── */
          <>
            <Text style={styles.sectionLabel}>今日一拍</Text>
            <View style={styles.snapWrap}>
              <Image source={{ uri: diaryPhoto.url }} style={styles.snapPhoto} resizeMode="cover" />
              {!!diaryPhoto.time && (
                <View style={styles.snapTimeBadge}>
                  <Text style={styles.snapTime}>{diaryPhoto.time}</Text>
                </View>
              )}
            </View>

            <View style={styles.diaryCard}>
              <View style={styles.diaryHandle} />
              <View style={styles.diaryCardHead}>
                <Text style={styles.entryNum}>記錄 #{selectedEntry.entryNumber ?? '—'}</Text>
              </View>
              {!!selectedEntry.title && <Text style={styles.diaryTitle}>{selectedEntry.title}</Text>}
              {selectedEntry.mood && selectedEntry.mood.length > 0 && (
                <View style={styles.moodRow}>
                  <Text style={styles.moodLabel}>心情</Text>
                  {selectedEntry.mood.map((id) => {
                    const m = MOODS.find((x) => x.id === id);
                    return m ? <Text key={id} style={styles.moodEmoji}>{m.emoji}</Text> : null;
                  })}
                </View>
              )}
              {!!selectedEntry.note && <Text style={styles.diaryNote}>{selectedEntry.note}</Text>}
              {selectedEntry.hashtags && selectedEntry.hashtags.length > 0 && (
                <View style={styles.hashtagRow}>
                  {selectedEntry.hashtags.map((tag) => (
                    <View key={tag} style={styles.hashtagChip}>
                      <Text style={styles.hashtagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.shareEntryBtn}
              activeOpacity={0.8}
              onPress={() => {
                const photo = selectedEntry.photoUrl
                  ? { uri: selectedEntry.photoUrl, name: `diary_${Date.now()}.jpg`, type: 'image/jpeg' }
                  : undefined;
                navigation.navigate('MainTabs', { screen: 'Community', params: { sharePhoto: photo, sharePetName: petName } } as any);
              }}
            >
              <MaterialIcons name="people" size={18} color={Colors.primary} />
              <Text style={styles.shareEntryBtnLabel}>分享到社群</Text>
            </TouchableOpacity>
          </>
        ) : isToday ? (
          /* ── Add entry view (today, no entry) ── */
          <>
            <TouchableOpacity style={styles.addPhotoCard} activeOpacity={0.82} onPress={pickPhoto}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.previewPhoto} resizeMode="cover" />
              ) : (
                <>
                  <View style={styles.cameraCircle}>
                    <MaterialIcons name="photo-camera" size={34} color={Colors.outline} />
                  </View>
                  <Text style={styles.addPhotoTitle}>新增今日照片</Text>
                  <Text style={styles.addPhotoSub}>記錄與 {petName} 的精彩時光</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.noteCard}>
              <MaterialIcons name="edit-note" size={20} color={Colors.outline} style={{ marginTop: 2 }} />
              <TextInput
                style={styles.noteInput}
                placeholder="記錄今天的故事…（選填）"
                placeholderTextColor={Colors.outlineVariant}
                value={note}
                onChangeText={setNote}
                multiline
              />
            </View>

            <View style={styles.moodSection}>
              <Text style={styles.moodSectionLabel}>{petName} 今天狀況如何？</Text>
              <View style={styles.moodPicker}>
                {MOODS.map((m) => {
                  const on = selectedMoods.includes(m.id);
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.moodChip, on && styles.moodChipOn]}
                      onPress={() => toggleMood(m.id)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.moodChipEmoji}>{m.emoji}</Text>
                      <Text style={[styles.moodChipLabel, on && styles.moodChipLabelOn]}>{m.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity style={styles.saveBtn} activeOpacity={0.85} onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator color={Colors.onPrimary} />
                : <Text style={styles.saveBtnLabel}>儲存今日日誌</Text>
              }
            </TouchableOpacity>

            {justSaved && (
              <View style={styles.shareCard}>
                <View style={styles.shareCardLeft}>
                  <MaterialIcons name="check-circle" size={18} color={Colors.primary} />
                  <Text style={styles.shareCardText}>今日日誌已記錄！</Text>
                </View>
                <TouchableOpacity style={styles.shareBtn} onPress={handleShareToCommunity} activeOpacity={0.8}>
                  <MaterialIcons name="people" size={15} color={Colors.onPrimary} />
                  <Text style={styles.shareBtnLabel}>分享到社群</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          /* ── Empty past day ── */
          <View style={styles.emptyWrap}>
            <MaterialIcons name="photo-album" size={40} color={Colors.outlineVariant} />
            <Text style={styles.emptyText}>這天沒有日誌紀錄</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineMD,
    color: Colors.onSurface,
    marginLeft: 4,
  },

  // Date strip
  dateStripWrap: {
    marginHorizontal: Math.round(width * 0.05),
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceVariant,
  },
  dateStrip: { paddingVertical: 12 },
  dateItem: {
    width: DATE_ITEM_W,
    alignItems: 'center',
    gap: 4,
  },
  dayName: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: Colors.onSurfaceVariant,
  },
  dayNameActive: { color: Colors.primary },
  datePill: {
    width: 40,
    height: 44,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePillActive: { backgroundColor: Colors.primary },
  dateNum: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: Colors.onSurface,
  },
  dateNumActive: { color: Colors.onPrimary },
  entryDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.primaryContainer,
  },
  entryDotActive: { backgroundColor: Colors.onPrimary },
  entryDotPlaceholder: { width: 5, height: 5 },

  // Content
  content: { paddingHorizontal: 20, paddingBottom: 48, paddingTop: 20 },

  // Section label
  sectionLabel: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.bodyLG,
    color: Colors.onSurface,
    marginBottom: 12,
  },

  // Daily Snap
  snapWrap: {
    width: '100%',
    height: Math.round((width - 40) * 0.75), // 4:3 ratio
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  snapPhoto: { width: '100%', height: '100%' },
  snapTimeBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  snapTime: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: '#fff',
  },

  // Diary card
  diaryCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 24,
    padding: 20,
    gap: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  diaryHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.outlineVariant,
    alignSelf: 'center',
    marginBottom: 4,
  },
  diaryCardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryNum: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: Colors.onSurfaceVariant,
    letterSpacing: 1,
  },

  diaryTitle: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineMD,
    color: Colors.onSurface,
    lineHeight: LineHeight.headlineMD,
  },
  moodRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  moodLabel: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.labelSM,
    color: Colors.onSurfaceVariant,
    letterSpacing: 1,
  },
  moodEmoji: { fontSize: 20 },
  diaryNote: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurface,
    lineHeight: LineHeight.bodyMD,
  },
  hashtagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hashtagChip: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  hashtagText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: Colors.onSurfaceVariant,
  },

  // Add photo
  addPhotoCard: {
    height: 200,
    borderRadius: 20,
    backgroundColor: Colors.surfaceContainerHigh,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  cameraCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  previewPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  addPhotoTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurface,
  },
  addPhotoSub: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: Colors.onSurfaceVariant,
  },

  // Note input
  noteCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceVariant,
    padding: 14,
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  noteInput: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurface,
    minHeight: 72,
  },

  // Mood selector
  moodSection: { marginBottom: 20 },
  moodSectionLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurface,
    marginBottom: 12,
  },
  moodPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: Colors.surfaceContainerHigh,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  moodChipOn: {
    backgroundColor: Colors.primaryFixed,
    borderColor: Colors.primary,
  },
  moodChipEmoji: { fontSize: 16 },
  moodChipLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: Colors.onSurfaceVariant,
  },
  moodChipLabelOn: { color: Colors.onPrimaryContainer },

  // Save
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 9999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: Colors.onPrimary,
  },

  // Share on existing entry
  shareEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 9999,
    paddingVertical: 12,
    marginTop: 4,
  },
  shareEntryBtnLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: Colors.primary,
  },

  // Share card
  shareCard: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primaryFixed,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  shareCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareCardText: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: Colors.primary,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primary,
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  shareBtnLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: Colors.onPrimary,
  },

  // Empty
  emptyWrap: {
    marginTop: 60,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurfaceVariant,
  },
});
