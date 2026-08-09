import { useCallback, useEffect, useRef, useState } from 'react';
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
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Clipboard from 'expo-clipboard';
import AppBar from '../../components/layout/AppBar';
import Avatar from '../../components/ui/Avatar';
import { ThemeColors } from '../../constants/themes';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { FontFamily, FontSize } from '../../constants/typography';
import {
  getPosts,
  getPostById,
  createPost,
  getPets,
  toggleLike as apiToggleLike,
  getPostComments,
  addComment as apiAddComment,
  reportPost as apiReportPost,
  blockUser as apiBlockUser,
  formatTimeAgo,
} from '../../api';
import { Post, Pet, Species } from '../../types';
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
  /** 頭像底色的種子。後端有回傳，接起來留言者改名才不會換色 */
  authorId?: string;
  author: string;
  avatarUrl?: string;
  avatarColor?: number;
  content: string;
  timeAgo: string;
}

type SortMode = 'new' | 'hot';
type PostType = 'question' | 'meetup' | 'share';
type FilterType = 'all' | PostType;

const SPECIES_LABEL: Record<Species, string> = {
  dog: '狗', cat: '貓', rabbit: '兔子', small: '小動物', bird: '鳥類', reptile: '爬蟲類', other: '其他',
};
const ALL_SPECIES: Species[] = ['dog', 'cat', 'rabbit', 'small', 'bird', 'reptile', 'other'];

const makePostTypeConfig = (
  c: ThemeColors,
): Record<PostType, { label: string; icon: keyof typeof MaterialIcons.glyphMap; color: string }> => ({
  question: { label: '問題', icon: 'help-outline', color: c.error },
  meetup: { label: '揪團', icon: 'groups', color: c.secondary },
  share: { label: '分享', icon: 'auto-awesome', color: c.primary },
});

// 20*2 margin + 1*2 border；寬度在元件內用 useWindowDimensions 取得
const CARD_IMAGE_INSET = 42;
const MAX_IMAGES = 5;

type ImagePayload = { uri: string; name: string; type: string };

function mapApiComment(c: any): Comment {
  return {
    id: String(c.id ?? c._id),
    authorId: c.user?.id ? String(c.user.id) : undefined,
    author: c.user?.name ?? '',
    avatarUrl: c.user?.avatarUrl ?? undefined,
    avatarColor: c.user?.avatarColor ?? undefined,
    content: c.content,
    timeAgo: formatTimeAgo(c.createdAt),
  };
}

