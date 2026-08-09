import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../../types/navigation';
import Avatar from '../../components/ui/Avatar';
import { ThemeColors } from '../../constants/themes';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { FontFamily, FontSize } from '../../constants/typography';
import { getBlockedUsers, unblockUser, BlockedUser } from '../../api';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'BlockedUsers'>;
};

export default function BlockedUsersScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await getBlockedUsers();
    if (res.success) setUsers(res.data);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleUnblock = (target: BlockedUser) => {
    Alert.alert(
      `解除封鎖 ${target.name}？`,
      '你將重新看到對方的貼文與留言，對方也會看到你的。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '解除封鎖',
          onPress: async () => {
            setUnblockingId(target.id);
            const res = await unblockUser(target.id);
            setUnblockingId(null);
            if (!res.success) {
              Alert.alert('解除失敗', res.message || '請稍後再試');
              return;
            }
            setUsers((prev) => prev.filter((u) => u.id !== target.id));
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={[styles.appBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>已封鎖的使用者</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.centered}>
          <MaterialIcons name="block" size={48} color={colors.onSurfaceVariant} />
          <Text style={styles.emptyTitle}>沒有封鎖任何人</Text>
          <Text style={styles.emptyDesc}>
            在社群貼文右上角的「⋯」可以封鎖不想看到的使用者
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          contentContainerStyle={styles.content}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Avatar url={item.avatarUrl} name={item.name} seed={item.id} colorIndex={(item as any).avatarColor} size={40} />
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <TouchableOpacity
                style={[styles.unblockBtn, unblockingId === item.id && { opacity: 0.5 }]}
                onPress={() => handleUnblock(item)}
                disabled={unblockingId === item.id}
                activeOpacity={0.75}
              >
                <Text style={styles.unblockLabel}>
                  {unblockingId === item.id ? '解除中...' : '解除封鎖'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
        />
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: c.background,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  appBarTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: c.primary,
  },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
    marginTop: 8,
  },
  emptyDesc: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
    textAlign: 'center',
  },

  content: { padding: 20 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  name: {
    flex: 1,
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
  },
  unblockBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: c.surfaceVariant,
    backgroundColor: c.surfaceContainerLowest,
  },
  unblockLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelSM,
    color: c.primary,
  },
  divider: { height: 1, backgroundColor: c.surfaceVariant, marginLeft: 56 },
});
