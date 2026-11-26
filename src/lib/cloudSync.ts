import { supabase } from './supabase';
import { computeInitials } from './formatters';
import {
  AlertItem,
  AppSettings,
  BillingCycle,
  CloudSnapshot,
  CurrencyCode,
  HouseholdMember,
  SubPulseStore,
  Subscription,
  SubscriptionCategory,
  SubscriptionStatus,
  ThemeMode,
} from '../types/subpulse';

type SchemaVariant = 'v2' | 'legacy';

let detectedSchema: SchemaVariant | null = null;
const legacyWorkspaceCache = new Map<string, string>();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getRedirectUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}${window.location.pathname}`;
}

function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = 'code' in err ? String((err as { code?: unknown }).code || '') : '';
  const msg = 'message' in err ? String((err as { message?: unknown }).message || '').toLowerCase() : '';
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('schema cache') ||
    (msg.includes('relation') && msg.includes('does not exist'))
  );
}

export function formatCloudError(err: unknown): string {
  if (!err) return 'Unable to sync with cloud right now.';
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string'
      ? (err as { message: string }).message
      : String(err);

  const lower = message.toLowerCase();
  if (lower.includes('infinite recursion')) {
    return 'Supabase RLS policy recursion detected on legacy workspaces table. Run the updated supabase/schema.sql in your Supabase SQL Editor to fix it.';
  }
  if (
    lower.includes('schema cache') ||
    (lower.includes('relation') && lower.includes('does not exist'))
  ) {
    return 'Cloud tables are not ready yet. Run supabase/schema.sql in your Supabase SQL Editor (it reloads the schema cache automatically).';
  }
  if (lower.includes('row-level security') || lower.includes('permission denied')) {
    return 'Cloud access denied by database policy. Re-run supabase/schema.sql in your Supabase SQL Editor.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Network unavailable. Changes stay safely saved locally on this device.';
  }
  return message;
}

/**
 * Automatically detects whether the Supabase project is running the normalized v2 schema
 * (`user_settings`, `subscriptions`, `household_members`, `alerts`) or the legacy schema
 * (`profiles`, `workspaces`, `workspace_members`, `subscriptions`, `alerts`).
 */
async function resolveSchemaVariant(forceRecheck = false): Promise<SchemaVariant> {
  if (!supabase) throw new Error('Supabase is not configured.');
  if (detectedSchema && !forceRecheck) return detectedSchema;

  const { error: v2Err } = await supabase
    .from('user_settings')
    .select('user_id')
    .limit(1);

  if (!v2Err) {
    detectedSchema = 'v2';
    return 'v2';
  }

  if (isMissingTableError(v2Err)) {
    const { error: legacyErr } = await supabase
      .from('profiles')
      .select('user_id')
      .limit(1);

    if (!legacyErr) {
      detectedSchema = 'legacy';
      return 'legacy';
    }
  }

  // Neither table is available — throw the original error for clear user feedback
  throw v2Err;
}

async function ensureLegacyWorkspaceId(
  userId: string,
  settings?: AppSettings
): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const cached = legacyWorkspaceCache.get(userId);
  if (cached) return cached;

  const { data: existing, error: selectErr } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true })
    .limit(1);

  if (selectErr) throw selectErr;
  if (existing && existing[0]?.id) {
    const id = String(existing[0].id);
    legacyWorkspaceCache.set(userId, id);
    return id;
  }

  const workspaceName = settings?.workspaceName || 'Personal';
  const { data: created, error: createErr } = await supabase
    .from('workspaces')
    .insert({ name: workspaceName, owner_id: userId })
    .select('id')
    .single();

  if (createErr) throw createErr;
  const workspaceId = String(created.id);
  legacyWorkspaceCache.set(userId, workspaceId);

  // Ensure owner is registered in workspace_members so legacy subscription RLS passes
  const email = settings?.userEmail || `${userId}@local`;
  const displayName =
    settings?.userName && settings.userName !== 'Guest' ? settings.userName : 'Owner';
  await supabase.from('workspace_members').upsert(
    {
      workspace_id: workspaceId,
      user_id: userId,
      display_name: displayName,
      initials: computeInitials(displayName),
      email,
      role: 'Owner',
      settled_this_month: true,
    },
    { onConflict: 'workspace_id,email' }
  );

  return workspaceId;
}

// ---------------------------------------------------------------------------
// Email-Only Supabase Authentication
// ---------------------------------------------------------------------------

export async function signUpWithEmail(email: string, password: string, fullName?: string) {
  if (!supabase) throw new Error('Supabase is not configured in this environment.');
  const trimmedName = fullName?.trim() || email.split('@')[0] || 'User';
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getRedirectUrl(),
      data: {
        full_name: trimmedName,
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function signInWithEmail(email: string, password: string) {
  if (!supabase) throw new Error('Supabase is not configured in this environment.');
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function resendSignupConfirmation(email: string) {
  if (!supabase) throw new Error('Supabase is not configured in this environment.');
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: getRedirectUrl(),
    },
  });
  if (error) throw error;
}

export async function requestPasswordReset(email: string) {
  if (!supabase) throw new Error('Supabase is not configured in this environment.');
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getRedirectUrl(),
  });
  if (error) throw error;
}

export async function updateAccountPassword(newPassword: string) {
  if (!supabase) throw new Error('Supabase is not configured in this environment.');
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (error) throw error;
  return data;
}

export async function signOutCloud() {
  detectedSchema = null;
  legacyWorkspaceCache.clear();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Row Mappers
// ---------------------------------------------------------------------------

function mapSubscriptionRow(row: Record<string, unknown>): Subscription {
  return {
    id: String(row.id),
    name: String(row.name),
    initials: String(row.initials || computeInitials(String(row.name || 'SP'))),
    avatarBg: String(
      row.avatar_bg || 'bg-light-primary-container dark:bg-dark-primary-container text-light-on-primary'
    ),
    category: (row.category as SubscriptionCategory) || 'Productivity & AI',
    price: Number(row.price ?? 0),
    currency: (row.currency as CurrencyCode) || 'USD',
    cycle: (row.cycle as BillingCycle) || 'monthly',
    status: (row.status as SubscriptionStatus) || 'active',
    nextBillingDate: String(row.next_billing_date || '2026-12-01'),
    reminderDays: ([1, 3, 7].includes(Number(row.reminder_days)) ? Number(row.reminder_days) : 3) as 1 | 3 | 7,
    startedOn: String(row.started_on || '2026-11-26'),
    paymentMethod: String(row.payment_method || ''),
    isShared: Boolean(row.is_shared),
    splitCount: Math.max(1, Number(row.split_count || 1)),
    sharedMembers: Array.isArray(row.shared_members) ? row.shared_members.map(String) : [],
    manageUrl: String(row.manage_url || ''),
    notes: String(row.notes || ''),
    priceChangeDelta: row.price_change_delta != null ? Number(row.price_change_delta) : undefined,
    trialEndsSoon: Boolean(row.trial_ends_soon),
    valueRating: (row.value_rating as Subscription['valueRating']) || 'unrated',
  };
}

function toV2SubscriptionRecord(userId: string, sub: Subscription) {
  return {
    user_id: userId,
    id: sub.id,
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
    split_count: Math.max(1, sub.splitCount || 1),
    shared_members: sub.sharedMembers,
    manage_url: sub.manageUrl,
    notes: sub.notes,
    price_change_delta: sub.priceChangeDelta ?? null,
    trial_ends_soon: Boolean(sub.trialEndsSoon),
    value_rating: sub.valueRating || 'unrated',
    archived_at: null,
    updated_at: new Date().toISOString(),
  };
}

function toLegacySubscriptionRecord(workspaceId: string, userId: string, sub: Subscription) {
  return {
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
    split_count: Math.max(1, sub.splitCount || 1),
    shared_members: sub.sharedMembers,
    manage_url: sub.manageUrl,
    notes: sub.notes,
    price_change_delta: sub.priceChangeDelta ?? null,
    trial_ends_soon: Boolean(sub.trialEndsSoon),
    value_rating: sub.valueRating || 'unrated',
    archived_at: null,
    updated_at: new Date().toISOString(),
  };
}

function mapMemberRow(row: Record<string, unknown>): HouseholdMember {
  const displayName = String(row.name ?? row.display_name ?? 'Member');
  return {
    id: String(row.id),
    name: displayName,
    initials: String(row.initials || computeInitials(displayName)),
    avatarColor: String(
      row.avatar_color || 'bg-light-primary-container dark:bg-dark-primary-container text-light-on-primary'
    ),
    role: (row.role as HouseholdMember['role']) || 'Editor',
    email: String(row.email || ''),
    settledThisMonth: Boolean(row.settled_this_month),
    customOwes: row.custom_owes != null ? Number(row.custom_owes) : undefined,
  };
}

function toV2MemberRecord(userId: string, member: HouseholdMember) {
  return {
    user_id: userId,
    id: member.id,
    name: member.name,
    initials: member.initials,
    avatar_color: member.avatarColor,
    role: member.role,
    email: member.email,
    settled_this_month: Boolean(member.settledThisMonth),
    custom_owes: member.customOwes ?? null,
    updated_at: new Date().toISOString(),
  };
}

function toLegacyMemberRecord(workspaceId: string, member: HouseholdMember) {
  const record: Record<string, unknown> = {
    workspace_id: workspaceId,
    display_name: member.name,
    initials: member.initials,
    avatar_color: member.avatarColor,
    role: member.role,
    email: member.email?.trim() || `${member.id}@household.local`,
    settled_this_month: Boolean(member.settledThisMonth),
    custom_owes: member.customOwes ?? null,
  };
  if (UUID_REGEX.test(member.id)) {
    record.id = member.id;
  }
  return record;
}

function mapAlertRow(row: Record<string, unknown>): AlertItem {
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description || ''),
    timestampLabel: String(
      row.timestamp_label || (row.created_at ? new Date(String(row.created_at)).toLocaleDateString() : 'Recently')
    ),
    type: (row.type as AlertItem['type']) || 'system',
    read: Boolean(row.read),
    subscriptionId: row.subscription_id ? String(row.subscription_id) : undefined,
  };
}

function toV2AlertRecord(userId: string, alert: AlertItem) {
  return {
    user_id: userId,
    id: alert.id,
    subscription_id: alert.subscriptionId ?? null,
    title: alert.title,
    description: alert.description,
    timestamp_label: alert.timestampLabel,
    type: alert.type,
    read: Boolean(alert.read),
    updated_at: new Date().toISOString(),
  };
}

function toLegacyAlertRecord(userId: string, alert: AlertItem, validSubIds?: Set<string>) {
  const safeSubId =
    alert.subscriptionId && (!validSubIds || validSubIds.has(alert.subscriptionId))
      ? alert.subscriptionId
      : null;
  return {
    id: alert.id,
    user_id: userId,
    subscription_id: safeSubId,
    title: alert.title,
    description: alert.description,
    type: alert.type,
    read: Boolean(alert.read),
  };
}

function mapSettingsRow(
  row: Record<string, unknown>,
  localFallback: SubPulseStore,
  workspaceNameOverride?: string
): AppSettings {
  return {
    ...localFallback.settings,
    workspaceName: String(workspaceNameOverride || row.workspace_name || localFallback.settings.workspaceName),
    userName: String(row.full_name || localFallback.settings.userName),
    userInitials: String(row.initials || localFallback.settings.userInitials),
    userEmail: String(row.email || localFallback.settings.userEmail),
    currency: (row.currency as CurrencyCode) || localFallback.settings.currency,
    country: String(row.country || localFallback.settings.country || 'United States'),
    timezone: String(row.timezone || localFallback.settings.timezone || 'UTC'),
    theme: (row.theme as ThemeMode) || localFallback.settings.theme,
    monthlyBudgetCap: Number(row.monthly_budget_cap ?? localFallback.settings.monthlyBudgetCap),
    annualTrimGoal: Number(row.annual_trim_goal ?? localFallback.settings.annualTrimGoal),
    savedYtd: Number(row.saved_ytd ?? 0),
    cancelledCountYtd: Number(row.cancelled_count_ytd ?? 0),
    categoryCaps:
      (row.category_caps as AppSettings['categoryCaps']) || localFallback.settings.categoryCaps,
    webPushEnabled: Boolean(row.web_push_enabled),
    emailFallbackEnabled: Boolean(row.email_fallback_enabled),
    quietHoursStart: String(row.quiet_hours_start || '22:00').slice(0, 5),
    quietHoursEnd: String(row.quiet_hours_end || '08:00').slice(0, 5),
    passkeyLockEnabled: false,
    totpEnabled: false,
    // Keep BYOK Gemini key strictly local
    geminiApiKey: localFallback.settings.geminiApiKey,
    aiFeaturesEnabled: localFallback.settings.aiFeaturesEnabled,
  };
}

function toV2SettingsRecord(
  userId: string,
  settings: AppSettings,
  hasCompletedOnboarding: boolean
) {
  return {
    user_id: userId,
    email: settings.userEmail || '',
    full_name: settings.userName || 'User',
    initials: settings.userInitials || computeInitials(settings.userName || 'User'),
    workspace_name: settings.workspaceName || 'Personal',
    currency: settings.currency,
    country: settings.country || 'United States',
    timezone: settings.timezone || 'UTC',
    theme: settings.theme,
    monthly_budget_cap: settings.monthlyBudgetCap,
    annual_trim_goal: settings.annualTrimGoal,
    saved_ytd: settings.savedYtd,
    cancelled_count_ytd: settings.cancelledCountYtd,
    category_caps: settings.categoryCaps,
    web_push_enabled: settings.webPushEnabled,
    email_fallback_enabled: settings.emailFallbackEnabled,
    quiet_hours_start: settings.quietHoursStart || '22:00',
    quiet_hours_end: settings.quietHoursEnd || '08:00',
    has_completed_onboarding: hasCompletedOnboarding,
    updated_at: new Date().toISOString(),
  };
}

function toLegacyProfileRecord(
  userId: string,
  settings: AppSettings,
  hasCompletedOnboarding: boolean
) {
  return {
    user_id: userId,
    email: settings.userEmail || '',
    full_name: settings.userName || 'User',
    initials: settings.userInitials || computeInitials(settings.userName || 'User'),
    currency: settings.currency,
    country: settings.country || 'United States',
    timezone: settings.timezone || 'UTC',
    theme: settings.theme,
    monthly_budget_cap: settings.monthlyBudgetCap,
    annual_trim_goal: settings.annualTrimGoal,
    saved_ytd: settings.savedYtd,
    cancelled_count_ytd: settings.cancelledCountYtd,
    category_caps: settings.categoryCaps,
    web_push_enabled: settings.webPushEnabled,
    email_fallback_enabled: settings.emailFallbackEnabled,
    quiet_hours_start: settings.quietHoursStart || '22:00',
    quiet_hours_end: settings.quietHoursEnd || '08:00',
    passkey_lock_enabled: false,
    has_completed_onboarding: hasCompletedOnboarding,
    updated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Cloud Read & Snapshot Inspection (Auto-supports v2 and legacy schemas)
// ---------------------------------------------------------------------------

export async function fetchCloudSnapshot(
  userId: string,
  localFallback: SubPulseStore
): Promise<CloudSnapshot> {
  if (!supabase) throw new Error('Supabase is not configured.');

  const schema = await resolveSchemaVariant(true);

  if (schema === 'v2') {
    const [settingsRes, subsRes, membersRes, alertsRes] = await Promise.all([
      supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
      supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .is('archived_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('household_members')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),
      supabase
        .from('alerts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    if (settingsRes.error) throw settingsRes.error;
    if (subsRes.error) throw subsRes.error;
    if (membersRes.error) throw membersRes.error;
    if (alertsRes.error) throw alertsRes.error;

    const subscriptions = (subsRes.data || []).map((row) =>
      mapSubscriptionRow(row as Record<string, unknown>)
    );
    const members = (membersRes.data || []).map((row) =>
      mapMemberRow(row as Record<string, unknown>)
    );
    const alerts = (alertsRes.data || []).map((row) =>
      mapAlertRow(row as Record<string, unknown>)
    );

    const row = settingsRes.data as Record<string, unknown> | null;
    const settings = row ? mapSettingsRow(row, localFallback) : null;

    return {
      userId,
      hasSettingsRow: Boolean(row),
      hasRemoteData: subscriptions.length > 0 || members.length > 0 || alerts.length > 0,
      settings,
      subscriptions,
      members,
      alerts,
      hasCompletedOnboarding: row ? Boolean(row.has_completed_onboarding) : false,
    };
  }

  // Legacy schema path: profiles + workspaces + workspace_members + subscriptions + alerts
  const [profileRes, workspacesRes, alertsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase
      .from('workspaces')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: true })
      .limit(1),
    supabase
      .from('alerts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (workspacesRes.error) throw workspacesRes.error;
  if (alertsRes.error) throw alertsRes.error;

  const primaryWorkspace = workspacesRes.data?.[0] as Record<string, unknown> | undefined;
  const workspaceId = primaryWorkspace?.id ? String(primaryWorkspace.id) : undefined;
  if (workspaceId) {
    legacyWorkspaceCache.set(userId, workspaceId);
  }

  let subscriptions: Subscription[] = [];
  let members: HouseholdMember[] = [];

  if (workspaceId) {
    const [subsRes, membersRes] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('*')
        .eq('workspace_id', workspaceId)
        .is('archived_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true }),
    ]);
    if (subsRes.error) throw subsRes.error;
    if (membersRes.error) throw membersRes.error;

    subscriptions = (subsRes.data || []).map((row) =>
      mapSubscriptionRow(row as Record<string, unknown>)
    );
    members = (membersRes.data || []).map((row) =>
      mapMemberRow(row as Record<string, unknown>)
    );
  }

  const alerts = (alertsRes.data || []).map((row) =>
    mapAlertRow(row as Record<string, unknown>)
  );

  const profileRow = profileRes.data as Record<string, unknown> | null;
  const settings = profileRow
    ? mapSettingsRow(
        profileRow,
        localFallback,
        primaryWorkspace?.name ? String(primaryWorkspace.name) : undefined
      )
    : null;

  // Note: legacy trigger auto-creates 1 Owner row in workspace_members on signup;
  // only count as remote data if there are subscriptions, alerts, or >1 household members
  const hasMeaningfulRemoteMembers = members.length > 1;
  const hasRemoteData =
    subscriptions.length > 0 || hasMeaningfulRemoteMembers || alerts.length > 0;

  return {
    userId,
    hasSettingsRow: Boolean(profileRow),
    hasRemoteData,
    settings,
    subscriptions,
    members: hasRemoteData ? members : [],
    alerts,
    hasCompletedOnboarding: profileRow ? Boolean(profileRow.has_completed_onboarding) : false,
  };
}

// ---------------------------------------------------------------------------
// Local + Cloud Conflict Resolution & Merge
// ---------------------------------------------------------------------------

export function hasLocalUserData(store: SubPulseStore): boolean {
  return store.subscriptions.length > 0 || store.members.length > 0 || store.alerts.length > 0;
}

export function mergeLocalAndCloudStore(
  local: SubPulseStore,
  cloud: CloudSnapshot,
  userEmail: string,
  displayName?: string
): SubPulseStore {
  const subById = new Map<string, Subscription>();
  const subFingerprints = new Set<string>();

  for (const sub of cloud.subscriptions) {
    subById.set(sub.id, sub);
    subFingerprints.add(`${sub.name.trim().toLowerCase()}|${sub.price}|${sub.cycle}`);
  }
  for (const sub of local.subscriptions) {
    const fingerprint = `${sub.name.trim().toLowerCase()}|${sub.price}|${sub.cycle}`;
    if (subById.has(sub.id)) {
      subById.set(sub.id, sub);
    } else if (!subFingerprints.has(fingerprint)) {
      subById.set(sub.id, sub);
      subFingerprints.add(fingerprint);
    }
  }

  const memberByKey = new Map<string, HouseholdMember>();
  for (const member of cloud.members) {
    const key = member.email ? `email:${member.email.trim().toLowerCase()}` : `id:${member.id}`;
    memberByKey.set(key, member);
  }
  for (const member of local.members) {
    const key = member.email ? `email:${member.email.trim().toLowerCase()}` : `id:${member.id}`;
    if (!memberByKey.has(key)) {
      memberByKey.set(key, member);
    }
  }

  const alertByKey = new Map<string, AlertItem>();
  for (const alert of cloud.alerts) {
    const key = `${alert.type}:${alert.title.trim().toLowerCase()}`;
    alertByKey.set(key, alert);
  }
  for (const alert of local.alerts) {
    const key = `${alert.type}:${alert.title.trim().toLowerCase()}`;
    if (!alertByKey.has(key)) {
      alertByKey.set(key, alert);
    }
  }

  const baseSettings = cloud.settings || local.settings;
  const resolvedName =
    displayName?.trim() ||
    (baseSettings.userName && baseSettings.userName !== 'Guest'
      ? baseSettings.userName
      : local.settings.userName !== 'Guest'
      ? local.settings.userName
      : userEmail.split('@')[0] || 'User');

  return {
    ...local,
    cloudUserId: cloud.userId,
    isSignedIn: true,
    isGuestMode: false,
    hasCompletedOnboarding: true,
    hasPendingCloudSync: false,
    lastSyncedAt: new Date().toISOString(),
    subscriptions: Array.from(subById.values()),
    members: Array.from(memberByKey.values()),
    alerts: Array.from(alertByKey.values()),
    settings: {
      ...baseSettings,
      userName: resolvedName,
      userInitials: computeInitials(resolvedName),
      userEmail: userEmail || baseSettings.userEmail,
      savedYtd: Math.max(baseSettings.savedYtd, local.settings.savedYtd),
      cancelledCountYtd: Math.max(baseSettings.cancelledCountYtd, local.settings.cancelledCountYtd),
      geminiApiKey: local.settings.geminiApiKey,
      aiFeaturesEnabled: local.settings.aiFeaturesEnabled,
    },
  };
}

// ---------------------------------------------------------------------------
// Cloud Write Operations (Auto-supports v2 and legacy schemas)
// ---------------------------------------------------------------------------

export async function syncUserSettings(
  userId: string,
  settings: AppSettings,
  hasCompletedOnboarding: boolean
): Promise<void> {
  if (!supabase) return;
  const schema = await resolveSchemaVariant();

  if (schema === 'v2') {
    const { error } = await supabase
      .from('user_settings')
      .upsert(toV2SettingsRecord(userId, settings, hasCompletedOnboarding), {
        onConflict: 'user_id',
      });
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('profiles')
    .upsert(toLegacyProfileRecord(userId, settings, hasCompletedOnboarding), {
      onConflict: 'user_id',
    });
  if (error) throw error;

  const workspaceId = await ensureLegacyWorkspaceId(userId, settings);
  if (settings.workspaceName) {
    await supabase
      .from('workspaces')
      .update({ name: settings.workspaceName, updated_at: new Date().toISOString() })
      .eq('id', workspaceId)
      .eq('owner_id', userId);
  }
}

export async function syncSubscriptionUpsert(userId: string, sub: Subscription): Promise<void> {
  if (!supabase) return;
  const schema = await resolveSchemaVariant();

  if (schema === 'v2') {
    const { error } = await supabase
      .from('subscriptions')
      .upsert(toV2SubscriptionRecord(userId, sub), { onConflict: 'user_id,id' });
    if (error) throw error;
    return;
  }

  const workspaceId = await ensureLegacyWorkspaceId(userId);
  const { error } = await supabase
    .from('subscriptions')
    .upsert(toLegacySubscriptionRecord(workspaceId, userId, sub), { onConflict: 'id' });
  if (error) throw error;
}

export async function syncSubscriptionsBatch(userId: string, subs: Subscription[]): Promise<void> {
  if (!supabase || subs.length === 0) return;
  const schema = await resolveSchemaVariant();

  if (schema === 'v2') {
    const { error } = await supabase
      .from('subscriptions')
      .upsert(
        subs.map((sub) => toV2SubscriptionRecord(userId, sub)),
        { onConflict: 'user_id,id' }
      );
    if (error) throw error;
    return;
  }

  const workspaceId = await ensureLegacyWorkspaceId(userId);
  const { error } = await supabase
    .from('subscriptions')
    .upsert(
      subs.map((sub) => toLegacySubscriptionRecord(workspaceId, userId, sub)),
      { onConflict: 'id' }
    );
  if (error) throw error;
}

export async function syncSubscriptionArchive(userId: string, subId: string): Promise<void> {
  if (!supabase) return;
  const schema = await resolveSchemaVariant();

  if (schema === 'v2') {
    const { error } = await supabase
      .from('subscriptions')
      .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('id', subId);
    if (error) throw error;
    return;
  }

  const workspaceId = await ensureLegacyWorkspaceId(userId);
  const { error } = await supabase
    .from('subscriptions')
    .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('id', subId);
  if (error) throw error;
}

export async function syncMemberUpsert(userId: string, member: HouseholdMember): Promise<void> {
  if (!supabase) return;
  const schema = await resolveSchemaVariant();

  if (schema === 'v2') {
    const { error } = await supabase
      .from('household_members')
      .upsert(toV2MemberRecord(userId, member), { onConflict: 'user_id,id' });
    if (error) throw error;
    return;
  }

  const workspaceId = await ensureLegacyWorkspaceId(userId);
  const { error } = await supabase
    .from('workspace_members')
    .upsert(toLegacyMemberRecord(workspaceId, member), { onConflict: 'workspace_id,email' });
  if (error) throw error;
}

export async function syncMembersBatch(userId: string, members: HouseholdMember[]): Promise<void> {
  if (!supabase || members.length === 0) return;
  const schema = await resolveSchemaVariant();

  if (schema === 'v2') {
    const { error } = await supabase
      .from('household_members')
      .upsert(
        members.map((m) => toV2MemberRecord(userId, m)),
        { onConflict: 'user_id,id' }
      );
    if (error) throw error;
    return;
  }

  const workspaceId = await ensureLegacyWorkspaceId(userId);
  const { error } = await supabase
    .from('workspace_members')
    .upsert(
      members.map((m) => toLegacyMemberRecord(workspaceId, m)),
      { onConflict: 'workspace_id,email' }
    );
  if (error) throw error;
}

export async function syncAlertsBatch(
  userId: string,
  alerts: AlertItem[],
  validSubIds?: Set<string>
): Promise<void> {
  if (!supabase || alerts.length === 0) return;
  const schema = await resolveSchemaVariant();

  if (schema === 'v2') {
    const { error } = await supabase
      .from('alerts')
      .upsert(
        alerts.map((a) => toV2AlertRecord(userId, a)),
        { onConflict: 'user_id,id' }
      );
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('alerts')
    .upsert(
      alerts.map((a) => toLegacyAlertRecord(userId, a, validSubIds)),
      { onConflict: 'id' }
    );
  if (error) throw error;
}

export async function pushFullStoreToCloud(
  userId: string,
  store: SubPulseStore,
  replaceExisting = false
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const schema = await resolveSchemaVariant();

  // 1. Always upsert user settings / profile first
  await syncUserSettings(userId, store.settings, store.hasCompletedOnboarding);

  const validSubIds = new Set(store.subscriptions.map((s) => s.id));

  if (schema === 'v2') {
    if (replaceExisting) {
      const [delSubs, delMembers, delAlerts] = await Promise.all([
        supabase.from('subscriptions').delete().eq('user_id', userId),
        supabase.from('household_members').delete().eq('user_id', userId),
        supabase.from('alerts').delete().eq('user_id', userId),
      ]);
      if (delSubs.error) throw delSubs.error;
      if (delMembers.error) throw delMembers.error;
      if (delAlerts.error) throw delAlerts.error;
    }

    await Promise.all([
      syncSubscriptionsBatch(userId, store.subscriptions),
      syncMembersBatch(userId, store.members),
      syncAlertsBatch(userId, store.alerts, validSubIds),
    ]);
    return;
  }

  // Legacy schema full push
  const workspaceId = await ensureLegacyWorkspaceId(userId, store.settings);

  if (replaceExisting) {
    const [delAlerts, delSubs] = await Promise.all([
      supabase.from('alerts').delete().eq('user_id', userId),
      supabase.from('subscriptions').delete().eq('workspace_id', workspaceId),
    ]);
    if (delAlerts.error) throw delAlerts.error;
    if (delSubs.error) throw delSubs.error;
    // Remove non-owner members on overwrite so owner RLS remains intact
    await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .neq('role', 'Owner');
  }

  // Upsert subscriptions BEFORE alerts so legacy FK alerts.subscription_id -> subscriptions.id resolves cleanly
  await syncSubscriptionsBatch(userId, store.subscriptions);
  await Promise.all([
    syncMembersBatch(userId, store.members),
    syncAlertsBatch(userId, store.alerts, validSubIds),
  ]);
}

// ---------------------------------------------------------------------------
// Cross-Device Realtime Subscription
// ---------------------------------------------------------------------------

export function subscribeToUserCloudChanges(userId: string, onChange: () => void): () => void {
  if (!supabase) return () => {};
  let debounceTimer: number | null = null;

  const scheduleRefresh = () => {
    if (debounceTimer) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      onChange();
    }, 600);
  };

  const schema = detectedSchema || 'v2';

  if (schema === 'v2') {
    const channel = supabase
      .channel(`subpulse-user-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subscriptions', filter: `user_id=eq.${userId}` },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'household_members', filter: `user_id=eq.${userId}` },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alerts', filter: `user_id=eq.${userId}` },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_settings', filter: `user_id=eq.${userId}` },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      supabase?.removeChannel(channel);
    };
  }

  const workspaceId = legacyWorkspaceCache.get(userId);
  const channel = supabase
    .channel(`subpulse-legacy-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'subscriptions',
        ...(workspaceId ? { filter: `workspace_id=eq.${workspaceId}` } : {}),
      },
      scheduleRefresh
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profiles', filter: `user_id=eq.${userId}` },
      scheduleRefresh
    )
    .subscribe();

  return () => {
    if (debounceTimer) window.clearTimeout(debounceTimer);
    supabase?.removeChannel(channel);
  };
}
