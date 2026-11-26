import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Shell } from './components/Shell';
import { SyncConflictModal } from './components/SyncConflictModal';
import { DEMO_STORE, INITIAL_STORE } from './data/seedData';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import {
  fetchCloudSnapshot,
  formatCloudError,
  hasLocalUserData,
  mergeLocalAndCloudStore,
  pushFullStoreToCloud,
  signOutCloud,
  subscribeToUserCloudChanges,
  syncAlertsBatch,
  syncMemberUpsert,
  syncSubscriptionArchive,
  syncSubscriptionUpsert,
  syncSubscriptionsBatch,
  syncUserSettings,
} from './lib/cloudSync';
import { clearSubPulseStore, loadSubPulseStore, saveSubPulseStore } from './lib/db';
import { computeInitials } from './lib/formatters';
import { supabase } from './lib/supabase';
import {
  AppSettings,
  AppView,
  CloudSnapshot,
  HouseholdMember,
  SubPulseStore,
  Subscription,
  SubscriptionStatus,
  SyncResolutionStrategy,
  SyncStatus,
} from './types/subpulse';
import { AnalyticsView } from './views/AnalyticsView';
import { DashboardView } from './views/DashboardView';
import { EditSubscriptionView } from './views/EditSubscriptionView';
import { HouseholdView } from './views/HouseholdView';
import { IntroView } from './views/IntroView';
import { NotificationsView } from './views/NotificationsView';
import { OnboardingView, SetupCompletionPayload } from './views/OnboardingView';
import { SavingsAuditView } from './views/SavingsAuditView';
import { SettingsView } from './views/SettingsView';
import { AuthScreenMode, SignInView } from './views/SignInView';
import { SubscriptionDetailView } from './views/SubscriptionDetailView';
import { SubscriptionsView } from './views/SubscriptionsView';
import { SystemStatesView } from './views/SystemStatesView';

interface PendingConflictState {
  userId: string;
  userEmail: string;
  displayName?: string;
  snapshot: CloudSnapshot;
}

