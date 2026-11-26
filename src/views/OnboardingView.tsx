import React, { useState } from 'react';
import { PWAInstallButton } from '../components/PWAInstallButton';

interface OnboardingViewProps {
  onSkipToDemo: () => void;
  onCompleteWithServices: (services: string[]) => void;
}

const POPULAR_SERVICES = ['Netflix', 'Spotify', 'iCloud+', 'YouTube'];

export const OnboardingView: React.FC<OnboardingViewProps> = ({
  onSkipToDemo,
  onCompleteWithServices,
}) => {
  const [selected, setSelected] = useState<string[]>(['Netflix', 'Spotify']);

  const toggleService = (svc: string) => {
    setSelected((prev) =>
      prev.includes(svc) ? prev.filter((item) => item !== svc) : [...prev, svc]
    );
  };

  return (
    <div className="min-h-screen flex flex-col justify-between max-w-[430px] mx-auto px-page-margin pt-gutter-lg pb-10 bg-light-surface dark:bg-dark-surface text-light-on-surface dark:text-dark-on-surface">
      {/* Top Onboarding Bar: Step Indicators + Skip */}
      <header className="flex items-center justify-between gap-gutter-md">
        <div className="flex items-center gap-1.5" aria-label="Onboarding progress">
          <span className="w-6 h-1.5 rounded-full bg-light-primary dark:bg-dark-primary" />
          <span className="w-2 h-1.5 rounded-full bg-light-outline-variant dark:bg-dark-outline-variant" />
          <span className="w-2 h-1.5 rounded-full bg-light-outline-variant dark:bg-dark-outline-variant" />
        </div>

        <button
          type="button"
          onClick={onSkipToDemo}
          className="inline-flex items-center justify-center min-h-[44px] px-3 font-label text-label-lg text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface dark:hover:text-dark-on-surface"
        >
          Skip to demo
        </button>
      </header>

      {/* Main Step Content */}
      <main className="flex flex-col gap-gutter-xl my-auto py-gutter-lg">
        <section className="flex flex-col gap-gutter-lg">
          <div className="w-14 h-14 rounded-xl bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-[28px]" aria-hidden="true">
              calendar_today
            </span>
          </div>

          <div className="flex flex-col gap-gutter-sm">
            <h1 className="font-headline text-display-lg-mobile text-light-on-surface dark:text-dark-on-surface text-balance">
              Never miss a renewal again
            </h1>
            <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant text-pretty">
              Track household splits, catch ending free trials, and stay under your monthly cap. Tap services below to start:
            </p>
          </div>

          {/* Quick-Add Popular Services */}
          <div className="grid grid-cols-2 gap-gutter-sm">
            {POPULAR_SERVICES.map((svc) => {
              const isSelected = selected.includes(svc);
              return (
                <button
                  key={svc}
                  type="button"
                  onClick={() => toggleService(svc)}
                  className={`min-h-[48px] px-3.5 py-2.5 rounded-lg bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest border flex items-center justify-between gap-2 transition-colors ${
                    isSelected
                      ? 'border-light-primary dark:border-dark-primary shadow-sm'
                      : 'border-light-outline-variant dark:border-dark-outline-variant'
                  }`}
                >
                  <span className="font-label text-label-lg text-light-on-surface dark:text-dark-on-surface">
                    {svc}
                  </span>
                  <span
                    className={`material-symbols-outlined text-[18px] ${
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

        {/* iOS Safari "Add to Home Screen" Install Guide Card */}
        <section
          aria-label="iOS Home Screen install guide"
          className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col gap-gutter-md"
        >
          <div className="flex items-center justify-between gap-gutter-sm">
            <h2 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface">
              Install on iPhone
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-primary dark:text-dark-primary font-label text-label-sm shrink-0">
              Push alerts
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
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">notifications_active</span>
              </span>
              <span className="font-body text-body-sm text-light-on-surface dark:text-dark-on-surface">
                Open SubPulse from Home Screen to enable iOS push
              </span>
            </li>
          </ol>

          <PWAInstallButton />
        </section>
      </main>

      {/* Primary Onboarding CTA */}
      <footer className="flex flex-col gap-gutter-sm">
        <button
          type="button"
          onClick={() => onCompleteWithServices(selected)}
          className="w-full inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-md bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-label text-label-lg transition-opacity hover:opacity-90 active:scale-[0.98]"
        >
          {selected.length > 0
            ? `Continue with ${selected.length} ${selected.length === 1 ? 'service' : 'services'}`
            : 'Continue to dashboard'}
        </button>
      </footer>
    </div>
  );
};
