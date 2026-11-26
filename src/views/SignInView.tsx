import React, { useEffect, useState } from 'react';
import {
  formatCloudError,
  requestPasswordReset,
  resendSignupConfirmation,
  signInWithEmail,
  signUpWithEmail,
  updateAccountPassword,
} from '../lib/cloudSync';
import { isSupabaseConfigured } from '../lib/supabase';

export type AuthScreenMode = 'signin' | 'signup' | 'reset' | 'recovery';

interface SignInViewProps {
  defaultEmail: string;
  defaultName?: string;
  initialMode?: AuthScreenMode;
  localSubscriptionCount: number;
  localMemberCount: number;
  onAuthSuccess: (email: string, userId: string, fullName?: string) => void;
  onContinueAsGuest: () => void;
  onPasswordUpdated?: () => void;
}

export const SignInView: React.FC<SignInViewProps> = ({
  defaultEmail,
  defaultName = '',
  initialMode = 'signin',
  localSubscriptionCount,
  localMemberCount,
  onAuthSuccess,
  onContinueAsGuest,
  onPasswordUpdated,
}) => {
  const [authMode, setAuthMode] = useState<AuthScreenMode>(initialMode);
  const [fullName, setFullName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [awaitingEmailConfirm, setAwaitingEmailConfirm] = useState<string | null>(null);

  useEffect(() => {
    setAuthMode(initialMode);
    setAuthError(null);
    setStatusNotice(null);
  }, [initialMode]);

  const hasLocalBackupData = localSubscriptionCount > 0 || localMemberCount > 0;

  const switchMode = (next: AuthScreenMode) => {
    setAuthMode(next);
    setAuthError(null);
    setStatusNotice(null);
    setAwaitingEmailConfirm(null);
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setStatusNotice(null);

    if (!isSupabaseConfigured) {
      setAuthError(
        'Cloud sync is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY or continue in Guest Mode.'
      );
      return;
    }

    if (authMode === 'recovery') {
      if (password.length < 6) {
        setAuthError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setAuthError('Passwords do not match.');
        return;
      }
      setIsSubmitting(true);
      try {
        await updateAccountPassword(password);
        setStatusNotice('Your password has been updated.');
        setPassword('');
        setConfirmPassword('');
        if (onPasswordUpdated) {
          onPasswordUpdated();
        } else {
          switchMode('signin');
        }
      } catch (err) {
        setAuthError(formatCloudError(err));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setAuthError('Please enter a valid email address.');
      return;
    }

    if (authMode === 'reset') {
      setIsSubmitting(true);
      try {
        await requestPasswordReset(trimmedEmail);
        setStatusNotice(
          `Password reset link sent to ${trimmedEmail}. Open the link in your email to set a new password.`
        );
      } catch (err) {
        setAuthError(formatCloudError(err));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }

    if (authMode === 'signup' && password !== confirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (authMode === 'signup') {
        const res = await signUpWithEmail(trimmedEmail, password, fullName);
        if (res.user && !res.session) {
          setAwaitingEmailConfirm(trimmedEmail);
          setStatusNotice(
            `Account created! Confirm your email at ${trimmedEmail}, then sign in to back up your local data.`
          );
          setAuthMode('signin');
          setPassword('');
          setConfirmPassword('');
          return;
        }
        if (res.user?.id) {
          onAuthSuccess(res.user.email || trimmedEmail, res.user.id, fullName.trim() || undefined);
        }
      } else {
        const res = await signInWithEmail(trimmedEmail, password);
        if (res.user?.id) {
          const metaName =
            typeof res.user.user_metadata?.full_name === 'string'
              ? res.user.user_metadata.full_name
              : undefined;
          onAuthSuccess(res.user.email || trimmedEmail, res.user.id, metaName);
        }
      }
    } catch (err) {
      setAuthError(formatCloudError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    const targetEmail = awaitingEmailConfirm || email.trim();
    if (!targetEmail || !isSupabaseConfigured) return;
    setIsResending(true);
    setAuthError(null);
    try {
      await resendSignupConfirmation(targetEmail);
      setStatusNotice(`Confirmation email resent to ${targetEmail}.`);
    } catch (err) {
      setAuthError(formatCloudError(err));
    } finally {
      setIsResending(false);
    }
  };

  const titleByMode: Record<AuthScreenMode, string> = {
    signin: 'Sign in with email',
    signup: 'Create your account',
    reset: 'Reset your password',
    recovery: 'Set a new password',
  };

  const subtitleByMode: Record<AuthScreenMode, string> = {
    signin: 'Back up local data and sync subscriptions across your devices.',
    signup: 'Use your email and a password to save your SubPulse data to the cloud.',
    reset: 'Enter the email linked to your account to receive a reset link.',
    recovery: 'Choose a new password for your SubPulse account.',
  };

  return (
    <div className="min-h-[100dvh] flex flex-col justify-center max-w-[440px] mx-auto px-page-margin py-8 gap-gutter-lg bg-light-surface dark:bg-dark-surface text-light-on-surface dark:text-dark-on-surface">
      {/* Top Return Bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onContinueAsGuest}
          className="inline-flex items-center gap-1.5 min-h-[40px] px-2 -ml-2 rounded-md text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface dark:hover:text-dark-on-surface font-label text-label-sm"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            arrow_back
          </span>
          <span>Back to Dashboard</span>
        </button>
      </div>

      {/* Brand Header */}
      <header className="flex flex-col items-center text-center gap-gutter-sm">
        <div className="w-12 h-12 rounded-lg bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary flex items-center justify-center shadow-sm">
          <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
            account_balance_wallet
          </span>
        </div>
        <h1 className="font-headline text-headline-lg-mobile text-light-on-surface dark:text-dark-on-surface">
          {titleByMode[authMode]}
        </h1>
        <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant text-pretty">
          {subtitleByMode[authMode]}
        </p>

        {(authMode === 'signin' || authMode === 'signup') && (
          <div className="grid grid-cols-2 p-1 rounded-md bg-light-surface-container dark:bg-dark-surface-container w-full max-w-[280px] mt-1">
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className={`min-h-[38px] px-3 rounded-DEFAULT font-label text-label-sm transition-colors ${
                authMode === 'signin'
                  ? 'bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest text-light-primary dark:text-dark-primary shadow-sm'
                  : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`min-h-[38px] px-3 rounded-DEFAULT font-label text-label-sm transition-colors ${
                authMode === 'signup'
                  ? 'bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest text-light-primary dark:text-dark-primary shadow-sm'
                  : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
              }`}
            >
              Create account
            </button>
          </div>
        )}
      </header>

      {/* Local Data Preservation Banner */}
      {hasLocalBackupData && authMode !== 'recovery' && (
        <div className="rounded-lg bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant px-gutter-md py-3 flex items-start gap-gutter-sm">
          <span
            className="material-symbols-outlined text-[20px] text-light-primary dark:text-dark-primary shrink-0 mt-0.5"
            aria-hidden="true"
          >
            cloud_upload
          </span>
          <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
            <span className="font-medium text-light-on-surface dark:text-dark-on-surface">
              Local data ready to back up:
            </span>{' '}
            {localSubscriptionCount} {localSubscriptionCount === 1 ? 'subscription' : 'subscriptions'}
            {localMemberCount > 0
              ? ` and ${localMemberCount} household ${localMemberCount === 1 ? 'member' : 'members'}`
              : ''}
            . If your account already has cloud data, you&apos;ll choose how to merge it.
          </p>
        </div>
      )}

      {/* Unconfigured Supabase Warning */}
      {!isSupabaseConfigured && (
        <div className="rounded-lg bg-warning-container/60 text-on-warning-container px-gutter-md py-3 flex items-start gap-gutter-sm">
          <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5" aria-hidden="true">
            info
          </span>
          <p className="font-body text-body-sm">
            Supabase environment variables (<span className="font-mono">VITE_SUPABASE_URL</span> &amp;{' '}
            <span className="font-mono">VITE_SUPABASE_ANON_KEY</span>) are not set yet. You can keep using
            SubPulse locally in Guest Mode.
          </p>
        </div>
      )}

      {/* Primary Email Auth Card */}
      <main className="sp-card rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-xl shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col gap-gutter-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-gutter-md">
          {authMode === 'signup' && (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="auth-name"
                className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant"
              >
                Full name (optional)
              </label>
              <input
                id="auth-name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Morgan"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface font-body text-title-md focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
              />
            </div>
          )}

          {authMode !== 'recovery' && (
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
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface font-body text-title-md focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
              />
            </div>
          )}

          {authMode !== 'reset' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="auth-password"
                  className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant"
                >
                  {authMode === 'recovery' ? 'New password' : 'Password'}
                </label>
                {authMode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => switchMode('reset')}
                    className="font-label text-label-sm text-light-primary dark:text-dark-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative flex items-center">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  minLength={6}
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
          )}

          {(authMode === 'signup' || authMode === 'recovery') && (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="auth-confirm-password"
                className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant"
              >
                Confirm password
              </label>
              <input
                id="auth-confirm-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                minLength={6}
                required
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface font-body text-title-md focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
              />
            </div>
          )}

          {authError && (
            <p
              role="alert"
              className="rounded-md bg-light-error-container/60 dark:bg-dark-error-container/40 px-3 py-2 font-body text-body-sm text-light-on-error-container dark:text-dark-on-error-container"
            >
              {authError}
            </p>
          )}

          {statusNotice && (
            <div
              role="status"
              className="rounded-md bg-success-container/40 dark:bg-success/15 px-3 py-2.5 flex flex-col gap-2"
            >
              <p className="font-body text-body-sm text-light-on-surface dark:text-dark-on-surface">
                {statusNotice}
              </p>
              {awaitingEmailConfirm && (
                <button
                  type="button"
                  disabled={isResending}
                  onClick={handleResendConfirmation}
                  className="self-start font-label text-label-sm text-light-primary dark:text-dark-primary hover:underline disabled:opacity-60"
                >
                  {isResending ? 'Resending…' : 'Resend confirmation email'}
                </button>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !isSupabaseConfigured}
            className="sp-btn w-full inline-flex items-center justify-center min-h-[48px] px-5 py-2.5 rounded-md bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-label text-label-lg disabled:opacity-50"
          >
            {isSubmitting
              ? authMode === 'signin'
                ? 'Signing in…'
                : authMode === 'signup'
                ? 'Creating account…'
                : authMode === 'reset'
                ? 'Sending reset link…'
                : 'Updating password…'
              : authMode === 'signin'
              ? 'Sign in with email'
              : authMode === 'signup'
              ? 'Create account & back up'
              : authMode === 'reset'
              ? 'Send password reset email'
              : 'Save new password'}
          </button>

          {authMode === 'reset' && (
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="w-full min-h-[42px] px-4 py-2 rounded-md text-light-primary dark:text-dark-primary font-label text-label-sm hover:underline"
            >
              Back to sign in
            </button>
          )}

          {authMode !== 'recovery' && (
            <div className="pt-gutter-sm border-t border-light-outline-variant dark:border-dark-outline-variant flex flex-col gap-2">
              <button
                type="button"
                onClick={onContinueAsGuest}
                className="sp-btn w-full inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-md border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface font-label text-label-sm hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low"
              >
                Continue as Guest (keep data on this device)
              </button>
            </div>
          )}
        </form>
      </main>
    </div>
  );
};
