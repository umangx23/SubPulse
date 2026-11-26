import { supabase } from './supabase';
import {
  AlertItem,
  AppSettings,
  BillingCycle,
  CurrencyCode,
  HouseholdMember,
  SubPulseStore,
  Subscription,
  SubscriptionCategory,
  SubscriptionStatus,
  ThemeMode,
} from '../types/subpulse';

function detectDeviceName(): { deviceName: string; platform: string } {
  if (typeof navigator === 'undefined') {
    return { deviceName: 'Unknown Device', platform: 'web' };
  }
  const ua = navigator.userAgent;
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true);

  if (/iPhone|iPad|iPod/i.test(ua)) {
    return {
      deviceName: isStandalone ? 'iOS · Home Screen PWA' : 'iOS · Safari',
      platform: isStandalone ? 'ios_pwa' : 'ios_web',
    };
  }
  if (/Android/i.test(ua)) {
    return {
      deviceName: isStandalone ? 'Android · Installed PWA' : 'Android · Browser',
      platform: isStandalone ? 'android_pwa' : 'android_web',
    };
  }
  return {
    deviceName: isStandalone ? 'Desktop · Installed PWA' : 'Desktop · Web',
    platform: 'desktop_web',
  };
}

export async function signUpWithEmail(email: string, password: string, fullName?: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName?.trim() || email.split('@')[0] || 'User',
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function signInWithEmail(email: string, password: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOutCloud() {
  if (!supabase) return;
  await supabase.auth.signOut({ scope: 'global' });
}

export async function registerCurrentDevice(userId: string): Promise<void> {
  if (!supabase) return;
  const { deviceName, platform } = detectDeviceName();
  try {
    await supabase.from('devices').upsert(
      {
        user_id: userId,
        device_name: deviceName,
        platform,
        last_active_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,device_name' }
    );
    await supabase
      .from('profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('user_id', userId);
  } catch {
    // Non-blocking if schema hasn't been applied yet
  }
}

export async function fetchCloudState(
  userId: string,
  localFallback: SubPulseStore
): Promise<Partial<SubPulseStore> | null> {
  if (!supabase) return null;

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileErr || !profile) return null;

  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1);

  const primaryWorkspace = workspaces?.[0];
  const workspaceId: string | undefined = primaryWorkspace?.id;

  let members: HouseholdMember[] = localFallback.members;
  let subscriptions: Subscription[] = [];

  if (workspaceId) {
    const [{ data: memberRows }, { data: subRows }] = await Promise.all([
      supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true }),
      supabase
        .from('subscriptions')
        .select('*')
        .eq('workspace_id', workspaceId)
        .is('archived_at', null)
        .order('created_at', { ascending: false }),
    ]);

    if (Array.isArray(memberRows)) {
      members = memberRows.map((m) => ({
        id: String(m.id),
        name: String(m.display_name),
        initials: String(m.initials || 'SP'),
        avatarColor: String(m.avatar_color || 'bg-light-primary-container text-light-on-primary'),
        role: (m.role as HouseholdMember['role']) || 'Editor',
        email: String(m.email),
        settledThisMonth: Boolean(m.settled_this_month),
        customOwes: m.custom_owes != null ? Number(m.custom_owes) : undefined,
      }));
    }

    if (Array.isArray(subRows)) {
      subscriptions = subRows.map((s) => ({
        id: String(s.id),
        name: String(s.name),
        initials: String(s.initials),
        avatarBg: String(s.avatar_bg),
        category: s.category as SubscriptionCategory,
        price: Number(s.price),
        currency: s.currency as CurrencyCode,
        cycle: s.cycle as BillingCycle,
        status: s.status as SubscriptionStatus,
        nextBillingDate: String(s.next_billing_date),
        reminderDays: (Number(s.reminder_days) as 1 | 3 | 7) || 3,
        startedOn: String(s.started_on),
        paymentMethod: String(s.payment_method || ''),
        isShared: Boolean(s.is_shared),
        splitCount: Number(s.split_count || 1),
        sharedMembers: Array.isArray(s.shared_members) ? (s.shared_members as string[]) : [],
        manageUrl: String(s.manage_url || ''),
        notes: String(s.notes || ''),
        priceChangeDelta: s.price_change_delta != null ? Number(s.price_change_delta) : undefined,
        trialEndsSoon: Boolean(s.trial_ends_soon),
        valueRating: (s.value_rating as Subscription['valueRating']) || 'unrated',
      }));
    }
  }

  const { data: alertRows } = await supabase
    .from('alerts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(25);

  const alerts: AlertItem[] = Array.isArray(alertRows)
    ? alertRows.map((a) => ({
        id: String(a.id),
        title: String(a.title),
        description: String(a.description),
        timestampLabel: new Date(a.created_at).toLocaleDateString(),
        type: a.type as AlertItem['type'],
        read: Boolean(a.read),
        subscriptionId: a.subscription_id ? String(a.subscription_id) : undefined,
      }))
    : [];

  const settings: AppSettings = {
    ...localFallback.settings,
    workspaceName: primaryWorkspace?.name || localFallback.settings.workspaceName,
    userName: String(profile.full_name || localFallback.settings.userName),
    userInitials: String(profile.initials || localFallback.settings.userInitials),
    userEmail: String(profile.email || localFallback.settings.userEmail),
    currency: (profile.currency as CurrencyCode) || localFallback.settings.currency,
    country: String(profile.country || localFallback.settings.country || 'United States'),
    timezone: String(profile.timezone || localFallback.settings.timezone || 'UTC'),
    theme: (profile.theme as ThemeMode) || localFallback.settings.theme,
    monthlyBudgetCap: Number(profile.monthly_budget_cap ?? localFallback.settings.monthlyBudgetCap),
    annualTrimGoal: Number(profile.annual_trim_goal ?? localFallback.settings.annualTrimGoal),
    savedYtd: Number(profile.saved_ytd ?? 0),
    cancelledCountYtd: Number(profile.cancelled_count_ytd ?? 0),
    categoryCaps: (profile.category_caps as AppSettings['categoryCaps']) || localFallback.settings.categoryCaps,
    webPushEnabled: Boolean(profile.web_push_enabled),
    emailFallbackEnabled: Boolean(profile.email_fallback_enabled),
    quietHoursStart: String(profile.quiet_hours_start || '22:00').slice(0, 5),
    quietHoursEnd: String(profile.quiet_hours_end || '08:00').slice(0, 5),
    passkeyLockEnabled: Boolean(profile.passkey_lock_enabled),
  };

  return {
    cloudUserId: userId,
    workspaceId,
    isSignedIn: true,
    isGuestMode: false,
    hasCompletedOnboarding: Boolean(profile.has_completed_onboarding) || localFallback.hasCompletedOnboarding,
    settings,
    members,
    subscriptions,
    alerts,
  };
}

export async function syncSubscriptionUpsert(
  workspaceId: string,
  userId: string,
  sub: Subscription
): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('subscriptions').upsert({
      id: sub.id,
      workspace_id: workspaceId,
      created_by: userId,
      name: sub.name,
      initials: sub.initials,
      avatar_bg: sub.avatarBg,
      category: sub.category,
      price: sub.price,
      currency: sub.currency,
      cycle: sub.cycle,
      status: sub.status,
      next_billing_date: sub.nextBillingDate,
      reminder_days: sub.reminderDays,
      started_on: sub.startedOn,
      payment_method: sub.paymentMethod,
      is_shared: sub.isShared,
      split_count: sub.splitCount,
      shared_members: sub.sharedMembers,
      manage_url: sub.manageUrl,
      notes: sub.notes,
      price_change_delta: sub.priceChangeDelta ?? null,
      trial_ends_soon: Boolean(sub.trialEndsSoon),
      value_rating: sub.valueRating || 'unrated',
      archived_at: null,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Local IndexedDB still holds the latest state
  }
}

export async function syncSubscriptionArchive(subId: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase
      .from('subscriptions')
      .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', subId);
  } catch {
    // ignore offline
  }
}

