import { View, Text, Switch, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { RootStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'NotificationSettings'>;
};

type NotifKey =
  | 'healthAlert'
  | 'vaccineReminder'
  | 'medicineReminder'
  | 'communityLike'
  | 'communityComment'
  | 'lostPetAlert';

function SwitchRow({
  icon,
  label,
  desc,
  value,
  onToggle,
  disabled,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  desc?: string;
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.row, disabled && { opacity: 0.45 }]}>
      <View style={styles.rowIcon}>
        <MaterialIcons name={icon} size={20} color={Colors.primary} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {desc && <Text style={styles.rowDesc}>{desc}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: Colors.surfaceVariant, true: Colors.primaryContainer }}
        thumbColor={value ? Colors.primary : Colors.outline}
        ios_backgroundColor={Colors.surfaceVariant}
      />
    </View>
  );
}

export default function NotificationSettingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [master, setMaster] = useState(true);
  const [settings, setSettings] = useState<Record<NotifKey, boolean>>({
    healthAlert: true,
    vaccineReminder: true,
    medicineReminder: true,
    communityLike: false,
    communityComment: true,
    lostPetAlert: true,
  });

  const toggle = (key: NotifKey) =>
    master && setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={[styles.appBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>通知設定</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Master toggle */}
        <View style={styles.masterCard}>
          <View style={styles.masterLeft}>
            <MaterialIcons
              name="notifications"
              size={26}
              color={master ? Colors.primary : Colors.outline}
            />
            <View>
              <Text style={styles.masterLabel}>推播通知</Text>
              <Text style={styles.masterDesc}>{master ? '目前已開啟' : '目前已關閉'}</Text>
            </View>
          </View>
          <Switch
            value={master}
            onValueChange={setMaster}
            trackColor={{ false: Colors.surfaceVariant, true: Colors.primaryContainer }}
            thumbColor={master ? Colors.primary : Colors.outline}
            ios_backgroundColor={Colors.surfaceVariant}
          />
        </View>

        {/* 健康提醒 */}
        <View>
          <Text style={styles.sectionTitle}>健康提醒</Text>
          <View style={styles.card}>
            <SwitchRow
              icon="local-hospital"
              label="健康狀態更新"
              value={settings.healthAlert}
              onToggle={() => toggle('healthAlert')}
              disabled={!master}
            />
            <View style={styles.divider} />
            <SwitchRow
              icon="event-available"
              label="疫苗與健康檢查"
              desc="提前 7 天提醒"
              value={settings.vaccineReminder}
              onToggle={() => toggle('vaccineReminder')}
              disabled={!master}
            />
            <View style={styles.divider} />
            <SwitchRow
              icon="alarm"
              label="藥物提醒"
              desc="依排程時間通知"
              value={settings.medicineReminder}
              onToggle={() => toggle('medicineReminder')}
              disabled={!master}
            />
          </View>
        </View>

        {/* 社群互動 */}
        <View>
          <Text style={styles.sectionTitle}>社群互動</Text>
          <View style={styles.card}>
            <SwitchRow
              icon="thumb-up"
              label="按讚通知"
              value={settings.communityLike}
              onToggle={() => toggle('communityLike')}
              disabled={!master}
            />
            <View style={styles.divider} />
            <SwitchRow
              icon="comment"
              label="留言通知"
              value={settings.communityComment}
              onToggle={() => toggle('communityComment')}
              disabled={!master}
            />
          </View>
        </View>

        {/* 走失寵物 */}
        <View>
          <Text style={styles.sectionTitle}>走失寵物</Text>
          <View style={styles.card}>
            <SwitchRow
              icon="warning"
              label="附近走失警報"
              desc="當附近有走失寵物時通知"
              value={settings.lostPetAlert}
              onToggle={() => toggle('lostPetAlert')}
              disabled={!master}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: Colors.background,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  appBarTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: Colors.primary,
  },
  content: { padding: 20, gap: 16 },

  masterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primaryFixed,
    borderRadius: 20,
    padding: 16,
  },
  masterLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  masterLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurface,
  },
  masterDesc: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },

  sectionTitle: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceVariant,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurface,
  },
  rowDesc: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: Colors.onSurfaceVariant,
  },
  divider: { height: 1, backgroundColor: Colors.surfaceVariant, marginLeft: 64 },
});
