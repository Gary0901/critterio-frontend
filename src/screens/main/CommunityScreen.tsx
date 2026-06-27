import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Share,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import AppBar from '../../components/layout/AppBar';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import {
  getPosts,
  createPost,
  getPets,
  toggleLike as apiToggleLike,
  getPostComments,
  addComment as apiAddComment,
  reportPost as apiReportPost,
  formatTimeAgo,
} from '../../api';
import { Post } from '../../types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList, MainTabParamList } from '../../types/navigation';
import { useUser } from '../../context/UserContext';
import { useNotifications } from '../../context/NotificationContext';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

interface Comment {
  id: string;
  author: string;
  avatarUrl?: string;
  content: string;
  timeAgo: string;
}

type SortMode = 'new' | 'hot';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_IMAGE_WIDTH = SCREEN_WIDTH - 42; // 20*2 margin + 1*2 border
const COMMENT_SHEET_HEIGHT = Dimensions.get('window').height * 0.65;
const MAX_IMAGES = 5;

type ImagePayload = { uri: string; name: string; type: string };

function mapApiComment(c: any): Comment {
  return {
    id: String(c.id ?? c._id),
    author: c.user?.name ?? '',
    avatarUrl: c.user?.avatarUrl ?? undefined,
    content: c.content,
    timeAgo: formatTimeAgo(c.createdAt),
  };
}

function EmptyFeed({ onCompose }: { onCompose: () => void }) {
  return (
    <View style={styles.emptyFeed}>
      <MaterialIcons name="pets" size={64} color={Colors.outlineVariant} />
      <Text style={styles.emptyFeedTitle}>還沒有任何貼文</Text>
      <Text style={styles.emptyFeedSub}>成為第一個分享你和毛孩的精彩時刻！</Text>
      <TouchableOpacity style={styles.emptyFeedBtn} onPress={onCompose} activeOpacity={0.8}>
        <Text style={styles.emptyFeedBtnLabel}>立刻分享</Text>
      </TouchableOpacity>
    </View>
  );
}

