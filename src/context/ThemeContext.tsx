import { ComponentType, createContext, useContext, useCallback, useEffect, useMemo, useState, ReactNode } from 'react';
import { Appearance } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes, isThemeKey, DEFAULT_THEME, Theme, ThemeColors, ThemeKey } from '../constants/themes';

const STORAGE_KEY = '@critterio/theme-preference';

type ThemeContextValue = {
  theme: Theme;
  /** 等同 theme.colors，最常用所以拉出來 */
  colors: ThemeColors;
  /** 使用者選的主題。沒有「跟隨系統」，這個值就是實際套用的那組 */
  preference: ThemeKey;
  setPreference: (p: ThemeKey) => void;
  isDark: boolean;
  /** AsyncStorage 讀取完成前為 false，用來擋住第一幀的錯誤配色 */
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemeKey>(DEFAULT_THEME);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && isThemeKey(saved)) {
          setPreferenceState(saved);
        }
      } catch {
        // 讀不到就用 DEFAULT_THEME，不值得為此擋住 App 啟動
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((p: ThemeKey) => {
    setPreferenceState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {
      // 寫入失敗不影響本次 session 的切換，下次啟動會 fallback 回上一個值
    });
  }, []);

  // 查不到就退回暖橘。正常情況不會發生（存進去的值有 isThemeKey 把關），
  // 但這裡是根 provider —— 真的拿到 undefined 會整個 App 白屏，不值得為此冒險。
  const theme = themes[preference] ?? themes.warm;

  // Alert、ActionSheet、鍵盤這些原生元件不吃我們的 context，它們看的是 RN 的
  // color scheme。不同步的話，選深色主題但手機是淺色時，跳出來的原生對話框會是白的。
  useEffect(() => {
    Appearance.setColorScheme(theme.isDark ? 'dark' : 'light');
  }, [theme.isDark]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      colors: theme.colors,
      preference,
      setPreference,
      isDark: theme.isDark,
      ready,
    }),
    [theme, preference, setPreference, ready],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme 必須在 ThemeProvider 內使用');
  return ctx;
}

/** 只要顏色的簡寫，screen 裡最常用的形式 */
export function useThemeColors(): ThemeColors {
  return useTheme().colors;
}

type NamedStyles<T> = { [P in keyof T]: import('react-native').ViewStyle | import('react-native').TextStyle | import('react-native').ImageStyle };

/**
 * 把 `const styles = StyleSheet.create({...})` 換成隨主題重算的版本。
 *
 *   const makeStyles = (c: ThemeColors) => StyleSheet.create({ ... });
 *   // 在 component 內：
 *   const styles = useThemedStyles(makeStyles);
 *
 * factory 必須定義在模組層級（identity 穩定），否則每次 render 都會重建 StyleSheet。
 */
export function useThemedStyles<T extends NamedStyles<T> | NamedStyles<any>>(
  factory: (colors: ThemeColors) => T,
): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}

/**
 * 讓一個 subtree 固定用指定主題，不受使用者偏好影響。
 *
 * 偏好與 setPreference 照原樣往下傳 —— 包在裡面的畫面如果要改設定，
 * 動到的還是全域的那一份，只是它自己不跟著變色。
 */
export function FixedThemeProvider({ themeKey, children }: { themeKey: ThemeKey; children: ReactNode }) {
  const outer = useContext(ThemeContext);
  const theme = themes[themeKey] ?? themes.warm;
  const outerIsDark = outer?.isDark ?? false;

  // 原生元件的 scheme 也要跟著鎖，否則深色偏好的使用者在鎖定淺色的登入頁
  // 按到錯誤提示，會跳出一個深色的 Alert。離開時要還原成外層的值 ——
  // 外層那個 effect 的 deps 沒變，不會自己重跑。
  useEffect(() => {
    Appearance.setColorScheme(theme.isDark ? 'dark' : 'light');
    return () => Appearance.setColorScheme(outerIsDark ? 'dark' : 'light');
  }, [theme.isDark, outerIsDark]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      colors: theme.colors,
      preference: outer?.preference ?? DEFAULT_THEME,
      setPreference: outer?.setPreference ?? (() => {}),
      isDark: theme.isDark,
      ready: outer?.ready ?? true,
    }),
    [theme, outer],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * 包一層固定主題的 HOC，給 navigator 註冊畫面時用：
 *
 *   <Stack.Screen name="Welcome" component={withFixedTheme(WelcomeScreen, 'warm')} />
 *
 * 順便補一個 StatusBar —— 深色模式下進到這種鎖定淺色的畫面，
 * 全域那個 StatusBar 還會是亮字，在淺底上看不見。
 */
export function withFixedTheme<P extends object>(Component: ComponentType<P>, themeKey: ThemeKey) {
  const theme = themes[themeKey];
  function FixedTheme(props: P) {
    return (
      <FixedThemeProvider themeKey={themeKey}>
        <StatusBar style={theme.isDark ? 'light' : 'dark'} />
        <Component {...props} />
      </FixedThemeProvider>
    );
  }
  FixedTheme.displayName = `withFixedTheme(${Component.displayName ?? Component.name ?? 'Component'})`;
  return FixedTheme;
}