function EmptyFeed({ onCompose }: { onCompose: () => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.emptyFeed}>
      <MaterialIcons name="pets" size={64} color={colors.outlineVariant} />
      <Text style={styles.emptyFeedTitle}>還沒有任何貼文</Text>
      <Text style={styles.emptyFeedSub}>成為第一個分享你和毛孩的精彩時刻！</Text>
      <TouchableOpacity style={styles.emptyFeedBtn} onPress={onCompose} activeOpacity={0.8}>
        <Text style={styles.emptyFeedBtnLabel}>立刻分享</Text>
      </TouchableOpacity>
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
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { width: screenW } = useWindowDimensions();
  const CARD_IMAGE_WIDTH = screenW - CARD_IMAGE_INSET;
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
        <Avatar url={post.authorAvatarUrl} name={post.author} seed={post.authorId} colorIndex={post.authorAvatarColor} />
        <View style={{ flex: 1 }}>
          <View style={styles.authorNameRow}>
            <Text style={styles.authorName}>{post.author}</Text>
            {post.postType && post.postType !== 'share' && (
              <View style={[styles.postTypeBadge, { backgroundColor: makePostTypeConfig(colors)[post.postType].color + '22' }]}>
                <MaterialIcons name={makePostTypeConfig(colors)[post.postType].icon} size={11} color={makePostTypeConfig(colors)[post.postType].color} />
                <Text style={[styles.postTypeBadgeLabel, { color: makePostTypeConfig(colors)[post.postType].color }]}>
                  {makePostTypeConfig(colors)[post.postType].label}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.timeAgo}>{post.timeAgo}</Text>
            {post.withPets && post.withPets.length > 0 && (
              <>
                <Text style={styles.metaDot}>·</Text>
                <MaterialIcons name="pets" size={12} color={colors.secondary} />
                <Text style={styles.withPetsLabel}>與 {post.withPets.join('、')}</Text>
              </>
            )}
          </View>
        </View>
        <TouchableOpacity style={styles.moreBtn} onPress={() => onMore(post.id)}>
          <MaterialIcons name="more-vert" size={20} color={colors.outline} />
        </TouchableOpacity>
      </View>

      {post.content.length > 0 && <Text style={styles.content}>{post.content}</Text>}

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
              color={liked ? colors.primary : colors.onSurfaceVariant}
            />
            <Text style={[styles.actionCount, liked && { color: colors.primary }]}>
              {likeCount}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.7}
            onPress={() => onComment(post.id)}
          >
            <MaterialIcons name="chat-bubble-outline" size={22} color={colors.onSurfaceVariant} />
            <Text style={styles.actionCount}>{post.comments}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity activeOpacity={0.7} onPress={handleShare}>
          <MaterialIcons name="share" size={22} color={colors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function CommunityScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  // 留言 sheet 的父層 KeyboardAvoidingView 沒有固定高度，百分比高度解析不出來，
  // 所以這裡要算成實際數值
  const { height: screenH } = useWindowDimensions();
  const { user } = useUser();
  const { unreadCount } = useNotifications();
  const route = useRoute<RouteProp<MainTabParamList, 'Community'>>();

  // Feed state
  const listRef = useRef<FlatList<Post>>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<SortMode>('new');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Compose state
  const [composing, setComposing] = useState(false);
  const [postType, setPostType] = useState<PostType>('share');
  const [draft, setDraft] = useState('');
  const [pendingImages, setPendingImages] = useState<ImagePayload[]>([]);
  const [posting, setPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [draftHashtags, setDraftHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const [showHashtagInput, setShowHashtagInput] = useState(false);

  // Pet picker
  const [pets, setPets] = useState<Pet[]>([]);
  const petOptions = pets.map((p) => p.name);
  const [taggedPets, setTaggedPets] = useState<string[]>([]);
  const [showPetPicker, setShowPetPicker] = useState(false);

  // 問題串分類：優先看有標記的寵物，沒標記就看帳號底下全部寵物；
  // 只有單一物種就直接帶入，跨物種時才需要使用者手動選一個
  const [questionSpeciesPick, setQuestionSpeciesPick] = useState<Species | null>(null);
  const relevantSpecies = (taggedPets.length > 0
    ? pets.filter((p) => taggedPets.includes(p.name))
    : pets
  ).map((p) => p.species);
  const distinctQuestionSpecies = Array.from(new Set(relevantSpecies));
  const resolvedQuestionSpecies =
    distinctQuestionSpecies.length === 1
      ? distinctQuestionSpecies[0]
      : questionSpeciesPick && distinctQuestionSpecies.includes(questionSpeciesPick)
      ? questionSpeciesPick
      : null;

  const autoHashtags =
    postType === 'question' && resolvedQuestionSpecies
      ? [`#${SPECIES_LABEL[resolvedQuestionSpecies]}提問`]
      : [];

  // 揪團活動：結構化欄位（時間/地點/物種為必填），不使用 hashtag 或寵物標記
  const [meetupTime, setMeetupTime] = useState('');
  const [meetupLocation, setMeetupLocation] = useState('');
  const [meetupSpecies, setMeetupSpecies] = useState<Species[]>([]);
  const [meetupPartners, setMeetupPartners] = useState('');
  const [meetupNote, setMeetupNote] = useState('');

  const toggleMeetupSpecies = (s: Species) => {
    setMeetupSpecies((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const meetupValid = meetupTime.trim() !== '' && meetupLocation.trim() !== '' && meetupSpecies.length > 0;

  const buildMeetupContent = () => {
    const speciesLabel = meetupSpecies.map((s) => SPECIES_LABEL[s]).join('、');
    let text = `📅 時間：${meetupTime.trim()}\n📍 地點：${meetupLocation.trim()}\n🐾 適合物種：${speciesLabel}`;
    if (meetupPartners.trim()) text += `\n👥 想找的夥伴：${meetupPartners.trim()}`;
    if (meetupNote.trim()) text += `\n📝 備註：${meetupNote.trim()}`;
    return text;
  };

  // Comments
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentsByPostId, setCommentsByPostId] = useState<Record<string, Comment[]>>({});
  const [commentsLoading, setCommentsLoading] = useState(false);

  // More modal
  const [morePostId, setMorePostId] = useState<string | null>(null);

  // ─── Data loading ──────────────────────────────────────────────────────────

  const load = useCallback(async (newSort: SortMode, newFilter: FilterType, newPage: number, append: boolean) => {
    if (newPage === 1) setRefreshing(true);
    else setLoadingMore(true);

    try {
      const res = await getPosts(newPage, newSort, newFilter === 'all' ? undefined : newFilter);
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
    load(sort, filterType, 1, false);
  }, [sort, filterType]);

  useEffect(() => {
    getPets().then((res) => {
      if (res.success) setPets(res.data);
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
    load(sort, filterType, 1, false);
  };

  const onLoadMore = () => {
    if (loadingMore || !hasMore) return;
    const next = page + 1;
    setPage(next);
    load(sort, filterType, next, true);
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
    setPostType('share');
    setQuestionSpeciesPick(null);
    setDraft('');
    setPendingImages([]);
    setDraftHashtags([]);
    setHashtagInput('');
    setShowHashtagInput(false);
    setTaggedPets([]);
    setMeetupTime('');
    setMeetupLocation('');
    setMeetupSpecies([]);
    setMeetupPartners('');
    setMeetupNote('');
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
    if (postType === 'meetup') {
      if (!meetupValid) return;
    } else if (!draft.trim() && pendingImages.length === 0) {
      return;
    }
    setPosting(true);
    setUploadProgress(0);

    // 模擬後端處理階段（70% → 95%）的緩慢爬升
    let fakeProgress = 70;
    let fakeTimer: ReturnType<typeof setInterval> | null = null;

    try {
      // 壓縮所有圖片
      const compressed = await Promise.all(pendingImages.map(compressImage));

      const finalHashtags = Array.from(new Set([...autoHashtags, ...draftHashtags]));
      const content = postType === 'meetup' ? buildMeetupContent() : draft.trim();

      const res = await createPost(
        content,
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
        postType === 'meetup' ? undefined : finalHashtags.length > 0 ? finalHashtags : undefined,
        postType === 'meetup' ? undefined : taggedPets.length > 0 ? taggedPets : undefined,
        postType,
      );

      if (fakeTimer) clearInterval(fakeTimer);
      setUploadProgress(100);

      if (res.success) {
        const newPost: Post = res.data;
        setTimeout(() => {
          if (filterType === 'all' || filterType === newPost.postType) {
            setPosts((prev) => [newPost, ...prev]);
          }
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
      // 後端會濾掉封鎖對象的留言，計數以實際載入的則數為準，
      // 否則卡片上的數字會比看得到的留言還多
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, comments: res.data.length } : p)),
      );
    }
  };

  // 從貼文分享連結（critterio://post/:postId）跳轉過來時，抓該篇貼文並置頂顯示
  useEffect(() => {
    const sharedPostId = route.params?.postId;
    if (!sharedPostId) return;
    (async () => {
      const res = await getPostById(sharedPostId);
      if (res.success) {
        setPosts((prev) => [res.data, ...prev.filter((p) => p.id !== res.data.id)]);
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
        openComments(sharedPostId);
      } else {
        Alert.alert('找不到貼文', '這則貼文可能已被刪除或不存在。');
      }
      navigation.setParams({ postId: undefined } as any);
    })();
  }, [route.params?.postId]);

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

  // ─── Block ────────────────────────────────────────────────────────────────

  const handleBlock = (postId: string) => {
    const target = posts.find((p) => p.id === postId);
    if (!target?.authorId) return;
    setMorePostId(null);

    Alert.alert(
      `封鎖 ${target.author}？`,
      '你將不會再看到對方的貼文與留言，對方也看不到你的。可隨時到「設定 > 隱私與安全 > 已封鎖的使用者」解除。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '封鎖',
          style: 'destructive',
          onPress: async () => {
            const res = await apiBlockUser(target.authorId!);
            if (!res.success) {
              Alert.alert('封鎖失敗', res.message || '請稍後再試');
              return;
            }
            // 立即從畫面移除該用戶所有貼文，不必等重新整理
            setPosts((prev) => prev.filter((p) => p.authorId !== target.authorId));
            Alert.alert('已封鎖', `你不會再看到 ${target.author} 的內容`);
          },
        },
      ],
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppBar
        avatarUrl={user.avatarUrl}
        userName={user.name}
        userId={user.id}
        userColor={user.avatarColor}
        onAvatarPress={() => navigation.navigate('Profile')}
        onNotificationPress={() => navigation.navigate('Notifications')}
        unreadCount={unreadCount}
      />

      <FlatList
        ref={listRef}
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
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
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
                {!posting && (
                  <View style={styles.postTypeRow}>
                    {(Object.keys(makePostTypeConfig(colors)) as PostType[]).map((t) => {
                      const cfg = makePostTypeConfig(colors)[t];
                      const active = postType === t;
                      return (
                        <TouchableOpacity
                          key={t}
                          style={[styles.postTypeChip, active && { backgroundColor: cfg.color, borderColor: cfg.color }]}
                          onPress={() => setPostType(t)}
                          activeOpacity={0.75}
                        >
                          <MaterialIcons name={cfg.icon} size={14} color={active ? colors.onPrimary : cfg.color} />
                          <Text style={[styles.postTypeChipLabel, { color: active ? colors.onPrimary : cfg.color }]}>
                            {cfg.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}

                    <View style={{ flex: 1 }} />

                    <TouchableOpacity
                      onPress={cancelCompose}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MaterialIcons name="close" size={26} color={colors.onSurfaceVariant} />
                    </TouchableOpacity>
                  </View>
                )}

                {postType === 'question' && distinctQuestionSpecies.length > 1 && (
                  <View style={styles.questionSpeciesRow}>
                    <Text style={styles.questionSpeciesLabel}>這個問題主要關於：</Text>
                    <View style={styles.questionSpeciesChips}>
                      {distinctQuestionSpecies.map((sp) => {
                        const active = resolvedQuestionSpecies === sp;
                        return (
                          <TouchableOpacity
                            key={sp}
                            style={[styles.speciesPickChip, active && styles.speciesPickChipActive]}
                            onPress={() => setQuestionSpeciesPick(sp)}
                            activeOpacity={0.75}
                          >
                            <Text style={[styles.speciesPickChipLabel, active && styles.speciesPickChipLabelActive]}>
                              {SPECIES_LABEL[sp]}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {postType === 'meetup' ? (
                  <View style={styles.meetupForm}>
                    <View style={styles.meetupField}>
                      <View style={styles.meetupLabelRow}>
                        <Text style={styles.meetupLabel}>📅 時間</Text>
                        <Text style={styles.meetupRequiredMark}>*</Text>
                      </View>
                      <TextInput
                        style={styles.meetupInput}
                        placeholder="例如：7/20（日）下午 2 點"
                        placeholderTextColor={colors.outlineVariant}
                        value={meetupTime}
                        onChangeText={setMeetupTime}
                      />
                    </View>

                    <View style={styles.meetupField}>
                      <View style={styles.meetupLabelRow}>
                        <Text style={styles.meetupLabel}>📍 地點</Text>
                        <Text style={styles.meetupRequiredMark}>*</Text>
                      </View>
                      <TextInput
                        style={styles.meetupInput}
                        placeholder="例如：台北市大安森林公園"
                        placeholderTextColor={colors.outlineVariant}
                        value={meetupLocation}
                        onChangeText={setMeetupLocation}
                      />
                    </View>

                    <View style={styles.meetupField}>
                      <View style={styles.meetupLabelRow}>
                        <Text style={styles.meetupLabel}>🐾 適合物種</Text>
                        <Text style={styles.meetupRequiredMark}>*</Text>
                      </View>
                      <View style={styles.questionSpeciesChips}>
                        {ALL_SPECIES.map((sp) => {
                          const active = meetupSpecies.includes(sp);
                          return (
                            <TouchableOpacity
                              key={sp}
                              style={[styles.speciesPickChip, active && styles.speciesPickChipActive]}
                              onPress={() => toggleMeetupSpecies(sp)}
                              activeOpacity={0.75}
                            >
                              <Text style={[styles.speciesPickChipLabel, active && styles.speciesPickChipLabelActive]}>
                                {SPECIES_LABEL[sp]}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    <View style={styles.meetupField}>
                      <Text style={styles.meetupLabel}>👥 想找的夥伴</Text>
                      <TextInput
                        style={styles.meetupInput}
                        placeholder="例如：想找同樣養守宮的朋友（非必填）"
                        placeholderTextColor={colors.outlineVariant}
                        value={meetupPartners}
                        onChangeText={setMeetupPartners}
                      />
                    </View>

                    <View style={styles.meetupField}>
                      <Text style={styles.meetupLabel}>📝 備註</Text>
                      <TextInput
                        style={[styles.meetupInput, styles.meetupNoteInput]}
                        placeholder="其他想補充的內容（非必填）"
                        placeholderTextColor={colors.outlineVariant}
                        value={meetupNote}
                        onChangeText={setMeetupNote}
                        multiline
                      />
                    </View>
                  </View>
                ) : (
                  <>
                    <TextInput
                      style={styles.composeInput}
                      placeholder={
                        postType === 'question'
                          ? '想請教什麼問題？（會自動加上物種標籤，方便同溫層看到）'
                          : '你的毛孩今天在做什麼？'
                      }
                      placeholderTextColor={colors.outlineVariant}
                      value={draft}
                      onChangeText={setDraft}
                      multiline
                      autoFocus={pendingImages.length === 0}
                    />

                    {autoHashtags.length > 0 && (
                      <View style={styles.draftHashtagsRow}>
                        {autoHashtags.map((tag) => (
                          <View key={tag} style={styles.autoHashtagChip}>
                            <MaterialIcons name="auto-awesome" size={10} color={colors.secondary} />
                            <Text style={styles.draftHashtagText}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {taggedPets.length > 0 && (
                      <View style={styles.taggedPetsRow}>
                        <MaterialIcons name="pets" size={14} color={colors.secondary} />
                        <Text style={styles.taggedPetsText}>與 {taggedPets.join('、')} 一起</Text>
                        <TouchableOpacity onPress={() => setTaggedPets([])}>
                          <MaterialIcons name="close" size={14} color={colors.outlineVariant} />
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
                            <MaterialIcons name="close" size={11} color={colors.secondary} />
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
                          placeholderTextColor={colors.outlineVariant}
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
                            color={hashtagInput.trim() ? colors.primary : colors.outlineVariant}
                          />
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
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
                        <MaterialIcons name="add-photo-alternate" size={28} color={colors.onSurfaceVariant} />
                        <Text style={styles.composeAddMoreLabel}>{pendingImages.length}/{MAX_IMAGES}</Text>
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                )}

                {!posting && <View style={styles.composeFooter}>
                  <TouchableOpacity style={styles.mediaBtn} onPress={pickFromCamera}>
                    <MaterialIcons name="photo-camera" size={22} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.mediaBtn} onPress={pickFromGallery}>
                    <MaterialIcons name="photo-library" size={22} color={colors.primary} />
                  </TouchableOpacity>
                  {postType !== 'meetup' && (
                    <TouchableOpacity
                      style={styles.mediaBtn}
                      onPress={() => setShowHashtagInput((v) => !v)}
                    >
                      <MaterialIcons
                        name="tag"
                        size={22}
                        color={
                          showHashtagInput || draftHashtags.length > 0
                            ? colors.primary
                            : colors.onSurfaceVariant
                        }
                      />
                    </TouchableOpacity>
                  )}
                  {postType !== 'meetup' && petOptions.length > 0 && (
                    <TouchableOpacity
                      style={styles.mediaBtn}
                      onPress={() => setShowPetPicker(true)}
                    >
                      <MaterialIcons
                        name="pets"
                        size={22}
                        color={
                          taggedPets.length > 0 ? colors.secondary : colors.onSurfaceVariant
                        }
                      />
                    </TouchableOpacity>
                  )}

                  <View style={{ flex: 1 }} />

                  <TouchableOpacity
                    style={[
                      styles.postBtn,
                      (postType === 'meetup' ? !meetupValid : !draft.trim() && pendingImages.length === 0) || posting
                        ? { opacity: 0.45 }
                        : undefined,
                    ]}
                    onPress={handlePost}
                    disabled={posting || (postType === 'meetup' ? !meetupValid : !draft.trim() && pendingImages.length === 0)}
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
                  <Avatar url={user.avatarUrl} name={user.name} seed={user.id} colorIndex={user.avatarColor} size={36} />
                  <Text style={styles.composePlaceholder}>分享你和寵物的精彩時刻...</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={pickFromCamera} activeOpacity={0.7}>
                  <MaterialIcons name="photo-camera" size={22} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={pickFromGallery} activeOpacity={0.7}>
                  <MaterialIcons name="photo-library" size={22} color={colors.primary} />
                </TouchableOpacity>
              </View>
            )}

            {/* 分類篩選 tabs */}
            {!composing && (
              <View style={styles.sortTabs}>
                {(['all', 'question', 'meetup', 'share'] as FilterType[]).map((f) => {
                  const active = filterType === f;
                  const cfg = f === 'all' ? null : makePostTypeConfig(colors)[f];
                  return (
                    <TouchableOpacity
                      key={f}
                      style={[styles.sortTab, active && styles.sortTabActive]}
                      onPress={() => setFilterType(f)}
                      activeOpacity={0.7}
                    >
                      {cfg && (
                        <MaterialIcons name={cfg.icon} size={14} color={active ? colors.onPrimary : colors.onSurfaceVariant} />
                      )}
                      <Text style={[styles.sortTabLabel, active && styles.sortTabLabelActive]}>
                        {f === 'all' ? '全部' : cfg!.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
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
                      color={sort === s ? colors.onPrimary : colors.onSurfaceVariant}
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
                      color={selected ? colors.onPrimary : colors.secondary}
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
            <View style={[styles.commentSheet, { height: screenH * 0.65 }]}>
              <View style={styles.sheetHandleWrap}>
                <View style={styles.sheetHandle} />
              </View>
              <View style={styles.commentSheetHeader}>
                <Text style={styles.commentSheetTitle}>留言</Text>
                <TouchableOpacity onPress={() => setCommentPostId(null)}>
                  <MaterialIcons name="close" size={22} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>
              {commentsLoading ? (
                <ActivityIndicator color={colors.primary} style={{ flex: 1, marginVertical: 24 }} />
              ) : (
                <FlatList
                  data={commentsForPost}
                  keyExtractor={(c) => c.id}
                  style={styles.commentScroll}
                  contentContainerStyle={styles.commentListContent}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <View style={styles.commentItem}>
                      <Avatar url={item.avatarUrl} name={item.author} seed={item.authorId} colorIndex={item.avatarColor} size={36} />
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
                <Avatar url={user.avatarUrl} name={user.name} seed={user.id} colorIndex={user.avatarColor} size={32} />
                <TextInput
                  style={styles.commentTextInput}
                  placeholder="留下你的留言..."
                  placeholderTextColor={colors.outlineVariant}
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.commentSendBtn, !commentText.trim() && { opacity: 0.4 }]}
                  onPress={submitComment}
                  disabled={!commentText.trim()}
                >
                  <MaterialIcons name="send" size={18} color={colors.onPrimary} />
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
              onPress={async () => {
                if (!morePostId) return;
                const link = `critterio://post/${morePostId}`;
                await Clipboard.setStringAsync(link);
                setMorePostId(null);
                Alert.alert('已複製', '連結已複製至剪貼簿');
              }}
              activeOpacity={0.75}
            >
              <MaterialIcons name="link" size={22} color={colors.onSurface} />
              <Text style={styles.moreOptionLabel}>複製連結</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.moreOption}
              onPress={() => morePostId && handleReport(morePostId)}
              activeOpacity={0.75}
            >
              <MaterialIcons name="flag" size={22} color={colors.error} />
              <Text style={[styles.moreOptionLabel, { color: colors.error }]}>回報貼文</Text>
            </TouchableOpacity>
            {(() => {
              const target = posts.find((p) => p.id === morePostId);
              // 自己的貼文不顯示封鎖
              if (!target?.authorId || target.authorId === user.id) return null;
              return (
                <TouchableOpacity
                  style={styles.moreOption}
                  onPress={() => morePostId && handleBlock(morePostId)}
                  activeOpacity={0.75}
                >
                  <MaterialIcons name="block" size={22} color={colors.error} />
                  <Text style={[styles.moreOptionLabel, { color: colors.error }]}>
                    封鎖 {target.author}
                  </Text>
                </TouchableOpacity>
              );
            })()}
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

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 8 },

  composeTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.surfaceContainerLowest,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.surfaceVariant,
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
    color: c.outlineVariant,
  },

  composeBox: {
    backgroundColor: c.surfaceContainerLowest,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.surfaceVariant,
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
    backgroundColor: c.surfaceVariant,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
    backgroundColor: c.primary,
    borderRadius: 4,
  },
  progressBarLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: c.primary,
    textAlign: 'right',
  },
  composeInput: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
    minHeight: 72,
    textAlignVertical: 'top',
  },

  taggedPetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.secondaryContainer + '44',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  taggedPetsText: {
    flex: 1,
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelMD,
    color: c.secondary,
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
    backgroundColor: c.secondaryContainer + '55',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  draftHashtagText: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: c.secondary,
  },
  autoHashtagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.secondaryContainer + '33',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: c.secondary + '55',
    borderStyle: 'dashed',
  },

  postTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  postTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: c.surfaceVariant,
  },
  postTypeChipLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelSM,
  },

  meetupForm: { gap: 14 },
  meetupField: { gap: 6 },
  meetupLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  meetupLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: c.onSurface,
  },
  meetupRequiredMark: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: c.error,
  },
  meetupInput: {
    borderWidth: 1,
    borderColor: c.surfaceVariant,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
    backgroundColor: c.surfaceContainerLow,
  },
  meetupNoteInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },

  questionSpeciesRow: { gap: 6 },
  questionSpeciesLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
  },
  questionSpeciesChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  speciesPickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: c.secondary,
  },
  speciesPickChipActive: {
    backgroundColor: c.secondary,
  },
  speciesPickChipLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelSM,
    color: c.secondary,
  },
  speciesPickChipLabelActive: {
    color: c.onPrimary,
  },

  hashtagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: c.surfaceVariant,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: c.surfaceContainerLow,
  },
  hashtagPrefix: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.primary,
  },
  hashtagTextInput: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
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
    borderColor: c.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  composeAddMoreLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.onSurfaceVariant,
  },
  composeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mediaBtn: { padding: 10 },
  postBtn: {
    backgroundColor: c.primary,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 9999,
  },
  postBtnLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: c.onPrimary,
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
    borderColor: c.surfaceVariant,
    backgroundColor: c.surfaceContainerLow,
  },
  sortTabActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  sortTabLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.labelMD,
    color: c.onSurfaceVariant,
  },
  sortTabLabelActive: {
    color: c.onPrimary,
  },

  separator: { height: 10 },

  card: {
    backgroundColor: c.surfaceContainerLowest,
    borderRadius: 24,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: c.surfaceVariant,
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
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorName: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
  },
  postTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  postTypeBadgeLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: 10,
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
    color: c.outline,
  },
  metaDot: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.outline,
  },
  withPetsLabel: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: c.secondary,
  },
  moreBtn: { padding: 4 },
  content: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
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
    backgroundColor: c.secondaryContainer + '55',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  hashtagText: {
    fontFamily: FontFamily.headlineMedium,
    fontSize: FontSize.labelSM,
    color: c.secondary,
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
    backgroundColor: c.outlineVariant,
  },
  imageDotActive: {
    backgroundColor: c.primary,
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
    borderTopColor: c.surfaceVariant,
  },
  actionsLeft: { flexDirection: 'row', gap: 20 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
  },

  // Pet picker
  petPickerTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: c.onSurface,
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
    borderColor: c.secondary,
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  petChipSelected: {
    backgroundColor: c.secondary,
    borderColor: c.secondary,
  },
  petChipLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.secondary,
  },
  petChipLabelSelected: {
    color: c.onPrimary,
  },
  petPickerDoneBtn: {
    backgroundColor: c.primary,
    borderRadius: 9999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  petPickerDoneLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.onPrimary,
  },

  // Shared sheet chrome
  sheetHandleWrap: { alignItems: 'center', paddingVertical: 10 },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.outlineVariant,
  },

  // Comment sheet
  commentSheet: {
    backgroundColor: c.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: c.surfaceVariant,
  },
  commentSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceVariant,
  },
  commentSheetTitle: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyLG,
    color: c.onSurface,
  },
  commentScroll: { flex: 1 },
  commentListContent: { paddingHorizontal: 20, paddingVertical: 12, gap: 16 },
  commentItem: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
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
    lineHeight: 22,
  },
  commentTime: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.labelSM,
    color: c.outline,
    alignSelf: 'flex-end',
  },
  emptyComments: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.outlineVariant,
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

  // More sheet
  moreSheet: {
    backgroundColor: c.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderColor: c.surfaceVariant,
  },
  moreOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceVariant,
  },
  moreOptionLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurface,
  },
  moreCancelBtn: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  moreCancelLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
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
    color: c.onSurface,
    marginTop: 8,
  },
  emptyFeedSub: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.bodyMD,
    color: c.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyFeedBtn: {
    marginTop: 8,
    backgroundColor: c.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 9999,
  },
  emptyFeedBtnLabel: {
    fontFamily: FontFamily.headlineSemiBold,
    fontSize: FontSize.bodyMD,
    color: c.onPrimary,
  },
});
