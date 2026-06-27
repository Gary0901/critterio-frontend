import { View, Text, Switch, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { RootStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PrivacySecurity'>;
};

function ComingSoonBadge() {
  return (
    <View style={styles.comingSoonBadge}>
      <Text style={styles.comingSoonText}>即將推出</Text>
    </View>
  );
}

export default function PrivacySecurityScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [showOnMap, setShowOnMap] = useState(true);

  const handleDeleteAccount = () => {
    Alert.alert(
      '刪除帳號',
      '此操作無法復原，所有資料將永久刪除。確定要繼續嗎？',
      [
        { text: '取消', style: 'cancel' },
        { text: '確定刪除', style: 'destructive', onPress: () => {} },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={[styles.appBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>隱私與安全</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 帳號安全 */}
        <View>
          <Text style={styles.sectionTitle}>帳號安全</Text>
          <View style={styles.card}>
            <View style={[styles.row, { opacity: 0.5 }]}>
              <View style={styles.rowIcon}>
                <MaterialIcons name="lock-outline" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.rowLabel}>更改密碼</Text>
              <ComingSoonBadge />
            </View>
            <View style={styles.divider} />
            <View style={[styles.row, { opacity: 0.5 }]}>
              <View style={styles.rowIcon}>
                <MaterialIcons name="security" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.rowLabel}>兩步驟驗證</Text>
              <ComingSoonBadge />
            </View>
          </View>
        </View>

        {/* 隱私設定 */}
        <View>
          <Text style={styles.sectionTitle}>隱私設定</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <MaterialIcons name="public" size={20} color={Colors.primary} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>貼文可見度</Text>
                <Text style={styles.rowDesc}>誰可以看到你的貼文</Text>
              </View>
              <View style={styles.valueChip}>
                <Text style={styles.valueChipText}>公開</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <MaterialIcons name="location-on" size={20} color={Colors.primary} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>在地圖上顯示</Text>
                <Text style={styles.rowDesc}>讓其他用戶在地圖上看到你</Text>
              </View>
              <Switch
                value={showOnMap}
                onValueChange={setShowOnMap}
                trackColor={{ false: Colors.surfaceVariant, true: Colors.primaryContainer }}
                thumbColor={showOnMap ? Colors.primary : Colors.outline}
                ios_backgroundColor={Colors.surfaceVariant}
              />
            </View>
          </View>
        </View>

        {/* 資料與帳號 */}
        <View>
          <Text style={styles.sectionTitle}>資料與帳號</Text>
          <View style={styles.card}>
            <View style={[styles.row, { opacity: 0.5 }]}>
              <View style={styles.rowIcon}>
                <MaterialIcons name="download" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.rowLabel}>下載我的資料</Text>
              <ComingSoonBadge />
            </View>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.row} onPress={handleDeleteAccount} activeOpacity={0.75}>
              <View style={[styles.rowIcon, { backgroundColor: Colors.errorContainer }]}>
                <MaterialIcons name="delete-outline" size={20} color={Colors.error} />
              </View>
              <Text style={[styles.rowLabel, { color: Colors.error }]}>刪除帳號</Text>
              <MaterialIcons name="chevron-right" size={20} color={Colors.error} />
            </TouchableOpacity>
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
    flex: 1,
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

  comingSoonBadge: {
    backgroundColor: Colors.surfaceContainerHigh,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  comingSoonText: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: Colors.onSurfaceVariant,
  },

  valueChip: {
    backgroundColor: Colors.primaryFixed,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  valueChipText: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelSM,
    color: Colors.onPrimaryContainer,
  },
});
