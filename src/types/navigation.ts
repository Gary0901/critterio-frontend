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
  DailyLog: { petId: string; petName: string };
  VetVisits: { petId: string; petName: string };
  NotificationSettings: undefined;
  PrivacySecurity: undefined;
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
