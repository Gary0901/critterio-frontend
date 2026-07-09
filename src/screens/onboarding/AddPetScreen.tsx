import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { addPet } from '../../api';
import { Species, Gender } from '../../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AddPet'>;
  route: RouteProp<RootStackParamList, 'AddPet'>;
};

type SpeciesItem = {
  value: Species;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
};

const SPECIES_LIST: SpeciesItem[] = [
  { value: 'dog',     label: '狗',     icon: 'dog' },
  { value: 'cat',     label: '貓',     icon: 'cat' },
  { value: 'rabbit',  label: '兔子',   icon: 'rabbit' },
  { value: 'small',   label: '小動物', icon: 'rodent' },
  { value: 'bird',    label: '鳥類',   icon: 'bird' },
  { value: 'reptile', label: '爬蟲類', icon: 'turtle' },
  { value: 'other',   label: '其他',   icon: 'paw' },
];

const BREEDS: Record<Species, string[]> = {
  dog:     ['黃金獵犬', '拉布拉多', '貴賓犬', '米格魯', '西施犬', '柯基', '哈士奇', '雪納瑞', '吉娃娃', '法鬥'],
  cat:     ['波斯貓', '暹羅貓', '緬因貓', '布偶貓', '英國短毛貓', '蘇格蘭折耳', '孟加拉貓', '美國短毛貓'],
  rabbit:  ['迷你垂耳兔', '迷你雷克斯', '獅子兔', '雷克斯兔', '安哥拉兔'],
  small:   ['天竺鼠', '倉鼠', '龍貓', '雪貂', '沙鼠'],
  bird:    ['玄鳳鸚鵡', '虎皮鸚鵡', '鳳頭鸚鵡', '風信子金剛鸚鵡', '愛情鳥', '折衷鸚鵡', '綠頰錐尾鸚鵡', '金絲雀', '哈恩金剛鸚鵡', '斑胸草雀'],
  reptile: ['烏龜', '豹紋守宮', '肥尾守宮', '鬆獅蜥', '變色龍', '玉米蛇', '球蟒', '藍舌蜥'],
  other:   [],
};