function Avatar({ url, name, size = 42 }: { url?: string; name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (url) {
    return (
      <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />
    );
  }
  return (
    <View style={[styles.initialsAvatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.initialsText}>{initials}</Text>
    </View>
  );
}

function PostCard({
  post,
  onLike,
  onComment,
  onMore,
}: {
  post: Post;
  onLike: (id: string) => void;
  onComment: (id: string) => void;
  onMore: (id: string) => void;
}) {
  const [liked, setLiked] = useState(post.isLiked ?? false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [imageIndex, setImageIndex] = useState(0);
  const allImages = post.images && post.images.length > 0 ? post.images : post.imageUrl ? [post.imageUrl] : [];

  const toggleLikeLocal = () => {
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => (next ? c + 1 : c - 1));
    onLike(post.id);
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: post.content });
    } catch {}
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Avatar url={post.authorAvatarUrl} name={post.author} />
        <View style={{ flex: 1 }}>
          <Text style={styles.authorName}>{post.author}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.timeAgo}>{post.timeAgo}</Text>
            {post.withPets && post.withPets.length > 0 && (
              <>
                <Text style={styles.metaDot}>·</Text>
                <MaterialIcons name="pets" size={12} color={Colors.secondary} />
                <Text style={styles.withPetsLabel}>與 {post.withPets.join('、')}</Text>
              </>
            )}
          </View>
        </View>
        <TouchableOpacity style={styles.moreBtn} onPress={() => onMore(post.id)}>
          <MaterialIcons name="more-vert" size={20} color={Colors.outline} />
        </TouchableOpacity>
      </View>

      <Text style={styles.content}>{post.content}</Text>

      {post.hashtags.length > 0 && (
        <View style={styles.hashtagRow}>
          {post.hashtags.map((tag) => (
            <View key={tag} style={styles.hashtag}>
              <Text style={styles.hashtagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {allImages.length > 0 && (
        <View style={styles.carouselWrapper}>
          <ScrollView
            horizontal
            pagingEnabled={false}
            snapToInterval={CARD_IMAGE_WIDTH}
            snapToAlignment="start"
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            style={{ width: CARD_IMAGE_WIDTH }}
            onScroll={(e) =>
              setImageIndex(Math.round(e.nativeEvent.contentOffset.x / CARD_IMAGE_WIDTH))
            }
            scrollEventThrottle={CARD_IMAGE_WIDTH / 2}
          >
            {allImages.map((url, idx) => (
              <Image
                key={idx}
                source={{ uri: url }}
                style={{ width: CARD_IMAGE_WIDTH, aspectRatio: 4 / 3 }}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
          {allImages.length > 1 && (
            <View style={styles.imageDots}>
              {allImages.map((_, idx) => (
                <View key={idx} style={[styles.imageDot, idx === imageIndex && styles.imageDotActive]} />
              ))}
            </View>
          )}
        </View>
      )}

      <View style={styles.actions}>
        <View style={styles.actionsLeft}>
          <TouchableOpacity style={styles.actionBtn} onPress={toggleLikeLocal} activeOpacity={0.7}>
            <MaterialIcons
              name={liked ? 'favorite' : 'favorite-border'}
              size={22}
              color={liked ? Colors.primary : Colors.onSurfaceVariant}
            />
            <Text style={[styles.actionCount, liked && { color: Colors.primary }]}>
              {likeCount}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.7}
            onPress={() => onComment(post.id)}
          >
            <MaterialIcons name="chat-bubble-outline" size={22} color={Colors.onSurfaceVariant} />
            <Text style={styles.actionCount}>{post.comments}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity activeOpacity={0.7} onPress={handleShare}>
          <MaterialIcons name="share" size={22} color={Colors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function CommunityScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { unreadCount } = useNotifications();
  const route = useRoute<RouteProp<MainTabParamList, 'Community'>>();

  // Feed state
  const [posts, setPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<SortMode>('new');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Compose state
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState('');
  const [pendingImages, setPendingImages] = useState<ImagePayload[]>([]);
  const [posting, setPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [draftHashtags, setDraftHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const [showHashtagInput, setShowHashtagInput] = useState(false);

  // Pet picker
  const [petOptions, setPetOptions] = useState<string[]>([]);
  const [taggedPets, setTaggedPets] = useState<string[]>([]);
  const [showPetPicker, setShowPetPicker] = useState(false);

  // Comments
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentsByPostId, setCommentsByPostId] = useState<Record<string, Comment[]>>({});
  const [commentsLoading, setCommentsLoading] = useState(false);

  // More modal
  const [morePostId, setMorePostId] = useState<string | null>(null);

  // ─── Data loading ──────────────────────────────────────────────────────────

  const load = useCallback(async (newSort: SortMode, newPage: number, append: boolean) => {
    if (newPage === 1) setRefreshing(true);
    else setLoadingMore(true);

    try {
      const res = await getPosts(newPage, newSort);
      if (!res.success) return;
      setHasMore(res.data.length === 10);
      setPosts((prev) => (append ? [...prev, ...res.data] : res.data));
    } finally {
      if (newPage === 1) setRefreshing(false);
      else setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    load(sort, 1, false);
  }, [sort]);

  useEffect(() => {
    getPets().then((res) => {
      if (res.success) setPetOptions(res.data.map((p) => p.name));
    });
  }, []);

  // 從日誌頁帶照片過來時，預填發文
  useEffect(() => {
    const { sharePhoto, sharePetName } = route.params ?? {};
    if (sharePhoto || sharePetName) {
      if (sharePhoto) setPendingImages([{ uri: sharePhoto.uri, name: sharePhoto.name, type: sharePhoto.type }]);
      if (sharePetName) setTaggedPets([sharePetName]);
      setComposing(true);
      navigation.setParams({ sharePhoto: undefined, sharePetName: undefined } as any);
    }
  }, [route.params?.sharePhoto, route.params?.sharePetName]);

  const onRefresh = () => {
    setPage(1);
    setHasMore(true);
    load(sort, 1, false);
  };

  const onLoadMore = () => {
    if (loadingMore || !hasMore) return;
    const next = page + 1;
    setPage(next);
    load(sort, next, true);
  };

  // ─── Like ─────────────────────────────────────────────────────────────────

  const handleLike = async (id: string) => {
    const res = await apiToggleLike(id);
    if (res.success) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, isLiked: res.data.liked, likes: res.data.likesCount }
            : p
        )
      );
    }
  };

  // ─── Compose ──────────────────────────────────────────────────────────────

  const makeImagePayload = (asset: ImagePicker.ImagePickerAsset): ImagePayload => ({
    uri: asset.uri,
    name: `photo.jpg`,
    type: 'image/jpeg',
  });

  const compressImage = async (payload: ImagePayload): Promise<ImagePayload> => {
    try {
      const result = await ImageManipulator.manipulateAsync(
        payload.uri,
        [{ resize: { width: 1080 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
      );
      return { uri: result.uri, name: 'photo.jpg', type: 'image/jpeg' };
    } catch {
      return payload;
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const remaining = MAX_IMAGES - pendingImages.length;
    if (remaining <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.7,
    });
    if (!result.canceled) {
      setPendingImages((prev) => [...prev, ...result.assets.map(makeImagePayload)].slice(0, MAX_IMAGES));
      setComposing(true);
    }
  };

  const pickFromCamera = async () => {
    if (pendingImages.length >= MAX_IMAGES) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled) {
      setPendingImages((prev) => [...prev, makeImagePayload(result.assets[0])]);
      setComposing(true);
    }
  };

  const removeImage = (idx: number) =>
    setPendingImages((prev) => prev.filter((_, i) => i !== idx));

  const cancelCompose = () => {
    setComposing(false);
    setDraft('');
    setPendingImages([]);
    setDraftHashtags([]);
    setHashtagInput('');
    setShowHashtagInput(false);
    setTaggedPets([]);
  };

  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#+/, '');
    if (!tag) return;
    const formatted = '#' + tag;
    if (!draftHashtags.includes(formatted)) {
      setDraftHashtags((prev) => [...prev, formatted]);
    }
    setHashtagInput('');
  };

  const removeHashtag = (tag: string) => {
    setDraftHashtags((prev) => prev.filter((t) => t !== tag));
  };

  const togglePet = (name: string) => {
    setTaggedPets((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name],
    );
  };

  const handlePost = async () => {
    if (!draft.trim() && pendingImages.length === 0) return;
    setPosting(true);
    setUploadProgress(0);

    // 模擬後端處理階段（70% → 95%）的緩慢爬升
    let fakeProgress = 70;
    let fakeTimer: ReturnType<typeof setInterval> | null = null;

    try {
      // 壓縮所有圖片
      const compressed = await Promise.all(pendingImages.map(compressImage));

      const res = await createPost(
        draft.trim(),
        compressed.length > 0 ? compressed : undefined,
        undefined,
        (pct) => {
          setUploadProgress(pct);
          if (pct >= 70 && !fakeTimer) {
            fakeTimer = setInterval(() => {
              fakeProgress = Math.min(fakeProgress + 1, 95);
              setUploadProgress(fakeProgress);
            }, 200);
          }
        },
        draftHashtags.length > 0 ? draftHashtags : undefined,
        taggedPets.length > 0 ? taggedPets : undefined,
      );

      if (fakeTimer) clearInterval(fakeTimer);
      setUploadProgress(100);

      if (res.success) {
        const newPost: Post = res.data;
        setTimeout(() => {
          setPosts((prev) => [newPost, ...prev]);
          cancelCompose();
          setUploadProgress(0);
        }, 300);
      }
    } catch {
      if (fakeTimer) clearInterval(fakeTimer);
      setUploadProgress(0);
    } finally {
      setPosting(false);
    }
  };

  // ─── Comments ─────────────────────────────────────────────────────────────

  const openComments = async (postId: string) => {
    setCommentPostId(postId);
    if (commentsByPostId[postId]) return;
    setCommentsLoading(true);
    const res = await getPostComments(postId);
    setCommentsLoading(false);
    if (res.success) {
      setCommentsByPostId((prev) => ({
        ...prev,
        [postId]: res.data.map(mapApiComment),
      }));
    }
  };

  const submitComment = async () => {
    if (!commentText.trim() || !commentPostId) return;
    const content = commentText.trim();
    setCommentText('');
    const res = await apiAddComment(commentPostId, content);
    if (res.success) {
      setCommentsByPostId((prev) => ({
        ...prev,
        [commentPostId]: [...(prev[commentPostId] ?? []), mapApiComment(res.data)],
      }));
      setPosts((prev) =>
        prev.map((p) => (p.id === commentPostId ? { ...p, comments: p.comments + 1 } : p)),
      );
    }
  };

  const commentsForPost = commentPostId ? (commentsByPostId[commentPostId] ?? []) : [];

  // ─── Report ───────────────────────────────────────────────────────────────

  const handleReport = (postId: string) => {
    setMorePostId(null);
    Alert.alert('回報貼文', '選擇回報原因', [
      {
        text: '垃圾內容',
        onPress: async () => {
          await apiReportPost(postId, 'SPAM');
          Alert.alert('已回報', '感謝你的回報，我們會盡快處理');
        },
      },
      {
        text: '不當內容',
        onPress: async () => {
          await apiReportPost(postId, 'INAPPROPRIATE');
          Alert.alert('已回報', '感謝你的回報，我們會盡快處理');
        },
      },
      { text: '取消', style: 'cancel' },
    ]);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppBar
        avatarUrl={user.avatarUrl}
        onAvatarPress={() => navigation.navigate('Profile')}
        onNotificationPress={() => navigation.navigate('Notifications')}
        unreadCount={unreadCount}
      />

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} />
          ) : null
        }
        ListHeaderComponent={
          <View style={styles.header}>
            {composing ? (
              <View style={styles.composeBox}>
                {posting && (
                  <View style={styles.progressBarWrap}>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${uploadProgress}%` as any }]} />
                    </View>
                    <Text style={styles.progressBarLabel}>{uploadProgress < 100 ? `${uploadProgress}%` : '處理中...'}</Text>
                  </View>
                )}
                <TextInput
                  style={styles.composeInput}
                  placeholder="你的毛孩今天在做什麼？"
                  placeholderTextColor={Colors.outlineVariant}
                  value={draft}
                  onChangeText={setDraft}
                  multiline
                  autoFocus={pendingImages.length === 0}
                />

                {taggedPets.length > 0 && (
                  <View style={styles.taggedPetsRow}>
                    <MaterialIcons name="pets" size={14} color={Colors.secondary} />
                    <Text style={styles.taggedPetsText}>與 {taggedPets.join('、')} 一起</Text>
                    <TouchableOpacity onPress={() => setTaggedPets([])}>
                      <MaterialIcons name="close" size={14} color={Colors.outlineVariant} />
                    </TouchableOpacity>
                  </View>
                )}

                {draftHashtags.length > 0 && (
                  <View style={styles.draftHashtagsRow}>
                    {draftHashtags.map((tag) => (
                      <TouchableOpacity
                        key={tag}
                        style={styles.draftHashtagChip}
                        onPress={() => removeHashtag(tag)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.draftHashtagText}>{tag}</Text>
                        <MaterialIcons name="close" size={11} color={Colors.secondary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {showHashtagInput && (
                  <View style={styles.hashtagInputRow}>
                    <Text style={styles.hashtagPrefix}>#</Text>
                    <TextInput
                      style={styles.hashtagTextInput}
                      placeholder="輸入標籤後按確認"
                      placeholderTextColor={Colors.outlineVariant}
                      value={hashtagInput}
                      onChangeText={setHashtagInput}
                      onSubmitEditing={addHashtag}
                      returnKeyType="done"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity onPress={addHashtag} disabled={!hashtagInput.trim()}>
                      <MaterialIcons
                        name="add-circle"
                        size={22}
                        color={hashtagInput.trim() ? Colors.primary : Colors.outlineVariant}
                      />
                    </TouchableOpacity>
                  </View>
                )}

                {pendingImages.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.composeImagesRow}
                  >
                    {pendingImages.map((img, idx) => (
                      <View key={img.uri + idx} style={styles.composeThumb}>
                        <Image source={{ uri: img.uri }} style={styles.composeThumbImg} resizeMode="cover" />
                        <TouchableOpacity style={styles.composeThumbRemove} onPress={() => removeImage(idx)}>
                          <MaterialIcons name="close" size={12} color="#fff" />
                        </TouchableOpacity>
                        {idx === 0 && (
                          <View style={styles.composeThumbCoverBadge}>
                            <Text style={styles.composeThumbCoverLabel}>封面</Text>
                          </View>
                        )}
                      </View>
                    ))}
                    {pendingImages.length < MAX_IMAGES && (
                      <TouchableOpacity style={styles.composeAddMoreBtn} onPress={pickFromGallery}>
                        <MaterialIcons name="add-photo-alternate" size={28} color={Colors.onSurfaceVariant} />
                        <Text style={styles.composeAddMoreLabel}>{pendingImages.length}/{MAX_IMAGES}</Text>
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                )}

                {!posting && <View style={styles.composeFooter}>
                  <TouchableOpacity style={styles.mediaBtn} onPress={pickFromCamera}>
                    <MaterialIcons name="photo-camera" size={22} color={Colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.mediaBtn} onPress={pickFromGallery}>
                    <MaterialIcons name="photo-library" size={22} color={Colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.mediaBtn}
                    onPress={() => setShowHashtagInput((v) => !v)}
                  >
                    <MaterialIcons
                      name="tag"
                      size={22}
                      color={
                        showHashtagInput || draftHashtags.length > 0
                          ? Colors.primary
                          : Colors.onSurfaceVariant
                      }
                    />
                  </TouchableOpacity>
                  {petOptions.length > 0 && (
                    <TouchableOpacity
                      style={styles.mediaBtn}
                      onPress={() => setShowPetPicker(true)}
                    >
                      <MaterialIcons
                        name="pets"
                        size={22}
                        color={
                          taggedPets.length > 0 ? Colors.secondary : Colors.onSurfaceVariant
                        }
                      />
                    </TouchableOpacity>
                  )}

                  <View style={{ flex: 1 }} />

                  <TouchableOpacity onPress={cancelCompose}>
                    <Text style={styles.cancelLabel}>取消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.postBtn,
                      (!draft.trim() && pendingImages.length === 0) || posting ? { opacity: 0.45 } : undefined,
                    ]}
                    onPress={handlePost}
                    disabled={posting || (!draft.trim() && pendingImages.length === 0)}
                  >
                    <Text style={styles.postBtnLabel}>發布</Text>
                  </TouchableOpacity>
                </View>}
              </View>
            ) : (
              <View style={styles.composeTrigger}>
                <TouchableOpacity
                  style={styles.composeTriggerLeft}
                  onPress={() => setComposing(true)}
                  activeOpacity={0.7}
                >
                  <Avatar url={user.avatarUrl} name={user.name} size={36} />
                  <Text style={styles.composePlaceholder}>分享你和寵物的精彩時刻...</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={pickFromCamera} activeOpacity={0.7}>
                  <MaterialIcons name="photo-camera" size={22} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={pickFromGallery} activeOpacity={0.7}>
                  <MaterialIcons name="photo-library" size={22} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            )}

            {/* Sort tabs — 無貼文時隱藏 */}
            {(!refreshing && posts.length > 0) && (
              <View style={styles.sortTabs}>
                {(['new', 'hot'] as SortMode[]).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.sortTab, sort === s && styles.sortTabActive]}
                    onPress={() => setSort(s)}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons
                      name={s === 'new' ? 'access-time' : 'local-fire-department'}
                      size={14}
                      color={sort === s ? Colors.onPrimary : Colors.onSurfaceVariant}
                    />
                    <Text style={[styles.sortTabLabel, sort === s && styles.sortTabLabelActive]}>
                      {s === 'new' ? '最新' : '熱門'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onLike={handleLike}
            onComment={openComments}
            onMore={setMorePostId}
          />
        )}
        ListEmptyComponent={
          !refreshing ? <EmptyFeed onCompose={() => setComposing(true)} /> : null
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* ── Pet picker modal ── */}
      <Modal
        visible={showPetPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPetPicker(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
            activeOpacity={1}
            onPress={() => setShowPetPicker(false)}
          />
          <View style={[styles.moreSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandleWrap}>
              <View style={styles.sheetHandle} />
            </View>
            <Text style={styles.petPickerTitle}>選擇一起出現的寵物</Text>
            <View style={styles.petChipsRow}>
              {petOptions.map((pet) => {
                const selected = taggedPets.includes(pet);
                return (
                  <TouchableOpacity
                    key={pet}
                    style={[styles.petChip, selected && styles.petChipSelected]}
                    onPress={() => togglePet(pet)}
                    activeOpacity={0.75}
                  >
                    <MaterialIcons
                      name="pets"
                      size={14}
                      color={selected ? Colors.onPrimary : Colors.secondary}
                    />
                    <Text style={[styles.petChipLabel, selected && styles.petChipLabelSelected]}>
                      {pet}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={styles.petPickerDoneBtn}
              onPress={() => setShowPetPicker(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.petPickerDoneLabel}>完成</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Comment modal ── */}
      <Modal
        visible={commentPostId !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setCommentPostId(null)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
            activeOpacity={1}
            onPress={() => setCommentPostId(null)}
          />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.commentSheet}>
              <View style={styles.sheetHandleWrap}>
                <View style={styles.sheetHandle} />
              </View>
              <View style={styles.commentSheetHeader}>
                <Text style={styles.commentSheetTitle}>留言</Text>
                <TouchableOpacity onPress={() => setCommentPostId(null)}>
                  <MaterialIcons name="close" size={22} color={Colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>
              {commentsLoading ? (
                <ActivityIndicator color={Colors.primary} style={{ flex: 1, marginVertical: 24 }} />
              ) : (
                <FlatList
                  data={commentsForPost}
                  keyExtractor={(c) => c.id}
                  style={styles.commentScroll}
                  contentContainerStyle={styles.commentListContent}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <View style={styles.commentItem}>
                      <Avatar url={item.avatarUrl} name={item.author} size={36} />
                      <View style={styles.commentBubble}>
                        <Text style={styles.commentAuthor}>{item.author}</Text>
                        <Text style={styles.commentContent}>{item.content}</Text>
                        <Text style={styles.commentTime}>{item.timeAgo}</Text>
                      </View>
                    </View>
                  )}
                  ListEmptyComponent={
                    <Text style={styles.emptyComments}>還沒有留言，搶先留下第一則！</Text>
                  }
                />
              )}
              <View style={[styles.commentInputBar, { paddingBottom: insets.bottom + 8 }]}>
                <Avatar url={user.avatarUrl} name={user.name} size={32} />
                <TextInput
                  style={styles.commentTextInput}
                  placeholder="留下你的留言..."
                  placeholderTextColor={Colors.outlineVariant}
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.commentSendBtn, !commentText.trim() && { opacity: 0.4 }]}
                  onPress={submitComment}
                  disabled={!commentText.trim()}
                >
                  <MaterialIcons name="send" size={18} color={Colors.onPrimary} />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── More modal ── */}
      <Modal
        visible={morePostId !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setMorePostId(null)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
            activeOpacity={1}
            onPress={() => setMorePostId(null)}
          />
          <View style={[styles.moreSheet, { paddingBottom: insets.bottom + 8 }]}>
            <View style={styles.sheetHandleWrap}>
              <View style={styles.sheetHandle} />
            </View>
            <TouchableOpacity
              style={styles.moreOption}
              onPress={() => {
                setMorePostId(null);
                Alert.alert('已複製', '連結已複製至剪貼簿');
              }}
              activeOpacity={0.75}
            >
              <MaterialIcons name="link" size={22} color={Colors.onSurface} />
              <Text style={styles.moreOptionLabel}>複製連結</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.moreOption}
              onPress={() => morePostId && handleReport(morePostId)}
              activeOpacity={0.75}
            >
              <MaterialIcons name="flag" size={22} color={Colors.error} />
              <Text style={[styles.moreOptionLabel, { color: Colors.error }]}>回報貼文</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.moreCancelBtn}
              onPress={() => setMorePostId(null)}
              activeOpacity={0.75}
            >
              <Text style={styles.moreCancelLabel}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 8 },

  composeTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceVariant,
    padding: 12,
    marginBottom: 8,
  },
  composeTriggerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  composePlaceholder: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.outlineVariant,
  },

  composeBox: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceVariant,
    padding: 14,
    marginBottom: 8,
    gap: 10,
    overflow: 'hidden',
  },
  progressBarWrap: {
    marginBottom: 10,
    gap: 4,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  progressBarLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: Colors.primary,
    textAlign: 'right',
  },
  composeInput: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurface,
    minHeight: 72,
    textAlignVertical: 'top',
  },

  taggedPetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.secondaryContainer + '44',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  taggedPetsText: {
    flex: 1,
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: Colors.secondary,
  },

  draftHashtagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  draftHashtagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.secondaryContainer + '55',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  draftHashtagText: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: Colors.secondary,
  },

  hashtagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceVariant,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.surfaceContainerLow,
  },
  hashtagPrefix: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: Colors.primary,
  },
  hashtagTextInput: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurface,
    paddingVertical: 2,
  },

  composeImagesRow: { gap: 8, paddingVertical: 4 },
  composeThumb: { width: 90, height: 90, borderRadius: 12, overflow: 'hidden' },
  composeThumbImg: { width: 90, height: 90 },
  composeThumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  composeThumbCoverBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    paddingVertical: 3,
  },
  composeThumbCoverLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: 10,
    color: '#fff',
  },
  composeAddMoreBtn: {
    width: 90,
    height: 90,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  composeAddMoreLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: Colors.onSurfaceVariant,
  },
  composeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mediaBtn: { padding: 6 },
  cancelLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: Colors.onSurfaceVariant,
    marginRight: 4,
  },
  postBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 9999,
  },
  postBtnLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: Colors.onPrimary,
  },

  // Sort tabs
  sortTabs: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 4,
    paddingBottom: 12,
  },
  sortTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: Colors.surfaceVariant,
    backgroundColor: Colors.surfaceContainerLow,
  },
  sortTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  sortTabLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: Colors.onSurfaceVariant,
  },
  sortTabLabelActive: {
    color: Colors.onPrimary,
  },

  separator: { height: 10 },

  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 24,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceVariant,
  },
  carouselWrapper: {
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  initialsAvatar: {
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontFamily: FontFamily.headlineBold,
    fontSize: FontSize.labelMD,
    color: Colors.onPrimaryContainer,
  },
  authorName: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurface,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  timeAgo: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: Colors.outline,
  },
  metaDot: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: Colors.outline,
  },
  withPetsLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: Colors.secondary,
  },
  moreBtn: { padding: 4 },
  content: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurfaceVariant,
    lineHeight: 24,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  hashtagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  hashtag: {
    backgroundColor: Colors.secondaryContainer + '55',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  hashtagText: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: Colors.secondary,
  },
  postImage: { width: '100%', aspectRatio: 4 / 3 },
  imageDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
  },
  imageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.outlineVariant,
  },
  imageDotActive: {
    backgroundColor: Colors.primary,
    width: 16,
    borderRadius: 3,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceVariant,
  },
  actionsLeft: { flexDirection: 'row', gap: 20 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurfaceVariant,
  },

  // Pet picker
  petPickerTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: Colors.onSurface,
    paddingHorizontal: 4,
    paddingBottom: 14,
  },
  petChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 20,
  },
  petChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: Colors.secondary,
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  petChipSelected: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  petChipLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: Colors.secondary,
  },
  petChipLabelSelected: {
    color: Colors.onPrimary,
  },
  petPickerDoneBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 9999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  petPickerDoneLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: Colors.onPrimary,
  },

  // Shared sheet chrome
  sheetHandleWrap: { alignItems: 'center', paddingVertical: 10 },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.outlineVariant,
  },

  // Comment sheet
  commentSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: COMMENT_SHEET_HEIGHT,
    borderTopWidth: 1,
    borderColor: Colors.surfaceVariant,
  },
  commentSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceVariant,
  },
  commentSheetTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: Colors.onSurface,
  },
  commentScroll: { flex: 1 },
  commentListContent: { paddingHorizontal: 20, paddingVertical: 12, gap: 16 },
  commentItem: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
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
    lineHeight: 22,
  },
  commentTime: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: Colors.outline,
    alignSelf: 'flex-end',
  },
  emptyComments: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.outlineVariant,
    textAlign: 'center',
    paddingVertical: 32,
  },
  commentInputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
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

  // More sheet
  moreSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderColor: Colors.surfaceVariant,
  },
  moreOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceVariant,
  },
  moreOptionLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurface,
  },
  moreCancelBtn: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  moreCancelLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurfaceVariant,
  },

  // Empty state
  emptyFeed: {
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyFeedTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: Colors.onSurface,
    marginTop: 8,
  },
  emptyFeedSub: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyFeedBtn: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 9999,
  },
  emptyFeedBtnLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: Colors.onPrimary,
  },
});
