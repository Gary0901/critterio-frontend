import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  useWindowDimensions,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ActionSheetIOS,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../../types/navigation';
import Avatar from '../../components/ui/Avatar';
import { ThemeColors } from '../../constants/themes';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { FontFamily, FontSize } from '../../constants/typography';
import { useUser } from '../../context/UserContext';
import { useAuth } from '../../context/AuthContext';
import { updateProfile, getMyPosts, getPets, getPostComments, addComment as apiAddComment, deletePost as apiDeletePost, formatTimeAgo } from '../../api';
import { Post } from '../../types';
import { useState, useCallback, useEffect } from 'react';
import { useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';

const CELL_GAP = 2;
// 40 = paddingHorizontal * 2；寬度在元件內用 useWindowDimensions 取得
const cellSize = (screenW: number) => (screenW - 40 - CELL_GAP * 2) / 3;

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
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const CELL_SIZE = cellSize(screenW);
  const { user, updateUser } = useUser();
  const { logout } = useAuth();
  const route = useRoute<RouteProp<RootStackParamList, 'Profile'>>();
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [petCount, setPetCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'info' | 'posts'>('info');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

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

  const [deletingPost, setDeletingPost] = useState(false);

  const handleDeletePost = () => {
    if (!selectedPost) return;
    const postId = selectedPost.id;
    Alert.alert(
      '刪除貼文',
      '此操作無法復原，貼文的內容、圖片、留言與按讚都會被永久刪除。確定要刪除嗎？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '確定刪除',
          style: 'destructive',
          onPress: async () => {
            setDeletingPost(true);
            const res = await apiDeletePost(postId);
            setDeletingPost(false);
            if (res.success) {
              setMyPosts((prev) => prev.filter((p) => p.id !== postId));
              closeModal();
            } else {
              Alert.alert('刪除失敗', '請稍後再試');
            }
          },
        },
      ]
    );
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

  const removeAvatar = async () => {
    setAvatarUploading(true);
    try {
      await updateProfile({ removeAvatar: true });
      // 後端回傳的 avatarUrl 是 null，但 User 型別用 undefined 表示沒有
      updateUser({ avatarUrl: undefined });
    } catch (e: any) {
      Alert.alert('移除失敗', e?.message ?? '請稍後再試');
    } finally {
      setAvatarUploading(false);
    }
  };

  // 已經有照片時先問要換還是移除，直接開相簿的話使用者沒有移除的入口
  const handleAvatarPress = () => {
    if (!user.avatarUrl) {
      pickAvatar();
      return;
    }
    const options = ['取消', '更換照片', '移除照片'];
    const run = (i: number) => {
      if (i === 1) pickAvatar();
      if (i === 2) removeAvatar();
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 0, destructiveButtonIndex: 2, title: '頭像照片' },
        run,
      );
    } else {
      Alert.alert('頭像照片', undefined, [
        { text: '更換照片', onPress: () => run(1) },
        { text: '移除照片', style: 'destructive', onPress: () => run(2) },
        { text: '取消', style: 'cancel' },
      ]);
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
      quality: 0.8,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setLocalAvatarUri(asset.uri);
      setAvatarUploading(true);
      try {
        const res = await updateProfile({
          avatar: { uri: asset.uri, name: asset.fileName ?? 'avatar.jpg', type: asset.mimeType ?? 'image/jpeg' },
        });
        updateUser({ avatarUrl: res.data.avatarUrl });
        setLocalAvatarUri(null);
      } catch (e: any) {
        setLocalAvatarUri(null);
        Alert.alert('上傳失敗', e.message);
      } finally {
        setAvatarUploading(false);
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
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
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
                            snapToInterval={screenW}
                            snapToAlignment="start"
                            decelerationRate="fast"
                            showsHorizontalScrollIndicator={false}
                            style={{ width: screenW }}
                            onScroll={(e) =>
                              setModalImageIndex(Math.round(e.nativeEvent.contentOffset.x / screenW))
                            }
                            scrollEventThrottle={screenW / 2}
                          >
                            {imgs.map((url, idx) => (
                              <Image
                                key={idx}
                                source={{ uri: url }}
                                style={{ width: screenW, aspectRatio: 4 / 3 }}
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
                        <Avatar url={user.avatarUrl} name={user.name} seed={user.id} colorIndex={user.avatarColor} size={40} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.modalAuthorName}>{user.name}</Text>
                          <Text style={styles.modalTimeAgo}>{selectedPost?.timeAgo}</Text>
                        </View>
                        <TouchableOpacity onPress={handleDeletePost} disabled={deletingPost} style={{ marginRight: 12 }}>
                          <MaterialIcons name="delete-outline" size={22} color={colors.error} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={closeModal}>
                          <MaterialIcons name="close" size={22} color={colors.onSurfaceVariant} />
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
                        color={selectedPost && likedPosts[selectedPost.id] ? colors.primary : colors.onSurfaceVariant}
                      />
                      <Text style={[styles.modalActionCount, selectedPost && likedPosts[selectedPost.id] && { color: colors.primary }]}>
                        {selectedPost ? selectedPost.likes + (likedPosts[selectedPost.id] ? 1 : 0) : 0}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalActionBtn} onPress={() => selectedPost && openComments(selectedPost)}>
                      <MaterialIcons name="chat-bubble-outline" size={22} color={colors.onSurfaceVariant} />
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
                      <MaterialIcons name="arrow-back" size={20} color={colors.onSurface} />
                    </TouchableOpacity>
                    <View style={styles.commentsAuthorRow}>
                      <Avatar url={user.avatarUrl} name={user.name} seed={user.id} colorIndex={user.avatarColor} size={32} />
                      <Text style={styles.commentsAuthorName} numberOfLines={1}>{user.name}</Text>
                    </View>
                    <TouchableOpacity onPress={closeModal}>
                      <MaterialIcons name="close" size={22} color={colors.onSurfaceVariant} />
                    </TouchableOpacity>
                  </View>
                  {selectedPost?.content && (
                    <Text style={styles.commentsPostPreview} numberOfLines={2}>{selectedPost.content}</Text>
                  )}
                  <View style={styles.commentsDivider} />
                  <ScrollView style={styles.commentsList} contentContainerStyle={styles.commentsListContent} showsVerticalScrollIndicator={false}>
                    {commentsLoading ? (
                      <Text style={{ textAlign: 'center', color: colors.onSurfaceVariant, paddingVertical: 16 }}>載入中...</Text>
                    ) : (commentsByPostId[selectedPost?.id ?? ''] ?? []).length === 0 ? (
                      <Text style={{ textAlign: 'center', color: colors.outlineVariant, paddingVertical: 16 }}>還沒有留言</Text>
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
                      placeholderTextColor={colors.outlineVariant}
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
                      <MaterialIcons name="send" size={18} color={colors.onPrimary} />
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
            <Avatar
              url={localAvatarUri ?? user.avatarUrl}
              name={user.name}
              seed={user.id}
              colorIndex={user.avatarColor}
              size={96}
            />
            {avatarUploading && (
              <View style={styles.avatarLoadingOverlay}>
                <ActivityIndicator size="small" color={colors.onPrimary} />
              </View>
            )}
            <TouchableOpacity style={styles.avatarEdit} onPress={handleAvatarPress} disabled={avatarUploading}>
              <MaterialIcons name="photo-camera" size={16} color={colors.onPrimary} />
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
                    <MaterialIcons name="check" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setDraftName(user.name); setEditingName(false); }}
                    style={styles.nameActionBtn}
                  >
                    <MaterialIcons name="close" size={18} color={colors.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.nameRow}>
                  <Text style={styles.displayName}>{user.name}</Text>
                  <TouchableOpacity onPress={handleNameEditPress} style={styles.nameEditBtn}>
                    <MaterialIcons name="edit" size={15} color={colors.onSurfaceVariant} />
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
                { icon: 'palette' as const, label: '外觀', onPress: () => navigation.navigate('Appearance') },
                { icon: 'help-outline' as const, label: '幫助與支援', onPress: () => navigation.navigate('HelpSupport') },
              ].map((item, i, arr) => (
                <View key={item.label}>
                  <TouchableOpacity style={styles.menuItem} onPress={item.onPress} disabled={!item.onPress}>
                    <View style={styles.menuIconWrap}>
                      <MaterialIcons name={item.icon} size={20} color={colors.primary} />
                    </View>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <MaterialIcons name="chevron-right" size={20} color={colors.outlineVariant} />
                  </TouchableOpacity>
                  {i < arr.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <MaterialIcons name="logout" size={20} color={colors.error} />
              <Text style={styles.logoutLabel}>登出</Text>
            </TouchableOpacity>

            <Text style={styles.version}>Critterio v1.0.0</Text>
          </>
        )}

        {/* Posts tab */}
        {activeTab === 'posts' && (
          myPosts.length === 0 ? (
            <View style={styles.emptyPosts}>
              <MaterialIcons name="photo-library" size={40} color={colors.outlineVariant} />
              <Text style={styles.emptyPostsText}>還沒有貼文</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {myPosts.map((post) => (
                <TouchableOpacity key={post.id} activeOpacity={0.85} style={[styles.gridCell, { width: CELL_SIZE, height: CELL_SIZE }]} onPress={() => setSelectedPost(post)}>
                  {post.imageUrl ? (
                    <Image source={{ uri: post.imageUrl }} style={styles.gridCellImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.gridCellFallback}>
                      <MaterialIcons name="format-quote" size={16} color={colors.onPrimaryContainer} style={{ opacity: 0.4 }} />
                      <Text style={styles.gridCellFallbackText} numberOfLines={5}>{post.content}</Text>
                    </View>
                  )}
                  {(post.postType === 'question' || post.postType === 'meetup') && (
                    <View style={styles.gridCellTypeBadge}>
                      <Text style={styles.gridCellTypeBadgeText}>
                        {post.postType === 'question' ? '❓' : '👥'}
                      </Text>
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

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },

  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: c.background,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  appBarTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: c.primary,
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
    color: c.onSurface,
    borderBottomWidth: 1.5,
    borderBottomColor: c.primary,
    paddingVertical: 2,
    minWidth: 120,
    textAlign: 'center',
  },
  nameActionBtn: { padding: 4 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarLoadingOverlay: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEdit: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: c.background,
  },
  displayName: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineMD,
    color: c.onSurface,
  },
  displayEmail: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
  },


  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: c.surfaceContainerLowest,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.surfaceVariant,
    paddingVertical: 16,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statNum: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.headlineMD,
    color: c.onSurface,
  },
  statLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
  },
  statDivider: { width: 1, backgroundColor: c.surfaceVariant },

  // Menu
  menuCard: {
    backgroundColor: c.surfaceContainerLowest,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.surfaceVariant,
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
    backgroundColor: c.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
  },
  divider: { height: 1, backgroundColor: c.surfaceVariant, marginLeft: 64 },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: c.errorContainer,
    borderRadius: 20,
    paddingVertical: 14,
  },
  logoutLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.error,
  },

  version: {
    textAlign: 'center',
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.outlineVariant,
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceVariant,
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
    color: c.onSurfaceVariant,
  },
  tabLabelActive: {
    fontFamily: FontFamily.headlineSemiBold,
    color: c.primary,
  },
  tabIndicator: {
    height: 2,
    width: 32,
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
  tabIndicatorActive: {
    backgroundColor: c.primary,
  },

  // Posts grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: CELL_GAP },
  gridCell: { borderRadius: 8, overflow: 'hidden' },
  gridCellTypeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCellTypeBadgeText: {
    fontSize: 11,
    lineHeight: 13,
  },
  gridCellImage: { width: '100%', height: '100%' },
  gridCellFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: c.primaryFixed,
    padding: 10,
    justifyContent: 'center',
    gap: 4,
  },
  gridCellFallbackText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onPrimaryContainer,
    lineHeight: 16,
  },
  emptyPosts: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  emptyPostsText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.outlineVariant,
  },

  // Post detail modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalDismiss: { flex: 1 },
  modalSheet: {
    backgroundColor: c.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderColor: c.surfaceVariant,
    overflow: 'hidden',
  },
  modalHandleRow: { alignItems: 'center', paddingVertical: 10 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: c.outlineVariant },
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
    backgroundColor: c.outlineVariant,
  },
  modalImageDotActive: {
    backgroundColor: c.primary,
    width: 16,
    borderRadius: 3,
  },
  modalBody: { padding: 16, gap: 12 },
  modalAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalAuthorName: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
  },
  modalTimeAgo: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.outline,
  },
  modalContent: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
    lineHeight: 24,
  },
  modalHashtagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  modalHashtag: {
    backgroundColor: c.secondaryContainer + '55',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  modalHashtagText: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: c.secondary,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: c.surfaceVariant,
  },
  modalActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modalActionCount: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
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
  commentsAuthorName: {
    flex: 1,
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
  },
  commentsPostPreview: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
    lineHeight: 20,
  },
  commentsDivider: { height: 1, backgroundColor: c.surfaceVariant, marginHorizontal: 16 },
  commentsList: { maxHeight: 280 },
  commentsListContent: { padding: 16, gap: 12 },
  commentItem: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  commentAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarInitials: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.labelSM,
    color: c.onPrimaryContainer,
  },
  commentBubble: {
    flex: 1,
    backgroundColor: c.surfaceContainerLow,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  commentAuthor: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: c.onSurface,
  },
  commentContent: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
    lineHeight: 20,
  },
  commentTime: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.outline,
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
    borderTopColor: c.surfaceVariant,
    backgroundColor: c.surfaceContainerLow,
  },
  commentTextInput: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
    maxHeight: 80,
    paddingVertical: 8,
  },
  commentSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
});
