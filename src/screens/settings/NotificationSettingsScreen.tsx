import { View, Text, Switch, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { RootStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { useAuth } from '../../context/AuthContext';
import { updateSettings } from '../../api';
import { NotifSettings } from '../../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'NotificationSettings'>;
};

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

const DEFAULT_SETTINGS: NotifSettings = {
  dailyCare: true,
  calendar: true,
  likes: true,
  comments: true,
};

export default function NotificationSettingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();

  const [settings, setSettings] = useState<NotifSettings>(
    user?.notifSettings ?? DEFAULT_SETTINGS
  );

  const allOn = Object.values(settings).every(Boolean);

  const toggle = (key: keyof NotifSettings) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    updateUser({ notifSettings: next });
    updateSettings({ notifSettings: next }).catch(() => {
      // 靜默失敗 — 重整後從後端重新載入
    });
  };

  const toggleMaster = () => {
    const next: NotifSettings = {
      dailyCare: !allOn,
      calendar:  !allOn,
      likes:     !allOn,
      comments:  !allOn,
    };
    setSettings(next);
    updateUser({ notifSettings: next });
    updateSettings({ notifSettings: next }).catch(() => {});
  };

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
        {/* 主開關 */}
        <View style={styles.masterCard}>
          <View style={styles.masterLeft}>
            <MaterialIcons
              name="notifications"
              size={26}
              color={allOn ? Colors.primary : Colors.outline}
            />
            <View>
              <Text style={styles.masterLabel}>推播通知</Text>
              <Text style={styles.masterDesc}>{allOn ? '目前已全部開啟' : '部分或全部已關閉'}</Text>
            </View>
          </View>
          <Switch
            value={allOn}
            onValueChange={toggleMaster}
            trackColor={{ false: Colors.surfaceVariant, true: Colors.primaryContainer }}
            thumbColor={allOn ? Colors.primary : Colors.outline}
            ios_backgroundColor={Colors.surfaceVariant}
          />
        </View>

        {/* 每日照護 */}
        <View>
          <Text style={styles.sectionTitle}>每日照護</Text>
          <View style={styles.card}>
            <SwitchRow
              icon="event-note"
              label="每日照護提醒"
              desc="當天還沒記錄時，晚上 8 點通知"
              value={settings.dailyCare}
              onToggle={() => toggle('dailyCare')}
            />
          </View>
        </View>

        {/* 行事曆 */}
        <View>
          <Text style={styles.sectionTitle}>行事曆</Text>
          <View style={styles.card}>
            <SwitchRow
              icon="calendar-today"
              label="行程提醒"
              desc="行程開始前 1 小時推播"
              value={settings.calendar}
              onToggle={() => toggle('calendar')}
            />
          </View>
        </View>

        {/* 社群互動 */}
        <View>
          <Text style={styles.sectionTitle}>社群互動</Text>
          <View style={styles.card}>
            <SwitchRow
              icon="favorite"
              label="按讚通知"
              desc="有人對你的貼文按讚"
              value={settings.likes}
              onToggle={() => toggle('likes')}
            />
            <View style={styles.divider} />
            <SwitchRow
              icon="chat-bubble"
              label="留言通知"
              desc="有人在你的貼文留言"
              value={settings.comments}
              onToggle={() => toggle('comments')}
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
