import { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { DarkTheme, DefaultTheme, LinkingOptions, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import {
  TAB_ITEM_HEIGHT,
  TAB_PILL_V_PADDING,
  TAB_WRAP_V_PADDING,
} from '../constants/layout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { registerPushToken } from '../utils/registerPushToken';

import { RootStackParamList, MainTabParamList } from '../types/navigation';
import { ThemeColors, warmColors } from '../constants/themes';
import { useTheme, useThemedStyles, withFixedTheme } from '../context/ThemeContext';
import { FontFamily, FontSize } from '../constants/typography';

// Screens
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import AddPetScreen from '../screens/onboarding/AddPetScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import NotificationSettingsScreen from '../screens/settings/NotificationSettingsScreen';
import PrivacySecurityScreen from '../screens/settings/PrivacySecurityScreen';
import AppearanceScreen from '../screens/settings/AppearanceScreen';
import BlockedUsersScreen from '../screens/settings/BlockedUsersScreen';
import HelpSupportScreen from '../screens/settings/HelpSupportScreen';
import TermsScreen from '../screens/settings/TermsScreen';
import PrivacyPolicyScreen from '../screens/settings/PrivacyPolicyScreen';

import MyPetsScreen from '../screens/main/MyPetsScreen';
import CommunityScreen from '../screens/main/CommunityScreen';
import AskAIScreen from '../screens/main/AskAIScreen';
import MapScreen from '../screens/main/MapScreen';
import CalendarScreen from '../screens/main/CalendarScreen';
import PetDetailScreen from '../screens/main/PetDetailScreen';
import DailyLogScreen from '../screens/main/DailyLogScreen';
import VetVisitsScreen from '../screens/main/VetVisitsScreen';
import PetCareGuideScreen from '../screens/main/PetCareGuideScreen';
import PartnerProgramScreen from '../screens/main/PartnerProgramScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// 未登入流程全程維持暖橘：這些畫面的版面是繞著品牌橘和滿版照片設計的，換色會散掉。
// 在模組層級包一次就好 —— 寫在 render 裡會讓每次重繪都產生新的 component type，
// 整個畫面連同 state 都會被重新掛載。
const WarmWelcomeScreen = withFixedTheme(WelcomeScreen, 'warm');
const WarmLoginScreen = withFixedTheme(LoginScreen, 'warm');
const WarmRegisterScreen = withFixedTheme(RegisterScreen, 'warm');
const WarmForgotPasswordScreen = withFixedTheme(ForgotPasswordScreen, 'warm');
const WarmResetPasswordScreen = withFixedTheme(ResetPasswordScreen, 'warm');
const WarmOnboardingScreen = withFixedTheme(OnboardingScreen, 'warm');
// 轉場動畫底下露出的也要是暖橘底，否則深色模式下切過去會先閃一下深色
const warmScreenOptions = { contentStyle: { backgroundColor: warmColors.background } };

type TabIconName = keyof typeof MaterialIcons.glyphMap;

const TAB_CONFIG: Record<
  keyof MainTabParamList,
  { icon: TabIconName; iconActive: TabIconName; label: string }
> = {
  MyPets:     { icon: 'pets',                 iconActive: 'pets',                 label: '我的寵物' },
  Community:  { icon: 'people-outline',        iconActive: 'people',               label: '社群' },
  AskAI:      { icon: 'auto-awesome',          iconActive: 'auto-awesome',         label: 'AI 助理' },
  Map:       { icon: 'map',          iconActive: 'map',         label: '地圖' },
  Reminders: { icon: 'calendar-today', iconActive: 'event',    label: '提醒' },
};

function CustomTabBar({ state, navigation }: any) {
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  return (
    // 絕對定位浮在內容上方。毛玻璃要有東西可以模糊，就必須讓內容從底下穿過去——
    // 若分頁列仍佔版面高度，底下只是一片純色背景，blur 等於白做。
    // 代價是各分頁畫面要自己補底部留白，見 useFloatingTabBarPadding()
    <View
      style={[styles.tabBarWrap, { paddingBottom: insets.bottom + 6 }]}
      pointerEvents="box-none"
    >
      <View style={styles.tabPill}>
        <BlurView
          intensity={80}
          tint={isDark ? 'systemThickMaterialDark' : 'systemThickMaterialLight'}
          style={StyleSheet.absoluteFill}
        />
        {/* 疊一層品牌色薄膜：純毛玻璃會完全跟著背景走，加這層才維持得住 App 的調性 */}
        <View style={styles.tabPillTint} pointerEvents="none" />
      {state.routes.map((route: any, index: number) => {
        const cfg = TAB_CONFIG[route.name as keyof MainTabParamList];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        // Centre tab (Ask AI) gets a special pill
        const isCenter = route.name === 'AskAI';

        if (isCenter) {
          return (
            <TouchableOpacity
              key={route.key}
              style={styles.tabItemCenter}
              onPress={onPress}
              activeOpacity={0.85}
            >
              <View style={[styles.centerPill, isFocused && styles.centerPillActive]}>
                <MaterialIcons
                  name={isFocused ? cfg.iconActive : cfg.icon}
                  size={24}
                  color={isFocused ? colors.onPrimary : colors.primary}
                />
              </View>
              <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
                {cfg.label}
              </Text>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tabItem}
            onPress={onPress}
            activeOpacity={0.75}
          >
            {/* 選中的分頁底下墊一顆膠囊，跟 IG 一樣用形狀而不只是顏色標示位置 */}
            <View style={[styles.tabIconWrap, isFocused && styles.tabIconWrapActive]}>
              <MaterialIcons
                name={isFocused ? cfg.iconActive : cfg.icon}
                size={24}
                color={isFocused ? colors.primary : colors.outline}
              />
            </View>
            <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
              {cfg.label}
            </Text>
          </TouchableOpacity>
        );
      })}
      </View>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
      initialRouteName="MyPets"
    >
      <Tab.Screen name="MyPets" component={MyPetsScreen} />
      <Tab.Screen name="Community" component={CommunityScreen} />
      <Tab.Screen name="AskAI" component={AskAIScreen} />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Reminders" component={CalendarScreen} />
    </Tab.Navigator>
  );
}

const linking = {
  prefixes: ['critterio://'],
  config: {
    screens: {
      ResetPassword: 'reset-password',
      MainTabs: {
        screens: {
          Community: 'post/:postId',
        },
      },
    },
  },
};

export default function AppNavigation() {
  const { colors, isDark } = useTheme();
  const { user, isLoading } = useAuth();

  // React Navigation 有自己的一組色，不接的話轉場與 modal 底層會露出它的預設白
  const navTheme = useMemo(
    () => ({
      ...(isDark ? DarkTheme : DefaultTheme),
      dark: isDark,
      colors: {
        ...(isDark ? DarkTheme : DefaultTheme).colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surfaceContainerLowest,
        text: colors.onSurface,
        border: colors.outlineVariant,
        notification: colors.error,
      },
    }),
    [colors, isDark],
  );

  useEffect(() => {
    if (user) registerPushToken().catch(() => {});
  }, [user]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      linking={linking as LinkingOptions<RootStackParamList>}
      theme={navTheme}
    >
      <Stack.Navigator
        initialRouteName={user ? 'MainTabs' : 'Welcome'}
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          // 沒有這行的話，轉場動畫底下露出的是 navigator 的預設白底
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {/* 以下到 Onboarding 為止都是未登入流程，一律鎖定暖橘 */}
        <Stack.Screen name="Welcome" component={WarmWelcomeScreen} options={warmScreenOptions} />
        <Stack.Screen name="Login" component={WarmLoginScreen} options={warmScreenOptions} />
        <Stack.Screen name="Register" component={WarmRegisterScreen} options={warmScreenOptions} />
        <Stack.Screen name="ForgotPassword" component={WarmForgotPasswordScreen} options={warmScreenOptions} />
        <Stack.Screen name="ResetPassword" component={WarmResetPasswordScreen} options={warmScreenOptions} />
        <Stack.Screen name="Onboarding" component={WarmOnboardingScreen} options={warmScreenOptions} />
        <Stack.Screen name="AddPet" component={AddPetScreen} />
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="PetDetail"
          component={PetDetailScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="DailyLog"
          component={DailyLogScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="VetVisits"
          component={VetVisitsScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="NotificationSettings"
          component={NotificationSettingsScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="PartnerProgram"
          component={PartnerProgramScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Appearance"
          component={AppearanceScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="PrivacySecurity"
          component={PrivacySecurityScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="BlockedUsers"
          component={BlockedUsersScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="HelpSupport"
          component={HelpSupportScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Terms"
          component={TermsScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="PrivacyPolicy"
          component={PrivacyPolicyScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="PetCareGuide"
          component={PetCareGuideScreen}
          options={{ animation: 'slide_from_right' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  // 絕對定位的容器，浮在內容上方且不吃觸控（box-none 讓空白處的手勢傳給底下的畫面）
  tabBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: TAB_WRAP_V_PADDING,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
  },
  // 真正看得到的懸浮膠囊。背景交給 BlurView，這裡只負責形狀與陰影
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    paddingVertical: TAB_PILL_V_PADDING,
    paddingHorizontal: 6,
    // overflow 必須有，否則 BlurView 會是方形、蓋掉圓角
    overflow: 'hidden',
    // 細微的亮色內框，模擬玻璃邊緣的高光
    borderWidth: 1,
    borderColor: c.surfaceVariant,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 8,
  },
  tabPillTint: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: c.surfaceContainerLowest,
    opacity: 0.55,
  },
  tabItem: {
    flex: 1,
    height: TAB_ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabIconWrap: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  tabIconWrapActive: {
    backgroundColor: c.primaryFixed,
  },
  tabItemCenter: {
    flex: 1,
    height: TAB_ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  // 未選中時用中性色。原本是 primaryFixed，跟 tabIconWrapActive 同色，
  // 導致「沒被選中的 AI 助理」看起來跟「被選中的分頁」一模一樣
  centerPill: {
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: c.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPillActive: {
    backgroundColor: c.primary,
  },
  tabLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: c.outline,
  },
  tabLabelActive: {
    color: c.primary,
    fontFamily: FontFamily.headlineBold,
  },
});
