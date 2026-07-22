// Mock API — simulates real backend calls with artificial delay.
// When connecting to the real backend, replace each function body with
// an actual fetch/axios call to the corresponding endpoint.
//
// All responses follow the standard shape: { success, data, message }

import {
  MOCK_USER,
  MOCK_POSTS,
  MOCK_DIARY_ENTRIES,
} from './mockData';
import { ApiResponse, Pet, PetStatus, AiMessage, Conversation, DiaryEntry, CalendarEvent, WeightLog, Post, User, VetVisit, LabResultItem, Medication } from '../types';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import client, { TOKEN_KEY, BASE_URL } from './client';

function mapPet(p: any): Pet {
  return {
    id: p.id,
    name: p.name,
    species: p.species,
    breed: p.breed ?? '',
    age: p.age,
    weightKg: p.weightKg,
    heightCm: p.heightCm ?? 0,
    gender: p.gender,
    photoUrl: p.photoUrl ?? undefined,
    traits: p.traits ?? [],
    status: 'healthy' as PetStatus,
    statusLabel: '健康',
    birthday: p.birthday ?? undefined,
    joinedAt: p.joinedFamilyAt ?? undefined,
    careTargets: (p.careTargets ?? []).map((ct: any) => ({
      label: ct.title,
      target: ct.unit,
      category: ct.category ?? 'other',
    })),
  };
}

export async function updateCareTargets(
  petId: string,
  items: { label: string; target: string; category: string }[]
): Promise<ApiResponse<null>> {
  const payload = items.map((item) => ({
    title: item.label,
    value: 0,
    unit: item.target,
    category: item.category,
  }));
  const res = await client.put(`/pets/${petId}/care-targets`, { careTargets: payload });
  if (!res.data.success) return { success: false, data: null, message: res.data.message };
  return { success: true, data: null, message: '' };
}

const delay = (ms = 500) => new Promise((res) => setTimeout(res, ms));

// ─── Auth ────────────────────────────────────────────────────────────────────
// POST /api/auth/login
export async function login(
  email: string,
  password: string
): Promise<ApiResponse<{ token: string; user: User }>> {
  const res = await client.post('/auth/login', { email, password });
  if (!res.data.success) return { success: false, data: null as any, message: res.data.message };
  return { success: true, data: res.data.data, message: res.data.message };
}

// POST /api/auth/register
export async function register(
  name: string,
  email: string,
  password: string
): Promise<ApiResponse<{ token: string; user: User }>> {
  const res = await client.post('/auth/register', { name, email, password });
  if (!res.data.success) return { success: false, data: null as any, message: res.data.message };
  return { success: true, data: res.data.data, message: res.data.message };
}

// ─── Pets ─────────────────────────────────────────────────────────────────────
// GET /api/v1/pets
export async function getPets(): Promise<ApiResponse<Pet[]>> {
  const res = await client.get('/pets');
  if (!res.data.success) return { success: false, data: [], message: res.data.message };
  return { success: true, data: res.data.data.map(mapPet), message: '' };
}

// POST /api/v1/pets  (accepts FormData so photo can be included)
export async function addPet(payload: FormData | {
  name: string; species: string; breed: string;
  birthday: string; gender: string; weight: number;
}): Promise<ApiResponse<Pet>> {
  const isForm = payload instanceof FormData;
  const res = await client.post('/pets', payload, {
    headers: isForm ? { 'Content-Type': 'multipart/form-data' } : undefined,
  });
  if (!res.data.success) return { success: false, data: null as any, message: res.data.message };
  return { success: true, data: mapPet(res.data.data), message: '' };
}

// ─── AI Care ──────────────────────────────────────────────────────────────────
export interface AiCareSuggestion {
  label: string;
  target: string;
  category: 'food' | 'activity' | 'grooming' | 'play' | 'health' | 'other';
}

export interface AiCareResult {
  suggestions: AiCareSuggestion[];
  idealWeightMin: number;
  idealWeightMax: number;
  idealHeightMin: number;
  idealHeightMax: number;
  healthNote: string;
  dailyKcal?: number;
  dailyWaterMl?: number;
}

