import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActionSheetIOS,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { getNotifications, markAllNotificationsRead, markNotificationRead, deleteNotification } from '../../api';
import { Notification } from '../../types';
import { useNotifications } from '../../context/NotificationContext';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Notifications'>;
};

type NotifConfig = {
  icon: keyof typeof MaterialIcons.glyphMap;
  iconColor: string;
  iconBg: string;
  labelColor: string;
  label: string;
};

function getConfig(type: Notification['type']): NotifConfig {
  switch (type) {
    case 'lost_pet':
      return {
        icon: 'emergency',
        iconColor: Colors.error,
        iconBg: Colors.errorContainer,
        labelColor: Colors.error,
        label: '走失寵物警報',
      };
    case 'health_reminder':
      return {
        icon: 'medical-services',
        iconColor: Colors.secondary,
        iconBg: Colors.secondaryContainer,
        labelColor: Colors.secondary,
        label: '健康提醒',
      };
    case 'like':
      return {
        icon: 'favorite',
        iconColor: '#E53935',
        iconBg: '#FDECEA',
        labelColor: '#E53935',
        label: '按讚',
      };
    case 'comment':
      return {
        icon: 'chat-bubble',
        iconColor: Colors.primary,
        iconBg: Colors.primaryFixed,
        labelColor: Colors.primary,
        label: '留言',
      };
    case 'milestone':
    default:
      return {
        icon: 'celebration',
        iconColor: Colors.onSurfaceVariant,
        iconBg: Colors.surfaceContainerHigh,
        labelColor: Colors.onSurfaceVariant,
        label: '里程碑',
      };
  }
}

function NotifCard({ notif }: { notif: Notification }) {
  const cfg = getConfig(notif.type);
  return (
    <View style={styles.card}>
      <View style={styles.cardInner}>
        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: cfg.iconBg }]}>
          <MaterialIcons name={cfg.icon} size={22} color={cfg.iconColor} />
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          <View style={styles.cardTopRow}>
            <Text style={[styles.typeLabel, { color: cfg.labelColor }]}>{cfg.label}</Text>
            <Text style={styles.timeAgo}>{notif.timeAgo}</Text>
          </View>
          <Text style={styles.notifTitle}>{notif.title}</Text>
          <Text style={styles.notifBody}>{notif.body}</Text>

        </View>
      </View>
    </View>
  );
}