export async function syncProfileSettings(
  userId: string,
  settings: AppSettings,
  hasCompletedOnboarding: boolean
): Promise<void> {
  if (!supabase) return;
  try {
    await supabase
      .from('profiles')
      .update({
        full_name: settings.userName,
        initials: settings.userInitials,
        currency: settings.currency,
        country: settings.country,
        timezone: settings.timezone,
        theme: settings.theme,
        monthly_budget_cap: settings.monthlyBudgetCap,
        annual_trim_goal: settings.annualTrimGoal,
        saved_ytd: settings.savedYtd,
        cancelled_count_ytd: settings.cancelledCountYtd,
        category_caps: settings.categoryCaps,
        web_push_enabled: settings.webPushEnabled,
        email_fallback_enabled: settings.emailFallbackEnabled,
        quiet_hours_start: settings.quietHoursStart,
        quiet_hours_end: settings.quietHoursEnd,
        passkey_lock_enabled: settings.passkeyLockEnabled,
        has_completed_onboarding: hasCompletedOnboarding,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
  } catch {
    // ignore offline
  }
}

export async function syncLocalSubscriptionsToCloud(
  workspaceId: string,
  userId: string,
  subscriptions: Subscription[]
): Promise<void> {
  if (!supabase || subscriptions.length === 0) return;
  await Promise.all(subscriptions.map((sub) => syncSubscriptionUpsert(workspaceId, userId, sub)));
}

export function subscribeToWorkspaceChanges(workspaceId: string, onChange: () => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`workspace-sync-${workspaceId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'subscriptions',
        filter: `workspace_id=eq.${workspaceId}`,
      },
      () => {
        onChange();
      }
    )
    .subscribe();

  return () => {
    supabase?.removeChannel(channel);
  };
}

