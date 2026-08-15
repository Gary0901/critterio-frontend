export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  Onboarding: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token: string };
  AddPet: { isOnboarding?: boolean };
  MainTabs: { screen?: keyof MainTabParamList } | undefined;
  Notifications: undefined;
  Profile: { postId?: string } | undefined;
  PetDetail: { petId: string };
  // petColor 是後端配給這隻寵物的識別色索引（Pet.color），
  // 分享卡的色帶要用它，才跟行事曆、我的寵物是同一個顏色
  DailyLog: { petId: string; petName: string; petColor?: number };
  VetVisits: { petId: string; petName: string; pendingJobId?: string };
  NotificationSettings: undefined;
  PrivacySecurity: undefined;
  Appearance: undefined;
  PartnerProgram: undefined;
  BlockedUsers: undefined;
  HelpSupport: undefined;
  Terms: undefined;
  PrivacyPolicy: undefined;
  PetCareGuide: { category: 'vet' | 'petstore' | 'grooming' };
};

export type MainTabParamList = {
  MyPets: undefined;
  Community: { sharePhoto?: { uri: string; name: string; type: string }; sharePetName?: string; postId?: string } | undefined;
  AskAI: undefined;
  Map: undefined;
  Reminders: undefined;
};
