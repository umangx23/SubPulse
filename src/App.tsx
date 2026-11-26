import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Shell } from './components/Shell';
import { DEMO_STORE, INITIAL_STORE } from './data/seedData';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { clearSubPulseStore, loadSubPulseStore, saveSubPulseStore } from './lib/db';
import {
  fetchCloudState,
  registerCurrentDevice,
  signOutCloud,
  subscribeToWorkspaceChanges,
  syncLocalSubscriptionsToCloud,
  syncProfileSettings,
  syncSubscriptionArchive,
  syncSubscriptionUpsert,
} from './lib/cloudSync';
import { computeInitials } from './lib/formatters';
import { supabase } from './lib/supabase';
import {
  AppSettings,
  AppView,
  HouseholdMember,
  SubPulseStore,
  Subscription,
  SubscriptionStatus,
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
import { SignInView } from './views/SignInView';
import { SplashView } from './views/SplashView';
import { SubscriptionDetailView } from './views/SubscriptionDetailView';
import { SubscriptionsView } from './views/SubscriptionsView';
import { SystemStatesView } from './views/SystemStatesView';

export default function App() {
  const [store, setStore] = useState<SubPulseStore>(() => structuredClone(INITIAL_STORE));
  const [isHydrating, setIsHydrating] = useState(true);
  const [currentView, setCurrentView] = useState<AppView>('splash');
  const [previousView, setPreviousView] = useState<AppView>('dashboard');
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [plansFilter, setPlansFilter] = useState<SubscriptionStatus | 'all'>('all');

  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [undoAction, setUndoAction] = useState<(() => void) | null>(null);
  const snackbarTimerRef = useRef<number | null>(null);

  const isOnline = useOnlineStatus();

  const hydrateCloudForUser = useCallback(async (userId: string) => {
    await registerCurrentDevice(userId);
    setStore((prev) => {
      void fetchCloudState(userId, prev).then(async (cloud) => {
        if (!cloud) return;
        const shouldUploadLocal =
          cloud.workspaceId &&
          (cloud.subscriptions?.length ?? 0) === 0 &&
          prev.subscriptions.length > 0;

        if (shouldUploadLocal && cloud.workspaceId) {
          await syncLocalSubscriptionsToCloud(cloud.workspaceId, userId, prev.subscriptions);
          await syncProfileSettings(userId, prev.settings, prev.hasCompletedOnboarding);
        }

        setStore((latest) => ({
          ...latest,
          ...cloud,
          subscriptions: shouldUploadLocal ? latest.subscriptions : (cloud.subscriptions ?? latest.subscriptions),
          settings: {
            ...cloud.settings!,
            geminiApiKey: latest.settings.geminiApiKey, // keep BYOK strictly local
            aiFeaturesEnabled: latest.settings.aiFeaturesEnabled,
          },
        }));
      });
      return { ...prev, cloudUserId: userId, isSignedIn: true, isGuestMode: false };
    });
  }, []);

  // Hydrate from IndexedDB on startup + restore Supabase session if present
  useEffect(() => {
    let active = true;
    loadSubPulseStore().then((loaded) => {
      if (!active) return;
      setStore(loaded);
      setIsHydrating(false);

      if (supabase) {
        supabase.auth.getSession().then(({ data }) => {
          if (active && data.session?.user) {
            void hydrateCloudForUser(data.session.user.id);
          }
        });
      }
    });
    return () => {
      active = false;
    };
  }, [hydrateCloudForUser]);

  // Subscribe to Supabase Realtime for cross-device sync
  useEffect(() => {
    if (!store.workspaceId || !store.cloudUserId || !isOnline) return;
    const unsubscribe = subscribeToWorkspaceChanges(store.workspaceId, () => {
      if (store.cloudUserId) {
        void hydrateCloudForUser(store.cloudUserId);
      }
    });
    return unsubscribe;
  }, [store.workspaceId, store.cloudUserId, isOnline, hydrateCloudForUser]);

  // Persist to IndexedDB whenever store changes after initial hydration
  useEffect(() => {
    if (!isHydrating) {
      saveSubPulseStore(store);
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

  const navigate = useCallback(
    (view: AppView) => {
      setPreviousView(currentView);
      setCurrentView(view);
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    },
    [currentView]
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
      setStore((prev) => {
        const nextSubs = isNew
          ? [sub, ...prev.subscriptions]
          : prev.subscriptions.map((s) => (s.id === sub.id ? sub : s));
        if (prev.workspaceId && prev.cloudUserId) {
          void syncSubscriptionUpsert(prev.workspaceId, prev.cloudUserId, sub);
        }
        return { ...prev, subscriptions: nextSubs };
      });
      setSelectedSubId(sub.id);
      setCurrentView('detail');
      showToast(isNew ? `Added "${sub.name}"` : `Updated "${sub.name}"`);
    },
    [showToast]
  );

  const handleTogglePause = useCallback(
    (id: string) => {
      const target = store.subscriptions.find((s) => s.id === id);
      if (!target) return;
      const previousStatus = target.status;
      const nextStatus: SubscriptionStatus =
        previousStatus === 'paused' || previousStatus === 'cancelled' ? 'active' : 'paused';

      setStore((prev) => {
        const updated = { ...target, status: nextStatus };
        if (prev.workspaceId && prev.cloudUserId) {
          void syncSubscriptionUpsert(prev.workspaceId, prev.cloudUserId, updated);
        }
        return {
          ...prev,
          subscriptions: prev.subscriptions.map((s) => (s.id === id ? updated : s)),
        };
      });

      showToast(
        nextStatus === 'paused' ? `Paused "${target.name}"` : `Resumed "${target.name}"`,
        () => {
          setStore((prev) => ({
            ...prev,
            subscriptions: prev.subscriptions.map((s) =>
              s.id === id ? { ...s, status: previousStatus } : s
            ),
          }));
        }
      );
    },
    [store.subscriptions, showToast]
  );

  const handleCancelPlan = useCallback(
    (id: string) => {
      const target = store.subscriptions.find((s) => s.id === id);
      if (!target) return;
      const previousStatus = target.status;
      const annualSaved = target.cycle === 'yearly' ? target.price : target.price * 12;

      setStore((prev) => {
        const updated: Subscription = { ...target, status: 'cancelled' };
        const nextSettings = {
          ...prev.settings,
          savedYtd: Number((prev.settings.savedYtd + annualSaved).toFixed(2)),
          cancelledCountYtd: prev.settings.cancelledCountYtd + 1,
        };
        if (prev.workspaceId && prev.cloudUserId) {
          void syncSubscriptionUpsert(prev.workspaceId, prev.cloudUserId, updated);
          void syncProfileSettings(prev.cloudUserId, nextSettings, prev.hasCompletedOnboarding);
        }
        return {
          ...prev,
          subscriptions: prev.subscriptions.map((s) => (s.id === id ? updated : s)),
          settings: nextSettings,
        };
      });

      showToast(`Cancelled "${target.name}"`, () => {
        setStore((prev) => ({
          ...prev,
          subscriptions: prev.subscriptions.map((s) =>
            s.id === id ? { ...s, status: previousStatus } : s
          ),
          settings: {
            ...prev.settings,
            savedYtd: Math.max(0, Number((prev.settings.savedYtd - annualSaved).toFixed(2))),
            cancelledCountYtd: Math.max(0, prev.settings.cancelledCountYtd - 1),
          },
        }));
      });
    },
    [store.subscriptions, showToast]
  );

  const handleArchiveSub = useCallback(
    (id: string) => {
      const target = store.subscriptions.find((s) => s.id === id);
      if (!target) return;

      setStore((prev) => {
        if (prev.workspaceId && prev.cloudUserId) {
          void syncSubscriptionArchive(id);
        }
        return {
          ...prev,
          subscriptions: prev.subscriptions.filter((s) => s.id !== id),
        };
      });
      setCurrentView('subscriptions');

      showToast(`Archived "${target.name}"`, () => {
        setStore((prev) => ({
          ...prev,
          subscriptions: [target, ...prev.subscriptions],
        }));
      });
    },
    [store.subscriptions, showToast]
  );

  const handleImportSubscriptions = useCallback(
    (items: Partial<Subscription>[]) => {
      const created: Subscription[] = items.map((item, idx) => ({
        id: `sub-imp-${Date.now()}-${idx}`,
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
        sharedMembers: ['Alex (You)'],
        manageUrl: 'https://',
        notes: item.notes || 'Imported from CSV',
      }));

      setStore((prev) => {
        if (prev.workspaceId && prev.cloudUserId) {
          void syncLocalSubscriptionsToCloud(prev.workspaceId, prev.cloudUserId, created);
        }
        return {
          ...prev,
          subscriptions: [...created, ...prev.subscriptions],
        };
      });
      showToast(`Imported ${created.length} ${created.length === 1 ? 'subscription' : 'subscriptions'}`);
    },
    [store.settings.currency, showToast]
  );

  const handleUpdateSettings = useCallback((patch: Partial<AppSettings>) => {
    setStore((prev) => {
      const nextSettings = { ...prev.settings, ...patch };
      if (prev.cloudUserId) {
        void syncProfileSettings(prev.cloudUserId, nextSettings, prev.hasCompletedOnboarding);
      }
      return {
        ...prev,
        settings: nextSettings,
      };
    });
  }, []);

  const handleToggleTheme = useCallback(() => {
    handleUpdateSettings({ theme: effectiveIsDark ? 'light' : 'dark' });
  }, [effectiveIsDark, handleUpdateSettings]);

  const handleInviteMember = useCallback((member: HouseholdMember) => {
    setStore((prev) => ({
      ...prev,
      members: [...prev.members, member],
    }));
  }, []);

  const handleToggleSettleMember = useCallback((id: string) => {
    setStore((prev) => ({
      ...prev,
      members: prev.members.map((m) =>
        m.id === id ? { ...m, settledThisMonth: !m.settledThisMonth } : m
      ),
    }));
  }, []);

  const handleMarkAllAlertsRead = useCallback(() => {
    setStore((prev) => ({
      ...prev,
      alerts: prev.alerts.map((a) => ({ ...a, read: true })),
    }));
    showToast('All alerts marked as read');
  }, [showToast]);

  const handleResetAllData = useCallback(async () => {
    await signOutCloud();
    await clearSubPulseStore();
    setStore(structuredClone(INITIAL_STORE));
    setSelectedSubId(null);
    setEditingSubId(null);
    setCurrentView('splash');
    showToast('Reset all data · Starting fresh');
  }, [showToast]);

  const handleLoadSampleDemo = useCallback(() => {
    setStore(structuredClone(DEMO_STORE));
    setCurrentView('dashboard');
    showToast('Loaded sample demo workspace');
  }, [showToast]);

  const handleCompleteSetup = useCallback(
    (payload: SetupCompletionPayload) => {
      setStore((prev) => {
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

        return {
          ...prev,
          hasCompletedOnboarding: true,
          settings: {
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
          },
          subscriptions: [...additions, ...prev.subscriptions],
        };
      });

      setCurrentView(store.isSignedIn ? 'dashboard' : 'signin');
      showToast(
        payload.selectedServices.length > 0
          ? `Setup saved with ${payload.selectedServices.length} ${
              payload.selectedServices.length === 1 ? 'service' : 'services'
            }`
          : 'Setup preferences saved'
      );
    },
    [store.isSignedIn, showToast]
  );

  const unreadAlertsCount = useMemo(
    () => store.alerts.filter((a) => !a.read).length,
    [store.alerts]
  );

  // Full-screen standalone flows (Splash, Intro, Setup, Sign In)
  if (currentView === 'splash') {
    return (
      <SplashView
        isHydrating={isHydrating}
        onComplete={() => {
          if (!store.hasCompletedOnboarding) {
            setCurrentView('intro');
          } else if (!store.isSignedIn) {
            setCurrentView('signin');
          } else {
            setCurrentView('dashboard');
          }
        }}
      />
    );
  }

  if (currentView === 'intro') {
    return (
      <IntroView
        onStartSetup={() => setCurrentView('setup')}
        onSignIn={() => setCurrentView('signin')}
        onExploreDemo={handleLoadSampleDemo}
      />
    );
  }

  if (currentView === 'signin') {
    return (
      <SignInView
        defaultEmail={store.settings.userEmail}
        defaultName={store.settings.userName === 'Guest' ? '' : store.settings.userName}
        onBackToIntro={() => setCurrentView('intro')}
        onSignIn={(email, guestMode, cloudUserId) => {
          setStore((prev) => ({
            ...prev,
            isSignedIn: true,
            isGuestMode: guestMode,
            cloudUserId: cloudUserId || prev.cloudUserId,
            hasCompletedOnboarding: true,
            settings: { ...prev.settings, userEmail: email },
          }));
          if (cloudUserId && !guestMode) {
            void hydrateCloudForUser(cloudUserId);
          }
          setCurrentView('dashboard');
          showToast(
            guestMode
              ? 'Signed in (local-only guest mode)'
              : cloudUserId
              ? `Synced as ${email}`
              : `Signed in as ${email}`
          );
        }}
      />
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
        onBack={() => setCurrentView(store.hasCompletedOnboarding ? 'settings' : 'intro')}
        onSkipToDemo={handleLoadSampleDemo}
        onCompleteSetup={handleCompleteSetup}
      />
    );
  }

  const selectedSub = store.subscriptions.find((s) => s.id === selectedSubId) || store.subscriptions[0];
  const editingSub = editingSubId ? store.subscriptions.find((s) => s.id === editingSubId) : undefined;

  return (
    <Shell
      currentView={currentView}
      onNavigate={navigate}
      onAddNew={handleAddNew}
      settings={store.settings}
      unreadAlertsCount={unreadAlertsCount}
      isOffline={!isOnline}
      onRetryConnection={() => {
        showToast(navigator.onLine ? 'Connection restored · Synced' : 'Still offline · Changes saved locally');
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
          settings={store.settings}
          isDark={effectiveIsDark}
          unreadAlertsCount={unreadAlertsCount}
          isLoading={isHydrating}
          onToggleTheme={handleToggleTheme}
          onNavigate={navigate}
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
            navigate(previousView === 'edit' ? 'subscriptions' : previousView === 'detail' ? 'dashboard' : previousView)
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
          isCloudSynced={Boolean(store.cloudUserId && !store.isGuestMode)}
          onSyncNow={() => {
            if (store.cloudUserId) {
              void hydrateCloudForUser(store.cloudUserId);
              showToast('Cloud sync refreshed');
            }
          }}
          onNavigate={navigate}
          onUpdateSettings={handleUpdateSettings}
          onLogOut={() => {
            void signOutCloud();
            setStore((prev) => ({
              ...prev,
              isSignedIn: false,
              cloudUserId: undefined,
              workspaceId: undefined,
            }));
            setCurrentView('signin');
          }}
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
  );
}
