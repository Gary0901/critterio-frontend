import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Animated,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../types/navigation';
import Card from '../../components/ui/Card';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { getVetVisits, parseVisitReport, createVetVisit, ParsedVisitReportDraft } from '../../api';
import { VetVisit, LabResultItem, Medication } from '../../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
  route: RouteProp<RootStackParamList, 'VetVisits'>;
};

const STATUS_LABEL: Record<LabResultItem['status'], string> = {
  NORMAL: '正常', HIGH: '偏高', LOW: '偏低', UNKNOWN: '未知',
};
const STATUS_COLOR: Record<LabResultItem['status'], string> = {
  NORMAL: Colors.secondary, HIGH: Colors.error, LOW: Colors.primary, UNKNOWN: Colors.outline,
};
const STATUS_OPTIONS: LabResultItem['status'][] = ['NORMAL', 'HIGH', 'LOW', 'UNKNOWN'];

function todayParts(): [string, string, string] {
  const d = new Date();
  return [String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')];
}

export default function VetVisitsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { petId, petName } = route.params;

  const [visits, setVisits] = useState<VetVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formVisible, setFormVisible] = useState(false);
  const [dateParts, setDateParts] = useState<[string, string, string]>(todayParts());
  const [clinicName, setClinicName] = useState('');
  const [diagnosisNote, setDiagnosisNote] = useState('');
  const [medications, setMedications] = useState<Medication[]>([]);
  const [syncToCalendar, setSyncToCalendar] = useState(true);
  const [draft, setDraft] = useState<ParsedVisitReportDraft | null>(null);
  const [draftItems, setDraftItems] = useState<LabResultItem[]>([]);
  const slideAnim = useRef(new Animated.Value(500)).current;

  const load = () => {
    getVetVisits(petId).then((res) => {
      if (res.success) setVisits(res.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [petId]);

  const openForm = () => {
    setDateParts(todayParts());
    setClinicName('');
    setDiagnosisNote('');
    setMedications([]);
    setSyncToCalendar(true);
    setDraft(null);
    setDraftItems([]);
    setFormVisible(true);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 150 }).start();
  };

  const closeForm = () => {
    Animated.timing(slideAnim, { toValue: 500, duration: 240, useNativeDriver: true })
      .start(() => setFormVisible(false));
  };

  const pickAndParse = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('權限不足', fromCamera ? '請允許使用相機以拍攝報告。' : '請允許存取相片庫以選擇報告照片。');
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled) return;
    const asset = result.assets[0];

    setParsing(true);
    try {
      const res = await parseVisitReport(petId, { uri: asset.uri, name: asset.fileName ?? 'report.jpg', type: asset.mimeType ?? 'image/jpeg' });
      if (res.success) {
        if (res.data.items.length === 0) {
          Alert.alert('無法辨識', '這張照片看起來沒有可辨識的數值型檢驗項目，請確認是血檢/生化等報告照片。');
          return;
        }
        setDraft(res.data);
        setDraftItems(res.data.items);
      } else {
        Alert.alert('解析失敗', res.message || '請稍後再試');
      }
    } catch {
      Alert.alert('解析失敗', '網路錯誤，請稍後再試');
    } finally {
      setParsing(false);
    }
  };

  const showPickerOptions = () => {
    Alert.alert('上傳檢驗報告', '請選擇報告照片來源', [
      { text: '拍照', onPress: () => pickAndParse(true) },
      { text: '從相簿選擇', onPress: () => pickAndParse(false) },
      { text: '取消', style: 'cancel' },
    ]);
  };

  const updateDraftItem = (index: number, patch: Partial<LabResultItem>) => {
    setDraftItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const addMedication = () => {
    setMedications((prev) => [...prev, { name: '', dosage: '', frequency: '' }]);
  };
  const updateMedication = (index: number, patch: Partial<Medication>) => {
    setMedications((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  };
  const removeMedication = (index: number) => {
    setMedications((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const [y, m, d] = dateParts;
    if (!y || !m || !d) {
      Alert.alert('請填寫看診日期');
      return;
    }
    setSaving(true);
    try {
      const res = await createVetVisit(petId, {
        visitDate: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`,
        clinicName: clinicName.trim(),
        diagnosisNote: diagnosisNote.trim(),
        medications: medications.filter((med) => med.name.trim()),
        imageUrl: draft?.imageUrl,
        reportType: draft?.reportType,
        items: draftItems,
        summaryAdvice: draft?.summaryAdvice,
        syncToCalendar,
      });
      if (res.success) {
        setVisits((prev) => [res.data, ...prev]);
        closeForm();
      } else {
        Alert.alert('儲存失敗', res.message || '請稍後再試');
      }
    } catch {
      Alert.alert('儲存失敗', '網路錯誤，請稍後再試');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{petName} 的就醫紀錄</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
        ) : visits.length === 0 ? (
          <Card style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
            <MaterialIcons name="event-note" size={32} color={Colors.outline} />
            <Text style={styles.emptyText}>尚未記錄任何就醫紀錄</Text>
            <Text style={styles.emptySub}>記錄看診日期、診所、用藥，需要時也可以順便上傳檢驗報告</Text>
          </Card>
        ) : (
          visits.map((v) => {
            const abnormalCount = v.items.filter((i) => i.status === 'HIGH' || i.status === 'LOW').length;
            return (
              <Card key={v.id} style={styles.visitCard}>
                <View style={styles.visitHead}>
                  <Text style={styles.visitDate}>{v.visitDate.slice(0, 10).replace(/-/g, '/')}</Text>
                  {abnormalCount > 0 && (
                    <View style={[styles.badge, { backgroundColor: Colors.errorContainer }]}>
                      <Text style={[styles.badgeText, { color: Colors.error }]}>{abnormalCount} 項異常</Text>
                    </View>
                  )}
                </View>
                {v.clinicName ? (
                  <View style={styles.metaRow}>
                    <MaterialIcons name="local-hospital" size={14} color={Colors.onSurfaceVariant} />
                    <Text style={styles.metaText}>{v.clinicName}</Text>
                  </View>
                ) : null}
                {v.diagnosisNote ? <Text style={styles.diagnosisText}>{v.diagnosisNote}</Text> : null}
                {v.medications.length > 0 && (
                  <View style={styles.medRow}>
                    <MaterialIcons name="medication" size={14} color={Colors.onSurfaceVariant} />
                    <Text style={styles.metaText}>
                      {v.medications.map((med) => med.name).join('、')}
                    </Text>
                  </View>
                )}
                {v.items.map((item, i) => (
                  <View key={i} style={styles.itemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{item.itemName}{item.abbreviation ? `（${item.abbreviation}）` : ''}</Text>
                      <Text style={styles.itemExplain} numberOfLines={2}>{item.plainExplanation}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.itemValue, { color: STATUS_COLOR[item.status] }]}>{item.value} {item.unit}</Text>
                      <Text style={[styles.itemStatus, { color: STATUS_COLOR[item.status] }]}>{STATUS_LABEL[item.status]}</Text>
                    </View>
                  </View>
                ))}
                {v.summaryAdvice ? <Text style={styles.summaryText}>💡 {v.summaryAdvice}</Text> : null}
              </Card>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity style={styles.addBtn} activeOpacity={0.85} onPress={openForm}>
        <MaterialIcons name="add" size={20} color={Colors.onPrimary} />
        <Text style={styles.addBtnLabel}>新增就醫紀錄</Text>
      </TouchableOpacity>

      <Modal visible={formVisible} transparent animationType="none" onRequestClose={closeForm}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeForm} />
          <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 24, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.sheetHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetTitle}>新增就醫紀錄</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>看診日期</Text>
                <View style={styles.dateRow}>
                  <TextInput
                    style={styles.dateInput} value={dateParts[0]}
                    onChangeText={(v) => setDateParts([v, dateParts[1], dateParts[2]])}
                    placeholder="年" keyboardType="number-pad" maxLength={4} placeholderTextColor={Colors.outline}
                  />
                  <Text style={styles.dateSep}>/</Text>
                  <TextInput
                    style={styles.dateInputSm} value={dateParts[1]}
                    onChangeText={(v) => setDateParts([dateParts[0], v, dateParts[2]])}
                    placeholder="月" keyboardType="number-pad" maxLength={2} placeholderTextColor={Colors.outline}
                  />
                  <Text style={styles.dateSep}>/</Text>
                  <TextInput
                    style={styles.dateInputSm} value={dateParts[2]}
                    onChangeText={(v) => setDateParts([dateParts[0], dateParts[1], v])}
                    placeholder="日" keyboardType="number-pad" maxLength={2} placeholderTextColor={Colors.outline}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>診所名稱</Text>
                <TextInput
                  style={styles.textInput} value={clinicName} onChangeText={setClinicName}
                  placeholder="例：安心動物醫院" placeholderTextColor={Colors.outline}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>看診原因/診斷內容</Text>
                <TextInput
                  style={[styles.textInput, styles.multilineInput]} value={diagnosisNote} onChangeText={setDiagnosisNote}
                  placeholder="例：食慾不振三天，診斷為輕微腸胃炎" placeholderTextColor={Colors.outline} multiline
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.medHeaderRow}>
                  <Text style={styles.inputLabel}>用藥紀錄</Text>
                  <TouchableOpacity style={styles.addMedBtn} onPress={addMedication}>
                    <MaterialIcons name="add" size={16} color={Colors.primary} />
                    <Text style={styles.addMedBtnLabel}>新增用藥</Text>
                  </TouchableOpacity>
                </View>
                {medications.map((med, index) => (
                  <View key={index} style={styles.medEditRow}>
                    <TextInput
                      style={[styles.textInput, styles.medNameInput]} value={med.name}
                      onChangeText={(v) => updateMedication(index, { name: v })}
                      placeholder="藥名" placeholderTextColor={Colors.outline}
                    />
                    <TextInput
                      style={[styles.textInput, styles.medSmallInput]} value={med.dosage}
                      onChangeText={(v) => updateMedication(index, { dosage: v })}
                      placeholder="劑量" placeholderTextColor={Colors.outline}
                    />
                    <TextInput
                      style={[styles.textInput, styles.medSmallInput]} value={med.frequency}
                      onChangeText={(v) => updateMedication(index, { frequency: v })}
                      placeholder="頻率" placeholderTextColor={Colors.outline}
                    />
                    <TouchableOpacity onPress={() => removeMedication(index)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <MaterialIcons name="close" size={18} color={Colors.outlineVariant} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>檢驗報告（可選）</Text>
                {draft ? (
                  <View style={styles.reportAttached}>
                    <Image source={{ uri: draft.imageUrl }} style={styles.previewImg} />
                    <Text style={styles.reportAttachedText}>已附上 {draftItems.length} 項檢驗數值</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.uploadReportBtn, parsing && { opacity: 0.6 }]}
                    onPress={showPickerOptions}
                    disabled={parsing}
                  >
                    {parsing ? (
                      <ActivityIndicator color={Colors.primary} />
                    ) : (
                      <>
                        <MaterialIcons name="add-a-photo" size={18} color={Colors.primary} />
                        <Text style={styles.uploadReportBtnLabel}>上傳檢驗報告，AI 自動解析</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {draftItems.map((item, index) => (
                <View key={index} style={styles.editItemCard}>
                  <Text style={styles.itemName}>{item.itemName}{item.abbreviation ? `（${item.abbreviation}）` : ''}</Text>
                  {item.refRange ? <Text style={styles.refRangeText}>參考範圍：{item.refRange}</Text> : null}
                  <View style={styles.editRow}>
                    <View style={[styles.inputWrapSm, { flex: 1 }]}>
                      <TextInput
                        style={styles.inputFieldSm} value={String(item.value)}
                        onChangeText={(v) => { const n = parseFloat(v); updateDraftItem(index, { value: isNaN(n) ? 0 : n }); }}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <Text style={styles.unitText}>{item.unit}</Text>
                  </View>
                  <View style={styles.statusRow}>
                    {STATUS_OPTIONS.map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.statusChip, item.status === s && { backgroundColor: STATUS_COLOR[s], borderColor: STATUS_COLOR[s] }]}
                        onPress={() => updateDraftItem(index, { status: s })}
                      >
                        <Text style={[styles.statusChipLabel, item.status === s && { color: Colors.onPrimary }]}>{STATUS_LABEL[s]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={styles.explainInput} value={item.plainExplanation}
                    onChangeText={(v) => updateDraftItem(index, { plainExplanation: v })}
                    multiline placeholder="白話文解釋" placeholderTextColor={Colors.outline}
                  />
                </View>
              ))}

              <View style={styles.syncRow}>
                <Text style={styles.inputLabel}>同步到行事曆</Text>
                <Switch value={syncToCalendar} onValueChange={setSyncToCalendar} trackColor={{ true: Colors.primary }} />
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                activeOpacity={0.85} onPress={handleSave} disabled={saving}
              >
                <Text style={styles.saveBtnLabel}>{saving ? '儲存中...' : '確認並儲存'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: FontFamily.headlineSemiBold, fontSize: FontSize.bodyLG, color: Colors.onSurface },

  content: { paddingHorizontal: 20, paddingBottom: 100, gap: 16 },

  emptyText: { fontFamily: FontFamily.headlineSemiBold, fontSize: FontSize.bodyMD, color: Colors.onSurface },
  emptySub: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelMD, color: Colors.onSurfaceVariant, textAlign: 'center' },

  visitCard: { gap: 8 },
  visitHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  visitDate: { fontFamily: FontFamily.headlineSemiBold, fontSize: FontSize.bodyMD, color: Colors.onSurface },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  badgeText: { fontFamily: FontFamily.headlineMedium, fontSize: FontSize.labelSM },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelMD, color: Colors.onSurfaceVariant },
  diagnosisText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelMD, color: Colors.onSurface },
  medRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  itemRow: { flexDirection: 'row', gap: 12, paddingVertical: 4, borderTopWidth: 1, borderTopColor: Colors.surfaceContainerHigh },
  itemName: { fontFamily: FontFamily.headlineSemiBold, fontSize: FontSize.bodyMD, color: Colors.onSurface },
  itemExplain: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelMD, color: Colors.onSurfaceVariant, marginTop: 2 },
  itemValue: { fontFamily: FontFamily.headlineSemiBold, fontSize: FontSize.bodyMD },
  itemStatus: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelSM, marginTop: 2 },
  summaryText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelMD, color: Colors.onSurfaceVariant, marginTop: 4 },

  addBtn: {
    position: 'absolute', left: 20, right: 20, bottom: 24,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 9999, paddingVertical: 16,
  },
  addBtnLabel: { fontFamily: FontFamily.headlineSemiBold, fontSize: FontSize.bodyMD, color: Colors.onPrimary },

  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: Colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, maxHeight: '90%' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.outline, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontFamily: FontFamily.headlineBold, fontSize: FontSize.headlineMD, color: Colors.onSurface, marginBottom: 12 },
  previewImg: { width: '100%', height: 140, borderRadius: 16 },

  inputGroup: { gap: 8, marginBottom: 16 },
  inputLabel: { fontFamily: FontFamily.headlineMedium, fontSize: FontSize.labelMD, color: Colors.onSurfaceVariant },
  textInput: {
    fontFamily: FontFamily.bodyMedium, fontSize: FontSize.bodyMD, color: Colors.onSurface,
    backgroundColor: Colors.surfaceContainerHigh, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
  },
  multilineInput: { minHeight: 70, textAlignVertical: 'top' },

  dateRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceContainerHigh, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  dateInput: { flex: 2, fontFamily: FontFamily.headlineSemiBold, fontSize: FontSize.bodyLG, color: Colors.onSurface, padding: 0, textAlign: 'center' },
  dateInputSm: { flex: 1, fontFamily: FontFamily.headlineSemiBold, fontSize: FontSize.bodyLG, color: Colors.onSurface, padding: 0, textAlign: 'center' },
  dateSep: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.bodyLG, color: Colors.onSurfaceVariant },

  medHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addMedBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  addMedBtnLabel: { fontFamily: FontFamily.headlineMedium, fontSize: FontSize.labelMD, color: Colors.primary },
  medEditRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  medNameInput: { flex: 2, paddingVertical: 10 },
  medSmallInput: { flex: 1, paddingVertical: 10 },

  uploadReportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed', borderRadius: 14, paddingVertical: 14,
  },
  uploadReportBtnLabel: { fontFamily: FontFamily.headlineMedium, fontSize: FontSize.labelMD, color: Colors.primary },
  reportAttached: { gap: 8 },
  reportAttachedText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelMD, color: Colors.onSurfaceVariant },

  editItemCard: { backgroundColor: Colors.surfaceContainerHigh, borderRadius: 16, padding: 14, marginBottom: 12, gap: 8 },
  refRangeText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelSM, color: Colors.onSurfaceVariant },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputWrapSm: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  inputFieldSm: { fontFamily: FontFamily.headlineSemiBold, fontSize: FontSize.bodyMD, color: Colors.onSurface, padding: 0 },
  unitText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.bodyMD, color: Colors.onSurfaceVariant },

  statusRow: { flexDirection: 'row', gap: 6 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9999, borderWidth: 1.5, borderColor: Colors.outlineVariant, backgroundColor: Colors.surfaceContainerLowest },
  statusChipLabel: { fontFamily: FontFamily.headlineMedium, fontSize: FontSize.labelSM, color: Colors.onSurfaceVariant },

  explainInput: {
    fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelMD, color: Colors.onSurface,
    backgroundColor: Colors.surfaceContainerLowest, borderRadius: 10, padding: 10, minHeight: 60, textAlignVertical: 'top',
  },

  syncRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },

  saveBtn: { backgroundColor: Colors.primary, borderRadius: 9999, paddingVertical: 16, alignItems: 'center', marginTop: 4, marginBottom: 8 },
  saveBtnLabel: { fontFamily: FontFamily.headlineSemiBold, fontSize: FontSize.bodyMD, color: Colors.onPrimary },
});
