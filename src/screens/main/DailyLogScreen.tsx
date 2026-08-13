import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActionSheetIOS,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../../types/navigation';
import { ThemeColors } from '../../constants/themes';
import { compressForUpload } from '../../utils/compressImage';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { FontFamily, FontSize, LineHeight } from '../../constants/typography';
import { getDiaryEntries, addDiaryEntry } from '../../api';
import { DiaryEntry } from '../../types';

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

function toDateStr(d: Date): string { return d.toISOString().split('T')[0]; }

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - d.getDay());
  return toDateStr(d);
}

function getWeekDates(weekStartStr: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStartStr);
    d.setDate(d.getDate() + i);
    return toDateStr(d);
  });
}

function getMonthCells(year: number, month: number): (string | null)[] {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function buildWeekLabel(weekStartStr: string): string {
  const start = new Date(weekStartStr);
  const end = new Date(weekStartStr);
  end.setDate(start.getDate() + 6);
  const sm = start.getMonth() + 1, sd = start.getDate();
  const em = end.getMonth() + 1, ed = end.getDate();
  return sm === em ? `${sm}月 ${sd}–${ed}日` : `${sm}月${sd}日 – ${em}月${ed}日`;
}

function dayName(dateStr: string) { return DAY_SHORT[new Date(dateStr).getDay()]; }
function dateNum(dateStr: string) { return new Date(dateStr).getDate(); }
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
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { petId, petName } = route.params;

  const today = new Date().toISOString().split('T')[0];

  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [note, setNote] = useState('');
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [justSavedPhoto, setJustSavedPhoto] = useState<string | null>(null);

  // ── Calendar view state ──
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());

  const todayWeekStart = getWeekStart(today);
  const canNextWeek = weekStart < todayWeekStart;
  const canNextMonth = calYear < new Date().getFullYear() || calMonth < new Date().getMonth();
  const weekDates = getWeekDates(weekStart);
  const monthCells = getMonthCells(calYear, calMonth);
  const DOW_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(toDateStr(d)); };
  const nextWeek = () => { if (!canNextWeek) return; const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(toDateStr(d)); };
  const prevMonth = () => { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1); };
  const nextMonth = () => { if (!canNextMonth) return; if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1); };
  const toggleViewMode = () => {
    if (viewMode === 'week') {
      const d = new Date(selectedDate);
      setCalYear(d.getFullYear()); setCalMonth(d.getMonth());
      setViewMode('month');
    } else {
      setWeekStart(getWeekStart(selectedDate));
      setViewMode('week');
    }
  };

  const selectedEntry = entries.find((e) => e.date === selectedDate);
  const entryDates = new Set(entries.map((e) => e.date));
  const isToday = selectedDate === today;

  useEffect(() => {
    getDiaryEntries(petId).then((res) => {
      if (res.success) setEntries(res.data);
    });
  }, [petId]);


  const toggleMood = (id: string) =>
    setSelectedMoods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );

  const launchLibrary = async () => {
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
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const launchCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('需要相機權限', '請在設定中允許存取相機');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const pickPhoto = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['取消', '拍照', '從相簿選取'], cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 1) launchCamera();
          else if (idx === 2) launchLibrary();
        }
      );
    } else {
      Alert.alert('新增照片', '', [
        { text: '取消', style: 'cancel' },
        { text: '拍照', onPress: launchCamera },
        { text: '從相簿選取', onPress: launchLibrary },
      ]);
    }
  };

  const handleSave = async () => {
    if (!note.trim() && !photoUri) {
      Alert.alert('請輸入內容', '至少需要新增照片或文字記錄');
      return;
    }
    setSaving(true);
    const photo = photoUri
      ? await compressForUpload({ uri: photoUri, name: `log_${Date.now()}.jpg`, type: 'image/jpeg' })
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


  const diaryPhoto = selectedEntry
    ? (selectedEntry.photos?.[0] ?? { url: selectedEntry.photoUrl, time: '' })
    : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{monthLabel(selectedDate)}日誌</Text>
        <View style={styles.iconBtn} />
      </View>

      {/* Date picker — week / month toggle */}
      <View style={styles.calendarWrap}>
        {/* Nav row */}
        <View style={styles.calNavRow}>
          <TouchableOpacity style={styles.calNavBtn} onPress={viewMode === 'week' ? prevWeek : prevMonth}>
            <MaterialIcons name="chevron-left" size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.calNavLabel}>
            {viewMode === 'week' ? buildWeekLabel(weekStart) : `${calYear} 年 ${calMonth + 1} 月`}
          </Text>
          <TouchableOpacity
            style={styles.calNavBtn}
            onPress={viewMode === 'week' ? nextWeek : nextMonth}
            disabled={viewMode === 'week' ? !canNextWeek : !canNextMonth}
          >
            <MaterialIcons
              name="chevron-right"
              size={22}
              color={(viewMode === 'week' ? canNextWeek : canNextMonth) ? colors.onSurface : colors.outlineVariant}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.calToggleBtn} onPress={toggleViewMode}>
            <MaterialIcons
              name={viewMode === 'week' ? 'calendar-month' : 'view-week'}
              size={18}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>

        {viewMode === 'week' ? (
          /* ── Week strip ── */
          <View style={styles.weekRow}>
            {weekDates.map((d) => {
              const active = d === selectedDate;
              const hasEntry = entryDates.has(d);
              return (
                <TouchableOpacity key={d} style={styles.weekDateItem} onPress={() => setSelectedDate(d)} activeOpacity={0.75}>
                  <Text style={[styles.dayName, active && styles.dayNameActive]}>{dayName(d)}</Text>
                  <View style={[styles.datePill, active && styles.datePillActive]}>
                    <Text style={[styles.dateNum, active && styles.dateNumActive]}>{dateNum(d)}</Text>
                  </View>
                  {hasEntry ? <View style={[styles.entryDot, active && styles.entryDotActive]} /> : <View style={styles.entryDotPlaceholder} />}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          /* ── Month grid ── */
          <>
            <View style={styles.dowRow}>
              {DOW_LABELS.map((l) => <Text key={l} style={styles.dowLabel}>{l}</Text>)}
            </View>
            <View style={styles.monthGrid}>
              {monthCells.map((d, i) => {
                if (!d) return <View key={`e${i}`} style={styles.monthCell} />;
                const active = d === selectedDate;
                const hasEntry = entryDates.has(d);
                const isFuture = d > today;
                return (
                  <TouchableOpacity
                    key={d}
                    style={styles.monthCell}
                    onPress={() => { if (!isFuture) setSelectedDate(d); }}
                    activeOpacity={0.75}
                    disabled={isFuture}
                  >
                    <View style={[styles.monthDatePill, active && styles.monthDatePillActive]}>
                      <Text style={[styles.monthDateNum, active && styles.monthDateNumActive, isFuture && styles.monthDateFuture]}>
                        {new Date(d).getDate()}
                      </Text>
                    </View>
                    {hasEntry
                      ? <View style={[styles.monthEntryDot, active && styles.monthEntryDotActive]} />
                      : <View style={styles.monthEntryDotPlaceholder} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </View>

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
              <Image source={{ uri: diaryPhoto.url }} style={styles.snapPhoto} resizeMode="contain" />
              {/* 底部漸層遮罩：照片下緣壓一層暗色，時間與心情才不會浮在亮處看不清 */}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.55)']}
                style={styles.snapScrim}
                pointerEvents="none"
              />
              <View style={styles.snapFooter}>
                {!!diaryPhoto.time && <Text style={styles.snapTime}>{diaryPhoto.time}</Text>}
                {selectedEntry.mood && selectedEntry.mood.length > 0 && (
                  <Text style={styles.snapMood}>
                    {selectedEntry.mood
                      .map((id) => MOODS.find((x) => x.id === id)?.emoji)
                      .filter(Boolean)
                      .join(' ')}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.diaryCard}>
              <View style={styles.diaryHandle} />
              <View style={styles.diaryCardHead}>
                <Text style={styles.entryNum}>記錄 #{selectedEntry.entryNumber ?? '—'}</Text>
              </View>
              {!!selectedEntry.title && <Text style={styles.diaryTitle}>{selectedEntry.title}</Text>}
              {/* 心情已經顯示在照片下緣，這裡不再重複 */}
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
              <MaterialIcons name="people" size={18} color={colors.primary} />
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
                  {/* 品牌色漸層取代原本的灰底，空狀態才不會像「壞掉的區塊」 */}
                  <LinearGradient
                    colors={[colors.primaryFixed, colors.surfaceContainerHigh]}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                  />
                  <View style={styles.cameraCircle}>
                    <MaterialIcons name="photo-camera" size={34} color={colors.primary} />
                  </View>
                  <Text style={styles.addPhotoTitle}>新增今日照片</Text>
                  <Text style={styles.addPhotoSub}>記錄與 {petName} 的精彩時光</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.noteCard}>
              <MaterialIcons name="edit-note" size={20} color={colors.outline} style={{ marginTop: 2 }} />
              <TextInput
                style={styles.noteInput}
                placeholder="記錄今天的故事…（選填）"
                placeholderTextColor={colors.outlineVariant}
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
                ? <ActivityIndicator color={colors.onPrimary} />
                : <Text style={styles.saveBtnLabel}>儲存今日日誌</Text>
              }
            </TouchableOpacity>

            {justSaved && (
              <View style={styles.shareCard}>
                <View style={styles.shareCardLeft}>
                  <MaterialIcons name="check-circle" size={18} color={colors.primary} />
                  <Text style={styles.shareCardText}>今日日誌已記錄！</Text>
                </View>
                <TouchableOpacity style={styles.shareBtn} onPress={handleShareToCommunity} activeOpacity={0.8}>
                  <MaterialIcons name="people" size={15} color={colors.onPrimary} />
                  <Text style={styles.shareBtnLabel}>分享到社群</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          /* ── Empty past day ── */
          <View style={styles.emptyWrap}>
            <MaterialIcons name="photo-album" size={40} color={colors.outlineVariant} />
            <Text style={styles.emptyText}>這天沒有日誌紀錄</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },

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
    color: c.onSurface,
    marginLeft: 4,
  },

  // ── Calendar ──
  calendarWrap: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceVariant,
  },
  calNavRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  calNavBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  calNavLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
  },
  calToggleBtn: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.primaryFixed,
  },
  // Week strip
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  weekDateItem: { flex: 1, alignItems: 'center', gap: 4 },
  dayName: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
  },
  dayNameActive: { color: c.primary },
  datePill: {
    width: 36, height: 40, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  datePillActive: { backgroundColor: c.primary },
  dateNum: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: c.onSurface,
  },
  dateNumActive: { color: c.onPrimary },
  entryDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: c.primaryContainer },
  entryDotActive: { backgroundColor: c.onPrimary },
  entryDotPlaceholder: { width: 5, height: 5 },
  // Month grid
  dowRow: { flexDirection: 'row', marginBottom: 2 },
  dowLabel: {
    flex: 1, textAlign: 'center',
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
  },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  monthCell: { width: `${(100 / 7).toFixed(4)}%` as any, alignItems: 'center', paddingVertical: 3 },
  monthDatePill: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  monthDatePillActive: { backgroundColor: c.primary },
  monthDateNum: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurface,
  },
  monthDateNumActive: { color: c.onPrimary },
  monthDateFuture: { color: c.outline },
  monthEntryDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: c.primaryContainer },
  monthEntryDotActive: { backgroundColor: c.onPrimary },
  monthEntryDotPlaceholder: { width: 4, height: 4 },

  // Content
  content: { paddingHorizontal: 20, paddingBottom: 48, paddingTop: 20 },

  // Section label
  sectionLabel: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.bodyLG,
    color: c.onSurface,
    marginBottom: 12,
  },

  // Daily Snap
  snapWrap: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#111',
  },
  snapPhoto: { width: '100%', height: '100%' },
  snapScrim: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: 88,
  },
  snapFooter: {
    position: 'absolute',
    left: 14, right: 14, bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  snapMood: { fontSize: 20 },
  snapTime: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: '#fff',
  },

  // Diary card
  diaryCard: {
    backgroundColor: c.surfaceContainerLowest,
    borderRadius: 24,
    padding: 20,
    gap: 12,
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  diaryHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.outlineVariant,
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
    color: c.onSurfaceVariant,
    letterSpacing: 1,
  },

  diaryTitle: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineMD,
    color: c.onSurface,
    lineHeight: LineHeight.headlineMD,
  },
  diaryNote: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
    lineHeight: LineHeight.bodyMD,
  },
  hashtagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hashtagChip: {
    backgroundColor: c.surfaceContainerHigh,
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  hashtagText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
  },

  // Add photo
  addPhotoCard: {
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: c.surfaceContainerHigh,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    // 配合內層的品牌色漸層，虛線框也跟著暖起來，不然會像沒載入完的灰框
    borderColor: c.primaryFixedDim,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  cameraCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: c.surfaceContainerLowest,
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
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
    color: c.onSurface,
  },
  addPhotoSub: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
  },

  // Note input
  noteCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: c.surfaceContainerLowest,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.surfaceVariant,
    padding: 14,
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  noteInput: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
    minHeight: 72,
  },

  // Mood selector
  moodSection: { marginBottom: 20 },
  moodSectionLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
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
    backgroundColor: c.surfaceContainerHigh,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  moodChipOn: {
    backgroundColor: c.primaryFixed,
    borderColor: c.primary,
  },
  moodChipEmoji: { fontSize: 16 },
  moodChipLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
  },
  moodChipLabelOn: { color: c.onPrimaryContainer },

  // Save
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

  // Share on existing entry
  shareEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: c.primary,
    borderRadius: 9999,
    paddingVertical: 12,
    marginTop: 4,
  },
  shareEntryBtnLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.primary,
  },

  // Share card
  shareCard: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.primaryFixed,
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
    color: c.primary,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: c.primary,
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  shareBtnLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: c.onPrimary,
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
    color: c.onSurfaceVariant,
  },
});
