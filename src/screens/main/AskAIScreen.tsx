import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Animated,
  Easing,
  Alert,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ThemeColors } from '../../constants/themes';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { FontFamily, FontSize } from '../../constants/typography';
import { listAiConversations, createAiConversation, getAiConversation, streamAiMessage, getPets } from '../../api';
import { AiMessage, Conversation, Pet } from '../../types';
import { buildPetColorMap } from '../../constants/petColors';
import { speciesIcon } from '../../constants/species';
import { AI_DISCLAIMER_KEY } from '../../constants/storageKeys';

/**
 * 主題快捷。選中時會把 `[標籤] ` 前綴加在訊息前送給 AI（見 send() 的 tagContext），
 * 所以 label 同時是顯示文字與送出的關鍵字，改字會改變 AI 收到的提示。
 */
const QUICK_TOPICS = [
  {
    key: 'diet', label: '飲食', icon: 'food-drumstick',
    withPet: ['{pet} 目前的體重適合吃多少飼料？', '{pet} 最近的飲食紀錄看起來正常嗎？'],
    general: ['幼犬和成犬的餵食次數差在哪？', '哪些人類食物對寵物有危險？'],
  },
  {
    key: 'behavior', label: '行為', icon: 'paw',
    withPet: ['{pet} 最近的日常紀錄有出現行為變化嗎？', '{pet} 這個年紀常見的行為問題有哪些？'],
    general: ['寵物一直舔腳掌是什麼原因？', '怎麼減少寵物的分離焦慮？'],
  },
  {
    key: 'health', label: '健康建議', icon: 'heart-pulse',
    withPet: ['{pet} 最近的體重變化正常嗎？', '{pet} 上次健檢有什麼要注意的？'],
    general: ['寵物需要定期做哪些健康檢查？', '疫苗多久要補打一次？'],
  },
  {
    key: 'care', label: '日常照護', icon: 'shower',
    withPet: ['{pet} 多久該洗一次澡？', '{pet} 這個年紀的照護重點是什麼？'],
    general: ['貓咪需要洗澡嗎？', '寵物指甲多久剪一次比較好？'],
  },
] satisfies {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  /** 已綁定寵物時用。這些問題會讓 AI 動用查詢紀錄的工具，{pet} 會替換成寵物名字 */
  withPet: string[];
  /** 未綁定寵物時用。不依賴 App 內資料，純知識問答 */
  general: string[];
}[];

const SIDEBAR_WIDTH = 280;
const NEW_CONV_ID = '__new__';

/**
 * 諮詢對象的圓形頭像。外環用寵物的識別色（跟行事曆、我的寵物同一套 petColorAt）。
 * 沒照片就退回物種圖示；未指定寵物是虛線外環 + 爪印。
 */
function PetAvatar({
  pet, color, styles, colors, size = 34,
}: {
  pet: Pet | null;
  color: string;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
  size?: number;
}) {
  const ring = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderColor: pet ? color : colors.outlineVariant,
    borderStyle: (pet ? 'solid' : 'dashed') as 'solid' | 'dashed',
  };

  return (
    <View style={[styles.avatarRing, ring]}>
      {pet?.photoUrl ? (
        <Image source={{ uri: pet.photoUrl }} style={styles.avatarImg} resizeMode="cover" />
      ) : (
        <MaterialCommunityIcons
          name={pet ? speciesIcon(pet.species) : 'paw'}
          size={size * 0.5}
          color={pet ? color : colors.onSurfaceVariant}
        />
      )}
    </View>
  );
}

// AI 回覆偶爾會用 **文字** 標粗體，聊天氣泡目前只是純文字渲染，這裡把 ** 語法轉成真的粗體
function renderMarkdownBold(content: string, styles: ReturnType<typeof makeStyles>) {
  const parts = content.split(/(\*\*.+?\*\*)/g);
  return parts.map((part, i) => {
    const match = part.match(/^\*\*(.+)\*\*$/);
    return match ? (
      <Text key={i} style={styles.bubbleTextBold}>{match[1]}</Text>
    ) : (
      part
    );
  });
}

