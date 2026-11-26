import React, { useState } from 'react';

interface SignInViewProps {
  defaultEmail: string;
  onSignIn: (email: string, guestMode: boolean) => void;
}

export const SignInView: React.FC<SignInViewProps> = ({ defaultEmail, onSignIn }) => {
  const [email, setEmail] = useState(defaultEmail || 'alex.morgan@icloud.com');
  const [password, setPassword] = useState('••••••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSignIn(email.trim() || 'alex.morgan@icloud.com', false);
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
          Welcome back
        </h1>
        <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
          Sign in to sync your household subscriptions
        </p>
      </header>

      {/* Primary Auth Card */}
      <main className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-xl shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col gap-gutter-lg">
        {/* Social & Passkey Quick Sign-In */}
        <div className="flex flex-col gap-gutter-sm">
          <button
            type="button"
            onClick={() => onSignIn(email, false)}
            className="w-full min-h-[48px] px-4 py-2.5 rounded-md bg-light-inverse-surface dark:bg-dark-inverse-surface text-light-inverse-on-surface dark:text-dark-inverse-on-surface font-label text-label-lg inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">phone_iphone</span>
            <span>Sign in with Apple</span>
          </button>

          <div className="grid grid-cols-2 gap-gutter-sm">
            <button
              type="button"
              onClick={() => onSignIn(email, false)}
              className="min-h-[44px] px-3 py-2 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-on-surface dark:text-dark-on-surface border border-light-outline-variant dark:border-dark-outline-variant font-label text-label-sm inline-flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">passkey</span>
              <span>Face ID</span>
            </button>
            <button
              type="button"
              onClick={() => onSignIn(email, false)}
              className="min-h-[44px] px-3 py-2 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-on-surface dark:text-dark-on-surface border border-light-outline-variant dark:border-dark-outline-variant font-label text-label-sm inline-flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">account_circle</span>
              <span>Google</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-gutter-sm">
          <span className="h-px flex-1 bg-light-outline-variant dark:bg-dark-outline-variant" />
          <span className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
            or email
          </span>
          <span className="h-px flex-1 bg-light-outline-variant dark:bg-dark-outline-variant" />
        </div>

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
              required
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface font-body text-title-md focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="auth-password"
                className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant"
              >
                Password
              </label>
              <button
                type="button"
                onClick={() => setMagicLinkSent(true)}
                className="font-label text-label-sm text-light-primary dark:text-dark-primary"
              >
                Forgot?
              </button>
            </div>
            <div className="relative flex items-center">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

          {magicLinkSent && (
            <p className="font-body text-body-sm text-success">
              One-time sign-in link sent to {email}.
            </p>
          )}

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center min-h-[48px] px-5 py-2.5 rounded-md bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-label text-label-lg transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            Sign in
          </button>

          <button
            type="button"
            onClick={() => setMagicLinkSent(true)}
            className="w-full min-h-[44px] px-4 py-2 rounded-md text-light-primary dark:text-dark-primary font-label text-label-sm"
          >
            Send one-time magic link instead
          </button>
        </form>
      </main>

      {/* Local-only / Guest Mode */}
      <footer className="text-center">
        <button
          type="button"
          onClick={() => onSignIn(email, true)}
          className="inline-flex items-center justify-center min-h-[44px] px-4 font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface dark:hover:text-dark-on-surface"
        >
          Continue in local-only guest mode
        </button>
      </footer>
    </div>
  );
};
