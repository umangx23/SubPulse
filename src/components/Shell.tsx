import React from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { SPRING_SNAPPY, triggerHaptic } from '../lib/haptics';
import { AppSettings, AppView, SyncStatus } from '../types/subpulse';
import { PWAInstallButton } from './PWAInstallButton';

interface ShellProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onAddNew: () => void;
  onOpenSignIn: () => void;
  settings: AppSettings;
  isGuestMode: boolean;
  syncStatus: SyncStatus;
  unreadAlertsCount: number;
  isOffline: boolean;
  onRetryConnection: () => void;
  snackbarMessage: string | null;
  onUndo?: (() => void) | null;
  onDismissSnackbar: () => void;
  children: React.ReactNode;
}

const DESKTOP_NAV: Array<{ id: AppView; label: string; icon: string }> = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'subscriptions', label: 'All plans', icon: 'credit_card' },
  { id: 'analytics', label: 'Insights', icon: 'bar_chart' },
  { id: 'household', label: 'Household', icon: 'group' },
  { id: 'notifications', label: 'Alerts', icon: 'notifications' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

const MOBILE_TABS: Array<{ id: AppView; label: string; icon: string }> = [
  { id: 'dashboard', label: 'Home', icon: 'home' },
  { id: 'subscriptions', label: 'Plans', icon: 'credit_card' },
  { id: 'analytics', label: 'Insights', icon: 'bar_chart' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export const Shell: React.FC<ShellProps> = ({
  currentView,
  onNavigate,
  onAddNew,
  onOpenSignIn,
  settings,
  isGuestMode,
  syncStatus,
  unreadAlertsCount,
  isOffline,
  onRetryConnection,
  snackbarMessage,
  onUndo,
  onDismissSnackbar,
  children,
}) => {
  const isNavActive = (tabId: AppView) => {
    if (tabId === 'subscriptions' && (currentView === 'detail' || currentView === 'edit')) return true;
    if (tabId === 'analytics' && currentView === 'savings') return true;
    if (tabId === 'settings' && (currentView === 'household' || currentView === 'states')) return true;
    return currentView === tabId;
  };

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen flex flex-col lg:flex-row bg-light-surface dark:bg-dark-surface text-light-on-surface dark:text-dark-on-surface">
      {/* Persistent Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 min-h-screen bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest border-r border-light-outline-variant dark:border-dark-outline-variant p-gutter-xl flex-col justify-between shrink-0 sticky top-0 h-screen">
        <div className="flex flex-col gap-gutter-xl">
          {/* Brand */}
          <motion.button
            type="button"
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
            transition={SPRING_SNAPPY}
            onClick={() => {
              triggerHaptic(8);
              onNavigate('dashboard');
            }}
            className="flex items-center gap-gutter-sm text-left"
          >
            <div className="w-10 h-10 rounded-md bg-light-primary dark:bg-dark-primary flex items-center justify-center text-light-on-primary dark:text-dark-on-primary shadow-sm shrink-0">
              <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                account_balance_wallet
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-headline text-headline-md text-light-on-surface dark:text-dark-on-surface leading-tight truncate">
                SubPulse
              </span>
              <span className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant truncate">
                {settings.workspaceName} · {settings.currency}
              </span>
            </div>
          </motion.button>

          {/* Sidebar Nav */}
          <nav aria-label="Primary navigation" className="flex flex-col gap-gutter-xs">
            {DESKTOP_NAV.map((item) => {
              const active =
                currentView === item.id ||
                (item.id === 'subscriptions' && (currentView === 'detail' || currentView === 'edit')) ||
                (item.id === 'analytics' && currentView === 'savings');
              return (
                <motion.button
                  key={item.id}
                  type="button"
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.97 }}
                  transition={SPRING_SNAPPY}
                  onClick={() => {
                    triggerHaptic(8);
                    onNavigate(item.id);
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex items-center justify-between gap-gutter-md min-h-[44px] px-3.5 rounded-md font-label text-label-lg transition-colors duration-state-change ease-state-change whitespace-nowrap ${
                    active
                      ? 'text-light-primary dark:text-dark-primary'
                      : 'text-light-on-surface-variant dark:text-dark-on-surface-variant hover:bg-light-surface-container-low/60 dark:hover:bg-dark-surface-container-low/60'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="desktop-nav-pill"
                      transition={SPRING_SNAPPY}
                      className="absolute inset-0 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container-low -z-0"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-gutter-md">
                    <span
                      className={`material-symbols-outlined text-[20px] ${active ? 'filled' : ''}`}
                      aria-hidden="true"
                    >
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </span>
                  {item.id === 'notifications' && unreadAlertsCount > 0 && (
                    <motion.span
                      initial={{ scale: 0.8 }}
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2 }}
                      className="relative z-10 font-mono text-mono-sm text-accent tabular-nums"
                    >
                      {unreadAlertsCount}
                    </motion.span>
                  )}
                </motion.button>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-col gap-gutter-sm">
          {/* Account & Cloud Backup Card */}
          {isGuestMode ? (
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                onOpenSignIn();
              }}
              className="w-full text-left rounded-lg bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-3 flex items-center justify-between gap-2 hover:bg-light-surface-container dark:hover:bg-dark-surface-container transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-md bg-light-primary/12 dark:bg-dark-primary/15 text-light-primary dark:text-dark-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    cloud_upload
                  </span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-label text-label-sm text-light-on-surface dark:text-dark-on-surface truncate">
                    Guest · Local only
                  </span>
                  <span className="font-body text-[11px] text-light-primary dark:text-dark-primary truncate">
                    Sign in to back up
                  </span>
                </div>
              </div>
              <span className="material-symbols-outlined text-[16px] text-light-on-surface-variant dark:text-dark-on-surface-variant shrink-0" aria-hidden="true">
                chevron_right
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                onNavigate('settings');
              }}
              className="w-full text-left rounded-lg bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-3 flex items-center gap-2.5 hover:bg-light-surface-container dark:hover:bg-dark-surface-container transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-light-primary-container dark:bg-dark-primary-container text-light-on-primary flex items-center justify-center font-label text-label-sm shrink-0">
                {settings.userInitials}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-label text-label-sm text-light-on-surface dark:text-dark-on-surface truncate">
                  {settings.userEmail || settings.userName}
                </span>
                <span
                  className={`font-body text-[11px] truncate ${
                    syncStatus === 'error'
                      ? 'text-light-error dark:text-dark-error'
                      : syncStatus === 'pending' || syncStatus === 'syncing'
                      ? 'text-warning'
                      : 'text-success dark:text-success-container'
                  }`}
                >
                  {syncStatus === 'syncing'
                    ? 'Syncing…'
                    : syncStatus === 'pending'
                    ? 'Pending sync'
                    : syncStatus === 'error'
                    ? 'Sync paused'
                    : 'Backed up'}
                </span>
              </div>
            </button>
          )}

          <PWAInstallButton />
          <motion.button
            type="button"
            whileHover={{ y: -2, scale: 1.015 }}
            whileTap={{ scale: 0.97 }}
            transition={SPRING_SNAPPY}
            onClick={() => {
              triggerHaptic(10);
              onAddNew();
            }}
            className="w-full inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-md bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-label text-label-lg whitespace-nowrap shadow-sm hover:shadow-md transition-shadow"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
            <span>Add subscription</span>
          </motion.button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-24 lg:pb-10">
        <AnimatePresence>
          {isOffline && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              role="status"
              className="bg-warning-container text-on-warning-container px-page-margin lg:px-gutter-xl py-2.5 flex items-center justify-between gap-gutter-sm overflow-hidden"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">cloud_off</span>
                <span className="font-label text-label-sm">Offline · Saved locally in IndexedDB</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(8);
                  onRetryConnection();
                }}
                className="font-label text-label-sm underline min-h-[32px] px-2"
              >
                Retry
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="w-full max-w-[430px] lg:max-w-[1040px] mx-auto lg:mx-0 flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Undo / Feedback Snackbar */}
      <AnimatePresence>
        {snackbarMessage && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={SPRING_SNAPPY}
            className="fixed bottom-20 lg:bottom-6 left-4 right-4 lg:left-auto lg:right-6 lg:w-96 z-40"
          >
            <div
              role="alert"
              className="rounded-lg bg-light-inverse-surface dark:bg-dark-inverse-surface text-light-inverse-on-surface dark:text-dark-inverse-on-surface px-4 py-3 flex items-center justify-between gap-gutter-md shadow-xl"
            >
              <span className="font-body text-body-sm truncate">{snackbarMessage}</span>
              <div className="flex items-center gap-3 shrink-0">
                {onUndo && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(10);
                      onUndo();
                    }}
                    className="font-label text-label-sm text-light-inverse-primary dark:text-dark-inverse-primary whitespace-nowrap"
                  >
                    Undo
                  </button>
                )}
                <button
                  type="button"
                  onClick={onDismissSnackbar}
                  aria-label="Dismiss message"
                  className="text-light-inverse-on-surface/70 dark:text-dark-inverse-on-surface/70 hover:opacity-100"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Tab Navigation */}
      <nav
        aria-label="Primary navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-light-surface-container-lowest/95 dark:bg-dark-surface-container-lowest/95 backdrop-blur-md border-t border-light-outline-variant dark:border-dark-outline-variant pb-[env(safe-area-inset-bottom)]"
      >
        <div className="max-w-[430px] mx-auto grid grid-cols-4 h-16 px-2">
          {MOBILE_TABS.map((tab) => {
            const active = isNavActive(tab.id);
            return (
              <motion.button
                key={tab.id}
                type="button"
                whileTap={{ scale: 0.9 }}
                transition={SPRING_SNAPPY}
                onClick={() => {
                  triggerHaptic(8);
                  onNavigate(tab.id);
                }}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active
                    ? 'text-light-primary dark:text-dark-primary'
                    : 'text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface dark:hover:text-dark-on-surface'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="mobile-tab-pill"
                    transition={SPRING_SNAPPY}
                    className="absolute top-0 w-10 h-0.5 rounded-full bg-light-primary dark:bg-dark-primary"
                  />
                )}
                <motion.span
                  animate={active ? { y: -1, scale: 1.08 } : { y: 0, scale: 1 }}
                  transition={SPRING_SNAPPY}
                  className={`material-symbols-outlined text-[22px] ${active ? 'filled' : ''}`}
                  aria-hidden="true"
                >
                  {tab.icon}
                </motion.span>
                <span className="font-label text-label-sm">{tab.label}</span>
              </motion.button>
            );
          })}
        </div>
      </nav>
    </div>
    </MotionConfig>
  );
};
