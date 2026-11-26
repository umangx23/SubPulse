import React from 'react';
import {
  formatCycleLabel,
  formatMoney,
  formatShortDate,
  getUserSharePrice,
} from '../lib/formatters';
import { Subscription } from '../types/subpulse';

interface SubscriptionDetailViewProps {
  subscription: Subscription;
  onBack: () => void;
  onEdit: (id: string) => void;
  onTogglePause: (id: string) => void;
  onCancelPlan: (id: string) => void;
}

export const SubscriptionDetailView: React.FC<SubscriptionDetailViewProps> = ({
  subscription,
  onBack,
  onEdit,
  onTogglePause,
  onCancelPlan,
}) => {
  const userShare = getUserSharePrice(subscription);
  const annualTotal = subscription.cycle === 'yearly' ? subscription.price : subscription.price * 12;
  const isPaused = subscription.status === 'paused';
  const isCancelled = subscription.status === 'cancelled';

  const statusBadge = () => {
    if (subscription.status === 'active') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-success-container text-on-success-container font-label text-label-sm shrink-0">
          <span className="material-symbols-outlined filled text-[14px]" aria-hidden="true">
            check_circle
          </span>
          <span>Active</span>
        </span>
      );
    }
    if (subscription.status === 'trial') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-light-error-container dark:bg-dark-error-container text-light-on-error-container dark:text-dark-on-error-container font-label text-label-sm shrink-0">
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">schedule</span>
          <span>Free trial</span>
        </span>
      );
    }
    if (subscription.status === 'paused') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-warning-container text-on-warning-container font-label text-label-sm shrink-0">
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">pause_circle</span>
          <span>Paused</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-light-surface-container-high dark:bg-dark-surface-container-high text-light-on-surface-variant dark:text-dark-on-surface-variant font-label text-label-sm shrink-0">
        <span>Cancelled</span>
      </span>
    );
  };

  return (
    <div className="flex flex-col flex-1">
      {/* Contextual Detail Header */}
      <header className="px-page-margin lg:px-gutter-xl pt-gutter-lg pb-gutter-md flex items-center justify-between gap-gutter-sm">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest text-light-on-surface dark:text-dark-on-surface border border-light-outline-variant dark:border-dark-outline-variant transition-colors hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low active:scale-95"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">arrow_back</span>
        </button>

        <span className="font-headline text-title-md text-light-on-surface dark:text-dark-on-surface">
          Subscription
        </span>

        <button
          type="button"
          onClick={() => onEdit(subscription.id)}
          className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-full bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest text-light-primary dark:text-dark-primary border border-light-outline-variant dark:border-dark-outline-variant font-label text-label-lg transition-colors hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low"
        >
          Edit
        </button>
      </header>

      <main className="px-page-margin lg:px-gutter-xl flex flex-col gap-gutter-lg flex-1 max-w-2xl lg:max-w-3xl w-full mx-auto lg:mx-0">
        {/* Hero Service Summary Card */}
        <article className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-xl shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col gap-gutter-lg">
          <div className="flex items-start justify-between gap-gutter-md">
            <div className="flex items-center gap-gutter-md">
              <div
                className={`w-14 h-14 rounded-lg ${subscription.avatarBg} flex items-center justify-center font-headline text-headline-md shrink-0`}
              >
                {subscription.initials}
              </div>
              <div className="flex flex-col gap-0.5">
                <h1 className="font-headline text-headline-lg-mobile text-light-on-surface dark:text-dark-on-surface">
                  {subscription.name}
                </h1>
                <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  {subscription.category} · {formatCycleLabel(subscription.cycle)}
                </p>
              </div>
            </div>

            {statusBadge()}
          </div>

          {/* Split Cost Summary */}
          <div className="grid grid-cols-2 gap-gutter-md pt-gutter-md border-t border-light-outline-variant dark:border-dark-outline-variant">
            <div className="flex flex-col gap-0.5">
              <span className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Your share
              </span>
              <span className="font-headline text-headline-lg-mobile text-light-primary dark:text-dark-primary tabular-nums">
                {formatMoney(userShare, subscription.currency)}
              </span>
              <span className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                {subscription.isShared ? `1 of ${subscription.splitCount} seats` : 'Individual plan'}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Total bill
              </span>
              <span className="font-headline text-headline-lg-mobile text-light-on-surface dark:text-dark-on-surface tabular-nums">
                {formatMoney(subscription.price, subscription.currency)}
              </span>
              <span className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums">
                {formatMoney(annualTotal, subscription.currency)} / yr
              </span>
            </div>
          </div>
        </article>

        {/* Billing & Reminder Details */}
        <section
          aria-label="Billing details"
          className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col gap-gutter-md"
        >
          <h2 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface">
            Billing &amp; reminders
          </h2>

          <dl className="flex flex-col gap-gutter-md">
            <div className="flex items-center justify-between gap-gutter-sm">
              <dt className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Next renewal
              </dt>
              <dd className="font-mono text-mono-md text-light-on-surface dark:text-dark-on-surface tabular-nums">
                {formatShortDate(subscription.nextBillingDate)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-gutter-sm">
              <dt className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Payment method
              </dt>
              <dd className="font-body text-body-md text-light-on-surface dark:text-dark-on-surface">
                {subscription.paymentMethod}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-gutter-sm">
              <dt className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Reminder alert
              </dt>
              <dd className="font-body text-body-md text-light-primary dark:text-dark-primary">
                {subscription.reminderDays} {subscription.reminderDays === 1 ? 'day' : 'days'} before
              </dd>
            </div>
            <div className="flex items-center justify-between gap-gutter-sm">
              <dt className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Started on
              </dt>
              <dd className="font-mono text-mono-md text-light-on-surface dark:text-dark-on-surface tabular-nums">
                {formatShortDate(subscription.startedOn)}
              </dd>
            </div>
          </dl>
        </section>

        {/* Shared Cost Split Members */}
        {subscription.isShared && subscription.splitCount > 1 && (
          <section
            aria-label="Shared cost split"
            className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col gap-gutter-md"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface">
                Shared split ({subscription.splitCount} ways)
              </h2>
              <span className="font-mono text-mono-sm text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums">
                {formatMoney(subscription.price / subscription.splitCount, subscription.currency)} each
              </span>
            </div>

            <div className="flex flex-wrap gap-gutter-sm">
              {subscription.sharedMembers.map((member) => (
                <span
                  key={member}
                  className="inline-flex items-center gap-1.5 min-h-[32px] px-3 py-1 rounded-full bg-light-surface-container dark:bg-dark-surface-container text-light-on-surface dark:text-dark-on-surface font-label text-label-sm"
                >
                  {member}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Notes & Account Link */}
        <section
          aria-label="Notes and account link"
          className="rounded-xl bg-light-surface-container-low dark:bg-dark-surface-container-low p-gutter-lg flex flex-col gap-gutter-sm"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface">Notes</h2>
            {subscription.manageUrl && (
              <a
                href={subscription.manageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-label text-label-sm text-light-primary dark:text-dark-primary hover:underline"
              >
                <span>Account page</span>
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">open_in_new</span>
              </a>
            )}
          </div>
          <p className="font-body text-body-md text-light-on-surface dark:text-dark-on-surface text-pretty">
            {subscription.notes || 'No notes added yet.'}
          </p>
          <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
            Never store service passwords in notes.
          </p>
        </section>

        {/* Quick Lifecycle Actions */}
        <section aria-label="Subscription actions" className="grid grid-cols-2 gap-gutter-md pb-6">
          <button
            type="button"
            onClick={() => onTogglePause(subscription.id)}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest text-light-on-surface dark:text-dark-on-surface border border-light-outline-variant dark:border-dark-outline-variant font-label text-label-lg transition-colors hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              {isPaused || isCancelled ? 'play_circle' : 'pause_circle'}
            </span>
            <span>{isPaused || isCancelled ? 'Resume plan' : 'Pause plan'}</span>
          </button>

          <button
            type="button"
            onClick={() => onCancelPlan(subscription.id)}
            disabled={isCancelled}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-md bg-light-error-container dark:bg-dark-error-container text-light-on-error-container dark:text-dark-on-error-container font-label text-label-lg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">cancel</span>
            <span>{isCancelled ? 'Cancelled' : 'Cancel plan'}</span>
          </button>
        </section>
      </main>
    </div>
  );
};
