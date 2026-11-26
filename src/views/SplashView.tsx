import React, { useEffect } from 'react';

interface SplashViewProps {
  isHydrating: boolean;
  onComplete: () => void;
}

export const SplashView: React.FC<SplashViewProps> = ({ isHydrating, onComplete }) => {
  useEffect(() => {
    if (isHydrating) return;
    const timer = window.setTimeout(() => {
      onComplete();
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [isHydrating, onComplete]);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-between max-w-[430px] mx-auto px-page-margin py-12 bg-light-surface dark:bg-dark-surface text-light-on-surface dark:text-dark-on-surface select-none">
      <div className="h-6" aria-hidden="true" />

      <div className="flex flex-col items-center text-center gap-gutter-lg animate-fade-in">
        <div className="relative flex items-center justify-center">
          <span
            className="absolute w-24 h-24 rounded-3xl bg-light-primary/15 dark:bg-dark-primary/15 animate-ping"
            style={{ animationDuration: '1.8s' }}
            aria-hidden="true"
          />
          <div className="relative w-20 h-20 rounded-2xl bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary flex items-center justify-center shadow-lg">
            <span className="material-symbols-outlined text-[40px]" aria-hidden="true">
              account_balance_wallet
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <h1 className="font-headline text-display-lg-mobile text-light-on-surface dark:text-dark-on-surface tracking-tight">
            SubPulse
          </h1>
          <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
            Subscriptions, splits &amp; smart budgets
          </p>
        </div>
      </div>

      <div className="w-full max-w-[200px] flex flex-col items-center gap-gutter-sm">
        <div className="w-full h-1 rounded-full bg-light-surface-container-high dark:bg-dark-surface-container-high overflow-hidden">
          <div className="h-full w-2/3 rounded-full bg-light-primary dark:bg-dark-primary animate-pulse" />
        </div>
        <span className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
          {isHydrating ? 'Loading local vault…' : 'Preparing workspace…'}
        </span>
      </div>
    </div>
  );
};

