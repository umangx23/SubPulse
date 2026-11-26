import React, { useState } from 'react';

interface SignInViewProps {
  defaultEmail: string;
  onSignIn: (email: string, guestMode: boolean) => void;
  onBackToIntro?: () => void;
}

export const SignInView: React.FC<SignInViewProps> = ({ defaultEmail, onSignIn, onBackToIntro }) => {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState(defaultEmail || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSignIn(email.trim() || 'guest@subpulse.app', false);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center max-w-[430px] mx-auto px-page-margin py-8 gap-gutter-xl bg-light-surface dark:bg-dark-surface text-light-on-surface dark:text-dark-on-surface">
      {/* Brand Header */}
      <header className="flex flex-col items-center text-center gap-gutter-sm">
        <div className="w-12 h-12 rounded-lg bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary flex items-center justify-center shadow-sm">
          <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
            account_balance_wallet
          </span>
        </div>
        <h1 className="font-headline text-headline-lg-mobile text-light-on-surface dark:text-dark-on-surface">
          {authMode === 'signin' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
          {authMode === 'signin'
            ? 'Sign in to sync your household subscriptions'
            : 'Save your subscriptions securely across devices'}
        </p>
        <div className="inline-flex p-1 rounded-full bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant mt-1">
          <button
            type="button"
            onClick={() => setAuthMode('signin')}
            className={`min-h-[36px] px-4 rounded-full font-label text-label-sm transition-colors ${
              authMode === 'signin'
                ? 'bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary'
                : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setAuthMode('signup')}
            className={`min-h-[36px] px-4 rounded-full font-label text-label-sm transition-colors ${
              authMode === 'signup'
                ? 'bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary'
                : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
            }`}
          >
            Create account
          </button>
        </div>
      </header>

      {/* Primary Auth Card */}
      <main className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-xl shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col gap-gutter-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-gutter-md">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="auth-email"
              className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant"
            >
              Email address
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface font-body text-title-md focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="auth-password"
              className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant"
            >
              Password
            </label>
            <div className="relative flex items-center">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                className="w-full min-h-[44px] pl-3.5 pr-11 py-2.5 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface font-body text-title-md focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1.5 w-9 h-9 rounded-full inline-flex items-center justify-center text-light-on-surface-variant dark:text-dark-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center min-h-[48px] px-5 py-2.5 rounded-md bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-label text-label-lg transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            {authMode === 'signin' ? 'Sign in' : 'Create account'}
          </button>

          <button
            type="button"
            onClick={() => onSignIn(email.trim() || 'guest@local', true)}
            className="w-full inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-md border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface font-label text-label-sm hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low"
          >
            Skip for now (use locally)
          </button>
        </form>
      </main>

      {/* Secondary Navigation */}
      <footer className="flex flex-col items-center gap-1 text-center">
        {onBackToIntro && (
          <button
            type="button"
            onClick={onBackToIntro}
            className="inline-flex items-center justify-center min-h-[40px] px-4 font-label text-label-sm text-light-primary dark:text-dark-primary hover:underline"
          >
            Replay intro &amp; setup
          </button>
        )}
      </footer>
    </div>
  );
};
