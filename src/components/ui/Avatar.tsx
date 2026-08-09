import { View, Text, Image, StyleSheet } from 'react-native';
import { ThemeColors } from '../../constants/themes';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { avatarColorFor, initialsFor } from '../../constants/avatarColors';
import { FontFamily } from '../../constants/typography';

type Props = {
  url?: string | null;
  name: string;
  /**
   * 決定底色用的種子。優先傳使用者 id —— id 穩定，改名不會換色。
   * 不傳就退回 name，改名時顏色會跟著變。
   */
  seed?: string;
  /** 使用者自己挑的顏色索引。沒有就依 seed 自動配 */
  colorIndex?: number | null;
  size?: number;
};

export default function Avatar({ url, name, seed, colorIndex, size = 42 }: Props) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);

  if (url) {
    return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }

  const { bg, fg } = avatarColorFor(seed ?? name, theme.key, colorIndex);
  const initials = initialsFor(name);

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}
    >
      {/*
        字級跟著尺寸縮放（同一個元件從 32px 的留言用到 96px 的個人頁），
        並依字數微調 —— 單字（CJK）用同樣比例會顯得空，兩個字母則會太擠
      */}
      <Text
        style={[
          styles.initials,
          { color: fg, fontSize: Math.round(size * (initials.length > 1 ? 0.38 : 0.46)) },
        ]}
      >
        {initials}
      </Text>
    </View>
  );
}

const makeStyles = (_c: ThemeColors) => StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: FontFamily.headlineBold },
});
