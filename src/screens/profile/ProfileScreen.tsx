import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  Dimensions,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { useUser } from '../../context/UserContext';
import { useAuth } from '../../context/AuthContext';
import { updateProfile, getMyPosts, getPets, getPostComments, addComment as apiAddComment, formatTimeAgo } from '../../api';
import { Post } from '../../types';
import { useState, useCallback, useEffect } from 'react';
import { useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';

const CELL_GAP = 2;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_SIZE = (SCREEN_WIDTH - 40 - CELL_GAP * 2) / 3; // 40 = paddingHorizontal * 2

interface Comment {
  id: string;
  author: string;
  content: string;
  timeAgo: string;
}


type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Profile'>;
};

export default function ProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useUser();
  const { logout } = useAuth();
  const route = useRoute<RouteProp<RootStackParamList, 'Profile'>>();
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [petCount, setPetCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'info' | 'posts'>('info');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  useFocusEffect(useCallback(() => {
    // 舊資料保留顯示，靜默背景更新
    getMyPosts().then((res) => {
      if (res.success) {
        setMyPosts(res.data);
        // 從通知跳轉過來時自動打開指定貼文
        const targetId = route.params?.postId;
        if (targetId) {
          const target = res.data.find((p: Post) => p.id === targetId);
          if (target) {
            setActiveTab('posts');
            setSelectedPost(target);
            navigation.setParams({ postId: undefined } as any);
          }
        }
      }
    });
    getPets().then((res) => { if (res.success) setPetCount(res.data.length); });
  }, [route.params?.postId]));
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentsByPostId, setCommentsByPostId] = useState<Record<string, Comment[]>>({});
  const [commentsLoading, setCommentsLoading] = useState(false);

  const openComments = async (post: Post) => {
    setShowComments(true);
    if (commentsByPostId[post.id]) return;
    setCommentsLoading(true);
    try {
      const res = await getPostComments(post.id);
      if (res.success) {
        setCommentsByPostId((prev) => ({
          ...prev,
          [post.id]: res.data.map((c: any) => ({
            id: String(c.id ?? c._id),
            author: c.user?.name ?? '',
            content: c.content,
            timeAgo: c.createdAt ? formatTimeAgo(c.createdAt) : '',
          })),
        }));
      }
    } finally {
      setCommentsLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedPost(null);
    setShowComments(false);
    setCommentText('');
    setModalImageIndex(0);
  };

  const submitComment = async () => {
    if (!commentText.trim() || !selectedPost) return;
    const content = commentText.trim();
    setCommentText('');
    const res = await apiAddComment(selectedPost.id, content);
    if (res.success) {
      const newComment: Comment = {
        id: String(res.data.id ?? Date.now()),
        author: user.name,
        content,
        timeAgo: '剛剛',
      };
      setCommentsByPostId((prev) => ({
        ...prev,
        [selectedPost.id]: [...(prev[selectedPost.id] ?? []), newComment],
      }));
    }
  };
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(user.name);

  const handleNameEditPress = () => {
    if (user.lastNameChangedAt) {
      const msPerDay = 1000 * 60 * 60 * 24;
      const lastChange = new Date(user.lastNameChangedAt);
      const daysDiff = Math.floor((Date.now() - lastChange.getTime()) / msPerDay);
      if (daysDiff < 14) {
        const nextAllowed = new Date(lastChange.getTime() + 14 * msPerDay);
        const y = nextAllowed.getFullYear();
        const m = String(nextAllowed.getMonth() + 1).padStart(2, '0');
        const d = String(nextAllowed.getDate()).padStart(2, '0');
        Alert.alert('暫時無法更換名稱', `您在 ${daysDiff} 天前已更換過名稱。\n下次可更換時間為 ${y}/${m}/${d}。`);
        return;
      }
    }
    Alert.alert('更換名稱', '名稱每 14 天只能更換一次，確定要繼續嗎？', [
      { text: '取消', style: 'cancel' },
      { text: '確定', onPress: () => { setDraftName(user.name); setEditingName(true); } },
    ]);
  };

  const saveName = async () => {
    const trimmed = draftName.trim();
    if (!trimmed) {
      Alert.alert('提示', '姓名不能為空白');
      return;
    }
    try {
      const res = await updateProfile({ name: trimmed });
      updateUser({ name: res.data.name, lastNameChangedAt: res.data.lastNameChangedAt });
      setEditingName(false);
    } catch (e: any) {
      Alert.alert('更新失敗', e.message);
    }
  };

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('權限不足', '請允許存取相片庫以更換頭像。');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      try {
        const res = await updateProfile({
          avatar: { uri: asset.uri, name: asset.fileName ?? 'avatar.jpg', type: asset.mimeType ?? 'image/jpeg' },
        });
        updateUser({ avatarUrl: res.data.avatarUrl });
      } catch (e: any) {
        Alert.alert('上傳失敗', e.message);
      }
    }
  };

  const handleLogout = () => {
    Alert.alert('登出', '確定要登出嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '登出',
        style: 'destructive',
        onPress: () => logout().then(() => navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] })),
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={[styles.appBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>個人資料</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Post detail bottom sheet */}
      <Modal
        visible={selectedPost !== null}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDismiss} activeOpacity={1} onPress={closeModal} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 8 }]}>
              <View style={styles.modalHandleRow}>
                <View style={styles.modalHandle} />
              </View>

              {!showComments ? (
                /* ── 貼文詳情 ── */
                <>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {(() => {
                      const imgs = selectedPost?.images && selectedPost.images.length > 0
                        ? selectedPost.images
                        : selectedPost?.imageUrl ? [selectedPost.imageUrl] : [];
                      if (imgs.length === 0) return null;
                      return (
                        <View>
                          <ScrollView
                            horizontal
                            pagingEnabled={false}
                            snapToInterval={SCREEN_WIDTH}
                            snapToAlignment="start"
                            decelerationRate="fast"
                            showsHorizontalScrollIndicator={false}
                            style={{ width: SCREEN_WIDTH }}
                            onScroll={(e) =>
                              setModalImageIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))
                            }
                            scrollEventThrottle={SCREEN_WIDTH / 2}
                          >
                            {imgs.map((url, idx) => (
                              <Image
                                key={idx}
                                source={{ uri: url }}
                                style={{ width: SCREEN_WIDTH, aspectRatio: 4 / 3 }}
                                resizeMode="cover"
                              />
                            ))}
                          </ScrollView>
                          {imgs.length > 1 && (
                            <View style={styles.modalImageDots}>
                              {imgs.map((_, idx) => (
                                <View key={idx} style={[styles.modalImageDot, idx === modalImageIndex && styles.modalImageDotActive]} />
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })()}
                    <View style={styles.modalBody}>
                      <View style={styles.modalAuthorRow}>
                        {user.avatarUrl ? (
                          <Image source={{ uri: user.avatarUrl }} style={styles.modalAvatar} />
                        ) : (
                          <View style={[styles.modalAvatar, styles.modalAvatarFallback]}>
                            <Text style={styles.modalAvatarInitials}>
                              {user.name.split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase() || '?'}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.modalAuthorName}>{user.name}</Text>
                          <Text style={styles.modalTimeAgo}>{selectedPost?.timeAgo}</Text>
                        </View>
                        <TouchableOpacity onPress={closeModal}>
                          <MaterialIcons name="close" size={22} color={Colors.onSurfaceVariant} />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.modalContent}>{selectedPost?.content}</Text>
                      {(selectedPost?.hashtags.length ?? 0) > 0 && (
                        <View style={styles.modalHashtagRow}>
                          {selectedPost?.hashtags.map((tag) => (
                            <View key={tag} style={styles.modalHashtag}>
                              <Text style={styles.modalHashtagText}>{tag}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </ScrollView>
                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={styles.modalActionBtn}
                      onPress={() => selectedPost && setLikedPosts((p) => ({ ...p, [selectedPost.id]: !p[selectedPost.id] }))}
                    >
                      <MaterialIcons
                        name={selectedPost && likedPosts[selectedPost.id] ? 'favorite' : 'favorite-border'}
                        size={22}
                        color={selectedPost && likedPosts[selectedPost.id] ? Colors.primary : Colors.onSurfaceVariant}
                      />
                      <Text style={[styles.modalActionCount, selectedPost && likedPosts[selectedPost.id] && { color: Colors.primary }]}>
                        {selectedPost ? selectedPost.likes + (likedPosts[selectedPost.id] ? 1 : 0) : 0}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalActionBtn} onPress={() => selectedPost && openComments(selectedPost)}>
                      <MaterialIcons name="chat-bubble-outline" size={22} color={Colors.onSurfaceVariant} />
                      <Text style={styles.modalActionCount}>
                        {selectedPost ? selectedPost.comments + (commentsByPostId[selectedPost.id]?.length ?? 0) : 0}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                /* ── 留言區 ── */
                <>
                  <View style={styles.commentsHeader}>
                    <TouchableOpacity onPress={() => setShowComments(false)} style={styles.commentsBackBtn}>
                      <MaterialIcons name="arrow-back" size={20} color={Colors.onSurface} />
                    </TouchableOpacity>
                    <View style={styles.commentsAuthorRow}>
                      {user.avatarUrl ? (
                        <Image source={{ uri: user.avatarUrl }} style={styles.commentsAvatar} />
                      ) : (
                        <View style={[styles.commentsAvatar, styles.modalAvatarFallback]}>
                          <Text style={styles.commentsAvatarInitials}>
                            {user.name.split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase() || '?'}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.commentsAuthorName} numberOfLines={1}>{user.name}</Text>
                    </View>
                    <TouchableOpacity onPress={closeModal}>
                      <MaterialIcons name="close" size={22} color={Colors.onSurfaceVariant} />
                    </TouchableOpacity>
                  </View>
                  {selectedPost?.content && (
                    <Text style={styles.commentsPostPreview} numberOfLines={2}>{selectedPost.content}</Text>
                  )}
                  <View style={styles.commentsDivider} />
                  <ScrollView style={styles.commentsList} contentContainerStyle={styles.commentsListContent} showsVerticalScrollIndicator={false}>
                    {commentsLoading ? (
                      <Text style={{ textAlign: 'center', color: Colors.onSurfaceVariant, paddingVertical: 16 }}>載入中...</Text>
                    ) : (commentsByPostId[selectedPost?.id ?? ''] ?? []).length === 0 ? (
                      <Text style={{ textAlign: 'center', color: Colors.outlineVariant, paddingVertical: 16 }}>還沒有留言</Text>
                    ) : null}
                    {(commentsByPostId[selectedPost?.id ?? ''] ?? []).map((c) => (
                      <View key={c.id} style={styles.commentItem}>
                        <View style={styles.commentAvatarCircle}>
                          <Text style={styles.commentAvatarInitials}>
                            {c.author.split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?'}
                          </Text>
                        </View>
                        <View style={styles.commentBubble}>
                          <Text style={styles.commentAuthor}>{c.author}</Text>
                          <Text style={styles.commentContent}>{c.content}</Text>
                          <Text style={styles.commentTime}>{c.timeAgo}</Text>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                  <View style={styles.commentInputBar}>
                    <TextInput
                      style={styles.commentTextInput}
                      placeholder="留下你的留言..."
                      placeholderTextColor={Colors.outlineVariant}
                      value={commentText}
                      onChangeText={setCommentText}
                      multiline
                      returnKeyType="send"
                      onSubmitEditing={submitComment}
                    />
                    <TouchableOpacity
                      style={[styles.commentSendBtn, !commentText.trim() && { opacity: 0.4 }]}
                      onPress={submitComment}
                      disabled={!commentText.trim()}
                    >
                      <MaterialIcons name="send" size={18} color={Colors.onPrimary} />
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrap}>
            {user.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitials}>
                  {user.name.split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.avatarEdit} onPress={pickAvatar}>
              <MaterialIcons name="photo-camera" size={16} color={Colors.onPrimary} />
            </TouchableOpacity>
          </View>

          <>
              {editingName ? (
                <View style={styles.nameEditRow}>
                  <TextInput
                    style={styles.nameInput}
                    value={draftName}
                    onChangeText={setDraftName}
                    autoFocus
                    autoCapitalize="words"
                    returnKeyType="done"
                    onSubmitEditing={saveName}
                  />
                  <TouchableOpacity onPress={saveName} style={styles.nameActionBtn}>
                    <MaterialIcons name="check" size={18} color={Colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setDraftName(user.name); setEditingName(false); }}
                    style={styles.nameActionBtn}
                  >
                    <MaterialIcons name="close" size={18} color={Colors.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.nameRow}>
                  <Text style={styles.displayName}>{user.name}</Text>
                  <TouchableOpacity onPress={handleNameEditPress} style={styles.nameEditBtn}>
                    <MaterialIcons name="edit" size={15} color={Colors.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>
              )}
              {!editingName && <Text style={styles.displayEmail}>{user.email}</Text>}
          </>
        </View>


        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{petCount}</Text>
            <Text style={styles.statLabel}>寵物</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{myPosts.length}</Text>
            <Text style={styles.statLabel}>貼文</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{myPosts.reduce((sum, p) => sum + p.likes, 0)}</Text>
            <Text style={styles.statLabel}>按讚</Text>
          </View>
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {(['info', 'posts'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={styles.tabItem}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
                {tab === 'info' ? '資料' : '我的貼文'}
              </Text>
              <View style={[styles.tabIndicator, activeTab === tab && styles.tabIndicatorActive]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Info tab */}
        {activeTab === 'info' && (
          <>
            <View style={styles.menuCard}>
              {[
                { icon: 'pets' as const, label: '我的寵物', onPress: () => navigation.navigate('MainTabs', { screen: 'MyPets' }) },
                { icon: 'notifications-none' as const, label: '通知設定', onPress: () => navigation.navigate('NotificationSettings') },
                { icon: 'lock-outline' as const, label: '隱私與安全', onPress: () => navigation.navigate('PrivacySecurity') },
                { icon: 'help-outline' as const, label: '幫助與支援', onPress: () => navigation.navigate('HelpSupport') },
              ].map((item, i, arr) => (
                <View key={item.label}>
                  <TouchableOpacity style={styles.menuItem} onPress={item.onPress} disabled={!item.onPress}>
                    <View style={styles.menuIconWrap}>
                      <MaterialIcons name={item.icon} size={20} color={Colors.primary} />
                    </View>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <MaterialIcons name="chevron-right" size={20} color={Colors.outlineVariant} />
                  </TouchableOpacity>
                  {i < arr.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <MaterialIcons name="logout" size={20} color={Colors.error} />
              <Text style={styles.logoutLabel}>登出</Text>
            </TouchableOpacity>

            <Text style={styles.version}>Critterio v1.0.0</Text>
          </>
        )}

        {/* Posts tab */}
        {activeTab === 'posts' && (
          myPosts.length === 0 ? (
            <View style={styles.emptyPosts}>
              <MaterialIcons name="photo-library" size={40} color={Colors.outlineVariant} />
              <Text style={styles.emptyPostsText}>還沒有貼文</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {myPosts.map((post) => (
                <TouchableOpacity key={post.id} activeOpacity={0.85} style={styles.gridCell} onPress={() => setSelectedPost(post)}>
                  {post.imageUrl ? (
                    <Image source={{ uri: post.imageUrl }} style={styles.gridCellImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.gridCellFallback}>
                      <MaterialIcons name="format-quote" size={16} color={Colors.onPrimaryContainer} style={{ opacity: 0.4 }} />
                      <Text style={styles.gridCellFallbackText} numberOfLines={5}>{post.content}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )
        )}
      </ScrollView>
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
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  appBarTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: Colors.primary,
  },

  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },

  // Avatar section
  avatarSection: { alignItems: 'center', paddingTop: 8, gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nameEditBtn: { padding: 4 },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nameInput: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineMD,
    color: Colors.onSurface,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.primary,
    paddingVertical: 2,
    minWidth: 120,
    textAlign: 'center',
  },
  nameActionBtn: { padding: 4 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: {
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: FontFamily.headlineBold,
    fontSize: 32,
    color: Colors.onPrimaryContainer,
  },
  avatarEdit: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  displayName: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineMD,
    color: Colors.onSurface,
  },
  displayEmail: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurfaceVariant,
  },


  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceVariant,
    paddingVertical: 16,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statNum: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineMD,
    color: Colors.onSurface,
  },
  statLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: Colors.onSurfaceVariant,
  },
  statDivider: { width: 1, backgroundColor: Colors.surfaceVariant },

  // Menu
  menuCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceVariant,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurface,
  },
  divider: { height: 1, backgroundColor: Colors.surfaceVariant, marginLeft: 64 },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.errorContainer,
    borderRadius: 20,
    paddingVertical: 14,
  },
  logoutLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: Colors.error,
  },

  version: {
    textAlign: 'center',
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: Colors.outlineVariant,
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceVariant,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  tabLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurfaceVariant,
  },
  tabLabelActive: {
    fontFamily: FontFamily.headlineSemiBold,
    color: Colors.primary,
  },
  tabIndicator: {
    height: 2,
    width: 32,
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
  tabIndicatorActive: {
    backgroundColor: Colors.primary,
  },

  // Posts grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: CELL_GAP },
  gridCell: { width: CELL_SIZE, height: CELL_SIZE, borderRadius: 8, overflow: 'hidden' },
  gridCellImage: { width: '100%', height: '100%' },
  gridCellFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.primaryFixed,
    padding: 10,
    justifyContent: 'center',
    gap: 4,
  },
  gridCellFallbackText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: Colors.onPrimaryContainer,
    lineHeight: 16,
  },
  emptyPosts: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  emptyPostsText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.outlineVariant,
  },

  // Post detail modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalDismiss: { flex: 1 },
  modalSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: Dimensions.get('window').height * 0.85,
    borderTopWidth: 1,
    borderColor: Colors.surfaceVariant,
    overflow: 'hidden',
  },
  modalHandleRow: { alignItems: 'center', paddingVertical: 10 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.outlineVariant },
  modalImage: { width: '100%', aspectRatio: 4 / 3 },
  modalImageDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
  },
  modalImageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.outlineVariant,
  },
  modalImageDotActive: {
    backgroundColor: Colors.primary,
    width: 16,
    borderRadius: 3,
  },
  modalBody: { padding: 16, gap: 12 },
  modalAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalAvatar: { width: 40, height: 40, borderRadius: 20 },
  modalAvatarFallback: {
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAvatarInitials: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.labelMD,
    color: Colors.onPrimaryContainer,
  },
  modalAuthorName: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurface,
  },
  modalTimeAgo: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: Colors.outline,
  },
  modalContent: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurface,
    lineHeight: 24,
  },
  modalHashtagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  modalHashtag: {
    backgroundColor: Colors.secondaryContainer + '55',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  modalHashtagText: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: Colors.secondary,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceVariant,
  },
  modalActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modalActionCount: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurfaceVariant,
  },

  // Comments view
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  commentsBackBtn: { padding: 4 },
  commentsAuthorRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentsAvatar: { width: 32, height: 32, borderRadius: 16 },
  commentsAvatarInitials: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.labelSM,
    color: Colors.onPrimaryContainer,
  },
  commentsAuthorName: {
    flex: 1,
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurface,
  },
  commentsPostPreview: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurfaceVariant,
    lineHeight: 20,
  },
  commentsDivider: { height: 1, backgroundColor: Colors.surfaceVariant, marginHorizontal: 16 },
  commentsList: { maxHeight: 280 },
  commentsListContent: { padding: 16, gap: 12 },
  commentItem: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  commentAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarInitials: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.labelSM,
    color: Colors.onPrimaryContainer,
  },
  commentBubble: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  commentAuthor: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: Colors.onSurface,
  },
  commentContent: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurfaceVariant,
    lineHeight: 20,
  },
  commentTime: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: Colors.outline,
    alignSelf: 'flex-end',
  },
  commentInputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceVariant,
    backgroundColor: Colors.surfaceContainerLow,
  },
  commentTextInput: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurface,
    maxHeight: 80,
    paddingVertical: 8,
  },
  commentSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
});
