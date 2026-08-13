export type Species = 'dog' | 'cat' | 'rabbit' | 'small' | 'bird' | 'reptile' | 'other';
export type PetStatus = 'healthy' | 'due_soon' | 'warning';
export type Gender = 'male' | 'female';

export interface Pet {
  id: string;
  name: string;
  species: Species;
  breed: string;
  age: number;
  weightKg: number;
  heightCm: number;
  gender: Gender;
  photoUrl?: string;
  /** 識別色索引（色條、行事曆標籤）。後端建立寵物時自動配一個未使用的值 */
  color?: number;
  traits: string[];
  status: PetStatus;
  statusLabel: string;
  nextEvent?: string;
  birthday?: string;   // ISO date string
  joinedAt?: string;   // ISO date string (createdAt)
  careTargets?: { label: string; target: string; category: string }[];
}


export interface NotifSettings {
  dailyCare: boolean;
  calendar: boolean;
  likes: boolean;
  comments: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  /** 使用者自選的頭像底色索引。沒選過為 undefined，前端會依 id 雜湊自動配 */
  avatarColor?: number;
  lastNameChangedAt?: string; // ISO date string, enforces 14-day cooldown
  defaultPostVisibility?: 'public' | 'private';
  notifSettings?: NotifSettings;
}

export interface Post {
  id: string;
  authorId?: string;
  author: string;
  authorAvatarUrl?: string;
  authorAvatarColor?: number;
  content: string;
  imageUrl?: string;
  images?: string[];
  hashtags: string[];
  withPets?: string[];
  postType?: 'question' | 'meetup' | 'share';
  likes: number;
  comments: number;
  timeAgo: string;
  isLiked?: boolean;
  createdAt?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  time: string;        // 'HH:MM AM/PM', or '' when allDay is true
  allDay: boolean;
  category: 'vet' | 'medication' | 'grooming' | 'activity' | 'anniversary' | 'other';
  petId: string;       // pet id, or 'all' for all pets
  done: boolean;
  date: string;        // YYYY-MM-DD
  repeat: 'none' | 'daily' | 'weekly' | 'monthly';
  recurringId?: string; // shared across recurring group
  /** 由寵物生日／加入家庭日自動產生。使用者不能勾選完成或刪除 */
  isAuto?: boolean;
}

export interface Notification {
  id: string;
  type: 'like' | 'comment' | 'health_reminder' | 'milestone' | 'lost_pet' | 'vet_visit_parsed';
  title: string;
  body: string;
  read: boolean;
  timeAgo: string;
  day: 'today' | 'yesterday' | 'earlier';
  data?: Record<string, string>;
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  petName?: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  messages: AiMessage[];
  /**
   * 這段對話綁定的寵物。後端在建立對話時寫入一次就不再變動，
   * 它決定 AI 有沒有被掛上查詢真實紀錄的工具（見 aiController 的 toolsPetId）。
   * undefined 代表未綁定，該對話的 AI 只有知識庫、查不到 App 內的資料。
   */
  petId?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

export interface DiaryPhoto {
  url: string;
  time: string; // e.g. "10:24 AM"
}

export interface WeightLog {
  id: string;
  weightKg: number;
  recordedAt: string; // ISO date string
}

export interface LabResultItem {
  itemName: string;
  abbreviation?: string;
  value: number;
  unit: string;
  refRange?: string;
  status: 'NORMAL' | 'HIGH' | 'LOW' | 'UNKNOWN';
  plainExplanation: string;
}

export interface Medication {
  name: string;
  dosage?: string;
  frequency?: string;
  notes?: string;
}

export interface VetVisit {
  id: string;
  petId: string;
  visitDate: string; // ISO date string
  clinicName: string;
  diagnosisNote: string;
  imageUrl: string;
  reportType: string;
  items: LabResultItem[];
  medications: Medication[];
  summaryAdvice: string;
  calendarEventId?: string | null;
  createdAt: string;
}

export interface DiaryEntry {
  id: string;
  petId: string;
  date: string; // YYYY-MM-DD
  photoUrl: string; // primary thumbnail (backwards compat)
  photos?: DiaryPhoto[];
  title?: string;
  note?: string;
  mood?: string[]; // mood identifiers e.g. ['happy','playful']
  hashtags?: string[];
  entryNumber?: number;
}
