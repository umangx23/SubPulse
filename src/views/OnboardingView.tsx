import React, { useState } from 'react';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { CurrencyCode, SubscriptionCategory } from '../types/subpulse';

export interface SetupCompletionPayload {
  userName: string;
  workspaceName: string;
  currency: CurrencyCode;
  country: string;
  timezone: string;
  monthlyBudgetCap: number;
  selectedServices: Array<{
    name: string;
    category: SubscriptionCategory;
    price: number;
  }>;
  webPushEnabled: boolean;
  emailFallbackEnabled: boolean;
}

interface OnboardingViewProps {
  initialCurrency?: CurrencyCode;
  initialBudgetCap?: number;
  initialWorkspaceName?: string;
  initialUserName?: string;
  onSkipToDemo: () => void;
  onCompleteSetup: (payload: SetupCompletionPayload) => void;
  onBack?: () => void;
}

interface PopularServiceTemplate {
  name: string;
  category: SubscriptionCategory;
  price: number;
  icon: string;
}

const POPULAR_SERVICES: PopularServiceTemplate[] = [
  { name: 'Netflix', category: 'Entertainment', price: 15.99, icon: 'movie' },
  { name: 'Spotify', category: 'Entertainment', price: 11.99, icon: 'music_note' },
  { name: 'iCloud+', category: 'Cloud & Utilities', price: 9.99, icon: 'cloud' },
  { name: 'YouTube Premium', category: 'Entertainment', price: 13.99, icon: 'play_circle' },
  { name: 'ChatGPT Plus', category: 'Productivity & AI', price: 20.0, icon: 'auto_awesome' },
  { name: 'Amazon Prime', category: 'Entertainment', price: 14.99, icon: 'local_shipping' },
  { name: 'Apple One', category: 'Cloud & Utilities', price: 19.95, icon: 'apps' },
  { name: 'Gym / Fitness', category: 'Fitness', price: 34.99, icon: 'fitness_center' },
];

const CURRENCIES: Array<{ code: CurrencyCode; label: string }> = [
  { code: 'USD', label: 'USD ($)' },
  { code: 'EUR', label: 'EUR (€)' },
  { code: 'GBP', label: 'GBP (£)' },
  { code: 'CAD', label: 'CAD ($)' },
];

const BUDGET_PRESETS = [100, 200, 250, 400];

