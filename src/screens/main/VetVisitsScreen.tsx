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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../types/navigation';
import Card from '../../components/ui/Card';
import { ThemeColors } from '../../constants/themes';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { FontFamily, FontSize } from '../../constants/typography';
import { getVetVisits, parseVisitReport, getVisitParseJob, createVetVisit, updateVetVisit, deleteVetVisit } from '../../api';
import { VetVisit, LabResultItem, Medication } from '../../types';

interface ReportDraft {
  imageUrl: string;
  reportType: string;
  summaryAdvice: string;
}

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
  route: RouteProp<RootStackParamList, 'VetVisits'>;
};

const STATUS_LABEL: Record<LabResultItem['status'], string> = {
  NORMAL: '正常', HIGH: '偏高', LOW: '偏低', UNKNOWN: '未知',
};
const makeStatusColor = (c: ThemeColors): Record<LabResultItem['status'], string> => ({
  NORMAL: c.secondary, HIGH: c.error, LOW: c.primary, UNKNOWN: c.outline,
});
const STATUS_OPTIONS: LabResultItem['status'][] = ['NORMAL', 'HIGH', 'LOW', 'UNKNOWN'];

function todayParts(): [string, string, string] {
  const d = new Date();
  return [String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')];
}

// 看診日期存的是「本機午夜」轉成的 ISO（見 handleSave 的說明），
// 在 UTC+8 會變成前一天 16:00Z。所以顯示時必須轉回本機時區，
// 不能直接切 ISO 字串的前 10 碼——那樣整整少一天。
function formatVisitDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

export default function VetVisitsScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { petId, petName } = route.params;

  const [visits, setVisits] = useState<VetVisit[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDeleteVisit = (visitId: string) => {
    Alert.alert('刪除就醫紀錄', '此操作無法復原，確定要刪除這筆紀錄嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除', style: 'destructive',
        onPress: async () => {
          setDeletingId(visitId);
          const res = await deleteVetVisit(petId, visitId);
          setDeletingId(null);
          if (res.success) {
            setVisits((prev) => prev.filter((v) => v.id !== visitId));
          } else {
            Alert.alert('刪除失敗', res.message || '請稍後再試');
          }
        },
      },
    ]);
  };
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formVisible, setFormVisible] = useState(false);
  // null = 新增模式；有值 = 正在編輯該筆紀錄
  const [editingId, setEditingId] = useState<string | null>(null);
  // 編輯模式下用來判斷「有沒有真的改過東西」，決定關閉前要不要攔一下
  const editSnapshotRef = useRef<string>('');
  const [dateParts, setDateParts] = useState<[string, string, string]>(todayParts());
  const [clinicName, setClinicName] = useState('');
  const [diagnosisNote, setDiagnosisNote] = useState('');
  const [medications, setMedications] = useState<Medication[]>([]);
  const [syncToCalendar, setSyncToCalendar] = useState(true);
  const [draft, setDraft] = useState<ReportDraft | null>(null);
  const [draftItems, setDraftItems] = useState<LabResultItem[]>([]);
  const slideAnim = useRef(new Animated.Value(500)).current;
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => {
    getVetVisits(petId).then((res) => {
      if (res.success) setVisits(res.data);
    }).finally(() => setLoading(false));
  };

  // 手動欄位（診所/日期/用藥等）只存在畫面的本地 state，從來沒有送到後端過；
  // 邊填邊存到手機本機，這樣背景解析完成、使用者從推播通知點回來時（畫面會重新掛載）才救得回來，
  // 不然就只有解析出來的報告數值能還原，其他都會變回空白
  const draftStorageKey = `vetvisit_draft_${petId}`;
  useEffect(() => {
    if (!formVisible) return;
    // 編輯既有紀錄時不寫草稿——這個 key 是給「新增到一半被背景解析推播打斷」用的還原機制，
    // 編輯模式寫進去會污染下一次新增時還原出來的內容
    if (editingId) return;
    const data = { dateParts, clinicName, diagnosisNote, medications, syncToCalendar };
    AsyncStorage.setItem(draftStorageKey, JSON.stringify(data)).catch(() => {});
  }, [formVisible, editingId, dateParts, clinicName, diagnosisNote, medications, syncToCalendar]);

  useEffect(() => { load(); }, [petId]);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };
  useEffect(() => stopPolling, []);

  // 檢查一次背景解析工作的狀態；ready/failed 回傳結果讓呼叫端決定要不要停止輪詢
  const checkParseJob = async (jobId: string): Promise<'ready' | 'failed' | 'processing'> => {
    const res = await getVisitParseJob(petId, jobId);
    if (!res.success) return 'processing'; // 網路暫時失敗，下一輪再試
    if (res.data.status === 'ready') {
      setDraft({ imageUrl: res.data.imageUrl, reportType: res.data.reportType, summaryAdvice: res.data.summaryAdvice });
      setDraftItems(res.data.items);
      // 解析成功但可能有漏抓——資料是對的、只是不一定完整，所以不擋流程，只提醒對照紙本
      if (res.data.warningMessage) {
        Alert.alert('請確認是否有遺漏', res.data.warningMessage);
      }
      return 'ready';
    }
    if (res.data.status === 'failed') {
      Alert.alert('解析失敗', res.data.errorMessage || '請稍後再試');
      return 'failed';
    }
    return 'processing';
  };

  const pollParseJob = (jobId: string) => {
    stopPolling();
    setParsing(true);
    const tick = async () => {
      const result = await checkParseJob(jobId);
      if (result !== 'processing') {
        stopPolling();
        setParsing(false);
      }
    };
    tick();
    pollRef.current = setInterval(tick, 4000);
  };

  // 從推播通知點進來時，畫面一開就自動打開表單並接續查詢那個解析工作；
  // 不能直接呼叫 openForm()（那個會把手動欄位重設成空白），要先試著從本機草稿救回剛剛填的內容
  useEffect(() => {
    if (!route.params.pendingJobId) return;
    const jobId = route.params.pendingJobId;
    (async () => {
      let restored = false;
      try {
        const saved = await AsyncStorage.getItem(draftStorageKey);
        if (saved) {
          const d = JSON.parse(saved);
          setDateParts(d.dateParts ?? todayParts());
          setClinicName(d.clinicName ?? '');
          setDiagnosisNote(d.diagnosisNote ?? '');
          setMedications(d.medications ?? []);
          setSyncToCalendar(d.syncToCalendar ?? true);
          restored = true;
        }
      } catch {}
      if (!restored) {
        setDateParts(todayParts());
        setClinicName('');
        setDiagnosisNote('');
        setMedications([]);
        setSyncToCalendar(true);
      }
      setDraft(null);
      setDraftItems([]);
      setFormVisible(true);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 150 }).start();
      pollParseJob(jobId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params.pendingJobId]);

  const openForm = () => {
    AsyncStorage.removeItem(draftStorageKey).catch(() => {}); // 開新的一筆，清掉舊草稿避免混到上一筆的內容
    setEditingId(null);
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

  const openEditForm = (visit: VetVisit) => {
    const d = new Date(visit.visitDate);
    const parts: [string, string, string] = [
      String(d.getFullYear()),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ];
    const meds = visit.medications.map((m) => ({ ...m }));
    const items = visit.items.map((i) => ({ ...i }));
    const synced = !!visit.calendarEventId;

    setEditingId(visit.id);
    setDateParts(parts);
    setClinicName(visit.clinicName ?? '');
    setDiagnosisNote(visit.diagnosisNote ?? '');
    setMedications(meds);
    setSyncToCalendar(synced);
    // 編輯模式不重新上傳報告，但要保留既有的解析結果讓使用者能校對數值
    setDraft(null);
    setDraftItems(items);

    editSnapshotRef.current = JSON.stringify({
      dateParts: parts,
      clinicName: visit.clinicName ?? '',
      diagnosisNote: visit.diagnosisNote ?? '',
      medications: meds,
      syncToCalendar: synced,
      draftItems: items,
    });

    setFormVisible(true);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 150 }).start();
  };

  const closeForm = () => {
    stopPolling();
    setParsing(false);
    // 存檔成功、或使用者確認放棄這次填寫，都算這次的草稿結束了，清掉本機暫存
    AsyncStorage.removeItem(draftStorageKey).catch(() => {});
    Animated.timing(slideAnim, { toValue: 500, duration: 240, useNativeDriver: true })
      .start(() => setFormVisible(false));
  };

  // 點外面或按返回鍵想關閉表單時，如果已經填了東西（或報告還在解析中），先跟使用者確認，
  // 不然一滑掉/一按返回鍵，剛剛填的內容就默默消失了
  const hasUnsavedInput = () => {
    // 編輯模式的欄位一開始就有值，不能用「有沒有填東西」判斷，
    // 改成跟開啟當下的快照比對，真的改過才攔
    if (editingId) {
      const now = JSON.stringify({ dateParts, clinicName, diagnosisNote, medications, syncToCalendar, draftItems });
      return now !== editSnapshotRef.current;
    }
    return !!(clinicName.trim() || diagnosisNote.trim() || medications.some((m) => m.name.trim()) || draft || draftItems.length > 0 || parsing);
  };

  const attemptCloseForm = () => {
    if (!hasUnsavedInput()) {
      closeForm();
      return;
    }
    Alert.alert('放棄這次填寫的內容？', '關閉後目前輸入的資料不會被儲存。', [
      { text: '繼續填寫', style: 'cancel' },
      { text: '放棄並關閉', style: 'destructive', onPress: closeForm },
    ]);
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
    if (!asset?.uri) {
      Alert.alert('讀取照片失敗', '請重新選擇一次照片。');
      return;
    }

    try {
      const res = await parseVisitReport(petId, { uri: asset.uri, name: asset.fileName ?? 'report.jpg', type: asset.mimeType ?? 'image/jpeg' });
      if (res.success) {
        // 不等解析完成——後端在背景跑，這裡開始輪詢；使用者可以繼續填其他欄位，
        // 也可以直接關掉表單離開，解析完成後會收到推播通知
        pollParseJob(res.data.jobId);
      } else {
        Alert.alert('上傳失敗', res.message || '請稍後再試');
      }
    } catch {
      Alert.alert('上傳失敗', '網路錯誤，請稍後再試');
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

  // AI 辨識不可能 100%——實測 test4（16 項）只抽到 13 項，且模型自己數的列數也不準，
  // 沒有可靠的方法自動偵測遺漏。所以人工複核這步必須能「補完」而不只是「修改」，
  // 否則使用者發現少了一項也只能整筆放棄重來
  const addDraftItem = () => {
    setDraftItems((prev) => [
      ...prev,
      { itemName: '', abbreviation: '', value: 0, unit: '', refRange: '', status: 'UNKNOWN', plainExplanation: '' },
    ]);
  };
  const removeDraftItem = (index: number) => {
    setDraftItems((prev) => prev.filter((_, i) => i !== index));
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
    // 不能只檢查有沒有填——2026/13/45 三欄都有值但不是真實日期，
    // 直接丟給 new Date() 會被自動進位成別的日子，使用者不會發現
    const yy = Number(y), mm = Number(m), dd = Number(d);
    const probe = new Date(yy, mm - 1, dd);
    const isRealDate =
      probe.getFullYear() === yy && probe.getMonth() === mm - 1 && probe.getDate() === dd;
    if (!isRealDate) {
      Alert.alert('看診日期不正確', '請確認年、月、日填寫正確。');
      return;
    }
    if (!clinicName.trim()) {
      Alert.alert('請填寫診所名稱', '就醫紀錄需要知道是在哪裡看的診。');
      return;
    }
    setSaving(true);
    try {
      // 用本機時區組出當天午夜的時間點再轉 ISO，而不是傳純日期字串給後端用 UTC 解析——
      // 不然後端 new Date('2026-07-24') 是 UTC 午夜，換算成台灣時間顯示會變成早上 8 點，
      // 行事曆那邊的全天事件判斷（時:分是否為 0:0）就會跟著誤判成有指定時間
      const visitDateISO = new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0).toISOString();
      const byDateDesc = (a: VetVisit, b: VetVisit) =>
        new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime();

      // 使用者按了「新增項目」卻沒填名稱的空白列不要存進去
      const cleanedItems = draftItems
        .filter((it) => it.itemName.trim())
        .map((it) => ({ ...it, itemName: it.itemName.trim(), unit: (it.unit ?? '').trim() }));

      const res = editingId
        ? await updateVetVisit(petId, editingId, {
            visitDate: visitDateISO,
            clinicName: clinicName.trim(),
            diagnosisNote: diagnosisNote.trim(),
            medications: medications.filter((med) => med.name.trim()),
            items: cleanedItems,
            syncToCalendar,
          })
        : await createVetVisit(petId, {
            visitDate: visitDateISO,
            clinicName: clinicName.trim(),
            diagnosisNote: diagnosisNote.trim(),
            medications: medications.filter((med) => med.name.trim()),
            imageUrl: draft?.imageUrl,
            reportType: draft?.reportType,
            items: cleanedItems,
            summaryAdvice: draft?.summaryAdvice,
            syncToCalendar,
          });

      if (res.success) {
        // 日期可能被改過，兩種情況都要重新依看診日期排序（新到舊）
        setVisits((prev) =>
          (editingId ? prev.map((v) => (v.id === editingId ? res.data : v)) : [res.data, ...prev]).sort(byDateDesc)
        );
        closeForm();
      } else {
        Alert.alert(editingId ? '更新失敗' : '儲存失敗', res.message || '請稍後再試');
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
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{petName} 的就醫紀錄</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : visits.length === 0 ? (
          <Card style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
            <MaterialIcons name="event-note" size={32} color={colors.outline} />
            <Text style={styles.emptyText}>尚未記錄任何就醫紀錄</Text>
            <Text style={styles.emptySub}>記錄看診日期、診所、用藥，需要時也可以順便上傳檢驗報告</Text>
          </Card>
        ) : (
          visits.map((v) => {
            const abnormalCount = v.items.filter((i) => i.status === 'HIGH' || i.status === 'LOW').length;
            return (
              <Card key={v.id} style={styles.visitCard}>
                <View style={styles.visitHead}>
                  <Text style={styles.visitDate}>{formatVisitDate(v.visitDate)}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {abnormalCount > 0 && (
                      <View style={[styles.badge, { backgroundColor: colors.errorContainer }]}>
                        <Text style={[styles.badgeText, { color: colors.error }]}>{abnormalCount} 項異常</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      onPress={() => openEditForm(v)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialIcons name="edit" size={19} color={colors.onSurfaceVariant} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteVisit(v.id)}
                      disabled={deletingId === v.id}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {deletingId === v.id ? (
                        <ActivityIndicator size="small" color={colors.error} />
                      ) : (
                        <MaterialIcons name="delete-outline" size={20} color={colors.error} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
                {v.clinicName ? (
                  <View style={styles.metaRow}>
                    <MaterialIcons name="local-hospital" size={14} color={colors.onSurfaceVariant} />
                    <Text style={styles.metaText}>{v.clinicName}</Text>
                  </View>
                ) : null}
                {v.diagnosisNote ? <Text style={styles.diagnosisText}>{v.diagnosisNote}</Text> : null}
                {v.medications.length > 0 && (
                  <View style={styles.medRow}>
                    <MaterialIcons name="medication" size={14} color={colors.onSurfaceVariant} />
                    <Text style={styles.metaText}>
                      {v.medications.map((med) => med.name).join('、')}
                    </Text>
                  </View>
                )}
                {v.items.length > 0 && (
                  <>
                    <TouchableOpacity
                      style={styles.expandToggle}
                      activeOpacity={0.7}
                      onPress={() => toggleExpanded(v.id)}
                    >
                      <Text style={styles.expandToggleText}>
                        {expandedIds.has(v.id) ? '收合檢驗數值' : `查看檢驗數值（${v.items.length} 項）`}
                      </Text>
                      <MaterialIcons
                        name={expandedIds.has(v.id) ? 'expand-less' : 'expand-more'}
                        size={18} color={colors.primary}
                      />
                    </TouchableOpacity>
                    {expandedIds.has(v.id) && v.items.map((item, i) => (
                      <View key={i} style={styles.itemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemName}>{item.itemName}{item.abbreviation ? `（${item.abbreviation}）` : ''}</Text>
                          <Text style={styles.itemExplain}>{item.plainExplanation}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[styles.itemValue, { color: makeStatusColor(colors)[item.status] }]}>{item.value} {item.unit}</Text>
                          <Text style={[styles.itemStatus, { color: makeStatusColor(colors)[item.status] }]}>{STATUS_LABEL[item.status]}</Text>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity style={styles.addBtn} activeOpacity={0.85} onPress={openForm}>
        <MaterialIcons name="add" size={20} color={colors.onPrimary} />
        <Text style={styles.addBtnLabel}>新增就醫紀錄</Text>
      </TouchableOpacity>

      <Modal visible={formVisible} transparent animationType="none" onRequestClose={attemptCloseForm}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={attemptCloseForm} />
          <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 24, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.sheetHandle} />
            {/* flexShrink 讓捲動區在內容過長時讓出空間給底部固定的儲存按鈕，
                否則 sheet 的 maxHeight 會把 footer 擠出畫面外 */}
            <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetTitle}>{editingId ? '編輯就醫紀錄' : '新增就醫紀錄'}</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>看診日期 <Text style={styles.requiredMark}>*</Text></Text>
                <View style={styles.dateRow}>
                  <TextInput
                    style={styles.dateInput} value={dateParts[0]}
                    onChangeText={(v) => setDateParts([v, dateParts[1], dateParts[2]])}
                    placeholder="年" keyboardType="number-pad" maxLength={4} placeholderTextColor={colors.outline}
                  />
                  <Text style={styles.dateSep}>/</Text>
                  <TextInput
                    style={styles.dateInputSm} value={dateParts[1]}
                    onChangeText={(v) => setDateParts([dateParts[0], v, dateParts[2]])}
                    placeholder="月" keyboardType="number-pad" maxLength={2} placeholderTextColor={colors.outline}
                  />
                  <Text style={styles.dateSep}>/</Text>
                  <TextInput
                    style={styles.dateInputSm} value={dateParts[2]}
                    onChangeText={(v) => setDateParts([dateParts[0], dateParts[1], v])}
                    placeholder="日" keyboardType="number-pad" maxLength={2} placeholderTextColor={colors.outline}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>診所名稱 <Text style={styles.requiredMark}>*</Text></Text>
                <TextInput
                  style={styles.textInput} value={clinicName} onChangeText={setClinicName}
                  placeholder="例：安心動物醫院" placeholderTextColor={colors.outline}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>看診原因/診斷內容</Text>
                <TextInput
                  style={[styles.textInput, styles.multilineInput]} value={diagnosisNote} onChangeText={setDiagnosisNote}
                  placeholder="例：食慾不振三天，診斷為輕微腸胃炎" placeholderTextColor={colors.outline} multiline
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.medHeaderRow}>
                  <Text style={styles.inputLabel}>用藥紀錄</Text>
                  <TouchableOpacity style={styles.addMedBtn} onPress={addMedication}>
                    <MaterialIcons name="add" size={16} color={colors.primary} />
                    <Text style={styles.addMedBtnLabel}>新增用藥</Text>
                  </TouchableOpacity>
                </View>
                {medications.map((med, index) => (
                  <View key={index} style={styles.medEditRow}>
                    <TextInput
                      style={[styles.textInput, styles.medNameInput]} value={med.name}
                      onChangeText={(v) => updateMedication(index, { name: v })}
                      placeholder="藥名" placeholderTextColor={colors.outline}
                    />
                    <TextInput
                      style={[styles.textInput, styles.medSmallInput]} value={med.dosage}
                      onChangeText={(v) => updateMedication(index, { dosage: v })}
                      placeholder="mg/顆" placeholderTextColor={colors.outline}
                    />
                    <TextInput
                      style={[styles.textInput, styles.medSmallInput]} value={med.frequency}
                      onChangeText={(v) => updateMedication(index, { frequency: v })}
                      placeholder="次/日" placeholderTextColor={colors.outline}
                    />
                    <TouchableOpacity onPress={() => removeMedication(index)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <MaterialIcons name="close" size={18} color={colors.outlineVariant} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>檢驗報告（可選）</Text>
                {editingId ? (
                  <Text style={styles.uploadHintText}>
                    {draftItems.length > 0
                      ? '報告圖片無法更換（圖片與數值是綁定的）。下方的數值、狀態與說明都可以直接修改；要換一份報告請刪除整筆紀錄後重新建立。'
                      : '這筆紀錄沒有檢驗報告。要補上報告請刪除整筆紀錄後重新建立。'}
                  </Text>
                ) : (
                  <Text style={styles.uploadHintText}>限血檢、生化、尿檢等有數值的報告單，X 光／超音波影像目前無法辨識</Text>
                )}
                {editingId ? null : draft ? (
                  <View style={styles.reportAttached}>
                    <Image source={{ uri: draft.imageUrl }} style={styles.previewImg} />
                    <Text style={styles.reportAttachedText}>已附上 {draftItems.length} 項檢驗數值</Text>
                  </View>
                ) : parsing ? (
                  <View style={styles.parsingRow}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={styles.parsingText}>AI 正在背景解析報告，可以先繼續填寫其他欄位，完成後會推播通知你，也可以先關閉這個視窗</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.uploadReportBtn} onPress={showPickerOptions}>
                    <MaterialIcons name="add-a-photo" size={18} color={colors.primary} />
                    <Text style={styles.uploadReportBtnLabel}>上傳檢驗報告，AI 自動解析</Text>
                  </TouchableOpacity>
                )}
              </View>

              {draftItems.length > 0 && (
                <Text style={styles.reviewHint}>
                  AI 辨識可能有遺漏或誤讀，請對照紙本核對。缺少的項目可以用下方「＋ 新增項目」自己補上。
                </Text>
              )}

              {draftItems.map((item, index) => (
                <View key={index} style={styles.editItemCard}>
                  <View style={styles.editRow}>
                    <View style={[styles.inputWrapSm, { flex: 1 }]}>
                      <TextInput
                        style={styles.inputFieldSm} value={item.itemName}
                        onChangeText={(v) => updateDraftItem(index, { itemName: v })}
                        placeholder="項目名稱（例：鉀離子 K）" placeholderTextColor={colors.outline}
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => removeDraftItem(index)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MaterialIcons name="close" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.editRow}>
                    <View style={[styles.inputWrapSm, { flex: 1 }]}>
                      <TextInput
                        style={styles.inputFieldSm} value={String(item.value)}
                        onChangeText={(v) => { const n = parseFloat(v); updateDraftItem(index, { value: isNaN(n) ? 0 : n }); }}
                        keyboardType="decimal-pad" placeholder="數值" placeholderTextColor={colors.outline}
                      />
                    </View>
                    <View style={[styles.inputWrapSm, { flex: 1 }]}>
                      <TextInput
                        style={styles.inputFieldSm} value={item.unit}
                        onChangeText={(v) => updateDraftItem(index, { unit: v })}
                        placeholder="單位" placeholderTextColor={colors.outline}
                      />
                    </View>
                  </View>
                  <View style={[styles.inputWrapSm, { marginTop: 8 }]}>
                    <TextInput
                      style={styles.inputFieldSm} value={item.refRange ?? ''}
                      onChangeText={(v) => updateDraftItem(index, { refRange: v })}
                      placeholder="參考範圍（選填，例：3.5 - 5.8）" placeholderTextColor={colors.outline}
                    />
                  </View>
                  <View style={styles.statusRow}>
                    {STATUS_OPTIONS.map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.statusChip, item.status === s && { backgroundColor: makeStatusColor(colors)[s], borderColor: makeStatusColor(colors)[s] }]}
                        onPress={() => updateDraftItem(index, { status: s })}
                      >
                        <Text style={[styles.statusChipLabel, item.status === s && { color: colors.onPrimary }]}>{STATUS_LABEL[s]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={styles.explainInput} value={item.plainExplanation}
                    onChangeText={(v) => updateDraftItem(index, { plainExplanation: v })}
                    multiline placeholder="白話文解釋" placeholderTextColor={colors.outline}
                  />
                </View>
              ))}

              {(draftItems.length > 0 || editingId) && (
                <TouchableOpacity style={styles.addItemBtn} onPress={addDraftItem} activeOpacity={0.75}>
                  <MaterialIcons name="add" size={18} color={colors.primary} />
                  <Text style={styles.addItemBtnLabel}>新增項目</Text>
                </TouchableOpacity>
              )}

              <View style={styles.syncRow}>
                <Text style={styles.inputLabel}>同步到行事曆</Text>
                <Switch value={syncToCalendar} onValueChange={setSyncToCalendar} trackColor={{ true: colors.primary }} />
              </View>

            </ScrollView>

            {/* 儲存按鈕固定在底部，不放進 ScrollView——檢驗數值可能有幾十項，
                放在捲動區最後會逼使用者滑過整份報告才按得到 */}
            <View style={styles.sheetFooter}>
              {parsing && (
                <Text style={styles.parsingHint}>報告還在背景解析中，請等解析完成後再儲存，不然這次的檢驗數值會沒有存進這筆紀錄</Text>
              )}
              <TouchableOpacity
                style={[styles.saveBtn, (saving || parsing) && { opacity: 0.6 }]}
                activeOpacity={0.85} onPress={handleSave} disabled={saving || parsing}
              >
                <Text style={styles.saveBtnLabel}>
                  {saving
                    ? (editingId ? '更新中...' : '儲存中...')
                    : parsing
                      ? '報告解析中...'
                      : (editingId ? '儲存變更' : '確認並儲存')}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: FontFamily.headlineSemiBold, fontSize: FontSize.bodyLG, color: c.onSurface },

  content: { paddingHorizontal: 20, paddingBottom: 100, gap: 16 },

  emptyText: { fontFamily: FontFamily.headlineSemiBold, fontSize: FontSize.bodyMD, color: c.onSurface },
  emptySub: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelMD, color: c.onSurfaceVariant, textAlign: 'center' },

  visitCard: { gap: 8 },
  visitHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  visitDate: { fontFamily: FontFamily.headlineSemiBold, fontSize: FontSize.bodyMD, color: c.onSurface },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  badgeText: { fontFamily: FontFamily.headlineMedium, fontSize: FontSize.labelSM },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelMD, color: c.onSurfaceVariant },
  diagnosisText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelMD, color: c.onSurface },
  medRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  itemRow: { flexDirection: 'row', gap: 12, paddingVertical: 4, borderTopWidth: 1, borderTopColor: c.surfaceContainerHigh },
  itemName: { fontFamily: FontFamily.headlineSemiBold, fontSize: FontSize.bodyMD, color: c.onSurface },
  itemExplain: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelMD, color: c.onSurfaceVariant, marginTop: 2 },
  itemValue: { fontFamily: FontFamily.headlineSemiBold, fontSize: FontSize.bodyMD },
  itemStatus: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelSM, marginTop: 2 },
  expandToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 6, marginTop: 2 },
  expandToggleText: { fontFamily: FontFamily.headlineMedium, fontSize: FontSize.labelMD, color: c.primary },

  addBtn: {
    position: 'absolute', left: 20, right: 20, bottom: 24,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: c.primary, borderRadius: 9999, paddingVertical: 16,
  },
  addBtnLabel: { fontFamily: FontFamily.headlineSemiBold, fontSize: FontSize.bodyMD, color: c.onPrimary },

  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: c.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, maxHeight: '90%' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: c.outline, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontFamily: FontFamily.headlineBold, fontSize: FontSize.headlineMD, color: c.onSurface, marginBottom: 12 },
  previewImg: { width: '100%', height: 140, borderRadius: 16 },

  inputGroup: { gap: 8, marginBottom: 16 },
  inputLabel: { fontFamily: FontFamily.headlineMedium, fontSize: FontSize.labelMD, color: c.onSurfaceVariant },
  requiredMark: { color: c.error },
  textInput: {
    fontFamily: FontFamily.bodyMedium, fontSize: FontSize.bodyMD, color: c.onSurface,
    backgroundColor: c.surfaceContainerHigh, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
  },
  multilineInput: { minHeight: 70, textAlignVertical: 'top' },

  dateRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surfaceContainerHigh, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  dateInput: { flex: 2, fontFamily: FontFamily.headlineSemiBold, fontSize: FontSize.bodyLG, color: c.onSurface, padding: 0, textAlign: 'center' },
  dateInputSm: { flex: 1, fontFamily: FontFamily.headlineSemiBold, fontSize: FontSize.bodyLG, color: c.onSurface, padding: 0, textAlign: 'center' },
  dateSep: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.bodyLG, color: c.onSurfaceVariant },

  medHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addMedBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  addMedBtnLabel: { fontFamily: FontFamily.headlineMedium, fontSize: FontSize.labelMD, color: c.primary },
  medEditRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  medNameInput: { flex: 2, paddingVertical: 10 },
  medSmallInput: { flex: 1, paddingVertical: 10 },

  uploadHintText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelSM, color: c.onSurfaceVariant },
  uploadReportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: c.primary, borderStyle: 'dashed', borderRadius: 14, paddingVertical: 14,
  },
  uploadReportBtnLabel: { fontFamily: FontFamily.headlineMedium, fontSize: FontSize.labelMD, color: c.primary },
  reportAttached: { gap: 8 },
  parsingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: c.surfaceContainerHigh, borderRadius: 14, padding: 14,
  },
  parsingText: { flex: 1, fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelMD, color: c.onSurfaceVariant, lineHeight: 20 },
  reportAttachedText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelMD, color: c.onSurfaceVariant },

  editItemCard: { backgroundColor: c.surfaceContainerHigh, borderRadius: 16, padding: 14, marginBottom: 12, gap: 8 },
  refRangeText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelSM, color: c.onSurfaceVariant },
  reviewHint: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
    backgroundColor: c.surfaceContainerHigh,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    lineHeight: 18,
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.primary,
    marginBottom: 16,
  },
  addItemBtnLabel: { fontFamily: FontFamily.headlineSemiBold, fontSize: FontSize.labelMD, color: c.primary },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputWrapSm: { backgroundColor: c.surfaceContainerLowest, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  inputFieldSm: { fontFamily: FontFamily.headlineSemiBold, fontSize: FontSize.bodyMD, color: c.onSurface, padding: 0 },
  unitText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.bodyMD, color: c.onSurfaceVariant },

  statusRow: { flexDirection: 'row', gap: 6 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9999, borderWidth: 1.5, borderColor: c.outlineVariant, backgroundColor: c.surfaceContainerLowest },
  statusChipLabel: { fontFamily: FontFamily.headlineMedium, fontSize: FontSize.labelSM, color: c.onSurfaceVariant },

  explainInput: {
    fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelMD, color: c.onSurface,
    backgroundColor: c.surfaceContainerLowest, borderRadius: 10, padding: 10, minHeight: 60, textAlignVertical: 'top',
  },

  syncRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },

  parsingHint: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.labelSM, color: c.error, textAlign: 'center', marginBottom: 8 },
  sheetFooter: {
    borderTopWidth: 1,
    borderTopColor: c.surfaceVariant,
    paddingTop: 12,
    backgroundColor: c.background,
  },
  saveBtn: { backgroundColor: c.primary, borderRadius: 9999, paddingVertical: 16, alignItems: 'center', marginTop: 4, marginBottom: 8 },
  saveBtnLabel: { fontFamily: FontFamily.headlineSemiBold, fontSize: FontSize.bodyMD, color: c.onPrimary },
});
