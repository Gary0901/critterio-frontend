import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { CalendarEvent, Pet } from '../../types';

type RepeatType = CalendarEvent['repeat'];
type CategoryType = CalendarEvent['category'];

const CATEGORIES: { key: CategoryType; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { key: 'vet', label: '獸醫', icon: 'local-hospital' },
  { key: 'medication', label: '用藥', icon: 'medical-services' },
  { key: 'grooming', label: '美容', icon: 'content-cut' },
  { key: 'activity', label: '活動', icon: 'directions-run' },
  { key: 'other', label: '其他', icon: 'event-note' },
];

const REPEAT_OPTIONS: { key: RepeatType; label: string }[] = [
  { key: 'none', label: '不重複' },
  { key: 'daily', label: '每天' },
  { key: 'weekly', label: '每週' },
  { key: 'monthly', label: '每月' },
];

interface Props {
  visible: boolean;
  selectedDate: string;
  pets: Pet[];
  petColorMap: Record<string, string>;
  allPetsColor: string;
  onClose: () => void;
  onSave: (events: CalendarEvent[]) => void;
}

// ─── TimePicker ───────────────────────────────────────────────────────────────

function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const match = value.match(/(\d+):(\d+)\s*(AM|PM)/i);
  const hour   = match ? parseInt(match[1], 10) : 9;
  const minute = match ? parseInt(match[2], 10) : 0;
  const ampm   = match ? match[3].toUpperCase() : 'AM';

  const emit = (h: number, m: number, a: string) =>
    onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${a}`);

  return (
    <View style={tpStyles.container}>
      {/* Hour */}
      <View style={tpStyles.spinCol}>
        <TouchableOpacity style={tpStyles.spinBtn} onPress={() => emit(hour === 12 ? 1 : hour + 1, minute, ampm)}>
          <MaterialIcons name="keyboard-arrow-up" size={26} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={tpStyles.spinVal}>{String(hour).padStart(2, '0')}</Text>
        <TouchableOpacity style={tpStyles.spinBtn} onPress={() => emit(hour === 1 ? 12 : hour - 1, minute, ampm)}>
          <MaterialIcons name="keyboard-arrow-down" size={26} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <Text style={tpStyles.colon}>:</Text>

      {/* Minute (5-min steps) */}
      <View style={tpStyles.spinCol}>
        <TouchableOpacity style={tpStyles.spinBtn} onPress={() => emit(hour, (minute + 5) % 60, ampm)}>
          <MaterialIcons name="keyboard-arrow-up" size={26} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={tpStyles.spinVal}>{String(minute).padStart(2, '0')}</Text>
        <TouchableOpacity style={tpStyles.spinBtn} onPress={() => emit(hour, minute === 0 ? 55 : minute - 5, ampm)}>
          <MaterialIcons name="keyboard-arrow-down" size={26} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* AM / PM */}
      <View style={tpStyles.ampmCol}>
        {(['AM', 'PM'] as const).map((p) => (
          <TouchableOpacity
            key={p}
            style={[tpStyles.ampmBtn, ampm === p && tpStyles.ampmBtnActive]}
            onPress={() => emit(hour, minute, p)}
          >
            <Text style={[tpStyles.ampmLabel, ampm === p && tpStyles.ampmLabelActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── DatePicker ───────────────────────────────────────────────────────────────

function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const currentYear = new Date().getFullYear();
  const parts = value ? value.split('-').map(Number) : [currentYear, 1, 1];
  const year = parts[0];
  const month = parts[1]; // 1-12
  const day = parts[2];

  const emit = (y: number, mo: number, d: number) => {
    const maxDay = new Date(y, mo, 0).getDate();
    const clampedDay = Math.min(d, maxDay);
    onChange(`${y}-${String(mo).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`);
  };

  const maxDay = new Date(year, month, 0).getDate();

  return (
    <View style={tpStyles.container}>
      <View style={tpStyles.spinCol}>
        <TouchableOpacity style={tpStyles.spinBtn} onPress={() => emit(year + 1, month, day)}>
          <MaterialIcons name="keyboard-arrow-up" size={26} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={tpStyles.spinVal}>{year}</Text>
        <TouchableOpacity style={tpStyles.spinBtn} onPress={() => emit(Math.max(year - 1, currentYear), month, day)}>
          <MaterialIcons name="keyboard-arrow-down" size={26} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <Text style={tpStyles.colon}>/</Text>

      <View style={tpStyles.spinCol}>
        <TouchableOpacity style={tpStyles.spinBtn} onPress={() => emit(year, month === 12 ? 1 : month + 1, day)}>
          <MaterialIcons name="keyboard-arrow-up" size={26} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={tpStyles.spinVal}>{String(month).padStart(2, '0')}</Text>
        <TouchableOpacity style={tpStyles.spinBtn} onPress={() => emit(year, month === 1 ? 12 : month - 1, day)}>
          <MaterialIcons name="keyboard-arrow-down" size={26} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <Text style={tpStyles.colon}>/</Text>

      <View style={tpStyles.spinCol}>
        <TouchableOpacity style={tpStyles.spinBtn} onPress={() => emit(year, month, day === maxDay ? 1 : day + 1)}>
          <MaterialIcons name="keyboard-arrow-up" size={26} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={tpStyles.spinVal}>{String(day).padStart(2, '0')}</Text>
        <TouchableOpacity style={tpStyles.spinBtn} onPress={() => emit(year, month, day === 1 ? maxDay : day - 1)}>
          <MaterialIcons name="keyboard-arrow-down" size={26} color={Colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function addDateByRepeat(dateStr: string, repeat: RepeatType, count: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (repeat === 'daily') dt.setDate(dt.getDate() + count);
  else if (repeat === 'weekly') dt.setDate(dt.getDate() + count * 7);
  else if (repeat === 'monthly') dt.setMonth(dt.getMonth() + count);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export default function AddEventModal({
  visible,
  selectedDate,
  pets,
  petColorMap,
  allPetsColor,
  onClose,
  onSave,
}: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CategoryType>('vet');
  const [petId, setPetId] = useState<string>('all');
  const [allDay, setAllDay] = useState(false);
  const [time, setTime] = useState('09:00 AM');
  const [repeat, setRepeat] = useState<RepeatType>('none');
  const [repeatUntilEnabled, setRepeatUntilEnabled] = useState(false);
  const [repeatUntil, setRepeatUntil] = useState('');

  const reset = () => {
    setTitle('');
    setDescription('');
    setCategory('vet');
    setPetId('all');
    setAllDay(false);
    setTime('09:00 AM');
    setRepeat('none');
    setRepeatUntilEnabled(false);
    setRepeatUntil('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSave = () => {
    if (!title.trim()) return;
    const recurringId = repeat !== 'none' ? `r${Date.now()}` : undefined;
    const base: CalendarEvent = {
      id: `e${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      time: allDay ? '' : time,
      allDay,
      category,
      petId,
      done: false,
      date: selectedDate,
      repeat,
      recurringId,
    };

    const events: CalendarEvent[] = [base];
    if (repeat !== 'none') {
      if (repeatUntilEnabled && repeatUntil) {
        let i = 1;
        while (i <= 1000) {
          const nextDate = addDateByRepeat(selectedDate, repeat, i);
          if (nextDate > repeatUntil) break;
          events.push({ ...base, id: `e${Date.now() + i}`, date: nextDate });
          i++;
        }
      } else {
        const count = repeat === 'daily' ? 90 : repeat === 'weekly' ? 52 : 12;
        for (let i = 1; i <= count; i++) {
          events.push({ ...base, id: `e${Date.now() + i}`, date: addDateByRepeat(selectedDate, repeat, i) });
        }
      }
    }

    onSave(events);
    reset();
    onClose();
  };

  const [, m, d] = selectedDate ? selectedDate.split('-').map(Number) : [0, 0, 0];
  const displayDate = selectedDate ? `${m}月${d}日` : '';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.dismiss} onPress={handleClose} activeOpacity={1} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>新增提醒</Text>
              <Text style={styles.headerDate}>{displayDate}</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <MaterialIcons name="close" size={22} color={Colors.onSurface} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Pet selector */}
            <Text style={styles.fieldLabel}>為哪隻寵物？</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.petRow}
            >
              <TouchableOpacity
                style={[styles.petChip, petId === 'all' && { backgroundColor: allPetsColor, borderColor: allPetsColor }]}
                onPress={() => setPetId('all')}
              >
                <MaterialIcons name="pets" size={14} color={petId === 'all' ? Colors.onPrimary : Colors.onSurface} />
                <Text style={[styles.petChipLabel, petId === 'all' && styles.chipLabelActive]}>全部</Text>
              </TouchableOpacity>
              {pets.map((pet) => {
                const color = petColorMap[pet.id] ?? Colors.primary;
                const selected = petId === pet.id;
                return (
                  <TouchableOpacity
                    key={pet.id}
                    style={[styles.petChip, selected && { backgroundColor: color, borderColor: color }]}
                    onPress={() => setPetId(pet.id)}
                  >
                    <View style={[styles.petDot, { backgroundColor: selected ? Colors.onPrimary : color }]} />
                    <Text style={[styles.petChipLabel, selected && styles.chipLabelActive]}>{pet.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Title */}
            <Text style={styles.fieldLabel}>事項名稱 *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="例：定期健檢"
              placeholderTextColor={Colors.outlineVariant}
            />

            {/* Description */}
            <Text style={styles.fieldLabel}>備註（選填）</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={description}
              onChangeText={setDescription}
              placeholder="更多說明..."
              placeholderTextColor={Colors.outlineVariant}
              multiline
              numberOfLines={3}
            />

            {/* Category */}
            <Text style={styles.fieldLabel}>類別</Text>
            <View style={styles.chipWrap}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.chip, category === c.key && styles.chipActive]}
                  onPress={() => setCategory(c.key)}
                >
                  <MaterialIcons
                    name={c.icon}
                    size={15}
                    color={category === c.key ? Colors.onPrimary : Colors.onSurfaceVariant}
                  />
                  <Text style={[styles.chipLabel, category === c.key && styles.chipLabelActive]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* All day toggle */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>全天</Text>
              <Switch
                value={allDay}
                onValueChange={setAllDay}
                trackColor={{ false: Colors.surfaceContainerHigh, true: Colors.primaryFixed }}
                thumbColor={allDay ? Colors.primary : Colors.outline}
                ios_backgroundColor={Colors.surfaceContainerHigh}
              />
            </View>

            {!allDay && (
              <>
                <Text style={styles.fieldLabel}>時間</Text>
                <TimePicker value={time} onChange={setTime} />
              </>
            )}

            {/* Repeat */}
            <Text style={styles.fieldLabel}>重複</Text>
            <View style={styles.chipWrap}>
              {REPEAT_OPTIONS.map((r) => (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.chip, repeat === r.key && styles.chipActive]}
                  onPress={() => {
                    setRepeat(r.key);
                    if (r.key === 'none') { setRepeatUntilEnabled(false); setRepeatUntil(''); }
                  }}
                >
                  <Text style={[styles.chipLabel, repeat === r.key && styles.chipLabelActive]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {repeat !== 'none' && (
              <>
                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>設定截止日期</Text>
                  <Switch
                    value={repeatUntilEnabled}
                    onValueChange={(v) => {
                      setRepeatUntilEnabled(v);
                      if (v && !repeatUntil) {
                        const dt = new Date(selectedDate);
                        dt.setMonth(dt.getMonth() + 6);
                        setRepeatUntil(
                          `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
                        );
                      }
                    }}
                    trackColor={{ false: Colors.surfaceContainerHigh, true: Colors.primaryFixed }}
                    thumbColor={repeatUntilEnabled ? Colors.primary : Colors.outline}
                    ios_backgroundColor={Colors.surfaceContainerHigh}
                  />
                </View>
                {repeatUntilEnabled && (
                  <>
                    <Text style={styles.fieldLabel}>截止於</Text>
                    <DatePicker value={repeatUntil} onChange={setRepeatUntil} />
                  </>
                )}
              </>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>

          <TouchableOpacity
            style={[styles.saveBtn, !title.trim() && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!title.trim()}
          >
            <Text style={styles.saveBtnLabel}>儲存提醒</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  dismiss: { flex: 1 },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: '92%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.outlineVariant,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  headerTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: Colors.onSurface,
  },
  headerDate: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  closeBtn: { padding: 4 },
  scrollContent: { paddingBottom: 8 },
  fieldLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: Colors.onSurfaceVariant,
    marginTop: 16,
    marginBottom: 8,
  },
  petRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
  },
  petChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: Colors.outlineVariant,
    backgroundColor: Colors.surface,
  },
  petChipLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: Colors.onSurface,
  },
  petDot: { width: 8, height: 8, borderRadius: 4 },
  input: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurface,
  },
  inputMulti: {
    minHeight: 72,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: Colors.outlineVariant,
    backgroundColor: Colors.surface,
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
  chipLabelActive: { color: Colors.onPrimary },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  toggleLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: Colors.onSurfaceVariant,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 9999,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 12,
  },
  saveBtnDisabled: { backgroundColor: Colors.outlineVariant },
  saveBtnLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: Colors.onPrimary,
  },
});

const tpStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  spinCol: {
    alignItems: 'center',
    gap: 2,
  },
  spinBtn: {
    padding: 4,
  },
  spinVal: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineMD,
    color: Colors.onSurface,
    minWidth: 48,
    textAlign: 'center',
  },
  colon: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineMD,
    color: Colors.onSurface,
    marginBottom: 4,
  },
  ampmCol: {
    gap: 8,
    marginLeft: 4,
  },
  ampmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9999,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  ampmBtnActive: {
    backgroundColor: Colors.primary,
  },
  ampmLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: Colors.onSurfaceVariant,
  },
  ampmLabelActive: {
    color: Colors.onPrimary,
  },
});