export const OnboardingView: React.FC<OnboardingViewProps> = ({
  initialCurrency = 'USD',
  initialBudgetCap = 250,
  initialWorkspaceName = 'Personal',
  initialUserName = '',
  onSkipToDemo,
  onCompleteSetup,
  onBack,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [userName, setUserName] = useState(initialUserName);
  const [workspaceName, setWorkspaceName] = useState(initialWorkspaceName);
  const [currency, setCurrency] = useState<CurrencyCode>(initialCurrency);
  const [country, setCountry] = useState('United States');
  const [timezone] = useState(
    () =>
      (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) ||
      'America/New_York'
  );
  const [monthlyBudgetCap, setMonthlyBudgetCap] = useState(initialBudgetCap);
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [webPushEnabled, setWebPushEnabled] = useState(false);
  const [emailFallbackEnabled, setEmailFallbackEnabled] = useState(true);
  const [pushStatusMsg, setPushStatusMsg] = useState<string | null>(null);

  const toggleService = (name: string) => {
    setSelectedNames((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
    );
  };

  const handleEnablePush = async () => {
    if (typeof Notification === 'undefined') {
      setPushStatusMsg('Browser notifications are unavailable here; email alerts remain enabled.');
      setWebPushEnabled(false);
      return;
    }
    try {
      const result = await Notification.requestPermission();
      if (result === 'granted') {
        setWebPushEnabled(true);
        setPushStatusMsg('Renewal push notifications enabled.');
      } else {
        setWebPushEnabled(false);
        setPushStatusMsg('Permission not granted. You can enable push later in Settings.');
      }
    } catch {
      setWebPushEnabled(false);
      setPushStatusMsg('Install to Home Screen on iOS to enable Web Push.');
    }
  };

  const handleFinish = () => {
    const selectedServices = POPULAR_SERVICES.filter((svc) =>
      selectedNames.includes(svc.name)
    ).map(({ name, category, price }) => ({ name, category, price }));

    onCompleteSetup({
      userName: userName.trim() || 'Alex Morgan',
      workspaceName: workspaceName.trim() || 'Personal',
      currency,
      country: country.trim() || 'United States',
      timezone,
      monthlyBudgetCap: Math.max(20, monthlyBudgetCap || 250),
      selectedServices,
      webPushEnabled,
      emailFallbackEnabled,
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col justify-between max-w-[430px] mx-auto px-page-margin pt-gutter-lg pb-8 bg-light-surface dark:bg-dark-surface text-light-on-surface dark:text-dark-on-surface">
      {/* Top Setup Bar: Progress + Skip */}
      <header className="flex items-center justify-between gap-gutter-md">
        <div className="flex items-center gap-2">
          {(step > 1 || onBack) && (
            <button
              type="button"
              onClick={() => {
                if (step > 1) {
                  setStep((s) => (s - 1) as 1 | 2 | 3);
                } else if (onBack) {
                  onBack();
                }
              }}
              aria-label="Back"
              className="w-10 h-10 rounded-full bg-light-surface-container-low dark:bg-dark-surface-container-low flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                arrow_back
              </span>
            </button>
          )}
          <div className="flex items-center gap-1.5" aria-label={`Setup step ${step} of 3`}>
            {[1, 2, 3].map((idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  idx === step
                    ? 'w-7 bg-light-primary dark:bg-dark-primary'
                    : idx < step
                    ? 'w-4 bg-success'
                    : 'w-2.5 bg-light-outline-variant dark:bg-dark-outline-variant'
                }`}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onSkipToDemo}
          className="inline-flex items-center justify-center min-h-[44px] px-3 font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface dark:hover:text-dark-on-surface"
        >
          Explore sample demo
        </button>
      </header>

      {/* Main Step Content */}
      <main className="flex flex-col gap-gutter-lg my-auto py-gutter-lg">
        {step === 1 && (
          <section className="flex flex-col gap-gutter-lg">
            <div className="flex flex-col gap-gutter-xs">
              <span className="font-label text-label-sm text-light-primary dark:text-dark-primary">
                Step 1 of 3 · Workspace &amp; preferences
              </span>
              <h1 className="font-headline text-headline-lg-mobile text-light-on-surface dark:text-dark-on-surface">
                Set up your tracker
              </h1>
              <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Choose your base currency, timezone, and monthly subscription cap.
              </p>
            </div>

            <div className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col gap-gutter-md">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="setup-name" className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  Your name
                </label>
                <input
                  id="setup-name"
                  type="text"
                  placeholder="e.g. Alex Morgan"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant font-body text-title-md focus:border-light-primary focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="setup-workspace" className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  Workspace / household name
                </label>
                <input
                  id="setup-workspace"
                  type="text"
                  placeholder="Personal or Household"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant font-body text-title-md focus:border-light-primary focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  Base currency
                </span>
                <div className="grid grid-cols-2 gap-gutter-xs">
                  {CURRENCIES.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => setCurrency(c.code)}
                      className={`min-h-[44px] px-3 rounded-md border font-label text-label-sm transition-colors ${
                        currency === c.code
                          ? 'bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary border-transparent'
                          : 'bg-light-surface-container-low dark:bg-dark-surface-container-low border-light-outline-variant dark:border-dark-outline-variant'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-gutter-sm">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="setup-country" className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                    Country
                  </label>
                  <input
                    id="setup-country"
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant font-body text-body-md"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                    Timezone
                  </span>
                  <div className="min-h-[44px] px-3 py-2 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant font-mono text-mono-sm flex items-center truncate">
                    {timezone}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                    Monthly budget cap
                  </span>
                  <span className="font-mono text-mono-md text-light-primary dark:text-dark-primary font-semibold">
                    {currency} {monthlyBudgetCap}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-gutter-xs">
                  {BUDGET_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setMonthlyBudgetCap(preset)}
                      className={`min-h-[40px] rounded-md border font-mono text-mono-sm ${
                        monthlyBudgetCap === preset
                          ? 'border-light-primary dark:border-dark-primary bg-light-primary/10 dark:bg-dark-primary/10 text-light-primary dark:text-dark-primary'
                          : 'border-light-outline-variant dark:border-dark-outline-variant bg-light-surface-container-low dark:bg-dark-surface-container-low'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="flex flex-col gap-gutter-lg">
            <div className="flex flex-col gap-gutter-xs">
              <span className="font-label text-label-sm text-light-primary dark:text-dark-primary">
                Step 2 of 3 · Quick-add subscriptions
              </span>
              <h1 className="font-headline text-headline-lg-mobile text-light-on-surface dark:text-dark-on-surface">
                Pick services you use
              </h1>
              <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Optional: tap any services below to pre-fill them, or continue with a blank slate.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-gutter-sm">
              {POPULAR_SERVICES.map((svc) => {
                const isSelected = selectedNames.includes(svc.name);
                return (
                  <button
                    key={svc.name}
                    type="button"
                    onClick={() => toggleService(svc.name)}
                    className={`min-h-[60px] px-3.5 py-2.5 rounded-lg bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest border flex items-center justify-between gap-2 text-left transition-colors ${
                      isSelected
                        ? 'border-light-primary dark:border-dark-primary shadow-sm'
                        : 'border-light-outline-variant dark:border-dark-outline-variant'
                    }`}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-label text-label-md text-light-on-surface dark:text-dark-on-surface truncate">
                        {svc.name}
                      </span>
                      <span className="font-mono text-mono-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                        ~{svc.price}/mo
                      </span>
                    </div>
                    <span
                      className={`material-symbols-outlined text-[20px] shrink-0 ${
                        isSelected
                          ? 'text-light-primary dark:text-dark-primary'
                          : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
                      }`}
                      aria-hidden="true"
                    >
                      {isSelected ? 'check_circle' : 'add_circle'}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="flex flex-col gap-gutter-lg">
            <div className="flex flex-col gap-gutter-xs">
              <span className="font-label text-label-sm text-light-primary dark:text-dark-primary">
                Step 3 of 3 · Alerts &amp; Home Screen
              </span>
              <h1 className="font-headline text-headline-lg-mobile text-light-on-surface dark:text-dark-on-surface">
                Stay ahead of renewals
              </h1>
              <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Enable reminders before trials convert and install SubPulse on your Home Screen.
              </p>
            </div>

            {/* Notification Permission Card */}
            <div className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col gap-gutter-md">
              <div className="flex items-center justify-between gap-gutter-sm">
                <div className="flex items-center gap-gutter-sm">
                  <span className="w-9 h-9 rounded-full bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-primary dark:text-dark-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                      notifications_active
                    </span>
                  </span>
                  <div className="flex flex-col">
                    <span className="font-title text-title-md">Renewal reminders</span>
                    <span className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                      1, 3, or 7 days before billing
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleEnablePush}
                  className={`min-h-[40px] px-3.5 rounded-md font-label text-label-sm ${
                    webPushEnabled
                      ? 'bg-success-container text-on-success-container'
                      : 'bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary'
                  }`}
                >
                  {webPushEnabled ? 'Enabled' : 'Allow push'}
                </button>
              </div>

              {pushStatusMsg && (
                <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  {pushStatusMsg}
                </p>
              )}

              <label className="flex items-center justify-between gap-gutter-sm pt-2 border-t border-light-outline-variant/60 dark:border-dark-outline-variant/60 cursor-pointer">
                <span className="font-body text-body-sm text-light-on-surface dark:text-dark-on-surface">
                  Email digest fallback (recommended on iOS)
                </span>
                <input
                  type="checkbox"
                  checked={emailFallbackEnabled}
                  onChange={(e) => setEmailFallbackEnabled(e.target.checked)}
                  className="w-5 h-5 accent-light-primary dark:accent-dark-primary"
                />
              </label>
            </div>

            {/* iOS Safari "Add to Home Screen" Install Guide Card */}
            <div
              aria-label="iOS Home Screen install guide"
              className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col gap-gutter-md"
            >
              <div className="flex items-center justify-between gap-gutter-sm">
                <h2 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface">
                  Install on iPhone
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-primary dark:text-dark-primary font-label text-label-sm shrink-0">
                  PWA
                </span>
              </div>

              <ol className="flex flex-col gap-gutter-sm">
                <li className="flex items-center gap-gutter-sm">
                  <span className="w-7 h-7 rounded-full bg-light-surface-container dark:bg-dark-surface-container text-light-primary dark:text-dark-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">ios_share</span>
                  </span>
                  <span className="font-body text-body-sm text-light-on-surface dark:text-dark-on-surface">
                    Tap the Share button in Safari&apos;s bottom bar
                  </span>
                </li>
                <li className="flex items-center gap-gutter-sm">
                  <span className="w-7 h-7 rounded-full bg-light-surface-container dark:bg-dark-surface-container text-light-primary dark:text-dark-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">add_box</span>
                  </span>
                  <span className="font-body text-body-sm text-light-on-surface dark:text-dark-on-surface">
                    Scroll down and choose &quot;Add to Home Screen&quot;
                  </span>
                </li>
                <li className="flex items-center gap-gutter-sm">
                  <span className="w-7 h-7 rounded-full bg-light-surface-container dark:bg-dark-surface-container text-light-primary dark:text-dark-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">home_app_logo</span>
                  </span>
                  <span className="font-body text-body-sm text-light-on-surface dark:text-dark-on-surface">
                    Launch from Home Screen for full-screen &amp; offline access
                  </span>
                </li>
              </ol>

              <PWAInstallButton />
            </div>
          </section>
        )}
      </main>

      {/* Primary Setup CTA */}
      <footer className="flex flex-col gap-gutter-sm">
        {step < 3 ? (
          <button
            type="button"
            onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
            className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] px-6 py-3 rounded-md bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-label text-label-lg transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            <span>
              {step === 2 && selectedNames.length > 0
                ? `Continue with ${selectedNames.length} ${selectedNames.length === 1 ? 'service' : 'services'}`
                : step === 2
                ? 'Skip for now'
                : 'Continue'}
            </span>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              arrow_forward
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleFinish}
            className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] px-6 py-3 rounded-md bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-label text-label-lg transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            <span>Finish setup</span>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              check
            </span>
          </button>
        )}
      </footer>
    </div>
  );
};
