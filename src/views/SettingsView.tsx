import React, { useState } from 'react';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { REFERENCE_TODAY } from '../data/seedData';
import { downloadFile, generateICSFeed, subscriptionsToCSV } from '../lib/formatters';
import { AppSettings, AppView, CurrencyCode, Subscription, ThemeMode } from '../types/subpulse';

interface SettingsViewProps {
  settings: AppSettings;
  subscriptions: Subscription[];
  memberCount: number;
  onNavigate: (view: AppView) => void;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onLogOut: () => void;
  onResetAllData: () => void;
  onShowToast: (msg: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  subscriptions,
  memberCount,
  onNavigate,
  onUpdateSettings,
  onLogOut,
  onResetAllData,
  onShowToast,
}) => {
  const [showTotpModal, setShowTotpModal] = useState(false);
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingQuietHours, setEditingQuietHours] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState(settings.geminiApiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestStatus, setKeyTestStatus] = useState<{ ok: boolean; message: string } | null>(null);

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
              IndexedDB · Synced
            </span>
          </div>
        </div>
      </header>

      {/* DESKTOP HEADER */}
      <header className="hidden lg:flex px-gutter-xl pt-gutter-xl pb-gutter-md items-center justify-between gap-gutter-md">
        <div>
          <h1 className="font-headline text-headline-lg text-light-on-surface dark:text-dark-on-surface">
            Settings &amp; security
          </h1>
          <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
            Account security, appearance, currency, and local backups
          </p>
        </div>
      </header>

      <main className="px-page-margin lg:px-gutter-xl flex flex-col gap-gutter-lg flex-1 max-w-2xl lg:max-w-3xl w-full mx-auto lg:mx-0">
        {/* Profile & Household Block */}
        <button
          type="button"
          onClick={() => onNavigate('household')}
          className="w-full text-left rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex items-center justify-between gap-gutter-md hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low transition-colors"
        >
          <div className="flex items-center gap-gutter-md">
            <div className="w-12 h-12 rounded-full bg-light-primary-container dark:bg-dark-primary-container text-light-on-primary flex items-center justify-center font-headline text-title-md shrink-0">
              {settings.userInitials}
            </div>
            <div className="flex flex-col gap-0.5">
              <h2 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface">
                {settings.userName}
              </h2>
              <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Household: {settings.workspaceName} ({memberCount} members)
              </p>
            </div>
          </div>
          <span className="material-symbols-outlined text-[20px] text-light-on-surface-variant dark:text-dark-on-surface-variant" aria-hidden="true">
            chevron_right
          </span>
        </button>

        {/* Security & Authentication */}
        <section
          aria-label="Security and authentication"
          className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col gap-gutter-md"
        >
          <h2 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface">
            Security &amp; sign-in
          </h2>

          <div className="flex items-center justify-between gap-gutter-md">
            <div className="flex flex-col">
              <span className="font-body text-body-md text-light-on-surface dark:text-dark-on-surface">
                Face ID / Passkey lock
              </span>
              <span className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Require biometric on reopen
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.passkeyLockEnabled}
              onChange={(e) => {
                onUpdateSettings({ passkeyLockEnabled: e.target.checked });
                onShowToast(e.target.checked ? 'Passkey lock enabled' : 'Passkey lock disabled');
              }}
              aria-label="Require Face ID or Passkey on reopen"
              className="w-6 h-6 rounded-sm text-light-primary focus:ring-light-primary border-light-outline-variant"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowTotpModal(true)}
            className="w-full text-left flex items-center justify-between gap-gutter-md pt-gutter-sm border-t border-light-outline-variant dark:border-dark-outline-variant"
          >
            <div className="flex flex-col">
              <span className="font-body text-body-md text-light-on-surface dark:text-dark-on-surface">
                Two-factor auth (TOTP)
              </span>
              <span
                className={`font-body text-body-sm ${
                  settings.totpEnabled
                    ? 'text-success dark:text-success-container'
                    : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
                }`}
              >
                {settings.totpEnabled ? 'Enabled · Authenticator app' : 'Not configured'}
              </span>
            </div>
            <span className="material-symbols-outlined text-[20px] text-light-on-surface-variant dark:text-dark-on-surface-variant" aria-hidden="true">
              chevron_right
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowAccountsModal(true)}
            className="w-full text-left flex items-center justify-between gap-gutter-md pt-gutter-sm border-t border-light-outline-variant dark:border-dark-outline-variant"
          >
            <div className="flex flex-col">
              <span className="font-body text-body-md text-light-on-surface dark:text-dark-on-surface">
                Connected accounts
              </span>
              <span className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Sign in with Apple, Google
              </span>
            </div>
            <span className="material-symbols-outlined text-[20px] text-light-on-surface-variant dark:text-dark-on-surface-variant" aria-hidden="true">
              chevron_right
            </span>
          </button>
        </section>

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
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="CAD">CAD ($)</option>
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
              <div className="flex items-center gap-2">
                <h2 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface">
                  Optional AI features (BYOK)
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-on-surface-variant dark:text-dark-on-surface-variant font-label text-label-sm">
                  Optional
                </span>
              </div>
              <span className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Bring your own Gemini API key for AI savings audits. Local audits always work without AI.
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

              <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Stored locally in IndexedDB on this device and sent only when you run an AI audit.
              </p>
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
              onClick={() => onNavigate('intro')}
              className="min-h-[44px] px-3 py-2 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-primary dark:text-dark-primary font-label text-label-sm"
            >
              Replay intro &amp; setup
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
        <section aria-label="Account termination" className="flex flex-col gap-gutter-sm pt-gutter-sm pb-6">
          <button
            type="button"
            onClick={onLogOut}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest text-light-on-surface dark:text-dark-on-surface border border-light-outline-variant dark:border-dark-outline-variant font-label text-label-lg hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low"
          >
            Log out of all devices
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-md bg-light-error-container dark:bg-dark-error-container text-light-on-error-container dark:text-dark-on-error-container font-label text-label-lg hover:opacity-90"
          >
            Reset application &amp; clear all data
          </button>
        </section>
      </main>

      {/* TOTP Modal */}
      {showTotpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-xl shadow-xl flex flex-col gap-gutter-md border border-light-outline-variant dark:border-dark-outline-variant">
            <h3 className="font-headline text-headline-md text-light-on-surface dark:text-dark-on-surface">
              Two-factor auth (TOTP)
            </h3>
            <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              {settings.totpEnabled
                ? 'Authenticator app protection is active for household exports and destructive actions.'
                : 'Enable TOTP authenticator verification for account security.'}
            </p>
            <div className="flex items-center justify-end gap-gutter-sm">
              <button
                type="button"
                onClick={() => {
                  onUpdateSettings({ totpEnabled: !settings.totpEnabled });
                  setShowTotpModal(false);
                  onShowToast(settings.totpEnabled ? 'TOTP disabled' : 'TOTP enabled');
                }}
                className="min-h-[44px] px-4 py-2 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container-low font-label text-label-sm"
              >
                {settings.totpEnabled ? 'Disable' : 'Enable'}
              </button>
              <button
                type="button"
                onClick={() => setShowTotpModal(false)}
                className="min-h-[44px] px-4 py-2 rounded-md bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-label text-label-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connected Accounts Modal */}
      {showAccountsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-xl shadow-xl flex flex-col gap-gutter-md border border-light-outline-variant dark:border-dark-outline-variant">
            <h3 className="font-headline text-headline-md text-light-on-surface dark:text-dark-on-surface">
              Connected accounts
            </h3>
            <div className="flex flex-col gap-gutter-sm">
              <div className="flex items-center justify-between p-3 rounded-lg bg-light-surface-container-low dark:bg-dark-surface-container-low">
                <span className="font-body text-body-md">Apple ID</span>
                <span className="font-label text-label-sm text-success">Connected</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-light-surface-container-low dark:bg-dark-surface-container-low">
                <span className="font-body text-body-md">Google ({settings.userEmail})</span>
                <span className="font-label text-label-sm text-success">Connected</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAccountsModal(false)}
              className="min-h-[44px] w-full rounded-md bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-label text-label-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Reset Application Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="reset-app-title">
          <div className="w-full max-w-sm rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-xl shadow-xl flex flex-col gap-gutter-md border border-light-outline-variant dark:border-dark-outline-variant">
            <h3 id="reset-app-title" className="font-headline text-headline-md text-light-on-surface dark:text-dark-on-surface">
              Reset application?
            </h3>
            <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              This removes all subscriptions, household splits, preferences, and your local Gemini API key from this device, and returns the app to its initial setup flow.
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
                Reset app
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
