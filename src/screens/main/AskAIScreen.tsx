import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Animated,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Chip from '../../components/ui/Chip';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { listAiConversations, createAiConversation, getAiConversation, streamAiMessage, getPets } from '../../api';
import { AiMessage, Conversation, Pet } from '../../types';

const QUICK_TAGS = ['飲食', '行為', '健康建議'];
const SIDEBAR_WIDTH = 280;
const NEW_CONV_ID = '__new__';

export default function AskAIScreen() {
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
  const [hasSent, setHasSent] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const activeConv = conversations.find((c) => c.id === activeConvId) ?? conversations[0];
  const messages = activeConv.messages;

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
        setConversations((prev) => prev.map((c) => c.id === id ? { ...c, messages: res.data.messages } : c));
        setHasSent(res.data.messages.length > 0);
      }
    } else {
      const conv = conversations.find((c) => c.id === id);
      setHasSent((conv?.messages.length ?? 0) > 0);
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
    setHasSent(false);
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

    const selectedPet = pets.find((p) => p.id === selectedPetId);
    const tagContext = selectedTag ? `[${selectedTag}] ` : '';
    const messageContent = input.trim() || '（已附上圖片）';

    const userMsg: AiMessage = {
      id: `m${Date.now()}`,
      role: 'user',
      content: messageContent,
      imageUrl: pendingImage ?? undefined,
      petName: selectedPet?.name,
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
    setHasSent(true);
    setLoading(true);
    scrollToBottom();

    let convId = activeConvId;
    try {
      // 第一則訊息時才建立後端對話
      if (convId === NEW_CONV_ID) {
        const createRes = await createAiConversation(selectedPetId ?? undefined);
        if (!createRes.success) throw new Error('建立對話失敗');
        convId = createRes.data.id;
        loadedConvIds.current.add(convId);
        setConversations((prev) => prev.map((c) => c.id === NEW_CONV_ID ? { ...c, id: convId } : c));
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
            <MaterialIcons name="menu" size={24} color={Colors.onSurface} />
          </TouchableOpacity>
          <View style={styles.headerTitleCol}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>AI 助理</Text>
              <View style={styles.betaBadge}>
                <Text style={styles.betaLabel}>Beta</Text>
              </View>
            </View>
            {activeConv.messages.length > 0 && (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {activeConv.title}
              </Text>
            )}
          </View>
          <View style={styles.iconBtnSm} />
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <MaterialIcons name="info-outline" size={13} color={Colors.onSurfaceVariant} />
          <Text style={styles.disclaimerText}>
            AI 回覆僅供健康參考，不構成獸醫診斷或醫療建議。緊急情況請立即就醫。
          </Text>
        </View>

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
                  <MaterialIcons name="auto-awesome" size={16} color={Colors.primaryContainer} />
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
                  {item.content}
                </Text>
                <Text style={[styles.timestamp, item.role === 'user' && styles.timestampUser]}>
                  {item.timestamp}
                </Text>
              </View>
            </View>
          )}
          ListFooterComponent={
            loading ? (
              <View style={styles.typingIndicator}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.typingText}>AI 助理思考中...</Text>
              </View>
            ) : null
          }
        />

        {/* Row 1: pet chips — only when nothing selected and not yet sent */}
        {pets.length > 0 && !selectedPetId && !selectedTag && !hasSent && (
          <View style={styles.chipRow}>
            {pets.map((pet) => (
              <TouchableOpacity
                key={pet.id}
                style={styles.petChipUnselected}
                onPress={() => setSelectedPetId(pet.id)}
                activeOpacity={0.75}
              >
                <Text style={styles.petChipUnselectedLabel}>{pet.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Row 2: selected chips — hidden when nothing selected and already sent */}
        {(selectedPetId || selectedTag || !hasSent) && (
          <View style={styles.chipRow}>
            {selectedPetId &&
              (() => {
                const pet = pets.find((p) => p.id === selectedPetId);
                return pet ? (
                  <TouchableOpacity
                    key={pet.id}
                    style={styles.petChip}
                    onPress={() => setSelectedPetId(null)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.petChipLabel}>{pet.name}</Text>
                    <MaterialIcons name="close" size={11} color={Colors.onSecondaryContainer} />
                  </TouchableOpacity>
                ) : null;
              })()}
            {selectedTag ? (
              <Chip label={selectedTag} selected onPress={() => setSelectedTag(null)} />
            ) : (
              QUICK_TAGS.map((tag) => (
                <Chip key={tag} label={tag} selected={false} onPress={() => setSelectedTag(tag)} />
              ))
            )}
          </View>
        )}

        {/* Pending image preview */}
        {pendingImage && (
          <View style={styles.imagePreviewWrap}>
            <Image source={{ uri: pendingImage }} style={styles.imagePreview} />
            <TouchableOpacity
              style={styles.imageRemoveBtn}
              onPress={() => setPendingImage(null)}
            >
              <MaterialIcons name="close" size={14} color={Colors.onPrimary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Input bar */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => pickImage('camera')}>
            <MaterialIcons name="photo-camera" size={22} color={Colors.onSurface} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => pickImage('gallery')}>
            <MaterialIcons name="photo-library" size={22} color={Colors.onSurface} />
          </TouchableOpacity>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.textInput}
              placeholder="告訴 AI 助理發生了什麼事..."
              placeholderTextColor={Colors.outlineVariant}
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
            <MaterialIcons name="send" size={14} color={Colors.onPrimary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

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
            <MaterialIcons name="edit" size={20} color={Colors.primary} />
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  kav: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: Colors.background,
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
    color: Colors.onSurfaceVariant,
    marginTop: 1,
  },
  headerTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: Colors.onSurface,
  },
  betaBadge: {
    backgroundColor: '#FF8C00',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  betaLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: 10,
    color: '#fff',
    letterSpacing: 0.4,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: Colors.surfaceContainerLow,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceVariant,
  },
  disclaimerText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: Colors.onSurfaceVariant,
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
  bubble: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  userBubble: { justifyContent: 'flex-end' },
  aiBubble: { justifyContent: 'flex-start' },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleContent: { maxWidth: '78%', borderRadius: 18, padding: 12, gap: 4 },
  aiContent: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.surfaceVariant,
    borderBottomLeftRadius: 4,
  },
  userContent: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleImage: { width: '100%', height: 160, borderRadius: 10 },
  bubbleText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurface,
    lineHeight: 22,
  },
  userText: { color: Colors.onPrimary },
  timestamp: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: Colors.onSurfaceVariant,
    alignSelf: 'flex-end',
  },
  timestampUser: { color: `${Colors.onPrimary}99` },
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
    color: Colors.onSurfaceVariant,
  },

  // Chip rows
  petChipUnselected: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
    backgroundColor: `${Colors.secondary}1A`,
  },
  petChipUnselectedLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: Colors.secondary,
  },
  petChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
    backgroundColor: Colors.secondaryContainer,
  },
  petChipLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: Colors.onSecondaryContainer,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceVariant,
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
    backgroundColor: Colors.primary,
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
    backgroundColor: Colors.surfaceContainerLow,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceVariant,
  },
  iconBtn: { padding: 8, marginBottom: 4 },
  inputWrap: { flex: 1, justifyContent: 'center' },
  textInput: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurface,
    maxHeight: 100,
    paddingVertical: 8,
  },
  charCount: {
    alignSelf: 'flex-end',
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: Colors.outlineVariant,
  },
  charCountWarn: { color: Colors.error },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 9999,
    marginBottom: 4,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: Colors.onPrimary,
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
    backgroundColor: Colors.surfaceContainerLow,
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
    borderBottomColor: Colors.surfaceVariant,
  },
  sidebarTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: Colors.onSurface,
  },
  convItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceVariant,
  },
  convItemActive: {
    backgroundColor: Colors.primaryContainer,
  },
  convTitle: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurface,
    marginBottom: 2,
  },
  convTitleActive: {
    fontFamily: FontFamily.headlineMedium,
    color: Colors.primary,
  },
  convDate: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: Colors.onSurfaceVariant,
  },
});
