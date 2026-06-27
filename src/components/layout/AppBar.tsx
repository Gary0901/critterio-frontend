import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';

interface Props {
  title?: string;
  showLogo?: boolean;
  avatarUrl?: string;
  onNotificationPress?: () => void;
  onAvatarPress?: () => void;
  onBackPress?: () => void;
  showBack?: boolean;
  unreadCount?: number;
}

export default function AppBar({
  title,
  showLogo = true,
  avatarUrl,
  onNotificationPress,
  onAvatarPress,
  onBackPress,
  showBack = false,
  unreadCount = 0,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.left}>
        {showBack ? (
          <TouchableOpacity onPress={onBackPress} style={styles.iconBtn}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.avatar} onPress={onAvatarPress} activeOpacity={0.8}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            ) : (
              <MaterialIcons name="pets" size={20} color={Colors.onPrimaryContainer} />
            )}
          </TouchableOpacity>
        )}

        {showLogo && (
          <Text style={styles.logo}>
            {title ?? 'Critterio'}
          </Text>
        )}
        {!showLogo && title && (
          <Text style={styles.pageTitle}>{title}</Text>
        )}
      </View>

      {onNotificationPress && (
        <TouchableOpacity onPress={onNotificationPress} style={styles.iconBtn}>
          <MaterialIcons name="notifications-none" size={24} color={Colors.primary} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 99 ? '99+' : String(unreadCount)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
    backgroundColor: Colors.background,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 40,
    height: 40,
  },
  logo: {
    fontFamily: FontFamily.brand,
    fontSize: FontSize.headlineMD + 4,
    color: Colors.primary,
  },
  pageTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: Colors.onSurface,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontFamily: FontFamily.headlineBold,
    lineHeight: 11,
  },
});