// GET /api/v1/pets/:id/ai-care
export async function getAiCare(petId: string): Promise<ApiResponse<AiCareResult>> {
  try {
    const res = await client.get(`/pets/${petId}/ai-care`);
    if (!res.data.success) return { success: false, data: null as any, message: res.data.message };
    return { success: true, data: res.data.data as AiCareResult, message: '' };
  } catch (e: any) {
    if (e?.response?.status === 429) {
      let msg = e.response.data?.message ?? 'AI 對話次數已達上限，請稍後再試';
      const resetSec = Number(e.response.headers?.['ratelimit-reset']);
      if (Number.isFinite(resetSec) && resetSec > 0) {
        msg += `（約 ${Math.ceil(resetSec / 60)} 分鐘後可再試）`;
      }
      return { success: false, data: null as any, message: msg };
    }
    throw e;
  }
}



// GET /api/v1/pets/:id/weight-logs
export async function getWeightLogs(petId: string): Promise<ApiResponse<WeightLog[]>> {
  const res = await client.get(`/pets/${petId}/weight-logs?limit=12`);
  if (!res.data.success) return { success: false, data: [], message: res.data.message };
  return { success: true, data: res.data.data as WeightLog[], message: '' };
}

// PATCH /api/v1/pets/:id  (general pet field updates)
export async function updatePetData(petId: string, updates: {
  name?: string;
  breed?: string;
  birthday?: string;
  joinedFamilyAt?: string;
  heightCm?: number;
  weight?: number;
  photo?: { uri: string; name: string; type: string };
}): Promise<ApiResponse<Pet>> {
  const form = new FormData();
  if (updates.name !== undefined) form.append('name', updates.name);
  if (updates.breed !== undefined) form.append('breed', updates.breed);
  if (updates.birthday !== undefined) form.append('birthday', updates.birthday);
  if (updates.joinedFamilyAt !== undefined) form.append('joinedFamilyAt', updates.joinedFamilyAt);
  if (updates.heightCm !== undefined) form.append('heightCm', String(updates.heightCm));
  if (updates.weight !== undefined) form.append('weight', String(updates.weight));
  if (updates.photo) {
    form.append('photo', { uri: updates.photo.uri, name: updates.photo.name, type: updates.photo.type } as any);
  }
  const res = await client.patch(`/pets/${petId}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  if (!res.data.success) return { success: false, data: null as any, message: res.data.message };
  return { success: true, data: mapPet(res.data.data), message: '' };
}

// DELETE /api/v1/pets/:id
export async function deletePet(petId: string): Promise<ApiResponse<null>> {
  const res = await client.delete(`/pets/${petId}`);
  if (!res.data.success) return { success: false, data: null, message: res.data.message };
  return { success: true, data: null, message: '' };
}

// PATCH /api/v1/pets/reorder
export async function reorderPets(petIds: string[]): Promise<ApiResponse<null>> {
  const res = await client.patch('/pets/reorder', { petIds });
  if (!res.data.success) return { success: false, data: null, message: res.data.message };
  return { success: true, data: null, message: '' };
}

// POST /api/v1/pets/:id/weight-logs
export async function addWeightLog(petId: string, weightKg: number): Promise<ApiResponse<WeightLog>> {
  const res = await client.post(`/pets/${petId}/weight-logs`, { weightKg });
  if (!res.data.success) return { success: false, data: null as any, message: res.data.message };
  return { success: true, data: res.data.data as WeightLog, message: '' };
}

// ─── Vet Visits（就醫紀錄）──────────────────────────────────────────────────────

function mapVetVisit(r: any): VetVisit {
  return {
    id: String(r.id ?? r._id),
    petId: typeof r.petId === 'string' ? r.petId : String(r.petId),
    visitDate: r.visitDate,
    clinicName: r.clinicName ?? '',
    diagnosisNote: r.diagnosisNote ?? '',
    imageUrl: r.imageUrl ?? '',
    reportType: r.reportType ?? '',
    items: r.items ?? [],
    medications: r.medications ?? [],
    summaryAdvice: r.summaryAdvice ?? '',
    calendarEventId: r.calendarEventId ?? null,
    createdAt: r.createdAt,
  };
}

export interface VisitParseJobStatus {
  jobId: string;
  status: 'processing' | 'ready' | 'failed';
  imageUrl: string;
  reportType: string;
  items: LabResultItem[];
  summaryAdvice: string;
  errorMessage: string;
}

// POST /api/v1/pets/:id/vet-visits/parse-report — 立刻回應 jobId，實際解析在後端背景進行，
// 完成後會推播通知，不需要前端一直卡在這支請求上等
export async function parseVisitReport(
  petId: string,
  image: { uri: string; name: string; type: string }
): Promise<ApiResponse<{ jobId: string }>> {
  const form = new FormData();
  form.append('image', { uri: image.uri, name: image.name, type: image.type } as any);
  const res = await client.post(`/pets/${petId}/vet-visits/parse-report`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  if (!res.data.success) return { success: false, data: null as any, message: res.data.message };
  return { success: true, data: { jobId: String(res.data.data.jobId) }, message: '' };
}

// GET /api/v1/pets/:id/vet-visits/parse-jobs/:jobId — 查詢背景解析工作目前的狀態，
// 畫面還開著時可以輪詢，或使用者點通知回來時用來讀取已完成的結果
export async function getVisitParseJob(petId: string, jobId: string): Promise<ApiResponse<VisitParseJobStatus>> {
  const res = await client.get(`/pets/${petId}/vet-visits/parse-jobs/${jobId}`);
  if (!res.data.success) return { success: false, data: null as any, message: res.data.message };
  return { success: true, data: res.data.data as VisitParseJobStatus, message: '' };
}

// POST /api/v1/pets/:id/vet-visits
export async function createVetVisit(
  petId: string,
  payload: {
    visitDate: string;
    clinicName?: string;
    diagnosisNote?: string;
    medications?: Medication[];
    imageUrl?: string;
    reportType?: string;
    items?: LabResultItem[];
    summaryAdvice?: string;
    syncToCalendar?: boolean;
  }
): Promise<ApiResponse<VetVisit>> {
  const res = await client.post(`/pets/${petId}/vet-visits`, payload);
  if (!res.data.success) return { success: false, data: null as any, message: res.data.message };
  return { success: true, data: mapVetVisit(res.data.data), message: '' };
}

// GET /api/v1/pets/:id/vet-visits
export async function getVetVisits(petId: string): Promise<ApiResponse<VetVisit[]>> {
  const res = await client.get(`/pets/${petId}/vet-visits`);
  if (!res.data.success) return { success: false, data: [], message: res.data.message };
  return { success: true, data: res.data.data.map(mapVetVisit), message: '' };
}

// DELETE /api/v1/pets/:id/vet-visits/:visitId
export async function deleteVetVisit(petId: string, visitId: string): Promise<ApiResponse<null>> {
  const res = await client.delete(`/pets/${petId}/vet-visits/${visitId}`);
  if (!res.data.success) return { success: false, data: null, message: res.data.message };
  return { success: true, data: null, message: '' };
}

// ─── Diary ────────────────────────────────────────────────────────────────────
function mapPetLog(log: any, entryNumber?: number): DiaryEntry {
  const date = new Date(log.date).toISOString().split('T')[0];
  const photos = (log.images ?? []).map((img: any) => ({ url: img.url, time: img.takenAt ?? '' }));
  return {
    id: log._id,
    petId: typeof log.petId === 'string' ? log.petId : String(log.petId),
    date,
    photoUrl: photos[0]?.url ?? '',
    photos,
    title: log.title,
    note: log.content,
    mood: log.mood ?? [],
    hashtags: log.hashtags ?? [],
    entryNumber,
  };
}

// GET /api/v1/pets/:id/logs
export async function getDiaryEntries(petId: string): Promise<ApiResponse<DiaryEntry[]>> {
  const res = await client.get(`/pets/${petId}/logs?limit=60`);
  if (!res.data.success) return { success: false, data: [], message: res.data.message };
  const logs: any[] = res.data.data;
  // logs are newest-first; assign entryNumber descending so oldest = #1
  const total = logs.length;
  return { success: true, data: logs.map((log, i) => mapPetLog(log, total - i)), message: '' };
}

// POST /api/v1/pets/:id/logs
export async function addDiaryEntry(
  petId: string,
  payload: {
    content: string;
    date: string;
    mood?: string[];
    photo?: { uri: string; name: string; type: string };
  }
): Promise<ApiResponse<DiaryEntry>> {
  const form = new FormData();
  form.append('content', payload.content);
  form.append('date', payload.date);
  if (payload.mood) payload.mood.forEach((m) => form.append('mood', m));
  if (payload.photo) {
    form.append('images', { uri: payload.photo.uri, name: payload.photo.name, type: payload.photo.type } as any);
  }
  const res = await client.post(`/pets/${petId}/logs`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  if (!res.data.success) return { success: false, data: null as any, message: res.data.message };
  return { success: true, data: mapPetLog(res.data.data), message: '' };
}

// ─── Community ────────────────────────────────────────────────────────────────

function mapPost(p: any): Post {
  return {
    id: String(p.id ?? p._id),
    author: p.user?.name ?? '',
    authorAvatarUrl: p.user?.avatarUrl ?? undefined,
    content: p.content,
    imageUrl: p.images?.[0] ?? undefined,
    images: p.images ?? [],
    hashtags: p.hashtags ?? [],
    withPets: p.withPets ?? [],
    postType: p.postType ?? 'share',
    likes: p.metrics?.likesCount ?? 0,
    comments: p.metrics?.commentsCount ?? 0,
    timeAgo: formatTimeAgo(p.createdAt),
    isLiked: p.isLiked ?? false,
    createdAt: p.createdAt,
  };
}

// GET /api/v1/posts?page=1&sort=new|hot&postType=question|meetup|share
export async function getPosts(
  page = 1,
  sort: 'new' | 'hot' = 'new',
  postType?: 'question' | 'meetup' | 'share',
): Promise<ApiResponse<Post[]>> {
  const params = new URLSearchParams({ page: String(page), limit: '10', sort });
  if (postType) params.set('postType', postType);
  const res = await client.get(`/posts?${params}`);
  if (!res.data.success) return { success: false, data: [], message: res.data.message };
  return { success: true, data: res.data.data.map(mapPost), message: '' };
}

// POST /api/v1/posts
export async function createPost(
  content: string,
  images?: { uri: string; name: string; type: string }[],
  petId?: string,
  onUploadProgress?: (pct: number) => void,
  hashtags?: string[],
  withPets?: string[],
  postType?: 'question' | 'meetup' | 'share',
): Promise<ApiResponse<Post>> {
  const form = new FormData();
  form.append('content', content);
  if (petId) form.append('petId', petId);
  if (hashtags && hashtags.length > 0) form.append('hashtags', JSON.stringify(hashtags));
  if (withPets && withPets.length > 0) form.append('withPets', JSON.stringify(withPets));
  if (postType) form.append('postType', postType);
  (images ?? []).forEach((img) =>
    form.append('images', { uri: img.uri, name: img.name, type: img.type } as any)
  );
  const res = await client.post('/posts', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onUploadProgress && e.total) {
        // 上傳佔 70%，後端處理（Cloudinary）佔 30%
        onUploadProgress(Math.round((e.loaded / e.total) * 70));
      }
    },
  });
  if (!res.data.success) return { success: false, data: null as any, message: res.data.message };
  return { success: true, data: mapPost(res.data.data), message: '' };
}

// POST /api/v1/posts/:id/like
export async function toggleLike(
  postId: string,
): Promise<ApiResponse<{ liked: boolean; likesCount: number }>> {
  const res = await client.post(`/posts/${postId}/like`);
  if (!res.data.success) return { success: false, data: null as any, message: res.data.message };
  return { success: true, data: res.data.data, message: '' };
}

// GET /api/v1/posts/:id
export async function getPostById(postId: string): Promise<ApiResponse<Post>> {
  const res = await client.get(`/posts/${postId}`);
  if (!res.data.success) return { success: false, data: null as any, message: res.data.message };
  return { success: true, data: mapPost(res.data.data), message: '' };
}

// GET /api/v1/posts/:id  (含留言)
export async function getPostComments(
  postId: string,
): Promise<ApiResponse<Array<{ id: string; content: string; createdAt: string; user: { name: string; avatarUrl?: string } }>>> {
  const res = await client.get(`/posts/${postId}`);
  if (!res.data.success) return { success: false, data: [], message: res.data.message };
  return { success: true, data: res.data.data.comments ?? [], message: '' };
}

// POST /api/v1/posts/:id/comments
export async function addComment(
  postId: string,
  content: string,
): Promise<ApiResponse<{ id: string; content: string; createdAt: string; user: { name: string; avatarUrl?: string } }>> {
  const res = await client.post(`/posts/${postId}/comments`, { content });
  if (!res.data.success) return { success: false, data: null as any, message: res.data.message };
  return { success: true, data: res.data.data, message: '' };
}

// POST /api/v1/posts/:id/report
export async function reportPost(
  postId: string,
  reason: 'SPAM' | 'INAPPROPRIATE' | 'OTHER',
): Promise<ApiResponse<null>> {
  const res = await client.post(`/posts/${postId}/report`, { reason });
  if (!res.data.success) return { success: false, data: null, message: res.data.message };
  return { success: true, data: null, message: '' };
}

// DELETE /api/v1/posts/:id
export async function deletePost(postId: string): Promise<ApiResponse<null>> {
  const res = await client.delete(`/posts/${postId}`);
  if (!res.data.success) return { success: false, data: null, message: res.data.message };
  return { success: true, data: null, message: '' };
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

const CATEGORY_TO_TYPE: Record<string, string> = {
  vet: 'medical', medication: 'deworm', grooming: 'grooming', activity: 'activity', other: 'other',
};
const TYPE_TO_CATEGORY: Record<string, CalendarEvent['category']> = {
  vaccine: 'vet', deworm: 'medication', medical: 'vet', grooming: 'grooming', activity: 'activity', other: 'other',
};

function ampmToISO(date: string, timeStr: string, allDay: boolean): string {
  const [y, m, d] = date.split('-').map(Number);
  if (allDay) return new Date(y, m - 1, d, 0, 0, 0).toISOString();
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return new Date(y, m - 1, d, 9, 0, 0).toISOString();
  let h = parseInt(match[1], 10);
  const min = parseInt(match[2], 10);
  if (match[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (match[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return new Date(y, m - 1, d, h, min, 0).toISOString();
}

function mapBackendEvent(e: any): CalendarEvent {
  const dt = new Date(e.startTime);
  const h = dt.getHours();
  const m = dt.getMinutes();
  const allDay = h === 0 && m === 0;
  const dateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h < 12 ? 'AM' : 'PM';
  const timeStr = allDay ? '' : `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
  return {
    id: String(e._id ?? e.id),
    title: e.title,
    description: e.note ?? '',
    time: timeStr,
    allDay,
    category: TYPE_TO_CATEGORY[e.type] ?? 'other',
    petId: e.petId ? String(e.petId) : 'all',
    done: Boolean(e.done),
    date: dateStr,
    repeat: e.repeat ?? 'none',
    recurringId: e.recurringId,
  };
}

// GET /api/v1/calendar/events?year=&month=
export async function getEvents(year: number, month: number): Promise<ApiResponse<CalendarEvent[]>> {
  const res = await client.get(`/calendar/events?year=${year}&month=${month}`);
  if (!res.data.success) return { success: false, data: [], message: res.data.message };
  return { success: true, data: (res.data.data as any[]).map(mapBackendEvent), message: '' };
}

// PATCH /api/v1/calendar/events/:id/done
export async function markEventDone(eventId: string, done: boolean): Promise<ApiResponse<null>> {
  const res = await client.patch(`/calendar/events/${eventId}/done`, { done });
  if (!res.data.success) return { success: false, data: null, message: res.data.message };
  return { success: true, data: null, message: '' };
}

// POST /api/v1/calendar/events
export async function addEvent(event: CalendarEvent): Promise<ApiResponse<CalendarEvent>> {
  const payload: Record<string, any> = {
    title: event.title,
    type: CATEGORY_TO_TYPE[event.category] ?? 'other',
    startTime: ampmToISO(event.date, event.time, event.allDay),
    repeat: event.repeat,
  };
  if (event.description) payload.note = event.description;
  if (event.petId !== 'all') payload.petId = event.petId;
  if (event.recurringId) payload.recurringId = event.recurringId;
  const res = await client.post('/calendar/events', payload);
  if (!res.data.success) return { success: false, data: null as any, message: res.data.message };
  return { success: true, data: mapBackendEvent(res.data.data), message: '' };
}

// DELETE /api/v1/calendar/events/:id?type=this|all
export async function deleteEvent(id: string, type: 'this' | 'all'): Promise<ApiResponse<null>> {
  const res = await client.delete(`/calendar/events/${id}?type=${type}`);
  if (!res.data.success) return { success: false, data: null, message: res.data.message };
  return { success: true, data: null, message: '' };
}

// ─── Notifications ────────────────────────────────────────────────────────────
export async function getNotifications(page = 1) {
  const res = await client.get('/notifications', { params: { page, limit: 30 } });
  return res.data;
}

export async function getUnreadCount(): Promise<number> {
  const res = await client.get('/notifications/unread-count');
  return res.data?.data?.count ?? 0;
}

export async function markNotificationRead(id: string) {
  const res = await client.patch(`/notifications/${id}/read`);
  return res.data;
}

export async function markAllNotificationsRead() {
  const res = await client.patch('/notifications/read-all');
  return res.data;
}

export async function deleteNotification(id: string) {
  const res = await client.delete(`/notifications/${id}`);
  return res.data;
}

export async function updatePushToken(token: string | null) {
  const res = await client.patch('/auth/push-token', { token });
  return res.data;
}


// ─── Profile ──────────────────────────────────────────────────────────────────
// PATCH /api/v1/auth/profile
export async function updateProfile(updates: {
  name?: string;
  avatar?: { uri: string; name: string; type: string };
  defaultPostVisibility?: 'public' | 'private';
}): Promise<ApiResponse<User>> {
  const form = new FormData();
  if (updates.name) form.append('name', updates.name);
  if (updates.avatar) {
    form.append('avatar', { uri: updates.avatar.uri, name: updates.avatar.name, type: updates.avatar.type } as any);
  }
  if (updates.defaultPostVisibility) form.append('defaultPostVisibility', updates.defaultPostVisibility);
  const res = await client.patch('/auth/profile', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  if (!res.data.success) throw new Error(res.data.message);
  const u = res.data.data;
  return {
    success: true,
    data: {
      id: String(u.id),
      name: u.name,
      email: u.email ?? '',
      avatarUrl: u.avatarUrl ?? undefined,
      lastNameChangedAt: u.lastNameChangedAt ?? undefined,
      defaultPostVisibility: u.defaultPostVisibility ?? 'public',
    },
    message: res.data.message,
  };
}

// ─── Settings ─────────────────────────────────────────────────────────────────
// PATCH /api/v1/auth/settings
export async function updateSettings(updates: {
  notifSettings?: Partial<{ dailyCare: boolean; calendar: boolean; likes: boolean; comments: boolean }>;
  defaultPostVisibility?: 'public' | 'private';
}): Promise<void> {
  await client.patch('/auth/settings', updates);
}

// DELETE /api/v1/auth/account
export async function deleteAccount(): Promise<void> {
  const res = await client.delete('/auth/account');
  if (!res.data.success) throw new Error(res.data.message);
}

export function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '剛剛';
  if (mins < 60) return `${mins} 分鐘前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小時前`;
  return `${Math.floor(hrs / 24)} 天前`;
}

// GET /api/v1/posts?userId=me
export async function getMyPosts(): Promise<ApiResponse<Post[]>> {
  const res = await client.get('/posts?userId=me');
  if (!res.data.success) return { success: false, data: [], message: res.data.message };
  return { success: true, data: res.data.data.map(mapPost), message: '' };
}

// ─── Map ─────────────────────────────────────────────────────────────────────

export interface ApiPlace {
  id: string;
  name: string;
  type: string;
  address: string;
  phone?: string;
  rating?: number;
  weekdayHours?: string[];
  is24Hours?: boolean;
  exoticFriendly?: boolean;
  photoUrl?: string;
  photoRef?: string;
  lat: number;
  lng: number;
  isFavorite?: boolean;
}

export async function getNearbyPlaces(
  lat: number,
  lng: number,
  type?: string,
  radius = 5000,
  is24hr?: boolean,
  exoticFriendly?: boolean
): Promise<ApiResponse<ApiPlace[]>> {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng), radius: String(radius) });
  if (type) params.set('type', type);
  if (is24hr) params.set('is24hr', 'true');
  if (exoticFriendly) params.set('exoticFriendly', 'true');
  const res = await client.get(`/map/places?${params}`);
  return res.data;
}

