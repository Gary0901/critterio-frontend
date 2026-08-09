import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemeColors } from '../../constants/themes';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import Avatar from '../ui/Avatar';
import { FontFamily, FontSize } from '../../constants/typography';

interface Props {
  title?: string;
  showLogo?: boolean;
  avatarUrl?: string;
  /** 沒有頭像時用來畫縮寫與底色。AppBar 顯示的一律是登入者本人 */
  userName?: string;
  userId?: string;
  userColor?: number;
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
  userName,
  userId,
  userColor,
  onNotificationPress,
  onAvatarPress,
  onBackPress,
  showBack = false,
  unreadCount = 0,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.left}>
        {showBack ? (
          <TouchableOpacity onPress={onBackPress} style={styles.iconBtn}>
            <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.8}>
            {avatarUrl || userName ? (
              <Avatar url={avatarUrl} name={userName ?? ''} seed={userId} colorIndex={userColor} size={40} />
            ) : (
              // 還沒拿到使用者資料時的佔位，避免閃一個空圓圈
              <View style={styles.avatar}>
                <MaterialIcons name="pets" size={20} color={colors.onPrimaryContainer} />
              </View>
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
          <MaterialIcons name="notifications-none" size={24} color={colors.primary} />
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

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
    backgroundColor: c.background,
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
    backgroundColor: c.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    fontFamily: FontFamily.brand,
    fontSize: FontSize.headlineMD + 4,
    color: c.primary,
  },
  pageTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: c.onSurface,
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
    backgroundColor: c.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: c.onError,
    fontSize: 9,
    fontFamily: FontFamily.headlineBold,
    lineHeight: 11,
  },
});
