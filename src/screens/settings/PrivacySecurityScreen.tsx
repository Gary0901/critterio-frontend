import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActionSheetIOS, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { RootStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { useAuth } from '../../context/AuthContext';
import { updateProfile, deleteAccount as apiDeleteAccount } from '../../api';

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
  const { user, updateUser, logout } = useAuth();
  const [postVisibility, setPostVisibility] = useState<'public' | 'private'>(
    user?.defaultPostVisibility ?? 'public'
  );
  const [deleting, setDeleting] = useState(false);

  const handleVisibilityPress = () => {
    const options = ['取消', '公開', '限自己'];
    const handler = async (idx: number) => {
      if (idx === 0) return;
      const val: 'public' | 'private' = idx === 1 ? 'public' : 'private';
      setPostVisibility(val);
      try {
        const res = await updateProfile({ defaultPostVisibility: val });
        if (res.success) updateUser({ defaultPostVisibility: val });
      } catch {
        setPostVisibility(postVisibility);
        Alert.alert('更新失敗', '請稍後再試');
      }
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 0, title: '貼文預設可見度' },
        handler,
      );
    } else {
      Alert.alert('貼文預設可見度', undefined, [
        { text: '公開', onPress: () => handler(1) },
        { text: '限自己', onPress: () => handler(2) },
        { text: '取消', style: 'cancel' },
      ]);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '刪除帳號',
      '此操作無法復原，所有資料（寵物、貼文、日誌等）將永久刪除。確定要繼續嗎？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '確定刪除',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await apiDeleteAccount();
              await logout();
              navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
            } catch {
              setDeleting(false);
              Alert.alert('刪除失敗', '請稍後再試');
            }
          },
        },
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
            <TouchableOpacity style={styles.row} onPress={handleVisibilityPress} activeOpacity={0.75}>
              <View style={styles.rowIcon}>
                <MaterialIcons name={postVisibility === 'public' ? 'public' : 'lock'} size={20} color={Colors.primary} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>貼文預設可見度</Text>
                <Text style={styles.rowDesc}>新發佈貼文的預設對象</Text>
              </View>
              <View style={styles.valueChip}>
                <Text style={styles.valueChipText}>{postVisibility === 'public' ? '公開' : '限自己'}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={Colors.onSurfaceVariant} />
            </TouchableOpacity>
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
            <TouchableOpacity
              style={[styles.row, deleting && { opacity: 0.5 }]}
              onPress={handleDeleteAccount}
              disabled={deleting}
              activeOpacity={0.75}
            >
              <View style={[styles.rowIcon, { backgroundColor: Colors.errorContainer }]}>
                <MaterialIcons name="delete-outline" size={20} color={Colors.error} />
              </View>
              <Text style={[styles.rowLabel, { color: Colors.error }]}>
                {deleting ? '刪除中...' : '刪除帳號'}
              </Text>
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