export default function App() {
  const [store, setStore] = useState<SubPulseStore>(() => structuredClone(INITIAL_STORE));
  const storeRef = useRef<SubPulseStore>(store);
  storeRef.current = store;

  const [isHydrating, setIsHydrating] = useState(true);
  // Boot directly into Dashboard in Guest Mode (or restored cloud session)
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [previousView, setPreviousView] = useState<AppView>('dashboard');
  const [authScreenMode, setAuthScreenMode] = useState<AuthScreenMode>('signin');
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [plansFilter, setPlansFilter] = useState<SubscriptionStatus | 'all'>('all');

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingConflict, setPendingConflict] = useState<PendingConflictState | null>(null);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);

  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [undoAction, setUndoAction] = useState<(() => void) | null>(null);
  const snackbarTimerRef = useRef<number | null>(null);
  const lastAuthSyncUserRef = useRef<string | null>(null);

  const isOnline = useOnlineStatus();

  const showToast = useCallback((msg: string, onUndo?: () => void) => {
    if (snackbarTimerRef.current) {
      window.clearTimeout(snackbarTimerRef.current);
    }
    setSnackbarMessage(msg);
    setUndoAction(() => onUndo || null);
    snackbarTimerRef.current = window.setTimeout(() => {
      setSnackbarMessage(null);
      setUndoAction(null);
    }, 4500);
  }, []);

  const runCloudWrite = useCallback(
    async (task: () => Promise<void>) => {
      if (!navigator.onLine) {
        setSyncStatus('pending');
        setStore((prev) => ({ ...prev, hasPendingCloudSync: true }));
        return;
      }
      setSyncStatus('syncing');
      setSyncError(null);
      try {
        await task();
        const syncedAt = new Date().toISOString();
        setSyncStatus('synced');
        setStore((prev) => ({
          ...prev,
          lastSyncedAt: syncedAt,
          hasPendingCloudSync: false,
        }));
      } catch (err) {
        const message = formatCloudError(err);
        setSyncStatus('error');
        setSyncError(message);
        setStore((prev) => ({ ...prev, hasPendingCloudSync: true }));
        showToast(message);
      }
    },
    [showToast]
  );

  // Core post-auth reconciliation: auto-upload empty cloud, auto-load empty local, or prompt conflict modal
  const reconcileCloudSession = useCallback(
    async (
      userId: string,
      userEmail: string,
      displayName: string | undefined,
      options: { interactive: boolean; silent?: boolean }
    ) => {
      const localSnapshot = storeRef.current;
      const resolvedName =
        displayName?.trim() ||
        (localSnapshot.settings.userName && localSnapshot.settings.userName !== 'Guest'
          ? localSnapshot.settings.userName
          : userEmail.split('@')[0] || 'User');

      setSyncStatus('syncing');
      setSyncError(null);

      try {
        const cloud = await fetchCloudSnapshot(userId, localSnapshot);
        const localHasData = hasLocalUserData(localSnapshot);
        const sameAccountSession =
          !localSnapshot.isGuestMode && localSnapshot.cloudUserId === userId;

        // Case 1: Interactive sign-in from Guest (or switching accounts) where BOTH local and cloud have data
        if (options.interactive && !sameAccountSession && localHasData && cloud.hasRemoteData) {
          setStore((prev) => ({
            ...prev,
            isSignedIn: true,
            isGuestMode: false,
            cloudUserId: userId,
            settings: {
              ...prev.settings,
              userEmail: userEmail || prev.settings.userEmail,
              userName: resolvedName,
              userInitials: computeInitials(resolvedName),
            },
          }));
          setPendingConflict({
            userId,
            userEmail,
            displayName: resolvedName,
            snapshot: cloud,
          });
          setSyncStatus('pending');
          return;
        }

        // Case 2: Cloud account is empty and user has local data (or pending offline changes for same account) -> back up local to cloud
        if ((!cloud.hasRemoteData && localHasData) || (sameAccountSession && localSnapshot.hasPendingCloudSync)) {
          const toPush: SubPulseStore = {
            ...localSnapshot,
            isSignedIn: true,
            isGuestMode: false,
            cloudUserId: userId,
            hasCompletedOnboarding: true,
            hasPendingCloudSync: false,
            lastSyncedAt: new Date().toISOString(),
            settings: {
              ...(cloud.settings || localSnapshot.settings),
              ...localSnapshot.settings,
              userEmail: userEmail || localSnapshot.settings.userEmail,
              userName: resolvedName,
              userInitials: computeInitials(resolvedName),
              geminiApiKey: localSnapshot.settings.geminiApiKey,
              aiFeaturesEnabled: localSnapshot.settings.aiFeaturesEnabled,
            },
          };

          await pushFullStoreToCloud(userId, toPush, false);
          setStore(toPush);
          setSyncStatus('synced');
          if (!options.silent) {
            showToast(
              toPush.subscriptions.length > 0
                ? `Backed up ${toPush.subscriptions.length} ${
                    toPush.subscriptions.length === 1 ? 'subscription' : 'subscriptions'
                  } to ${userEmail}`
                : `Signed in as ${userEmail}`
            );
          }
          return;
        }

        // Case 3: Hydrate from cloud (either local is empty or refreshing existing session)
        const hydratedSettings: AppSettings = {
          ...(cloud.settings || localSnapshot.settings),
          userEmail: userEmail || cloud.settings?.userEmail || localSnapshot.settings.userEmail,
          userName:
            cloud.settings?.userName && cloud.settings.userName !== 'Guest'
              ? cloud.settings.userName
              : resolvedName,
          userInitials: computeInitials(
            cloud.settings?.userName && cloud.settings.userName !== 'Guest'
              ? cloud.settings.userName
              : resolvedName
          ),
          geminiApiKey: localSnapshot.settings.geminiApiKey,
          aiFeaturesEnabled: localSnapshot.settings.aiFeaturesEnabled,
        };

        // Ensure user_settings row exists for pre-existing Supabase auth users
        if (!cloud.hasSettingsRow) {
          await syncUserSettings(userId, hydratedSettings, true);
        }

        setStore((prev) => ({
          ...prev,
          cloudUserId: userId,
          isSignedIn: true,
          isGuestMode: false,
          hasCompletedOnboarding: cloud.hasCompletedOnboarding || prev.hasCompletedOnboarding,
          hasPendingCloudSync: false,
          lastSyncedAt: new Date().toISOString(),
          subscriptions: cloud.subscriptions,
          members: cloud.members,
          alerts: cloud.alerts,
          settings: hydratedSettings,
        }));
        setSyncStatus('synced');

        if (!options.silent) {
          showToast(
            cloud.subscriptions.length > 0
              ? `Synced ${cloud.subscriptions.length} ${
                  cloud.subscriptions.length === 1 ? 'subscription' : 'subscriptions'
                } from ${userEmail}`
              : `Signed in as ${userEmail}`
          );
        }
      } catch (err) {
        const message = formatCloudError(err);
        setSyncStatus('error');
        setSyncError(message);
        // Never lose local data if cloud sync fails; keep signed-in email metadata and mark pending
        setStore((prev) => ({
          ...prev,
          cloudUserId: userId,
          isSignedIn: true,
          isGuestMode: false,
          hasPendingCloudSync: true,
          settings: {
            ...prev.settings,
            userEmail: userEmail || prev.settings.userEmail,
            userName: resolvedName,
            userInitials: computeInitials(resolvedName),
          },
        }));
        if (!options.silent) {
          showToast(message);
        }
      }
    },
    [showToast]
  );

  // Hydrate from IndexedDB on mount + subscribe to Supabase Auth state changes
  useEffect(() => {
    let active = true;
    let authUnsubscribe: (() => void) | null = null;

    loadSubPulseStore().then(async (loaded) => {
      if (!active) return;

      // Normalize legacy stored state: if no cloudUserId, ensure Guest Mode is cleanly active
      const normalized: SubPulseStore = loaded.cloudUserId
        ? loaded
        : { ...loaded, isGuestMode: true, isSignedIn: false };

      setStore(normalized);
      storeRef.current = normalized;
      setIsHydrating(false);

      if (!supabase) {
        setSyncStatus('local');
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!active) return;

      const sessionUser = sessionData.session?.user;
      if (sessionUser) {
        lastAuthSyncUserRef.current = sessionUser.id;
        const metaName =
          typeof sessionUser.user_metadata?.full_name === 'string'
            ? sessionUser.user_metadata.full_name
            : undefined;
        void reconcileCloudSession(sessionUser.id, sessionUser.email || '', metaName, {
          interactive: false,
          silent: true,
        });
      } else if (normalized.cloudUserId) {
        // Stored session expired: fall back gracefully to Guest Mode without losing local IndexedDB data
        setStore((prev) => ({
          ...prev,
          isSignedIn: false,
          isGuestMode: true,
          cloudUserId: undefined,
        }));
        setSyncStatus('local');
      } else {
        setSyncStatus('local');
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (!active) return;

        if (event === 'PASSWORD_RECOVERY') {
          setAuthScreenMode('recovery');
          setCurrentView('signin');
          showToast('Reset link verified · Choose a new password');
          return;
        }

        if (event === 'SIGNED_OUT') {
          lastAuthSyncUserRef.current = null;
          setPendingConflict(null);
          setSyncStatus('local');
          setSyncError(null);
          setStore((prev) => ({
            ...prev,
            isSignedIn: false,
            isGuestMode: true,
            cloudUserId: undefined,
            hasPendingCloudSync: false,
          }));
          return;
        }

        if (event === 'SIGNED_IN' && session?.user) {
          // Avoid duplicate reconciliation if SignInView's onAuthSuccess already triggered it
          if (lastAuthSyncUserRef.current === session.user.id) return;
          lastAuthSyncUserRef.current = session.user.id;
          const metaName =
            typeof session.user.user_metadata?.full_name === 'string'
              ? session.user.user_metadata.full_name
              : undefined;
          void reconcileCloudSession(session.user.id, session.user.email || '', metaName, {
            interactive: true,
          });
        }
      });

      authUnsubscribe = () => subscription.unsubscribe();
    });

    return () => {
      active = false;
      if (authUnsubscribe) authUnsubscribe();
    };
  }, [reconcileCloudSession, showToast]);

  // Retry pending cloud sync automatically when connectivity returns
  useEffect(() => {
    if (
      isOnline &&
      !isHydrating &&
      store.cloudUserId &&
      !store.isGuestMode &&
      store.hasPendingCloudSync &&
      !pendingConflict
    ) {
      void runCloudWrite(() => pushFullStoreToCloud(store.cloudUserId!, storeRef.current, false));
    }
  }, [
    isOnline,
    isHydrating,
    store.cloudUserId,
    store.isGuestMode,
    store.hasPendingCloudSync,
    pendingConflict,
    runCloudWrite,
  ]);

  // Subscribe to Supabase Realtime for cross-device sync (user-scoped across all 4 tables)
  useEffect(() => {
    if (!store.cloudUserId || store.isGuestMode || !isOnline || pendingConflict) return;
    const unsubscribe = subscribeToUserCloudChanges(store.cloudUserId, () => {
      const latest = storeRef.current;
      if (latest.cloudUserId && !latest.isGuestMode && !latest.hasPendingCloudSync) {
        void reconcileCloudSession(
          latest.cloudUserId,
          latest.settings.userEmail,
          latest.settings.userName,
          { interactive: false, silent: true }
        );
      }
    });
    return unsubscribe;
  }, [store.cloudUserId, store.isGuestMode, isOnline, pendingConflict, reconcileCloudSession]);

  // Persist to IndexedDB whenever store changes after initial hydration
  useEffect(() => {
    if (!isHydrating) {
      void saveSubPulseStore(store);
    }
  }, [store, isHydrating]);

  // Synchronize theme class on <html>
  const effectiveIsDark = useMemo(() => {
    if (store.settings.theme === 'dark') return true;
    if (store.settings.theme === 'light') return false;
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }, [store.settings.theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (effectiveIsDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [effectiveIsDark]);

  const navigate = useCallback(
    (view: AppView) => {
      setPreviousView(currentView);
      setCurrentView(view);
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    },
    [currentView]
  );

  const openSignIn = useCallback(
    (mode: AuthScreenMode = 'signin') => {
      setAuthScreenMode(mode);
      navigate('signin');
    },
    [navigate]
  );

  const handleResolveConflict = useCallback(
    async (strategy: SyncResolutionStrategy) => {
      if (!pendingConflict) return;
      setIsResolvingConflict(true);
      setSyncError(null);

      const { userId, userEmail, displayName, snapshot } = pendingConflict;
      const local = storeRef.current;

      try {
        if (strategy === 'merge') {
          const merged = mergeLocalAndCloudStore(local, snapshot, userEmail, displayName);
          await pushFullStoreToCloud(userId, merged, false);
          setStore(merged);
          setSyncStatus('synced');
          setPendingConflict(null);
          showToast(`Merged and backed up ${merged.subscriptions.length} subscriptions`);
        } else if (strategy === 'keep_cloud') {
          const resolvedName =
            snapshot.settings?.userName && snapshot.settings.userName !== 'Guest'
              ? snapshot.settings.userName
              : displayName || userEmail.split('@')[0] || 'User';

          const nextStore: SubPulseStore = {
            ...local,
            cloudUserId: userId,
            isSignedIn: true,
            isGuestMode: false,
            hasCompletedOnboarding: true,
            hasPendingCloudSync: false,
            lastSyncedAt: new Date().toISOString(),
            subscriptions: snapshot.subscriptions,
            members: snapshot.members,
            alerts: snapshot.alerts,
            settings: {
              ...(snapshot.settings || local.settings),
              userEmail: userEmail || snapshot.settings?.userEmail || local.settings.userEmail,
              userName: resolvedName,
              userInitials: computeInitials(resolvedName),
              geminiApiKey: local.settings.geminiApiKey,
              aiFeaturesEnabled: local.settings.aiFeaturesEnabled,
            },
          };
          setStore(nextStore);
          setSyncStatus('synced');
          setPendingConflict(null);
          showToast(`Restored ${snapshot.subscriptions.length} subscriptions from cloud`);
        } else {
          // overwrite_cloud
          const resolvedName =
            displayName ||
            (local.settings.userName !== 'Guest'
              ? local.settings.userName
              : userEmail.split('@')[0] || 'User');
          const nextStore: SubPulseStore = {
            ...local,
            cloudUserId: userId,
            isSignedIn: true,
            isGuestMode: false,
            hasCompletedOnboarding: true,
            hasPendingCloudSync: false,
            lastSyncedAt: new Date().toISOString(),
            settings: {
              ...local.settings,
              userEmail,
              userName: resolvedName,
              userInitials: computeInitials(resolvedName),
            },
          };
          await pushFullStoreToCloud(userId, nextStore, true);
          setStore(nextStore);
          setSyncStatus('synced');
          setPendingConflict(null);
          showToast(`Replaced cloud backup with ${nextStore.subscriptions.length} local subscriptions`);
        }
      } catch (err) {
        const message = formatCloudError(err);
        setSyncError(message);
        setSyncStatus('error');
      } finally {
        setIsResolvingConflict(false);
      }
    },
    [pendingConflict, showToast]
  );

  const handleSelectSubscription = useCallback(
    (id: string) => {
      setSelectedSubId(id);
      navigate('detail');
    },
    [navigate]
  );

  const handleAddNew = useCallback(() => {
    setEditingSubId(null);
    navigate('edit');
  }, [navigate]);

  const handleEditSub = useCallback(
    (id: string) => {
      setEditingSubId(id);
      navigate('edit');
    },
    [navigate]
  );

  const handleSaveSubscription = useCallback(
    (sub: Subscription, isNew: boolean) => {
      const cloudUserId = !storeRef.current.isGuestMode ? storeRef.current.cloudUserId : undefined;
      setStore((prev) => ({
        ...prev,
        subscriptions: isNew
          ? [sub, ...prev.subscriptions]
          : prev.subscriptions.map((s) => (s.id === sub.id ? sub : s)),
      }));
      if (cloudUserId) {
        void runCloudWrite(() => syncSubscriptionUpsert(cloudUserId, sub));
      }
      setSelectedSubId(sub.id);
      setCurrentView('detail');
      showToast(isNew ? `Added "${sub.name}"` : `Updated "${sub.name}"`);
    },
    [runCloudWrite, showToast]
  );

  const handleTogglePause = useCallback(
    (id: string) => {
      const target = store.subscriptions.find((s) => s.id === id);
      if (!target) return;
      const previousStatus = target.status;
      const nextStatus: SubscriptionStatus =
        previousStatus === 'paused' || previousStatus === 'cancelled' ? 'active' : 'paused';
      const updated = { ...target, status: nextStatus };
      const cloudUserId = !storeRef.current.isGuestMode ? storeRef.current.cloudUserId : undefined;

      setStore((prev) => ({
        ...prev,
        subscriptions: prev.subscriptions.map((s) => (s.id === id ? updated : s)),
      }));
      if (cloudUserId) {
        void runCloudWrite(() => syncSubscriptionUpsert(cloudUserId, updated));
      }

      showToast(
        nextStatus === 'paused' ? `Paused "${target.name}"` : `Resumed "${target.name}"`,
        () => {
          const reverted = { ...target, status: previousStatus };
          setStore((prev) => ({
            ...prev,
            subscriptions: prev.subscriptions.map((s) => (s.id === id ? reverted : s)),
          }));
          if (cloudUserId) {
            void runCloudWrite(() => syncSubscriptionUpsert(cloudUserId, reverted));
          }
        }
      );
    },
    [store.subscriptions, runCloudWrite, showToast]
  );

  const handleCancelPlan = useCallback(
    (id: string) => {
      const target = store.subscriptions.find((s) => s.id === id);
      if (!target) return;
      const previousStatus = target.status;
      const annualSaved = target.cycle === 'yearly' ? target.price : target.price * 12;
      const updated: Subscription = { ...target, status: 'cancelled' };
      const cloudUserId = !storeRef.current.isGuestMode ? storeRef.current.cloudUserId : undefined;

      const nextSettings: AppSettings = {
        ...storeRef.current.settings,
        savedYtd: Number((storeRef.current.settings.savedYtd + annualSaved).toFixed(2)),
        cancelledCountYtd: storeRef.current.settings.cancelledCountYtd + 1,
      };

      setStore((prev) => ({
        ...prev,
        subscriptions: prev.subscriptions.map((s) => (s.id === id ? updated : s)),
        settings: nextSettings,
      }));

      if (cloudUserId) {
        void runCloudWrite(async () => {
          await Promise.all([
            syncSubscriptionUpsert(cloudUserId, updated),
            syncUserSettings(cloudUserId, nextSettings, storeRef.current.hasCompletedOnboarding),
          ]);
        });
      }

      showToast(`Cancelled "${target.name}"`, () => {
        const revertedSub = { ...target, status: previousStatus };
        const revertedSettings: AppSettings = {
          ...storeRef.current.settings,
          savedYtd: Math.max(0, Number((storeRef.current.settings.savedYtd - annualSaved).toFixed(2))),
          cancelledCountYtd: Math.max(0, storeRef.current.settings.cancelledCountYtd - 1),
        };
        setStore((prev) => ({
          ...prev,
          subscriptions: prev.subscriptions.map((s) => (s.id === id ? revertedSub : s)),
          settings: revertedSettings,
        }));
        if (cloudUserId) {
          void runCloudWrite(async () => {
            await Promise.all([
              syncSubscriptionUpsert(cloudUserId, revertedSub),
              syncUserSettings(cloudUserId, revertedSettings, storeRef.current.hasCompletedOnboarding),
            ]);
          });
        }
      });
    },
    [store.subscriptions, runCloudWrite, showToast]
  );

  const handleArchiveSub = useCallback(
    (id: string) => {
      const target = store.subscriptions.find((s) => s.id === id);
      if (!target) return;
      const cloudUserId = !storeRef.current.isGuestMode ? storeRef.current.cloudUserId : undefined;

      setStore((prev) => ({
        ...prev,
        subscriptions: prev.subscriptions.filter((s) => s.id !== id),
      }));
      if (cloudUserId) {
        void runCloudWrite(() => syncSubscriptionArchive(cloudUserId, id));
      }
      setCurrentView('subscriptions');

      showToast(`Archived "${target.name}"`, () => {
        setStore((prev) => ({
          ...prev,
          subscriptions: [target, ...prev.subscriptions],
        }));
        if (cloudUserId) {
          void runCloudWrite(() => syncSubscriptionUpsert(cloudUserId, target));
        }
      });
    },
    [store.subscriptions, runCloudWrite, showToast]
  );

  const handleImportSubscriptions = useCallback(
    (items: Partial<Subscription>[]) => {
      const created: Subscription[] = items.map((item, idx) => ({
        id:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `sub-imp-${Date.now()}-${idx}`,
        name: item.name || 'Imported Plan',
        initials: computeInitials(item.name || 'Imported Plan'),
        avatarBg: 'bg-light-primary-container dark:bg-dark-primary-container text-light-on-primary',
        category: item.category || 'Productivity & AI',
        price: item.price || 9.99,
        currency: store.settings.currency,
        cycle: item.cycle || 'monthly',
        status: item.status || 'active',
        nextBillingDate: item.nextBillingDate || '2026-12-05',
        reminderDays: 3,
        startedOn: '2026-11-26',
        paymentMethod: 'Visa ••4821',
        isShared: false,
        splitCount: 1,
        sharedMembers: [store.settings.userName || 'You'],
        manageUrl: 'https://',
        notes: item.notes || 'Imported from CSV',
      }));

      const cloudUserId = !storeRef.current.isGuestMode ? storeRef.current.cloudUserId : undefined;
      setStore((prev) => ({
        ...prev,
        subscriptions: [...created, ...prev.subscriptions],
      }));
      if (cloudUserId) {
        void runCloudWrite(() => syncSubscriptionsBatch(cloudUserId, created));
      }
      showToast(`Imported ${created.length} ${created.length === 1 ? 'subscription' : 'subscriptions'}`);
    },
    [store.settings.currency, store.settings.userName, runCloudWrite, showToast]
  );

  const handleUpdateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      const nextSettings = { ...storeRef.current.settings, ...patch };
      const cloudUserId = !storeRef.current.isGuestMode ? storeRef.current.cloudUserId : undefined;
      setStore((prev) => ({
        ...prev,
        settings: nextSettings,
      }));
      if (cloudUserId) {
        void runCloudWrite(() =>
          syncUserSettings(cloudUserId, nextSettings, storeRef.current.hasCompletedOnboarding)
        );
      }
    },
    [runCloudWrite]
  );

  const handleToggleTheme = useCallback(() => {
    handleUpdateSettings({ theme: effectiveIsDark ? 'light' : 'dark' });
  }, [effectiveIsDark, handleUpdateSettings]);

  const handleInviteMember = useCallback(
    (member: HouseholdMember) => {
      const cloudUserId = !storeRef.current.isGuestMode ? storeRef.current.cloudUserId : undefined;
      setStore((prev) => ({
        ...prev,
        members: [...prev.members, member],
      }));
      if (cloudUserId) {
        void runCloudWrite(() => syncMemberUpsert(cloudUserId, member));
      }
    },
    [runCloudWrite]
  );

  const handleToggleSettleMember = useCallback(
    (id: string) => {
      const existing = storeRef.current.members.find((m) => m.id === id);
      if (!existing) return;
      const updated = { ...existing, settledThisMonth: !existing.settledThisMonth };
      const cloudUserId = !storeRef.current.isGuestMode ? storeRef.current.cloudUserId : undefined;
      setStore((prev) => ({
        ...prev,
        members: prev.members.map((m) => (m.id === id ? updated : m)),
      }));
      if (cloudUserId) {
        void runCloudWrite(() => syncMemberUpsert(cloudUserId, updated));
      }
    },
    [runCloudWrite]
  );

  const handleMarkAllAlertsRead = useCallback(() => {
    const updatedAlerts = storeRef.current.alerts.map((a) => ({ ...a, read: true }));
    const cloudUserId = !storeRef.current.isGuestMode ? storeRef.current.cloudUserId : undefined;
    setStore((prev) => ({
      ...prev,
      alerts: updatedAlerts,
    }));
    if (cloudUserId && updatedAlerts.length > 0) {
      void runCloudWrite(() => syncAlertsBatch(cloudUserId, updatedAlerts));
    }
    showToast('All alerts marked as read');
  }, [runCloudWrite, showToast]);

  const handleSignOut = useCallback(
    async (clearLocalData: boolean) => {
      try {
        await signOutCloud();
      } catch {
        // Always complete local sign-out even if offline
      }
      lastAuthSyncUserRef.current = null;
      setPendingConflict(null);
      setSyncStatus('local');
      setSyncError(null);

      if (clearLocalData) {
        await clearSubPulseStore();
        setStore(structuredClone(INITIAL_STORE));
        setSelectedSubId(null);
        setEditingSubId(null);
        setCurrentView('dashboard');
        showToast('Signed out and cleared local device data');
      } else {
        setStore((prev) => ({
          ...prev,
          isSignedIn: false,
          isGuestMode: true,
          cloudUserId: undefined,
          hasPendingCloudSync: false,
          backupBannerDismissed: false,
        }));
        setCurrentView('dashboard');
        showToast('Signed out · Continuing in Guest Mode with local copy');
      }
    },
    [showToast]
  );

  const handleResetAllData = useCallback(async () => {
    try {
      await signOutCloud();
    } catch {
      // ignore if offline
    }
    lastAuthSyncUserRef.current = null;
    setPendingConflict(null);
    setSyncStatus('local');
    setSyncError(null);
    await clearSubPulseStore();
    setStore(structuredClone(INITIAL_STORE));
    setSelectedSubId(null);
    setEditingSubId(null);
    setCurrentView('dashboard');
    showToast('Device reset · Started fresh in Guest Mode');
  }, [showToast]);

  const handleLoadSampleDemo = useCallback(() => {
    const cloudUserId = !storeRef.current.isGuestMode ? storeRef.current.cloudUserId : undefined;
    const demo = structuredClone(DEMO_STORE);
    if (cloudUserId) {
      demo.isSignedIn = true;
      demo.isGuestMode = false;
      demo.cloudUserId = cloudUserId;
      demo.settings.userEmail = storeRef.current.settings.userEmail;
      demo.settings.geminiApiKey = storeRef.current.settings.geminiApiKey;
      demo.settings.aiFeaturesEnabled = storeRef.current.settings.aiFeaturesEnabled;
      setStore(demo);
      void runCloudWrite(() => pushFullStoreToCloud(cloudUserId, demo, false));
    } else {
      setStore(demo);
    }
    setCurrentView('dashboard');
    showToast('Loaded sample demo workspace');
  }, [runCloudWrite, showToast]);

  const handleCompleteSetup = useCallback(
    (payload: SetupCompletionPayload) => {
      const prev = storeRef.current;
      const existingNames = new Set(prev.subscriptions.map((s) => s.name.toLowerCase()));
      const additions: Subscription[] = [];
      payload.selectedServices.forEach((svc, idx) => {
        const matched = Array.from(existingNames).some((n) => n.includes(svc.name.toLowerCase()));
        if (!matched) {
          additions.push({
            id: `sub-setup-${Date.now()}-${idx}`,
            name: svc.name,
            initials: computeInitials(svc.name),
            avatarBg: 'bg-light-primary-container dark:bg-dark-primary-container text-light-on-primary',
            category: svc.category,
            price: svc.price,
            currency: payload.currency,
            cycle: 'monthly',
            status: 'active',
            nextBillingDate: '2026-12-05',
            reminderDays: 3,
            startedOn: '2026-11-26',
            paymentMethod: 'Apple Pay · ••4821',
            isShared: false,
            splitCount: 1,
            sharedMembers: [payload.userName],
            manageUrl: 'https://',
            notes: 'Added during initial setup',
          });
        }
      });

      const nextSettings: AppSettings = {
        ...prev.settings,
        userName: payload.userName,
        userInitials: computeInitials(payload.userName),
        workspaceName: payload.workspaceName,
        currency: payload.currency,
        country: payload.country,
        timezone: payload.timezone,
        monthlyBudgetCap: payload.monthlyBudgetCap,
        webPushEnabled: payload.webPushEnabled,
        emailFallbackEnabled: payload.emailFallbackEnabled,
      };

      const nextStore: SubPulseStore = {
        ...prev,
        hasCompletedOnboarding: true,
        settings: nextSettings,
        subscriptions: [...additions, ...prev.subscriptions],
      };

      setStore(nextStore);

      const cloudUserId = !prev.isGuestMode ? prev.cloudUserId : undefined;
      if (cloudUserId) {
        void runCloudWrite(async () => {
          await Promise.all([
            syncUserSettings(cloudUserId, nextSettings, true),
            syncSubscriptionsBatch(cloudUserId, additions),
          ]);
        });
      }

      setCurrentView('dashboard');
      showToast(
        payload.selectedServices.length > 0
          ? `Setup saved with ${payload.selectedServices.length} ${
              payload.selectedServices.length === 1 ? 'service' : 'services'
            }`
          : 'Setup preferences saved'
      );
    },
    [runCloudWrite, showToast]
  );

  const handleSyncNow = useCallback(() => {
    const latest = storeRef.current;
    if (!latest.cloudUserId || latest.isGuestMode) {
      openSignIn('signin');
      return;
    }
    if (latest.hasPendingCloudSync) {
      void runCloudWrite(() => pushFullStoreToCloud(latest.cloudUserId!, latest, false));
    } else {
      void reconcileCloudSession(
        latest.cloudUserId,
        latest.settings.userEmail,
        latest.settings.userName,
        { interactive: false, silent: false }
      );
    }
  }, [openSignIn, reconcileCloudSession, runCloudWrite]);

  const unreadAlertsCount = useMemo(
    () => store.alerts.filter((a) => !a.read).length,
    [store.alerts]
  );

  // Full-screen standalone flows (Intro, Setup, Sign In)
  if (currentView === 'intro') {
    return (
      <IntroView
        onStartSetup={() => setCurrentView('setup')}
        onSignIn={() => openSignIn('signin')}
        onExploreDemo={handleLoadSampleDemo}
      />
    );
  }

  if (currentView === 'signin') {
    return (
      <>
        <SignInView
          defaultEmail={store.settings.userEmail}
          defaultName={store.settings.userName === 'Guest' ? '' : store.settings.userName}
          initialMode={authScreenMode}
          localSubscriptionCount={store.subscriptions.length}
          localMemberCount={store.members.length}
          onAuthSuccess={(email, userId, fullName) => {
            lastAuthSyncUserRef.current = userId;
            setCurrentView('dashboard');
            void reconcileCloudSession(userId, email, fullName, { interactive: true });
          }}
          onContinueAsGuest={() => {
            setCurrentView('dashboard');
          }}
          onPasswordUpdated={() => {
            setCurrentView('dashboard');
            showToast('Password updated successfully');
          }}
        />
        {pendingConflict && (
          <SyncConflictModal
            userEmail={pendingConflict.userEmail}
            localCounts={{
              subscriptions: store.subscriptions.length,
              members: store.members.length,
              alerts: store.alerts.length,
            }}
            cloudSnapshot={pendingConflict.snapshot}
            isResolving={isResolvingConflict}
            errorMessage={syncError}
            onResolve={handleResolveConflict}
          />
        )}
      </>
    );
  }

  if (currentView === 'setup' || currentView === 'onboarding') {
    return (
      <OnboardingView
        initialCurrency={store.settings.currency}
        initialCountry={store.settings.country}
        initialBudgetCap={store.settings.monthlyBudgetCap}
        initialWorkspaceName={store.settings.workspaceName}
        initialUserName={store.settings.userName === 'Guest' ? '' : store.settings.userName}
        onBack={() => setCurrentView(previousView === 'settings' ? 'settings' : 'dashboard')}
        onSkipToDemo={handleLoadSampleDemo}
        onCompleteSetup={handleCompleteSetup}
      />
    );
  }

  const selectedSub = store.subscriptions.find((s) => s.id === selectedSubId) || store.subscriptions[0];
  const editingSub = editingSubId ? store.subscriptions.find((s) => s.id === editingSubId) : undefined;

  return (
    <>
      <Shell
        currentView={currentView}
        onNavigate={navigate}
        onAddNew={handleAddNew}
        onOpenSignIn={() => openSignIn('signin')}
        settings={store.settings}
        isGuestMode={store.isGuestMode}
        syncStatus={syncStatus}
        unreadAlertsCount={unreadAlertsCount}
        isOffline={!isOnline}
        onRetryConnection={() => {
          if (navigator.onLine) {
            if (!store.isGuestMode && store.cloudUserId) {
              handleSyncNow();
            } else {
              showToast('Back online');
            }
          } else {
            showToast('Still offline · Changes saved locally');
          }
        }}
        snackbarMessage={snackbarMessage}
        onUndo={
          undoAction
            ? () => {
                undoAction();
                setSnackbarMessage(null);
                setUndoAction(null);
              }
            : null
        }
        onDismissSnackbar={() => {
          setSnackbarMessage(null);
          setUndoAction(null);
        }}
      >
        {currentView === 'dashboard' && (
          <DashboardView
            subscriptions={store.subscriptions}
            memberCount={store.members.length}
            settings={store.settings}
            isDark={effectiveIsDark}
            isGuestMode={store.isGuestMode}
            backupBannerDismissed={store.backupBannerDismissed}
            unreadAlertsCount={unreadAlertsCount}
            isLoading={isHydrating}
            onToggleTheme={handleToggleTheme}
            onNavigate={navigate}
            onOpenSignIn={() => openSignIn('signin')}
            onDismissBackupBanner={() =>
              setStore((prev) => ({ ...prev, backupBannerDismissed: true }))
            }
            onLoadDemo={handleLoadSampleDemo}
            onFilterPlans={(status) => {
              setPlansFilter(status);
              navigate('subscriptions');
            }}
            onSelectSubscription={handleSelectSubscription}
            onAddNew={handleAddNew}
            onShowToast={(m) => showToast(m)}
          />
        )}

        {currentView === 'subscriptions' && (
          <SubscriptionsView
            subscriptions={store.subscriptions}
            settings={store.settings}
            initialFilter={plansFilter}
            onFilterChange={setPlansFilter}
            onSelectSubscription={handleSelectSubscription}
            onAddNew={handleAddNew}
            onImportSubscriptions={handleImportSubscriptions}
          />
        )}

        {currentView === 'detail' && selectedSub && (
          <SubscriptionDetailView
            subscription={selectedSub}
            onBack={() =>
              navigate(
                previousView === 'edit'
                  ? 'subscriptions'
                  : previousView === 'detail'
                  ? 'dashboard'
                  : previousView
              )
            }
            onEdit={handleEditSub}
            onTogglePause={handleTogglePause}
            onCancelPlan={handleCancelPlan}
          />
        )}

        {currentView === 'edit' && (
          <EditSubscriptionView
            existing={editingSub}
            defaultCurrency={store.settings.currency}
            onCancel={() => navigate(editingSub ? 'detail' : 'dashboard')}
            onSave={handleSaveSubscription}
            onArchive={handleArchiveSub}
          />
        )}

        {currentView === 'analytics' && (
          <AnalyticsView
            subscriptions={store.subscriptions}
            settings={store.settings}
            onNavigate={navigate}
            onUpdateMonthlyCap={(cap) => handleUpdateSettings({ monthlyBudgetCap: cap })}
            onShowToast={(m) => showToast(m)}
          />
        )}

        {currentView === 'savings' && (
          <SavingsAuditView
            subscriptions={store.subscriptions}
            settings={store.settings}
            onBack={() => navigate('analytics')}
            onOpenSettings={() => navigate('settings')}
            onSelectSubscription={handleSelectSubscription}
            onUpdateTrimGoal={(goal) => handleUpdateSettings({ annualTrimGoal: goal })}
            onShowToast={(m) => showToast(m)}
          />
        )}

        {currentView === 'household' && (
          <HouseholdView
            subscriptions={store.subscriptions}
            members={store.members}
            settings={store.settings}
            onBack={() => navigate('settings')}
            onSelectSubscription={handleSelectSubscription}
            onInviteMember={handleInviteMember}
            onToggleSettleMember={handleToggleSettleMember}
            onShowToast={(m) => showToast(m)}
          />
        )}

        {currentView === 'notifications' && (
          <NotificationsView
            alerts={store.alerts}
            subscriptions={store.subscriptions}
            settings={store.settings}
            onBack={() => navigate('dashboard')}
            onMarkAllRead={handleMarkAllAlertsRead}
            onSelectSubscription={handleSelectSubscription}
            onToggleSetting={(key, val) => handleUpdateSettings({ [key]: val })}
            onShowToast={(m) => showToast(m)}
          />
        )}

        {currentView === 'settings' && (
          <SettingsView
            settings={store.settings}
            subscriptions={store.subscriptions}
            memberCount={store.members.length}
            isGuestMode={store.isGuestMode}
            syncStatus={syncStatus}
            syncError={syncError}
            lastSyncedAt={store.lastSyncedAt}
            onOpenSignIn={(mode) => openSignIn(mode || 'signin')}
            onSyncNow={handleSyncNow}
            onNavigate={navigate}
            onUpdateSettings={handleUpdateSettings}
            onLogOut={handleSignOut}
            onResetAllData={handleResetAllData}
            onShowToast={(m) => showToast(m)}
          />
        )}

        {currentView === 'states' && (
          <SystemStatesView
            onBack={() => navigate('settings')}
            onAddNew={handleAddNew}
            onShowToast={(m) => showToast(m)}
          />
        )}
      </Shell>

      {pendingConflict && (
        <SyncConflictModal
          userEmail={pendingConflict.userEmail}
          localCounts={{
            subscriptions: store.subscriptions.length,
            members: store.members.length,
            alerts: store.alerts.length,
          }}
          cloudSnapshot={pendingConflict.snapshot}
          isResolving={isResolvingConflict}
          errorMessage={syncError}
          onResolve={handleResolveConflict}
        />
      )}
    </>
  );
}
