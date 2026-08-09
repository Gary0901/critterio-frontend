import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AppBar from '../../components/layout/AppBar';
import { useUser } from '../../context/UserContext';
import { useNotifications } from '../../context/NotificationContext';
import Card from '../../components/ui/Card';
import { ThemeColors } from '../../constants/themes';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { FontFamily, FontSize } from '../../constants/typography';
import { getEvents, markEventDone, addEvent, deleteEvent, getPets } from '../../api';
import { CalendarEvent, Pet } from '../../types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { buildPetColorMap, allPetsColor } from '../../constants/petColors';
import AddEventModal from './AddEventModal';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTH_NAMES = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

const makeCategoryConfig = (
  c: ThemeColors,
): Record<string, { icon: keyof typeof MaterialIcons.glyphMap; color: string; bg: string }> => ({
  vet:        { icon: 'local-hospital',   color: c.error,            bg: c.errorContainer },
  medication: { icon: 'medical-services', color: c.secondary,        bg: c.secondaryContainer },
  grooming:   { icon: 'content-cut',      color: c.primaryContainer, bg: c.primaryFixed },
  activity:   { icon: 'directions-run',   color: c.onSurface,        bg: c.surfaceContainerHigh },
  anniversary:{ icon: 'cake',            color: c.primary,          bg: c.primaryFixed },
  other:      { icon: 'event-note',       color: c.onSurface,        bg: c.surfaceContainerHigh },
});

function buildCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const days: { num: number; currentMonth: boolean }[] = [];

  for (let i = firstDay - 1; i >= 0; i--) days.push({ num: prevDays - i, currentMonth: false });
  for (let d = 1; d <= daysInMonth; d++) days.push({ num: d, currentMonth: true });
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) days.push({ num: d, currentMonth: false });
  return days;
}

