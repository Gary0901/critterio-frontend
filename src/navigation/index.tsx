import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinkingOptions, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { registerPushToken } from '../utils/registerPushToken';

import { RootStackParamList, MainTabParamList } from '../types/navigation';
import { Colors } from '../constants/colors';
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

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

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
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom + 4 }]}>
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
                  color={isFocused ? Colors.onPrimary : Colors.primary}
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
            <MaterialIcons
              name={isFocused ? cfg.iconActive : cfg.icon}
              size={24}
              color={isFocused ? Colors.primary : Colors.outline}
            />
            <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
              {cfg.label}
            </Text>
          </TouchableOpacity>
        );
      })}
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
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (user) registerPushToken().catch(() => {});
  }, [user]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking as LinkingOptions<RootStackParamList>}>
      <Stack.Navigator
        initialRouteName={user ? 'MainTabs' : 'Welcome'}
        screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
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
          name="PrivacySecurity"
          component={PrivacySecurityScreen}
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

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceVariant,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  tabItemCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  centerPill: {
    width: 52,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPillActive: {
    backgroundColor: Colors.primary,
  },
  tabLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: Colors.outline,
  },
  tabLabelActive: {
    color: Colors.primary,
    fontFamily: FontFamily.headlineBold,
  },
});