export default function AskAIScreen() {
  const { colors, theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  const [conversations, setConversations] = useState<Conversation[]>([
    { id: NEW_CONV_ID, title: '新對話', createdAt: '剛剛', messages: [] },
  ]);
  const [activeConvId, setActiveConvId] = useState<string>(NEW_CONV_ID);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const loadedConvIds = useRef<Set<string>>(new Set([NEW_CONV_ID]));

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [petPickerOpen, setPetPickerOpen] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // 免責聲明預設顯示，關掉後記在本機、不再出現。
  // null = 偏好還沒讀完：先不渲染，避免已關閉的使用者看到它閃一下才消失
  const [disclaimerVisible, setDisclaimerVisible] = useState<boolean | null>(null);

  // 用 useFocusEffect 而非只在掛載時讀：使用者可能到「隱私與安全」把它開回來，
  // 這頁在 tab navigator 裡不會重新掛載，靠 focus 才能拿到最新偏好
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(AI_DISCLAIMER_KEY)
        .then((v) => setDisclaimerVisible(v !== '1'))
        .catch(() => setDisclaimerVisible(true)); // 讀取失敗就照預設顯示
    }, []),
  );

  const dismissDisclaimer = () => {
    setDisclaimerVisible(false);
    AsyncStorage.setItem(AI_DISCLAIMER_KEY, '1').catch(() => {});
  };

  const activeConv = conversations.find((c) => c.id === activeConvId) ?? conversations[0];
  const messages = activeConv.messages;

  // 對話一旦建立，後端的 conv.petId 就是不可變的事實來源；
  // 還沒建立（新對話）時才用本地的 selectedPetId。
  const activePetId = activeConv.petId ?? selectedPetId;
  const activePet = pets.find((p) => p.id === activePetId) ?? null;
  const petColorMap = useMemo(() => buildPetColorMap(pets, theme.key), [pets, theme.key]);
  const activePetColor = activePet ? petColorMap[activePet.id] : colors.outline;

  // 已經有訊息 = 後端已綁定，換寵物只能靠開新對話（後端沒有改 petId 的 endpoint）
  const petLocked = activeConv.messages.length > 0;

  // 展開清單：所有寵物 + 「不指定」。id 為 null 代表不指定
  const pickerOptions = useMemo(
    () => [
      ...pets.map((p) => ({ id: p.id as string | null, name: p.name, pet: p, color: petColorMap[p.id] })),
      { id: null as string | null, name: '不指定寵物', pet: null as Pet | null, color: colors.outline },
    ],
    [pets, petColorMap, colors.outline],
  );

  /**
   * 空狀態的範例問題。
   * 有綁寵物就給會用到真實紀錄的問題（讓使用者第一次就看到 function calling 的價值），
   * 沒綁就給不依賴 App 資料的一般問題，避免問了卻得到空泛回答。
   * 沒選主題時每個主題各挑第一句；選了主題就展開該主題的全部。
   */
  const starters = useMemo(() => {
    const fill = (q: string) => q.replace('{pet}', activePet?.name ?? '');
    const pick = (t: (typeof QUICK_TOPICS)[number]) => (activePet ? t.withPet : t.general);

    const topics = selectedTag
      ? QUICK_TOPICS.filter((t) => t.label === selectedTag)
      : QUICK_TOPICS;

    return topics.flatMap((t) =>
      (selectedTag ? pick(t) : pick(t).slice(0, 1)).map((q) => ({
        key: `${t.key}-${q}`,
        icon: t.icon,
        text: fill(q),
      })),
    );
  }, [selectedTag, activePet]);

  // 一個 Animated.Value 驅動全部項目，各項用不同 inputRange 做出逐項延遲
  const pickerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (petPickerOpen) {
      pickerAnim.setValue(0);
      Animated.timing(pickerAnim, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [petPickerOpen]);

  const choosePet = (petId: string | null) => {
    if (petId === activePetId) {
      setPetPickerOpen(false);
      return;
    }

    if (petLocked) {
      // 後端的 conv.petId 寫入後改不了，換對象只能另起一段對話。
      // 這是會跳離目前對話的動作，先確認避免誤觸；
      // 面板不先關掉，取消時使用者還留在挑選畫面。
      const name = petId ? pets.find((p) => p.id === petId)?.name : null;
      Alert.alert(
        '另開新對話',
        name
          ? `要為 ${name} 另開一段新對話嗎？目前這段對話會保留在側邊欄。`
          : '要另開一段不指定寵物的新對話嗎？目前這段對話會保留在側邊欄。',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '另開新對話',
            onPress: () => {
              setPetPickerOpen(false);
              newConversation();
              setSelectedPetId(petId);
            },
          },
        ],
      );
      return;
    }

    setPetPickerOpen(false);
    setSelectedPetId(petId);
  };

  useEffect(() => {
    getPets().then((res) => { if (res.success) setPets(res.data); });
    listAiConversations().then((res) => {
      if (res.success && res.data.length > 0) {
        setConversations((prev) => [prev[0], ...res.data]);
      }
    });
  }, []);

  const scrollToBottom = () =>
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

  const openSidebar = () => {
    setSidebarOpen(true);
    Animated.timing(sidebarAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
  };

  const closeSidebar = () => {
    Animated.timing(sidebarAnim, {
      toValue: -SIDEBAR_WIDTH,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setSidebarOpen(false));
  };

  const switchConversation = async (id: string) => {
    setActiveConvId(id);
    setInput('');
    setPendingImage(null);
    setSelectedTag(null);
    setSelectedPetId(null);
    closeSidebar();

    if (!loadedConvIds.current.has(id)) {
      loadedConvIds.current.add(id);
      const res = await getAiConversation(id);
      if (res.success) {
        // petId 也要一起帶進來，頭像才知道這段對話綁的是誰
        setConversations((prev) =>
          prev.map((c) => c.id === id ? { ...c, messages: res.data.messages, petId: res.data.petId } : c),
        );
      }
    }
  };

  const newConversation = () => {
    if (activeConvId === NEW_CONV_ID && activeConv.messages.length === 0) return;
    const hasNew = conversations.some((c) => c.id === NEW_CONV_ID);
    if (!hasNew) {
      loadedConvIds.current.add(NEW_CONV_ID);
      setConversations((prev) => [{ id: NEW_CONV_ID, title: '新對話', createdAt: '剛剛', messages: [] }, ...prev]);
    }
    setActiveConvId(NEW_CONV_ID);
    setInput('');
    setPendingImage(null);
    setSelectedTag(null);
    setSelectedPetId(null);
    closeSidebar();
  };

  const pickImage = async (source: 'camera' | 'gallery') => {
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return;
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled) setPendingImage(result.assets[0].uri);
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled) setPendingImage(result.assets[0].uri);
    }
  };

  const send = async () => {
    if (!input.trim() && !pendingImage) return;

    const tagContext = selectedTag ? `[${selectedTag}] ` : '';
    const messageContent = input.trim() || '（已附上圖片）';

    const userMsg: AiMessage = {
      id: `m${Date.now()}`,
      role: 'user',
      content: messageContent,
      imageUrl: pendingImage ?? undefined,
      petName: activePet?.name,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const isFirstMsg = activeConv.messages.length === 0;
    const imageForSend = pendingImage ? { uri: pendingImage, name: 'photo.jpg', type: 'image/jpeg' } : undefined;

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== activeConvId) return c;
        return {
          ...c,
          title: isFirstMsg ? messageContent.slice(0, 30) : c.title,
          messages: [...c.messages, userMsg],
        };
      }),
    );

    setInput('');
    setPendingImage(null);
    setLoading(true);
    scrollToBottom();

    let convId = activeConvId;
    try {
      // 第一則訊息時才建立後端對話
      if (convId === NEW_CONV_ID) {
        const createRes = await createAiConversation(activePetId ?? undefined);
        if (!createRes.success) throw new Error('建立對話失敗');
        convId = createRes.data.id;
        loadedConvIds.current.add(convId);
        // 一併寫回 petId：這是後端剛剛綁定的結果，之後這段對話都以它為準
        setConversations((prev) =>
          prev.map((c) => c.id === NEW_CONV_ID ? { ...c, id: convId, petId: createRes.data.petId } : c),
        );
        setActiveConvId(convId);
      }

      const streamingId = `streaming_${Date.now()}`;
      let firstDelta = true;

      await streamAiMessage(
        convId,
        tagContext + messageContent,
        {
          onDelta: (delta) => {
            if (firstDelta) {
              firstDelta = false;
              setLoading(false);
              setConversations((prev) =>
                prev.map((c) => c.id === convId ? {
                  ...c,
                  messages: [...c.messages, {
                    id: streamingId,
                    role: 'assistant' as const,
                    content: delta,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  }],
                } : c),
              );
              scrollToBottom();
            } else {
              setConversations((prev) =>
                prev.map((c) => c.id === convId ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === streamingId ? { ...m, content: m.content + delta } : m
                  ),
                } : c),
              );
            }
          },
          onDone: (createdAt) => {
            setLoading(false);
            setConversations((prev) =>
              prev.map((c) => c.id === convId ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === streamingId
                    ? { ...m, timestamp: new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
                    : m
                ),
              } : c),
            );
          },
          onError: (msg) => {
            setLoading(false);
            setConversations((prev) =>
              prev.map((c) => c.id === convId ? {
                ...c,
                messages: firstDelta
                  ? [...c.messages, { id: streamingId, role: 'assistant' as const, content: msg, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]
                  : c.messages.map((m) => m.id === streamingId ? { ...m, content: msg } : m),
              } : c),
            );
          },
          onImageAttachFailed: () => {
            Alert.alert('圖片無法附加', '照片讀取失敗，已改為僅傳送文字訊息。');
          },
        },
        imageForSend,
      );
    } catch {
      setLoading(false);
      setConversations((prev) =>
        prev.map((c) => c.id === convId ? {
          ...c,
          messages: [...c.messages, {
            id: `err${Date.now()}`,
            role: 'assistant' as const,
            content: '抱歉，AI 助理暫時無法回應，請稍後再試。',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }],
        } : c),
      );
      scrollToBottom();
    }
  };

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.iconBtnSm} onPress={openSidebar}>
            <MaterialIcons name="menu" size={24} color={colors.onSurface} />
          </TouchableOpacity>
          <View style={styles.headerTitleCol}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>AI 助理</Text>
            </View>
            {activeConv.messages.length > 0 && (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {activeConv.title}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.iconBtnSm}
            onPress={() => setPetPickerOpen(true)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={activePet ? `目前諮詢對象 ${activePet.name}，點擊更換` : '選擇諮詢的寵物'}
          >
            <PetAvatar pet={activePet} color={activePetColor} styles={styles} colors={colors} />
          </TouchableOpacity>
        </View>

        {/* Disclaimer — 可關閉，關掉後記在本機 */}
        {disclaimerVisible && (
          <View style={styles.disclaimer}>
            <MaterialIcons name="info-outline" size={13} color={colors.onSurfaceVariant} />
            <Text style={styles.disclaimerText}>
              AI 回覆僅供健康參考，不構成獸醫診斷或醫療建議。緊急情況請立即就醫。
            </Text>
            <TouchableOpacity
              onPress={dismissDisclaimer}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="關閉免責聲明"
            >
              <MaterialIcons name="close" size={15} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
        )}

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View
              style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}
            >
              {item.role === 'assistant' && (
                <View style={styles.aiAvatar}>
                  <MaterialIcons name="auto-awesome" size={16} color={colors.primaryContainer} />
                </View>
              )}
              <View
                style={[
                  styles.bubbleContent,
                  item.role === 'user' ? styles.userContent : styles.aiContent,
                ]}
              >
                {item.imageUrl && (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.bubbleImage}
                    resizeMode="cover"
                  />
                )}
                <Text style={[styles.bubbleText, item.role === 'user' && styles.userText]}>
                  {renderMarkdownBold(item.content, styles)}
                </Text>
                <Text style={[styles.timestamp, item.role === 'user' && styles.timestampUser]}>
                  {item.timestamp}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <MaterialIcons name="auto-awesome" size={24} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>想問什麼？</Text>
              <Text style={styles.emptySubtitle}>
                {activePet
                  ? `已選 ${activePet.name}，可以問問牠的體重、日誌或就醫紀錄。`
                  : '選一個主題，或直接輸入你的問題。'}
              </Text>

              {starters.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={styles.starterCard}
                  onPress={() => setInput(s.text)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`使用範例問題：${s.text}`}
                >
                  <MaterialCommunityIcons name={s.icon} size={17} color={colors.secondary} />
                  <Text style={styles.starterText}>{s.text}</Text>
                  <MaterialIcons name="arrow-outward" size={15} color={colors.outlineVariant} />
                </TouchableOpacity>
              ))}
            </View>
          }
          ListFooterComponent={
            loading ? (
              <View style={styles.typingIndicator}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.typingText}>AI 助理思考中...</Text>
              </View>
            ) : null
          }
        />

        {/* 主題快捷：選中時只留該顆（可再點一次取消） */}
        <View style={styles.chipRow}>
          {(selectedTag
            ? QUICK_TOPICS.filter((t) => t.label === selectedTag)
            : QUICK_TOPICS
          ).map((topic) => {
            const active = selectedTag === topic.label;
            return (
              <TouchableOpacity
                key={topic.key}
                style={[styles.topicChip, active && styles.topicChipActive]}
                onPress={() => setSelectedTag(active ? null : topic.label)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <MaterialCommunityIcons
                  name={topic.icon}
                  size={15}
                  color={active ? colors.onSecondaryContainer : colors.secondary}
                />
                <Text style={[styles.topicChipLabel, active && styles.topicChipLabelActive]}>
                  {topic.label}
                </Text>
                {active && (
                  <MaterialIcons name="close" size={13} color={colors.onSecondaryContainer} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Pending image preview */}
        {pendingImage && (
          <View style={styles.imagePreviewWrap}>
            <Image source={{ uri: pendingImage }} style={styles.imagePreview} />
            <TouchableOpacity
              style={styles.imageRemoveBtn}
              onPress={() => setPendingImage(null)}
            >
              <MaterialIcons name="close" size={14} color={colors.onPrimary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Input bar */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => pickImage('camera')}>
            <MaterialIcons name="photo-camera" size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => pickImage('gallery')}>
            <MaterialIcons name="photo-library" size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.textInput}
              placeholder="告訴 AI 助理發生了什麼事..."
              placeholderTextColor={colors.outlineVariant}
              value={input}
              onChangeText={(t) => setInput(t.slice(0, 500))}
              multiline
              maxLength={500}
            />
            {input.length > 0 && (
              <Text style={[styles.charCount, input.length >= 450 && styles.charCountWarn]}>
                {500 - input.length}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && !pendingImage && styles.sendBtnDisabled]}
            onPress={send}
            disabled={loading}
          >
            <Text style={styles.sendLabel}>送出</Text>
            <MaterialIcons name="send" size={14} color={colors.onPrimary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* 諮詢對象挑選：從右上角頭像往下垂直展開 */}
      <Modal
        visible={petPickerOpen}
        transparent
        animationType="none"
        onRequestClose={() => setPetPickerOpen(false)}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => setPetPickerOpen(false)}
        >
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.pickerScrim, { opacity: pickerAnim }]}
            pointerEvents="none"
          />

          <View style={[styles.pickerColumn, { top: insets.top + 56, bottom: insets.bottom + 16 }]}>
            <ScrollView
              style={styles.pickerScroll}
              contentContainerStyle={styles.pickerScrollContent}
              showsVerticalScrollIndicator={false}
            >
            {pickerOptions.map((opt, i) => {
              const active = opt.id === activePetId;
              // 用單一 Animated.Value 帶出逐項延遲：每項起跑點往後推一格
              const start = (i / (pickerOptions.length + 1)) * 0.7;
              const rowStyle = {
                opacity: pickerAnim.interpolate({
                  inputRange: [start, start + 0.3],
                  outputRange: [0, 1],
                  extrapolate: 'clamp' as const,
                }),
                transform: [{
                  translateY: pickerAnim.interpolate({
                    inputRange: [start, start + 0.3],
                    outputRange: [-12, 0],
                    extrapolate: 'clamp' as const,
                  }),
                }],
              };

              return (
                <Animated.View key={opt.id ?? '__none__'} style={rowStyle}>
                  <TouchableOpacity
                    style={styles.pickerItem}
                    onPress={() => choosePet(opt.id)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={opt.name}
                  >
                    <View style={[styles.pickerLabel, active && styles.pickerLabelActive]}>
                      <Text style={[styles.pickerLabelText, active && styles.pickerLabelTextActive]}>
                        {opt.name}
                      </Text>
                    </View>
                    <View style={[styles.pickerAvatarWrap, active && { borderColor: opt.color }]}>
                      <PetAvatar pet={opt.pet} color={opt.color} styles={styles} colors={colors} size={56} />
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
            </ScrollView>

            {petLocked && (
              <Animated.View style={[styles.pickerHint, { opacity: pickerAnim }]}>
                <Text style={styles.pickerHintText}>換對象會另開一段新對話</Text>
              </Animated.View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sidebar overlay — outside KAV so it covers full screen */}
      {sidebarOpen && (
        <TouchableOpacity
          style={[StyleSheet.absoluteFill, styles.sidebarOverlay]}
          activeOpacity={1}
          onPress={closeSidebar}
        />
      )}

      {/* Sidebar panel */}
      <Animated.View
        style={[styles.sidebar, { transform: [{ translateX: sidebarAnim }] }]}
        pointerEvents={sidebarOpen ? 'auto' : 'none'}
      >
        <View style={[styles.sidebarTop, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.sidebarTitle}>對話記錄</Text>
          <TouchableOpacity style={styles.iconBtnSm} onPress={newConversation}>
            <MaterialIcons name="edit" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.convItem, item.id === activeConvId && styles.convItemActive]}
              onPress={() => switchConversation(item.id)}
              activeOpacity={0.75}
            >
              <Text
                style={[styles.convTitle, item.id === activeConvId && styles.convTitleActive]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text style={styles.convDate}>{item.createdAt}</Text>
            </TouchableOpacity>
          )}
        />
      </Animated.View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  kav: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: c.background,
  },
  headerTitleCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
  },
  headerSubtitle: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
    marginTop: 1,
  },
  headerTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: c.onSurface,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: c.surfaceContainerLow,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceVariant,
  },
  disclaimerText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
    flex: 1,
    lineHeight: 18,
  },
  iconBtnSm: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Messages
  messageList: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 12 },

  // 空狀態：新對話時的範例問題
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 32,
    paddingHorizontal: 8,
    gap: 10,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: c.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineMD,
    color: c.onSurface,
  },
  emptySubtitle: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 6,
  },
  starterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'stretch',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: c.surfaceContainerLow,
    borderWidth: 1,
    borderColor: c.surfaceVariant,
  },
  starterText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurface,
    lineHeight: 20,
  },
  bubble: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  userBubble: { justifyContent: 'flex-end' },
  aiBubble: { justifyContent: 'flex-start' },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleContent: { maxWidth: '78%', borderRadius: 18, padding: 12, gap: 4 },
  aiContent: {
    backgroundColor: c.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: c.surfaceVariant,
    borderBottomLeftRadius: 4,
  },
  userContent: {
    backgroundColor: c.primary,
    borderBottomRightRadius: 4,
  },
  bubbleImage: { width: '100%', height: 160, borderRadius: 10 },
  bubbleText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
    lineHeight: 22,
  },
  bubbleTextBold: { fontFamily: FontFamily.bodyBold },
  userText: { color: c.onPrimary },
  timestamp: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
    alignSelf: 'flex-end',
  },
  timestampUser: { color: `${c.onPrimary}99` },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typingText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
  },

  // 諮詢對象頭像
  avatarRing: {
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceContainerLow,
  },
  avatarImg: { width: '100%', height: '100%' },

  // 諮詢對象展開清單（從右上角頭像往下）
  pickerScrim: { backgroundColor: 'rgba(0,0,0,0.35)' },
  pickerColumn: {
    position: 'absolute',
    right: 12,
    alignItems: 'flex-end',
  },
  // flexShrink 讓清單短時貼著內容、長時才收縮成可捲動，提示語始終跟在最後一項下方
  pickerScroll: { flexShrink: 1 },
  pickerScrollContent: {
    alignItems: 'flex-end',
    gap: 14,
    paddingBottom: 4,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pickerLabel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
    backgroundColor: c.surfaceContainerLowest,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 3,
  },
  pickerLabelActive: { backgroundColor: c.secondaryContainer },
  pickerLabelText: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
  },
  pickerLabelTextActive: { color: c.onSecondaryContainer },
  // 選中的那顆多一圈識別色外框，跟其他項拉開差別
  pickerAvatarWrap: {
    padding: 3,
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pickerHint: {
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  pickerHintText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: '#FFFFFF',
  },

  // 主題快捷晶片
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 9999,
    backgroundColor: `${c.secondary}1A`,
  },
  topicChipActive: { backgroundColor: c.secondaryContainer },
  topicChipLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: c.secondary,
  },
  topicChipLabelActive: { color: c.onSecondaryContainer },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: c.surfaceVariant,
  },

  // Image preview
  imagePreviewWrap: { marginHorizontal: 16, marginBottom: 8, alignSelf: 'flex-start' },
  imagePreview: { width: 72, height: 72, borderRadius: 10 },
  imageRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: c.surfaceContainerLow,
    borderTopWidth: 1,
    borderTopColor: c.surfaceVariant,
  },
  iconBtn: { padding: 8, marginBottom: 4 },
  inputWrap: { flex: 1, justifyContent: 'center' },
  textInput: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
    maxHeight: 100,
    paddingVertical: 8,
  },
  charCount: {
    alignSelf: 'flex-end',
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.outlineVariant,
  },
  charCountWarn: { color: c.error },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 9999,
    marginBottom: 4,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: c.onPrimary,
  },

  // Sidebar
  sidebarOverlay: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 10,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: c.surfaceContainerLow,
    zIndex: 11,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  sidebarTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceVariant,
  },
  sidebarTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: c.onSurface,
  },
  convItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceVariant,
  },
  convItemActive: {
    backgroundColor: c.primaryContainer,
  },
  convTitle: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
    marginBottom: 2,
  },
  convTitleActive: {
    fontFamily: FontFamily.headlineMedium,
    color: c.primary,
  },
  convDate: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
  },
});