function buildWeekStrip(year: number, month: number, day: number) {
  const dow = new Date(year, month, day).getDay();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(year, month, day - dow + i);
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
  });
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function timeToMinutes(e: CalendarEvent): number {
  if (e.allDay) return -1;
  const match = e.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let h = parseInt(match[1], 10);
  const min = parseInt(match[2], 10);
  if (match[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (match[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

function sortByTime(entries: CalendarEvent[]): CalendarEvent[] {
  return [...entries].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
}

// ─── EventRow ─────────────────────────────────────────────────────────────────

function EventRow({
  event,
  petColor,
  petName,
  todayStr,
  onToggle,
  onDelete,
  showActions = true,
  isOverdue = false,
}: {
  event: CalendarEvent;
  petColor: string;
  petName: string;
  todayStr: string;
  onToggle: (id: string) => void;
  onDelete: (event: CalendarEvent) => void;
  showActions?: boolean;
  isOverdue?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const categoryConfig = makeCategoryConfig(colors);
  const cfg = categoryConfig[event.category] ?? categoryConfig.activity;
  const [, em, ed] = event.date.split('-').map(Number);
  const showDate = event.date !== todayStr;

  return (
    <View style={[styles.eventRowOuter, event.done && styles.eventRowDone]}>
      <View style={[styles.petColorBar, { backgroundColor: petColor }]} />
      <View style={styles.eventRowInner}>
        <View style={[styles.eventIcon, { backgroundColor: cfg.bg }]}>
          <MaterialIcons name={cfg.icon} size={18} color={cfg.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eventTitle, event.done && styles.eventTitleDone]}>
            {event.title}
          </Text>
          {!!event.description && (
            <Text style={styles.eventDesc}>{event.description}</Text>
          )}
          <View style={styles.eventMetaRow}>
            {showDate && (
              <Text style={styles.eventDateLabel}>{em}月{ed}日</Text>
            )}
            <Text style={styles.eventTime}>{event.allDay ? '全天' : event.time}</Text>
            <View style={[styles.petBadge, { backgroundColor: petColor + '22' }]}>
              <View style={[styles.petBadgeDot, { backgroundColor: petColor }]} />
              <Text style={[styles.petBadgeLabel, { color: petColor }]}>{petName}</Text>
            </View>
            {event.repeat !== 'none' && (
              <View style={styles.repeatBadge}>
                <MaterialIcons name="repeat" size={10} color={colors.outline} />
                <Text style={styles.repeatBadgeLabel}>
                  {event.repeat === 'daily' ? '每天' : event.repeat === 'weekly' ? '每週' : '每月'}
                </Text>
              </View>
            )}
          </View>
        </View>
        {showActions && (
          <>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(event)}>
              <MaterialIcons name="delete-outline" size={20} color={colors.outlineVariant} />
            </TouchableOpacity>
            {isOverdue ? (
              <View style={styles.overdueBadge}>
                <Text style={styles.overdueBadgeLabel}>逾期</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.checkBtn, event.done && styles.checkBtnDone]}
                onPress={() => onToggle(event.id)}
              >
                {event.done
                  ? <MaterialIcons name="check" size={16} color={colors.onPrimary} />
                  : <MaterialIcons name="radio-button-unchecked" size={22} color={colors.outlineVariant} />
                }
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );
}

// ─── CalendarScreen ───────────────────────────────────────────────────────────

export default function CalendarScreen({ navigation }: Props) {
  const { colors, theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { unreadCount } = useNotifications();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);

  const now = new Date();
  const todayStr = toDateStr(now.getFullYear(), now.getMonth(), now.getDate());

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState<CalendarEvent | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  const fetchEvents = useCallback(async () => {
    try {
      const res = await getEvents(year, month + 1);
      if (res.success) setEvents(res.data);
    } catch { /* silently ignore network errors */ }
  }, [year, month]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    getPets()
      .then((res) => { if (res.success) setPets(res.data); })
      .catch(() => { /* silently ignore network errors */ });
  }, []);

  const selectedDateStr = useMemo(
    () => toDateStr(year, month, selectedDay),
    [year, month, selectedDay]
  );

  const petColorMap = useMemo(() => buildPetColorMap(pets, theme.key), [pets, theme.key]);

  const weekStrip = useMemo(() => buildWeekStrip(year, month, selectedDay), [year, month, selectedDay]);

  const calHeaderLabel = useMemo(() => {
    if (viewMode === 'month') return `${MONTH_NAMES[month]} ${year}`;
    return `${MONTH_NAMES[month]} ${year}`;
  }, [viewMode, year, month, selectedDay, weekStrip]);

  const getPetInfo = (petId: string) => {
    if (petId === 'all') return { name: '全部', color: allPetsColor(colors) };
    const pet = pets.find((p) => p.id === petId);
    return { name: pet?.name ?? '?', color: petColorMap[petId] ?? colors.primary };
  };

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach((e) => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [events]);

  const selectedDateEvents = useMemo(
    () => sortByTime(eventsByDate[selectedDateStr] ?? []),
    [eventsByDate, selectedDateStr]
  );

  const upcomingEvents = useMemo(() =>
    events
      .filter((e) => e.date > todayStr)
      .sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : timeToMinutes(a) - timeToMinutes(b))
      .slice(0, 5),
    [events, todayStr]
  );

  const doneCount = selectedDateEvents.filter((e) => e.done).length;
  const overdueCount = selectedDateEvents.filter((e) => !e.done && e.date < todayStr).length;

  const calDays = buildCalendarDays(year, month);

  const prevPeriod = () => {
    if (viewMode === 'month') {
      const nm = month === 0 ? 11 : month - 1;
      const ny = month === 0 ? year - 1 : year;
      setSelectedDay((d) => Math.min(d, new Date(ny, nm + 1, 0).getDate()));
      setMonth(nm); setYear(ny);
    } else {
      const d = new Date(year, month, selectedDay - 7);
      setYear(d.getFullYear()); setMonth(d.getMonth()); setSelectedDay(d.getDate());
    }
  };
  const nextPeriod = () => {
    if (viewMode === 'month') {
      const nm = month === 11 ? 0 : month + 1;
      const ny = month === 11 ? year + 1 : year;
      setSelectedDay((d) => Math.min(d, new Date(ny, nm + 1, 0).getDate()));
      setMonth(nm); setYear(ny);
    } else {
      const d = new Date(year, month, selectedDay + 7);
      setYear(d.getFullYear()); setMonth(d.getMonth()); setSelectedDay(d.getDate());
    }
  };

  const toggle = async (id: string) => {
    const event = events.find((e) => e.id === id);
    if (!event) return;
    const newDone = !event.done;
    setEvents((prev) => prev.map((e) => e.id === id ? { ...e, done: newDone } : e));
    await markEventDone(id, newDone);
  };

  const handleAddEvents = async (newEvents: CalendarEvent[]) => {
    try {
      await addEvent(newEvents[0]);
    } catch { /* silently ignore */ }
    fetchEvents();
  };

  const confirmDelete = async (type: 'this' | 'all') => {
    if (!deletingEvent) return;
    try {
      await deleteEvent(deletingEvent.id, type);
    } catch { /* silently ignore */ }
    setEvents((prev) =>
      type === 'this'
        ? prev.filter((e) => e.id !== deletingEvent.id)
        : prev.filter((e) => e.recurringId !== deletingEvent.recurringId)
    );
    setDeletingEvent(null);
  };

  const isSelectedToday = selectedDateStr === todayStr;
  const selectedLabel = isSelectedToday ? '今天' : `${month + 1}月${selectedDay}日`;

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

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Calendar card ───────────────────────────────────── */}
        <Card style={styles.calCard}>
          <View style={styles.calHeader}>
            <Text style={styles.calMonthLabel}>{calHeaderLabel}</Text>
            <View style={styles.calNav}>
              {/* View mode toggle */}
              <View style={styles.viewToggle}>
                {(['month', 'week'] as const).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.viewToggleBtn, viewMode === mode && styles.viewToggleBtnActive]}
                    onPress={() => setViewMode(mode)}
                  >
                    <Text style={[styles.viewToggleLabel, viewMode === mode && styles.viewToggleLabelActive]}>
                      {mode === 'month' ? '月' : '週'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={[styles.calNavBtn, styles.calAddBtn]} onPress={() => setShowAddModal(true)}>
                <MaterialIcons name="add" size={20} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.calNavBtn} onPress={prevPeriod}>
                <MaterialIcons name="chevron-left" size={22} color={colors.onSurface} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.calNavBtn} onPress={nextPeriod}>
                <MaterialIcons name="chevron-right" size={22} color={colors.onSurface} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.dayLabels}>
            {DAY_LABELS.map((l, i) => (
              <Text key={i} style={styles.dayLabel}>{l}</Text>
            ))}
          </View>

          {/* Month grid */}
          {viewMode === 'month' && (
            <View style={styles.dayGrid}>
              {calDays.map((day, i) => {
                const isToday =
                  day.currentMonth &&
                  day.num === now.getDate() &&
                  month === now.getMonth() &&
                  year === now.getFullYear();
                const isSelected = day.currentMonth && day.num === selectedDay;
                const dateStr = day.currentMonth ? toDateStr(year, month, day.num) : null;
                const dayEntries = dateStr ? (eventsByDate[dateStr] ?? []) : [];
                const colorBars = [...new Set(dayEntries.map((e) => getPetInfo(e.petId).color))].slice(0, 3);

                return (
                  <TouchableOpacity
                    key={i}
                    style={styles.dayCell}
                    onPress={() => day.currentMonth && setSelectedDay(day.num)}
                    disabled={!day.currentMonth}
                  >
                    <View style={[
                      styles.dayCellCircle,
                      isSelected && styles.dayCellSelected,
                      isToday && !isSelected && styles.dayCellToday,
                    ]}>
                      <Text style={[
                        styles.dayNum,
                        !day.currentMonth && styles.dayNumFaded,
                        isSelected && styles.dayNumSelected,
                      ]}>
                        {day.num}
                      </Text>
                    </View>
                    {colorBars.length > 0 && (
                      <View style={styles.barStack}>
                        {colorBars.map((color: string, di: number) => (
                          <View key={di} style={[styles.eventBar, { backgroundColor: color }]} />
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Week / Day strip */}
          {viewMode !== 'month' && (
            <View style={styles.dayGrid}>
              {weekStrip.map((d, i) => {
                const isToday = d.year === now.getFullYear() && d.month === now.getMonth() && d.day === now.getDate();
                const isSelected = d.year === year && d.month === month && d.day === selectedDay;
                const dateStr = toDateStr(d.year, d.month, d.day);
                const dayEntries = eventsByDate[dateStr] ?? [];
                const colorBars = [...new Set(dayEntries.map((e) => getPetInfo(e.petId).color))].slice(0, 3);
                return (
                  <TouchableOpacity
                    key={i}
                    style={styles.dayCell}
                    onPress={() => { setYear(d.year); setMonth(d.month); setSelectedDay(d.day); }}
                  >
                    <View style={[
                      styles.dayCellCircle,
                      isSelected && styles.dayCellSelected,
                      isToday && !isSelected && styles.dayCellToday,
                    ]}>
                      <Text style={[
                        styles.dayNum,
                        d.month !== month && styles.dayNumFaded,
                        isSelected && styles.dayNumSelected,
                      ]}>
                        {d.day}
                      </Text>
                    </View>
                    {colorBars.length > 0 && (
                      <View style={styles.barStack}>
                        {colorBars.map((color: string, di: number) => (
                          <View key={di} style={[styles.eventBar, { backgroundColor: color }]} />
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Card>

        {/* ── Pet color legend ────────────────────────────────── */}
        {pets.length > 0 && (
          <View style={styles.legend}>
            {pets.map((pet) => (
              <View key={pet.id} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: petColorMap[pet.id] }]} />
                <Text style={styles.legendLabel}>{pet.name}</Text>
              </View>
            ))}
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: allPetsColor(colors) }]} />
              <Text style={styles.legendLabel}>全部</Text>
            </View>
          </View>
        )}

        {/* ── Today progress bar ──────────────────────────────── */}
        {selectedDateEvents.length > 0 ? (
          <View style={styles.progressRow}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>
                {selectedLabel}：{doneCount}/{selectedDateEvents.length} 項已完成
              </Text>
              {overdueCount > 0 && (
                <View style={styles.overdueChip}>
                  <Text style={styles.overdueChipLabel}>{overdueCount} 項逾期</Text>
                </View>
              )}
              {doneCount === selectedDateEvents.length && (
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
              )}
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(doneCount / selectedDateEvents.length) * 100}%` as any }]} />
              {overdueCount > 0 && (
                <View style={[styles.progressOverdue, { width: `${(overdueCount / selectedDateEvents.length) * 100}%` as any }]} />
              )}
            </View>
          </View>
        ) : (
          <View style={styles.emptyToday}>
            <MaterialIcons name="pets" size={16} color={colors.outline} />
            <Text style={styles.emptyTodayText}>不要忘記重要的日子，為你的寵物安排今日行程吧！</Text>
          </View>
        )}

        {/* ── Selected date events ────────────────────────────── */}
        {selectedDateEvents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{selectedLabel}</Text>
            <Card style={styles.eventList}>
              {selectedDateEvents.map((e, idx) => {
                const { name, color } = getPetInfo(e.petId);
                return (
                  <View key={e.id}>
                    <EventRow
                      event={e}
                      petColor={color}
                      petName={name}
                      todayStr={todayStr}
                      showActions={!e.isAuto}
                      onToggle={toggle}
                      onDelete={setDeletingEvent}
                      isOverdue={!e.done && e.date < todayStr}
                    />
                    {idx < selectedDateEvents.length - 1 && <View style={styles.divider} />}
                  </View>
                );
              })}
            </Card>
          </View>
        )}

        {/* ── Upcoming events ─────────────────────────────────── */}
        {upcomingEvents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>即將到來</Text>
            <Card style={styles.eventList}>
              {upcomingEvents.map((e, idx) => {
                const { name, color } = getPetInfo(e.petId);
                return (
                  <View key={e.id}>
                    <EventRow
                      event={e}
                      petColor={color}
                      petName={name}
                      todayStr={todayStr}
                      onToggle={toggle}
                      onDelete={setDeletingEvent}
                      showActions={false}
                    />
                    {idx < upcomingEvents.length - 1 && <View style={styles.divider} />}
                  </View>
                );
              })}
            </Card>
          </View>
        )}

        {/* ── Add event button ────────────────────────────────── */}
        <TouchableOpacity style={styles.addEventBtn} onPress={() => setShowAddModal(true)}>
          <MaterialIcons name="add-circle" size={22} color={colors.onPrimary} />
          <Text style={styles.addEventLabel}>新增提醒</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Add Event Modal ─────────────────────────────────────── */}
      <AddEventModal
        visible={showAddModal}
        selectedDate={selectedDateStr}
        pets={pets}
        petColorMap={petColorMap}
        allPetsColor={allPetsColor(colors)}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddEvents}
      />

      {/* ── Delete Confirm Modal ────────────────────────────────── */}
      <Modal
        transparent
        animationType="fade"
        visible={!!deletingEvent}
        onRequestClose={() => setDeletingEvent(null)}
      >
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteCard}>
            <Text style={styles.deleteTitle}>刪除事項</Text>
            <Text style={styles.deleteEventName}>「{deletingEvent?.title}」</Text>

            {deletingEvent?.repeat !== 'none' ? (
              <>
                <Text style={styles.deleteSubtitle}>這是重複事項，要刪除哪些？</Text>
                <TouchableOpacity style={styles.deleteOption} onPress={() => confirmDelete('this')}>
                  <MaterialIcons name="event-busy" size={20} color={colors.error} />
                  <Text style={[styles.deleteOptionText, { color: colors.error }]}>僅刪除此次</Text>
                </TouchableOpacity>
                <View style={styles.deleteOptionDivider} />
                <TouchableOpacity style={styles.deleteOption} onPress={() => confirmDelete('all')}>
                  <MaterialIcons name="delete-forever" size={20} color={colors.error} />
                  <Text style={[styles.deleteOptionText, { color: colors.error }]}>刪除全部重複事項</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.deleteOption} onPress={() => confirmDelete('this')}>
                <MaterialIcons name="delete-outline" size={20} color={colors.error} />
                <Text style={[styles.deleteOptionText, { color: colors.error }]}>確認刪除</Text>
              </TouchableOpacity>
            )}

            <View style={styles.deleteOptionDivider} />
            <TouchableOpacity style={styles.deleteCancelBtn} onPress={() => setDeletingEvent(null)}>
              <Text style={styles.deleteCancelLabel}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 16 },

  // Calendar card
  calCard: { gap: 12 },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  calMonthLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.headlineMD,
    color: c.onSurface,
  },
  calNav: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: c.surfaceContainerHigh,
    borderRadius: 10,
    padding: 2,
  },
  viewToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  viewToggleBtnActive: {
    backgroundColor: c.surface,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  viewToggleLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: c.outline,
  },
  viewToggleLabelActive: {
    color: c.onSurface,
    fontFamily: FontFamily.headlineSemiBold,
  },
  calNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceContainerHigh,
  },
  calAddBtn: {
    backgroundColor: c.primaryFixed,
  },
  dayLabels: { flexDirection: 'row' },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.labelSM,
    color: c.outline,
    paddingVertical: 4,
  },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  // Cell is taller than wide so stacked bars have room below the circle
  dayCell: {
    width: '14.28%',
    // 固定高度而非 aspectRatio：用比例的話螢幕越寬格子越高，
    // Pro Max 上一格會撐到 67pt，但內容只有數字 + 最多 3 條事件色條，
    // 多出來的空間就變成月曆下方那一大片白。
    // 用 minHeight 而非 height：使用者開了系統放大文字時，日期數字會變大，
    // 寫死 height 會把它切掉；minHeight 讓格子在需要時長高，平常維持一致。
    // 56 = 數字 22 + 色條區 24 + 上下留白 10
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 5,
  },
  dayCellCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellSelected: { backgroundColor: c.primary },
  dayCellToday: { backgroundColor: c.primaryFixed },
  dayNum: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurface,
  },
  dayNumFaded: { color: c.outlineVariant },
  dayNumSelected: { color: c.onPrimary, fontFamily: FontFamily.headlineBold },
  barStack: {
    width: '72%',
    gap: 2,
    marginTop: 2,
  },
  eventBar: { width: '100%', height: 3, borderRadius: 2 },

  // Pet legend
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
  },

  // Empty today state
  emptyToday: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  emptyTodayText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: c.outline,
    lineHeight: 20,
  },

  // Progress
  progressRow: { gap: 8 },
  progressLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
  },
  overdueChip: {
    backgroundColor: c.errorContainer,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  overdueChipLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelSM,
    color: c.error,
  },
  progressTrack: {
    height: 6,
    flexDirection: 'row',
    backgroundColor: c.surfaceContainerHigh,
    borderRadius: 9999,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: c.primary },
  progressOverdue: { height: '100%', backgroundColor: c.error },

  // Event sections
  section: { gap: 8 },
  sectionLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  eventList: { gap: 0, padding: 0 },

  // Event row — outer holds the color bar + inner content
  eventRowOuter: { flexDirection: 'row', overflow: 'hidden' },
  eventRowDone: { opacity: 0.5 },
  petColorBar: { width: 4, alignSelf: 'stretch', minHeight: 56 },
  eventRowInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingRight: 12,
    paddingLeft: 10,
  },
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
  },
  eventTitleDone: { textDecorationLine: 'line-through' },
  eventDesc: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  eventDateLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: c.outline,
  },
  eventTime: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: c.outline,
  },
  petBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  petBadgeDot: { width: 6, height: 6, borderRadius: 3 },
  petBadgeLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
  },
  repeatBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  repeatBadgeLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.outline,
  },
  overdueBadge: {
    backgroundColor: c.errorContainer,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  overdueBadgeLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelSM,
    color: c.error,
  },
  deleteBtn: { padding: 4 },
  checkBtn: { padding: 4 },
  checkBtnDone: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: 1, backgroundColor: c.surfaceVariant, marginHorizontal: 14 },

  // Add button
  addEventBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: c.primary,
    borderRadius: 9999,
    paddingVertical: 15,
  },
  addEventLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.onPrimary,
  },

  // Delete modal
  deleteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  deleteCard: {
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 20,
    width: '100%',
  },
  deleteTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: c.onSurface,
    marginBottom: 4,
  },
  deleteEventName: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
    marginBottom: 16,
  },
  deleteSubtitle: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
    marginBottom: 12,
  },
  deleteOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  deleteOptionText: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
  },
  deleteOptionDivider: { height: 1, backgroundColor: c.surfaceVariant },
  deleteCancelBtn: { paddingVertical: 14, alignItems: 'center' },
  deleteCancelLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
  },
});
