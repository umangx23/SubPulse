export type SubscriptionStatus = 'active' | 'trial' | 'paused' | 'cancelled';

export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export type SubscriptionCategory =
  | 'Productivity & AI'
  | 'Entertainment'
  | 'Cloud & Utilities'
  | 'Fitness';

export type CurrencyCode = 'USD' | 'INR' | 'EUR' | 'GBP' | 'CAD';

export type ThemeMode = 'light' | 'dark' | 'system';

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'pending' | 'error';

export type SyncResolutionStrategy = 'merge' | 'keep_cloud' | 'overwrite_cloud';

export type AppView =
  | 'splash'
  | 'intro'
  | 'setup'
  | 'dashboard'
  | 'subscriptions'
  | 'detail'
  | 'edit'
  | 'analytics'
  | 'savings'
  | 'household'
  | 'notifications'
  | 'settings'
  | 'signin'
  | 'onboarding'
  | 'states';

export interface Subscription {
  id: string;
  name: string;
  initials: string;
  avatarBg: string;
  category: SubscriptionCategory;
  price: number;
  currency: CurrencyCode;
  cycle: BillingCycle;
  status: SubscriptionStatus;
  nextBillingDate: string; // YYYY-MM-DD
  reminderDays: 1 | 3 | 7;
  startedOn: string; // YYYY-MM-DD
  paymentMethod: string;
  isShared: boolean;
  splitCount: number;
  sharedMembers: string[];
  manageUrl: string;
  notes: string;
  priceChangeDelta?: number; // e.g., +2.00 for Netflix hike
  trialEndsSoon?: boolean;
  valueRating?: 'worth' | 'low' | 'unrated';
}

export interface HouseholdMember {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  role: 'Owner' | 'Editor' | 'Viewer';
  email: string;
  settledThisMonth: boolean;
  customOwes?: number;
}

export interface AlertItem {
  id: string;
  title: string;
  description: string;
  timestampLabel: string;
  type: 'trial' | 'price_hike' | 'digest' | 'system';
  read: boolean;
  subscriptionId?: string;
}

export interface CategoryBudget {
  category: SubscriptionCategory;
  cap: number;
  colorClass: string;
}

export interface AppSettings {
  workspaceName: string;
  userName: string;
  userInitials: string;
  userEmail: string;
  currency: CurrencyCode;
  country?: string;
  timezone?: string;
  theme: ThemeMode;
  monthlyBudgetCap: number;
  annualTrimGoal: number;
  savedYtd: number;
  cancelledCountYtd: number;
  passkeyLockEnabled: boolean;
  totpEnabled: boolean;
  webPushEnabled: boolean;
  emailFallbackEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  aiFeaturesEnabled: boolean;
  geminiApiKey?: string;
  categoryCaps: Record<SubscriptionCategory, number>;
}

export interface AIRecommendation {
  subscriptionId: string;
  subscriptionName: string;
  actionType: 'cancel' | 'consolidate' | 'downgrade' | 'review';
  headline: string;
  reason: string;
  monthlySavings: number;
}

export interface AIAuditResponse {
  summary: string;
  recommendations: AIRecommendation[];
  generatedAt: string;
}

export interface CloudSnapshot {
  userId: string;
  hasSettingsRow: boolean;
  hasRemoteData: boolean;
  settings: AppSettings | null;
  subscriptions: Subscription[];
  members: HouseholdMember[];
  alerts: AlertItem[];
  hasCompletedOnboarding: boolean;
}

export interface SubPulseStore {
  subscriptions: Subscription[];
  members: HouseholdMember[];
  alerts: AlertItem[];
  settings: AppSettings;
  hasCompletedOnboarding: boolean;
  isSignedIn: boolean;
  isGuestMode: boolean;
  cloudUserId?: string;
  lastSyncedAt?: string;
  hasPendingCloudSync?: boolean;
  backupBannerDismissed?: boolean;
}