export async function getMapFavorites(): Promise<ApiResponse<ApiPlace[]>> {
  const res = await client.get('/map/favorites');
  return res.data;
}

export async function addMapFavorite(placeId: string): Promise<void> {
  await client.post('/map/favorites', { placeId });
}

export async function removeMapFavorite(placeId: string): Promise<void> {
  await client.delete(`/map/favorites/${placeId}`);
}

// ─── AI Conversations ──────────────────────────────────────────────────────────

function mapAiConv(c: any): Conversation {
  return {
    id: String(c.id ?? c._id),
    title: c.title,
    createdAt: formatTimeAgo(c.updatedAt ?? c.createdAt),
    messages: (c.messages ?? []).map((m: any, i: number): AiMessage => ({
      id: m._id ? String(m._id) : `m${i}`,
      role: m.role,
      content: m.content,
      imageUrl: m.imageUrl,
      timestamp: m.createdAt
        ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '',
    })),
  };
}

export async function listAiConversations(): Promise<ApiResponse<Conversation[]>> {
  const res = await client.get('/ai/conversations');
  if (!res.data.success) return { success: false, data: [], message: res.data.message };
  return { success: true, data: res.data.data.map(mapAiConv), message: '' };
}

export async function createAiConversation(petId?: string): Promise<ApiResponse<Conversation>> {
  const res = await client.post('/ai/conversations', petId ? { petId } : {});
  if (!res.data.success) return { success: false, data: null as any, message: res.data.message };
  return { success: true, data: mapAiConv(res.data.data), message: '' };
}