export default function NotificationsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const load = () => {
    getNotifications().then((res) => {
      if (res.success) setNotifications(res.data);
    });
  };

  useEffect(() => { load(); }, []);

  const todayNotifs     = notifications.filter((n) => n.day === 'today');
  const yesterdayNotifs = notifications.filter((n) => n.day === 'yesterday');
  const earlierNotifs   = notifications.filter((n) => n.day === 'earlier');

  const handleTap = async (n: Notification) => {
    if (!n.read) {
      await markNotificationRead(n.id);
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
      refreshCount();
    }

    // 跳轉到對應頁面
    switch (n.type) {
      case 'like':
      case 'comment':
        navigation.navigate('Profile', { postId: n.data?.postId });
        break;
      case 'health_reminder':
        if (n.data?.eventId) {
          navigation.navigate('MainTabs', { screen: 'Reminders' } as any);
        } else if (n.data?.petId) {
          navigation.navigate('PetDetail', { petId: n.data.petId });
        } else {
          navigation.navigate('MainTabs', { screen: 'MyPets' } as any);
        }
        break;
      case 'milestone':
        if (n.data?.petId && n.data?.petName) {
          navigation.navigate('PetDetail', { petId: n.data.petId });
        } else {
          navigation.navigate('MainTabs', { screen: 'MyPets' } as any);
        }
        break;
      case 'lost_pet':
        navigation.navigate('MainTabs', { screen: 'Community' } as any);
        break;
    }
  };

  const handleDelete = async (id: string) => {
    await deleteNotification(id);
    setNotifications((prev) => prev.filter((x) => x.id !== id));
  };

  const handleLongPress = (n: Notification) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['取消', '刪除通知'], cancelButtonIndex: 0, destructiveButtonIndex: 1 },
        (idx) => { if (idx === 1) handleDelete(n.id); },
      );
    } else {
      Alert.alert('刪除通知', '確定要刪除這則通知嗎？', [
        { text: '取消', style: 'cancel' },
        { text: '刪除', style: 'destructive', onPress: () => handleDelete(n.id) },
      ]);
    }
  };

  const markAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((x) => ({ ...x, read: true })));
    refreshCount();
  };

  const { refreshCount } = useNotifications();
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Custom app bar with back button */}
      <View style={[styles.appBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>通知</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={[]}
        renderItem={null}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: 32 }]}
        ListHeaderComponent={
          <>
            {/* Header */}
            <View style={styles.pageHeader}>
              <View>
                <Text style={styles.eyebrow}>即時掌握</Text>
                <Text style={styles.pageTitle}>通知</Text>
              </View>
              {unreadCount > 0 && (
                <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead}>
                  <Text style={styles.markAllLabel}>全部標為已讀</Text>
                </TouchableOpacity>
              )}
            </View>

            {notifications.length === 0 && (
              <View style={styles.empty}>
                <MaterialIcons name="notifications-none" size={48} color={Colors.outlineVariant} />
                <Text style={styles.emptyText}>目前沒有通知</Text>
              </View>
            )}

            {/* Today */}
            {todayNotifs.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>今天</Text>
                {todayNotifs.map((n) => (
                  <TouchableOpacity key={n.id} onPress={() => handleTap(n)} onLongPress={() => handleLongPress(n)} activeOpacity={0.8}>
                    <View style={[styles.notifRow, !n.read && styles.notifUnread]}>
                      <NotifCard notif={n} />
                      {!n.read && <View style={styles.unreadDot} />}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Yesterday */}
            {yesterdayNotifs.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>昨天</Text>
                {yesterdayNotifs.map((n) => (
                  <TouchableOpacity key={n.id} onPress={() => handleTap(n)} onLongPress={() => handleLongPress(n)} activeOpacity={0.8}>
                    <View style={[styles.notifRow, !n.read && styles.notifUnread]}>
                      <NotifCard notif={n} />
                      {!n.read && <View style={styles.unreadDot} />}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Earlier */}
            {earlierNotifs.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>更早</Text>
                {earlierNotifs.map((n) => (
                  <TouchableOpacity key={n.id} onPress={() => handleTap(n)} onLongPress={() => handleLongPress(n)} activeOpacity={0.8}>
                    <View style={[styles.notifRow, !n.read && styles.notifUnread]}>
                      <NotifCard notif={n} />
                      {!n.read && <View style={styles.unreadDot} />}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        }
      />
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
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: Colors.primary,
  },
  listContent: { paddingHorizontal: 20, gap: 0 },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 4,
  },
  eyebrow: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.labelSM,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  pageTitle: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineLG,
    color: Colors.onSurface,
  },
  markAllBtn: {
    backgroundColor: Colors.primaryFixed,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9999,
  },
  markAllLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: Colors.primary,
  },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.bodyMD, color: Colors.onSurfaceVariant },
  notifRow: { position: 'relative' },
  notifUnread: { opacity: 1 },
  unreadDot: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  section: { gap: 10, marginBottom: 20 },
  sectionLabel: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.labelMD,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },

  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceVariant,
    overflow: 'hidden',
  },
  cardInner: { flexDirection: 'row', gap: 12, padding: 14 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardContent: { flex: 1, gap: 4 },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeLabel: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.labelMD,
  },
  timeAgo: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: Colors.onSurfaceVariant,
  },
  notifTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: Colors.onSurface,
    lineHeight: 24,
  },
  notifBody: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurfaceVariant,
    lineHeight: 22,
  },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  actionPrimary: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 9999,
  },
  actionPrimaryLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: Colors.onPrimary,
  },
  actionSecondary: {
    backgroundColor: Colors.surfaceContainerHigh,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 9999,
  },
  actionSecondaryLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: Colors.onSurfaceVariant,
  },
});