export default function AddPetScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const [name, setName]           = useState('');
  const [gender, setGender]       = useState<Gender>('male');
  const [species, setSpecies]     = useState<Species>('dog');
  const [breed, setBreed]         = useState('');
  const [weightKg, setWeightKg]   = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'g'>('kg');
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay]   = useState('');
  const [joinYear, setJoinYear]   = useState('');
  const [joinMonth, setJoinMonth] = useState('');
  const [joinDay, setJoinDay]     = useState('');
  const [notes, setNotes]         = useState('');
  const [photoUri, setPhotoUri]   = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const handleSpeciesChange = (s: Species) => {
    setSpecies(s);
    setBreed('');
    if (!weightKg.trim()) {
      setWeightUnit(s === 'bird' || s === 'reptile' || s === 'small' ? 'g' : 'kg');
    }
  };

  const toggleWeightUnit = () => {
    setWeightUnit((prevUnit) => {
      const nextUnit = prevUnit === 'kg' ? 'g' : 'kg';
      const current = parseFloat(weightKg);
      if (!isNaN(current)) {
        setWeightKg(
          nextUnit === 'g' ? String(Math.round(current * 1000)) : String(Math.round((current / 1000) * 1000) / 1000)
        );
      }
      return nextUnit;
    });
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    const enteredWeight = parseFloat(weightKg);
    const weightInKg = weightUnit === 'g' ? enteredWeight / 1000 : enteredWeight;
    if (weightKg.trim() !== '') {
      if (isNaN(weightInKg) || weightInKg < 0.01 || weightInKg > 200) {
        Alert.alert(
          '體重範圍錯誤',
          weightUnit === 'g' ? '請輸入 10–200000 g 的合理數值' : '請輸入 0.01–200 kg 的合理數值'
        );
        return;
      }
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('species', species);
      formData.append('breed', breed.trim() || 'Mixed');
      if (birthYear && birthMonth && birthDay) {
        const birthday = `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`;
        formData.append('birthday', birthday);
      }
      if (joinYear && joinMonth && joinDay) {
        const joinedFamilyAt = `${joinYear}-${joinMonth.padStart(2, '0')}-${joinDay.padStart(2, '0')}`;
        formData.append('joinedFamilyAt', joinedFamilyAt);
      }
      formData.append('gender', gender);
      formData.append('weight', String(weightInKg || 0));
      if (photoUri) {
        const filename = photoUri.split('/').pop() ?? 'photo.jpg';
        const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
        formData.append('photo', { uri: photoUri, name: filename, type: `image/${ext}` } as any);
      }

      await addPet(formData as any);
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } finally {
      setLoading(false);
    }
  };

  const breeds = BREEDS[species];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>新增寵物</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Photo ── */}
        <View style={styles.photoSection}>
          <TouchableOpacity style={styles.photoCircle} activeOpacity={0.75} onPress={pickPhoto}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
            ) : (
              <>
                <MaterialCommunityIcons name="camera-plus-outline" size={30} color={Colors.outline} />
                <Text style={styles.photoLabel}>新增照片</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Name ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>名稱</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.inputField}
              placeholder="例如：小白"
              placeholderTextColor={Colors.outline}
              value={name}
              onChangeText={setName}
            />
          </View>
        </View>

        {/* ── Gender ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>性別</Text>
          <View style={styles.genderRow}>
            {(['male', 'female'] as Gender[]).map((g) => {
              const active = gender === g;
              return (
                <TouchableOpacity
                  key={g}
                  style={[styles.genderChip, active && styles.genderChipActive]}
                  onPress={() => setGender(g)}
                  activeOpacity={0.75}
                >
                  <MaterialCommunityIcons
                    name={g === 'male' ? 'gender-male' : 'gender-female'}
                    size={18}
                    color={active ? Colors.onPrimary : Colors.onSurfaceVariant}
                  />
                  <Text style={[styles.genderLabel, active && styles.genderLabelActive]}>
                    {g === 'male' ? '男生' : '女生'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Species ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>物種</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.speciesScroll}
          >
            {SPECIES_LIST.map((s) => {
              const active = species === s.value;
              return (
                <TouchableOpacity
                  key={s.value}
                  style={[styles.speciesChip, active && styles.speciesChipActive]}
                  onPress={() => handleSpeciesChange(s.value)}
                  activeOpacity={0.75}
                >
                  <MaterialCommunityIcons
                    name={s.icon}
                    size={28}
                    color={active ? Colors.primary : Colors.onSurfaceVariant}
                  />
                  <Text style={[styles.speciesLabel, active && styles.speciesLabelActive]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Breed ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>品種</Text>
          {breeds.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.breedScroll}
            >
              {breeds.map((b) => {
                const active = breed === b;
                return (
                  <TouchableOpacity
                    key={b}
                    style={[styles.breedChip, active && styles.breedChipActive]}
                    onPress={() => setBreed(active ? '' : b)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.breedChipLabel, active && styles.breedChipLabelActive]}>
                      {b}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.inputField}
              placeholder={breeds.length > 0 ? '或直接輸入品種...' : '輸入品種...'}
              placeholderTextColor={Colors.outline}
              value={breed}
              onChangeText={setBreed}
            />
          </View>
        </View>

        {/* ── Weight ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>體重</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.inputField}
              placeholder="0.0"
              placeholderTextColor={Colors.outline}
              keyboardType="decimal-pad"
              value={weightKg}
              onChangeText={setWeightKg}
            />
            <TouchableOpacity onPress={toggleWeightUnit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.inputSuffix, styles.inputSuffixToggle]}>{weightUnit}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Birthday ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>生日</Text>
          <View style={styles.dateRow}>
            <View style={[styles.inputWrap, { flex: 5 }]}>
              <TextInput
                style={[styles.inputField, styles.dateField]}
                placeholder="YYYY"
                placeholderTextColor={Colors.outline}
                keyboardType="number-pad"
                maxLength={4}
                value={birthYear}
                onChangeText={setBirthYear}
              />
            </View>
            <Text style={styles.dateSep}>/</Text>
            <View style={[styles.inputWrap, { flex: 3 }]}>
              <TextInput
                style={[styles.inputField, styles.dateField]}
                placeholder="MM"
                placeholderTextColor={Colors.outline}
                keyboardType="number-pad"
                maxLength={2}
                value={birthMonth}
                onChangeText={setBirthMonth}
              />
            </View>
            <Text style={styles.dateSep}>/</Text>
            <View style={[styles.inputWrap, { flex: 3 }]}>
              <TextInput
                style={[styles.inputField, styles.dateField]}
                placeholder="DD"
                placeholderTextColor={Colors.outline}
                keyboardType="number-pad"
                maxLength={2}
                value={birthDay}
                onChangeText={setBirthDay}
              />
            </View>
          </View>
        </View>

        {/* ── Joined Family ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>加入家庭日</Text>
          <View style={styles.dateRow}>
            <View style={[styles.inputWrap, { flex: 5 }]}>
              <TextInput
                style={[styles.inputField, styles.dateField]}
                placeholder="YYYY"
                placeholderTextColor={Colors.outline}
                keyboardType="number-pad"
                maxLength={4}
                value={joinYear}
                onChangeText={setJoinYear}
              />
            </View>
            <Text style={styles.dateSep}>/</Text>
            <View style={[styles.inputWrap, { flex: 3 }]}>
              <TextInput
                style={[styles.inputField, styles.dateField]}
                placeholder="MM"
                placeholderTextColor={Colors.outline}
                keyboardType="number-pad"
                maxLength={2}
                value={joinMonth}
                onChangeText={setJoinMonth}
              />
            </View>
            <Text style={styles.dateSep}>/</Text>
            <View style={[styles.inputWrap, { flex: 3 }]}>
              <TextInput
                style={[styles.inputField, styles.dateField]}
                placeholder="DD"
                placeholderTextColor={Colors.outline}
                keyboardType="number-pad"
                maxLength={2}
                value={joinDay}
                onChangeText={setJoinDay}
              />
            </View>
          </View>
        </View>

        {/* ── Notes ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>備忘錄（選填）</Text>
          <View style={[styles.inputWrap, styles.notesWrap]}>
            <TextInput
              style={[styles.inputField, styles.notesField]}
              placeholder="關於您寵物的特別備注..."
              placeholderTextColor={Colors.outline}
              multiline
              value={notes}
              onChangeText={setNotes}
              textAlignVertical="top"
            />
          </View>
        </View>
      </ScrollView>

      {/* ── Footer ── */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.submitBtn, (!name.trim() || loading) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!name.trim() || loading}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="paw" size={18} color={Colors.onPrimary} />
          <Text style={styles.submitBtnLabel}>{loading ? '新增中...' : '新增寵物'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: Colors.onSurface,
  },

  content: { paddingHorizontal: 20, paddingBottom: 120, gap: 24 },

  // Photo
  photoSection: { alignItems: 'center', paddingVertical: 4 },
  photoCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Colors.surfaceContainerHigh,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: Colors.outline,
  },
  photoPreview: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },

  // Section
  section: { gap: 10 },
  sectionLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: Colors.onSurfaceVariant,
  },

  // Generic input
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  inputField: {
    flex: 1,
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurface,
    padding: 0,
  },
  inputSuffix: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurfaceVariant,
  },
  inputSuffixToggle: {
    color: Colors.primary,
    fontFamily: FontFamily.headlineSemiBold,
    textDecorationLine: 'underline',
  },

  // Gender
  genderRow: { flexDirection: 'row', gap: 12 },
  genderChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.surfaceContainerHigh,
  },
  genderChipActive: { backgroundColor: Colors.primary },
  genderLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurfaceVariant,
  },
  genderLabelActive: { color: Colors.onPrimary },

  // Species
  speciesScroll: { gap: 8, paddingBottom: 2 },
  speciesChip: {
    width: 88,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceContainerHigh,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  speciesChipActive: {
    backgroundColor: Colors.primaryFixed,
    borderColor: Colors.primary,
  },
  speciesLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: Colors.onSurfaceVariant,
  },
  speciesLabelActive: {
    color: Colors.primary,
    fontFamily: FontFamily.headlineSemiBold,
  },

  // Breed chips
  breedScroll: { gap: 8, paddingBottom: 2 },
  breedChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: Colors.surfaceContainerHigh,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  breedChipActive: {
    backgroundColor: Colors.primaryFixed,
    borderColor: Colors.primary,
  },
  breedChipLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: Colors.onSurfaceVariant,
  },
  breedChipLabelActive: {
    color: Colors.primary,
    fontFamily: FontFamily.headlineSemiBold,
  },

  // Date
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateField: { textAlign: 'center' },
  dateSep: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyLG,
    color: Colors.outline,
  },

  // Notes
  notesWrap: { alignItems: 'flex-start' },
  notesField: { minHeight: 88 },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Colors.background,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 9999,
    paddingVertical: 16,
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: Colors.onPrimary,
  },
});