export async function getAiConversation(convId: string): Promise<ApiResponse<Conversation>> {
  const res = await client.get(`/ai/conversations/${convId}`);
  if (!res.data.success) return { success: false, data: null as any, message: res.data.message };
  return { success: true, data: mapAiConv(res.data.data), message: '' };
}

export async function streamAiMessage(
  convId: string,
  content: string,
  callbacks: {
    onDelta: (delta: string) => void;
    onDone: (createdAt: string) => void;
    onError: (msg: string) => void;
    onImageAttachFailed?: () => void;
  },
  image?: { uri: string; name: string; type: string },
): Promise<void> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);

  let imageBase64: string | undefined;
  if (image) {
    try {
      imageBase64 = await FileSystem.readAsStringAsync(image.uri, { encoding: FileSystem.EncodingType.Base64 });
    } catch (e) {
      console.warn('[streamAiMessage] 圖片讀取失敗，改為僅傳送文字:', e);
      callbacks.onImageAttachFailed?.();
    }
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/ai/conversations/${convId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        ...(imageBase64 ? { imageBase64, imageMimeType: image!.type } : {}),
      }),
    });
  } catch {
    callbacks.onError('網路連線失敗，請稍後再試。');
    return;
  }

  if (!response.ok || !response.body) {
    if (response.status === 429) {
      let msg = 'AI 對話次數已達上限，請稍後再試';
      try {
        const errData = await response.json();
        if (errData?.message) msg = errData.message;
      } catch {}
      const resetSec = Number(response.headers.get('RateLimit-Reset'));
      if (Number.isFinite(resetSec) && resetSec > 0) {
        msg += `（約 ${Math.ceil(resetSec / 60)} 分鐘後可再試）`;
      }
      callbacks.onError(msg);
      return;
    }
    callbacks.onError('AI 助理暫時無法回應，請稍後再試。');
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.delta) callbacks.onDelta(data.delta);
          else if (data.done) callbacks.onDone(data.createdAt ?? new Date().toISOString());
          else if (data.error) callbacks.onError(data.error);
        } catch { /* ignore malformed line */ }
      }
    }
  } catch {
    callbacks.onError('連線中斷，請稍後再試。');
  }
}

export async function sendAiMessage(
  convId: string,
  content: string,
  image?: { uri: string; name: string; type: string },
): Promise<ApiResponse<AiMessage>> {
  const form = new FormData();
  form.append('content', content);
  if (image) form.append('image', { uri: image.uri, name: image.name, type: image.type } as any);
  const res = await client.post(`/ai/conversations/${convId}/messages`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  if (!res.data.success) return { success: false, data: null as any, message: res.data.message };
  const m = res.data.data;
  return {
    success: true,
    data: {
      id: `m${Date.now()}`,
      role: m.role,
      content: m.content,
      imageUrl: m.imageUrl,
      timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
    message: '',
  };
}
