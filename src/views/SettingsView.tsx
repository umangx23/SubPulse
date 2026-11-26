import React, { useState } from 'react';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { REFERENCE_TODAY } from '../data/seedData';
import { formatCloudError, requestPasswordReset } from '../lib/cloudSync';
import { downloadFile, generateICSFeed, subscriptionsToCSV } from '../lib/formatters';
import { isSupabaseConfigured } from '../lib/supabase';
import { AppSettings, AppView, CurrencyCode, Subscription, SyncStatus, ThemeMode } from '../types/subpulse';

interface SettingsViewProps {
  settings: AppSettings;
  subscriptions: Subscription[];
  memberCount: number;
  isGuestMode: boolean;
  syncStatus: SyncStatus;
  syncError: string | null;
  lastSyncedAt?: string;
  onOpenSignIn: (mode?: 'signin' | 'signup') => void;
  onSyncNow: () => void;
  onNavigate: (view: AppView) => void;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onLogOut: (clearLocalData: boolean) => void;
  onResetAllData: () => void;
  onShowToast: (msg: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  subscriptions,
  memberCount,
  isGuestMode,
  syncStatus,
  syncError,
  lastSyncedAt,
  onOpenSignIn,
  onSyncNow,
  onNavigate,
  onUpdateSettings,
  onLogOut,
  onResetAllData,
  onShowToast,
}) => {
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingQuietHours, setEditingQuietHours] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState(settings.geminiApiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestStatus, setKeyTestStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const isCloudSignedIn = !isGuestMode;

  const formattedLastSynced = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const syncStatusLabel = (() => {
    if (isGuestMode) return 'Guest mode · Saved on this device';
    if (syncStatus === 'syncing') return 'Syncing with cloud…';
    if (syncStatus === 'pending') return 'Changes waiting to sync';
    if (syncStatus === 'error') return 'Sync paused · Local data is safe';
    return formattedLastSynced ? `Backed up · Last synced ${formattedLastSynced}` : 'Backed up to your account';
  })();

  const handleSendPasswordReset = async () => {
    if (!settings.userEmail || !isSupabaseConfigured) return;
    setIsSendingReset(true);
    try {
      await requestPasswordReset(settings.userEmail);
      onShowToast(`Password reset link sent to ${settings.userEmail}`);
    } catch (err) {
      onShowToast(formatCloudError(err));
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleSaveApiKey = () => {
    const trimmed = apiKeyDraft.trim();
    onUpdateSettings({ geminiApiKey: trimmed, aiFeaturesEnabled: trimmed ? true : settings.aiFeaturesEnabled });
    setKeyTestStatus(null);
    onShowToast(trimmed ? 'Gemini API key saved locally' : 'Gemini API key cleared');
  };

  const handleTestApiKey = async () => {
    const keyToTest = apiKeyDraft.trim();
    if (!keyToTest) {
      setKeyTestStatus({ ok: false, message: 'Enter an API key first.' });
      return;
    }
    setIsTestingKey(true);
    setKeyTestStatus(null);
    try {
      const res = await fetch('/api/ai/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': keyToTest,
        },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setKeyTestStatus({ ok: false, message: data.error || 'Key verification failed.' });
      } else {
        onUpdateSettings({ geminiApiKey: keyToTest, aiFeaturesEnabled: true });
        setKeyTestStatus({ ok: true, message: 'Key verified · AI audit ready' });
        onShowToast('Gemini API key verified and saved');
      }
    } catch {
      setKeyTestStatus({ ok: false, message: 'Unable to reach verification endpoint.' });
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleExport = (format: 'csv' | 'json' | 'ics') => {
    if (format === 'csv') {
      downloadFile(`subpulse-export-${REFERENCE_TODAY}.csv`, subscriptionsToCSV(subscriptions), 'text/csv;charset=utf-8;');
      onShowToast('Exported CSV backup');
    } else if (format === 'json') {
      downloadFile(
        `subpulse-backup-${REFERENCE_TODAY}.json`,
        JSON.stringify({ settings, subscriptions }, null, 2),
        'application/json'
      );
      onShowToast('Exported JSON backup');
    } else {
      downloadFile(`subpulse-renewals-${REFERENCE_TODAY}.ics`, generateICSFeed(subscriptions), 'text/calendar;charset=utf-8;');
      onShowToast('Exported .ICS calendar feed');
    }
  };

  return (
    <div className="flex flex-col flex-1">
      {/* MOBILE HEADER */}
      <header className="lg:hidden px-page-margin pt-gutter-lg pb-gutter-md flex items-center justify-between gap-gutter-sm">
        <div className="flex items-center gap-gutter-sm">
          <div className="w-9 h-9 rounded-md bg-light-primary dark:bg-dark-primary flex items-center justify-center text-light-on-primary dark:text-dark-on-primary shadow-sm">
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              account_balance_wallet
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-headline text-title-md text-light-on-surface dark:text-dark-on-surface leading-tight">
              Settings
            </span>
            <span className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              {syncStatusLabel}
            </span>
          </div>
        </div>
        {isCloudSignedIn ? (
          <button
            type="button"
            disabled={syncStatus === 'syncing'}
            onClick={onSyncNow}
            className="min-h-[36px] px-3 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-primary dark:text-dark-primary font-label text-label-sm disabled:opacity-60"
          >
            {syncStatus === 'syncing' ? 'Syncing…' : 'Sync'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onOpenSignIn('signin')}
            className="min-h-[36px] px-3 rounded-md bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-label text-label-sm"
          >
            Sign in
          </button>
        )}
      </header>

      {/* DESKTOP HEADER */}
      <header className="hidden lg:flex px-gutter-xl pt-gutter-xl pb-gutter-md items-center justify-between gap-gutter-md">
        <div>
          <h1 className="font-headline text-headline-lg text-light-on-surface dark:text-dark-on-surface">
            Settings &amp; backup
          </h1>
          <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
            {syncStatusLabel}
          </p>
        </div>
        {isCloudSignedIn ? (
          <button
            type="button"
            disabled={syncStatus === 'syncing'}
            onClick={onSyncNow}
            className="sp-btn min-h-[40px] px-4 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-primary dark:text-dark-primary font-label text-label-sm inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">sync</span>
            <span>{syncStatus === 'syncing' ? 'Syncing…' : 'Sync now'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onOpenSignIn('signin')}
            className="sp-btn min-h-[40px] px-4 rounded-md bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-label text-label-sm inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">cloud_upload</span>
            <span>Sign in &amp; back up</span>
          </button>
        )}
      </header>

      <main className="px-page-margin lg:px-gutter-xl flex flex-col gap-gutter-lg flex-1 max-w-2xl lg:max-w-3xl w-full mx-auto lg:mx-0">
        {/* Cloud Account & Email Backup Section */}
        <section
          aria-label="Account and cloud backup"
          className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col gap-gutter-md"
        >
          <div className="flex items-start justify-between gap-gutter-md">
            <div className="flex items-center gap-gutter-md min-w-0">
              <div className="w-12 h-12 rounded-full bg-light-primary-container dark:bg-dark-primary-container text-light-on-primary flex items-center justify-center font-headline text-title-md shrink-0">
                {isGuestMode ? (
                  <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                    person_outline
                  </span>
                ) : (
                  settings.userInitials
                )}
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <h2 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface truncate">
                  {isGuestMode ? 'Guest Mode (Local only)' : settings.userName}
                </h2>
                <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant truncate">
                  {isGuestMode
                    ? `${subscriptions.length} ${subscriptions.length === 1 ? 'subscription' : 'subscriptions'} & ${memberCount} ${memberCount === 1 ? 'member' : 'members'} stored on this device`
                    : settings.userEmail}
                </p>
              </div>
            </div>
            <span
              className={`font-label text-label-sm shrink-0 ${
                isGuestMode
                  ? 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
                  : syncStatus === 'error'
                  ? 'text-light-error dark:text-dark-error'
                  : syncStatus === 'pending' || syncStatus === 'syncing'
                  ? 'text-warning'
                  : 'text-success dark:text-success-container'
              }`}
            >
              {isGuestMode
                ? 'Not backed up'
                : syncStatus === 'syncing'
                ? 'Syncing…'
                : syncStatus === 'pending'
                ? 'Pending'
                : syncStatus === 'error'
                ? 'Sync error'
                : 'Synced'}
            </span>
          </div>

          {syncError && isCloudSignedIn && (
            <div
              role="alert"
              className="rounded-lg bg-light-error-container/50 dark:bg-dark-error-container/40 px-3.5 py-2.5 flex items-center justify-between gap-gutter-sm"
            >
              <p className="font-body text-body-sm text-light-on-error-container dark:text-dark-on-error-container">
                {syncError}
              </p>
              <button
                type="button"
                onClick={onSyncNow}
                className="font-label text-label-sm text-light-on-error-container dark:text-dark-on-error-container underline shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {isGuestMode ? (
            <div className="flex flex-col gap-gutter-sm pt-gutter-sm border-t border-light-outline-variant dark:border-dark-outline-variant">
              <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Sign in with your email to back up your local data to Supabase and sync across devices. If you already have a cloud backup, you can merge or restore it.
              </p>
              <div className="flex flex-wrap items-center gap-gutter-sm">
                <button
                  type="button"
                  onClick={() => onOpenSignIn('signin')}
                  className="min-h-[44px] px-4 py-2 rounded-md bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-label text-label-sm inline-flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">mail</span>
                  <span>Sign in with email</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenSignIn('signup')}
                  className="min-h-[44px] px-4 py-2 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface font-label text-label-sm"
                >
                  Create account &amp; back up
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-gutter-sm pt-gutter-sm border-t border-light-outline-variant dark:border-dark-outline-variant">
              <div className="flex flex-wrap items-center gap-gutter-sm">
                <button
                  type="button"
                  disabled={syncStatus === 'syncing'}
                  onClick={onSyncNow}
                  className="min-h-[42px] px-3.5 py-2 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-light-primary dark:text-dark-primary font-label text-label-sm inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">sync</span>
                  <span>{syncStatus === 'syncing' ? 'Syncing…' : 'Back up & sync now'}</span>
                </button>
                <button
                  type="button"
                  disabled={isSendingReset || !isSupabaseConfigured}
                  onClick={handleSendPasswordReset}
                  className="min-h-[42px] px-3.5 py-2 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface font-label text-label-sm disabled:opacity-60"
                >
                  {isSendingReset ? 'Sending reset link…' : 'Send password reset email'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSignOutModal(true)}
                  className="min-h-[42px] px-3.5 py-2 rounded-md text-light-error dark:text-dark-error font-label text-label-sm hover:underline"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Household & Shared Splits Link */}
        <button
          type="button"
          onClick={() => onNavigate('household')}
          className="w-full text-left rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex items-center justify-between gap-gutter-md hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low transition-colors"
        >
          <div className="flex items-center gap-gutter-md">
            <div className="w-11 h-11 rounded-lg bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-primary dark:text-dark-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                group
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <h2 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface">
                Household: {settings.workspaceName}
              </h2>
              <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                {memberCount} {memberCount === 1 ? 'member' : 'members'} · Manage shared subscription splits
              </p>
            </div>
          </div>
          <span className="material-symbols-outlined text-[20px] text-light-on-surface-variant dark:text-dark-on-surface-variant" aria-hidden="true">
            chevron_right
          </span>
        </button>

        {/* Preferences & Appearance */}
        <section
          aria-label="Preferences"
          className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col gap-gutter-md"
        >
          <h2 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface">
            Preferences
          </h2>

          <div className="flex items-center justify-between gap-gutter-sm">
            <span className="font-body text-body-md text-light-on-surface dark:text-dark-on-surface">
              Theme
            </span>
            <div className="inline-grid grid-cols-3 p-1 rounded-md bg-light-surface-container dark:bg-dark-surface-container">
              {(['light', 'dark', 'system'] as ThemeMode[]).map((mode) => {
                const active = settings.theme === mode;
                const label = mode === 'system' ? 'Auto' : mode.charAt(0).toUpperCase() + mode.slice(1);
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onUpdateSettings({ theme: mode })}
                    className={`px-2.5 py-1 rounded-DEFAULT font-label text-label-sm transition-colors ${
                      active
                        ? 'bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest text-light-primary dark:text-dark-primary shadow-sm'
                        : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-gutter-sm pt-gutter-sm border-t border-light-outline-variant dark:border-dark-outline-variant">
            <label htmlFor="settings-currency" className="font-body text-body-md text-light-on-surface dark:text-dark-on-surface">
              Base currency
            </label>
            <select
              id="settings-currency"
              value={settings.currency}
              onChange={(e) => {
                onUpdateSettings({ currency: e.target.value as CurrencyCode });
                onShowToast(`Base currency set to ${e.target.value}`);
              }}
              className="min-h-[40px] px-3 py-1 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant font-mono text-mono-md text-light-primary dark:text-dark-primary"
            >
              <option value="USD">USD ($)</option>
              <option value="INR">INR (₹)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="CAD">CAD ($)</option>
            </select>
          </div>

          <div className="flex items-center justify-between gap-gutter-sm pt-gutter-sm border-t border-light-outline-variant dark:border-dark-outline-variant">
            <label htmlFor="settings-country" className="font-body text-body-md text-light-on-surface dark:text-dark-on-surface">
              Country / Region
            </label>
            <select
              id="settings-country"
              value={settings.country || 'United States'}
              onChange={(e) => {
                onUpdateSettings({ country: e.target.value });
                onShowToast(`Country set to ${e.target.value}`);
              }}
              className="min-h-[40px] px-3 py-1 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant font-body text-body-md text-light-on-surface dark:text-dark-on-surface"
            >
              <option value="India">India</option>
              <option value="United States">United States</option>
              <option value="United Kingdom">United Kingdom</option>
              <option value="Canada">Canada</option>
              <option value="European Union">European Union</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="flex flex-col gap-gutter-sm pt-gutter-sm border-t border-light-outline-variant dark:border-dark-outline-variant">
            <div className="flex items-center justify-between gap-gutter-sm">
              <span className="font-body text-body-md text-light-on-surface dark:text-dark-on-surface">
                Notification quiet hours
              </span>
              <button
                type="button"
                onClick={() => setEditingQuietHours((v) => !v)}
                className="font-mono text-mono-sm text-light-primary dark:text-dark-primary tabular-nums hover:underline"
              >
                {settings.quietHoursStart} – {settings.quietHoursEnd}
              </button>
            </div>
            {editingQuietHours && (
              <div className="flex items-center gap-gutter-sm">
                <input
                  type="time"
                  value={settings.quietHoursStart}
                  onChange={(e) => onUpdateSettings({ quietHoursStart: e.target.value })}
                  className="min-h-[40px] px-2.5 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant font-mono text-mono-sm"
                />
                <span className="font-body text-body-sm">to</span>
                <input
                  type="time"
                  value={settings.quietHoursEnd}
                  onChange={(e) => onUpdateSettings({ quietHoursEnd: e.target.value })}
                  className="min-h-[40px] px-2.5 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant font-mono text-mono-sm"
                />
              </div>
            )}
          </div>
        </section>

        {/* Optional AI Features (BYOK) */}
        <section
          aria-label="Optional AI features"
          className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col gap-gutter-md"
        >
          <div className="flex items-center justify-between gap-gutter-md">
            <div className="flex flex-col">
              <h2 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface">
                Optional AI features (BYOK)
              </h2>
              <span className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Bring your own Gemini API key for AI savings audits. Stored strictly on this device and never uploaded to cloud backup.
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.aiFeaturesEnabled}
              onChange={(e) => {
                onUpdateSettings({ aiFeaturesEnabled: e.target.checked });
                onShowToast(e.target.checked ? 'Optional AI features enabled' : 'AI features disabled');
              }}
              aria-label="Enable optional AI features"
              className="w-6 h-6 shrink-0 rounded-sm text-light-primary focus:ring-light-primary border-light-outline-variant"
            />
          </div>

          {settings.aiFeaturesEnabled && (
            <div className="flex flex-col gap-gutter-sm pt-gutter-sm border-t border-light-outline-variant dark:border-dark-outline-variant">
              <label
                htmlFor="byok-gemini-key"
                className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant"
              >
                Gemini API key
              </label>
              <div className="relative flex items-center">
                <input
                  id="byok-gemini-key"
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKeyDraft}
                  onChange={(e) => setApiKeyDraft(e.target.value)}
                  placeholder="AIza..."
                  autoComplete="off"
                  className="w-full min-h-[44px] pl-3.5 pr-11 py-2 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant font-mono text-mono-sm focus:border-light-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((v) => !v)}
                  aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                  className="absolute right-1.5 w-9 h-9 rounded-full inline-flex items-center justify-center text-light-on-surface-variant dark:text-dark-on-surface-variant"
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    {showApiKey ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-gutter-xs">
                <button
                  type="button"
                  onClick={handleSaveApiKey}
                  className="min-h-[40px] px-3.5 rounded-md bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-label text-label-sm"
                >
                  Save key
                </button>
                <button
                  type="button"
                  onClick={handleTestApiKey}
                  disabled={isTestingKey}
                  className="min-h-[40px] px-3.5 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-primary dark:text-dark-primary border border-light-outline-variant dark:border-dark-outline-variant font-label text-label-sm disabled:opacity-60"
                >
                  {isTestingKey ? 'Testing...' : 'Test key'}
                </button>
                {(apiKeyDraft || settings.geminiApiKey) && (
                  <button
                    type="button"
                    onClick={() => {
                      setApiKeyDraft('');
                      onUpdateSettings({ geminiApiKey: '' });
                      setKeyTestStatus(null);
                      onShowToast('Gemini API key cleared');
                    }}
                    className="min-h-[40px] px-3 rounded-md text-light-error dark:text-dark-error font-label text-label-sm"
                  >
                    Clear
                  </button>
                )}
              </div>

              {keyTestStatus && (
                <p
                  role="status"
                  className={`font-body text-body-sm ${
                    keyTestStatus.ok ? 'text-success' : 'text-light-error dark:text-dark-error'
                  }`}
                >
                  {keyTestStatus.message}
                </p>
              )}
            </div>
          )}
        </section>

        {/* Data Export & Backup */}
        <section
          aria-label="Data and privacy"
          className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col gap-gutter-md"
        >
          <h2 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface">
            Export &amp; calendar
          </h2>
          <div className="grid grid-cols-3 gap-gutter-sm">
            <button
              type="button"
              onClick={() => handleExport('csv')}
              className="min-h-[44px] px-3 py-2 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-on-surface dark:text-dark-on-surface font-label text-label-sm hover:opacity-90"
            >
              CSV
            </button>
            <button
              type="button"
              onClick={() => handleExport('json')}
              className="min-h-[44px] px-3 py-2 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-on-surface dark:text-dark-on-surface font-label text-label-sm hover:opacity-90"
            >
              JSON
            </button>
            <button
              type="button"
              onClick={() => handleExport('ics')}
              className="min-h-[44px] px-3 py-2 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-on-surface dark:text-dark-on-surface font-label text-label-sm hover:opacity-90"
            >
              .ICS
            </button>
          </div>
        </section>

        {/* PWA Setup, Onboarding & System States */}
        <section
          aria-label="App setup and state previews"
          className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col gap-gutter-sm"
        >
          <h2 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface">
            App installation &amp; setup
          </h2>
          <PWAInstallButton />
          <div className="grid grid-cols-2 gap-gutter-sm pt-1">
            <button
              type="button"
              onClick={() => onNavigate('onboarding')}
              className="min-h-[44px] px-3 py-2 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-primary dark:text-dark-primary font-label text-label-sm"
            >
              Quick setup wizard
            </button>
            <button
              type="button"
              onClick={() => onNavigate('states')}
              className="min-h-[44px] px-3 py-2 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-primary dark:text-dark-primary font-label text-label-sm"
            >
              Empty &amp; offline states
            </button>
          </div>
        </section>

        {/* Isolated Destructive Actions */}
        <section aria-label="Local data reset" className="flex flex-col gap-gutter-sm pt-gutter-sm pb-6">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-md bg-light-error-container dark:bg-dark-error-container text-light-on-error-container dark:text-dark-on-error-container font-label text-label-lg hover:opacity-90"
          >
            Reset local app &amp; clear device data
          </button>
        </section>
      </main>

      {/* Sign-Out Choice Modal */}
      {showSignOutModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sign-out-title"
        >
          <div className="w-full max-w-sm rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-xl shadow-xl flex flex-col gap-gutter-md border border-light-outline-variant dark:border-dark-outline-variant">
            <h3 id="sign-out-title" className="font-headline text-headline-md text-light-on-surface dark:text-dark-on-surface">
              Sign out of {settings.userEmail}?
            </h3>
            <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              Your cloud backup remains safely stored in Supabase. Choose what to do with the data on this device:
            </p>
            <div className="flex flex-col gap-gutter-sm">
              <button
                type="button"
                onClick={() => {
                  setShowSignOutModal(false);
                  onLogOut(false);
                }}
                className="w-full min-h-[44px] px-4 py-2 rounded-md bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-label text-label-sm"
              >
                Sign out &amp; keep local copy (Guest Mode)
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSignOutModal(false);
                  onLogOut(true);
                }}
                className="w-full min-h-[44px] px-4 py-2 rounded-md bg-light-error-container dark:bg-dark-error-container text-light-on-error-container dark:text-dark-on-error-container font-label text-label-sm"
              >
                Sign out &amp; clear this device
              </button>
              <button
                type="button"
                onClick={() => setShowSignOutModal(false)}
                className="w-full min-h-[40px] px-4 py-2 rounded-md border border-light-outline-variant dark:border-dark-outline-variant font-label text-label-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Application Confirmation */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-app-title"
        >
          <div className="w-full max-w-sm rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-xl shadow-xl flex flex-col gap-gutter-md border border-light-outline-variant dark:border-dark-outline-variant">
            <h3 id="reset-app-title" className="font-headline text-headline-md text-light-on-surface dark:text-dark-on-surface">
              Reset local application?
            </h3>
            <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              This signs out on this device and removes all local subscriptions, household splits, preferences, and your local Gemini API key from IndexedDB. Any data already backed up to Supabase stays safe in your account.
            </p>
            <div className="flex items-center justify-end gap-gutter-sm">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="min-h-[44px] px-4 py-2 rounded-md border border-light-outline-variant dark:border-dark-outline-variant font-label text-label-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onResetAllData();
                }}
                className="min-h-[44px] px-4 py-2 rounded-md bg-light-error-container dark:bg-dark-error-container text-light-on-error-container dark:text-dark-on-error-container font-label text-label-sm"
              >
                Reset device
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
