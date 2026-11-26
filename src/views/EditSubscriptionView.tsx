import React, { useState } from 'react';
import { computeInitials, formatMoney } from '../lib/formatters';
import {
  BillingCycle,
  CurrencyCode,
  Subscription,
  SubscriptionCategory,
  SubscriptionStatus,
} from '../types/subpulse';

interface EditSubscriptionViewProps {
  existing?: Subscription;
  defaultCurrency: CurrencyCode;
  onCancel: () => void;
  onSave: (sub: Subscription, isNew: boolean) => void;
  onArchive?: (id: string) => void;
}

const AVATAR_COLORS = [
  'bg-light-primary-container dark:bg-dark-primary-container text-light-on-primary',
  'bg-success text-on-success',
  'bg-light-secondary dark:bg-dark-secondary text-light-on-secondary dark:text-dark-on-secondary',
  'bg-accent text-on-accent',
];

export const EditSubscriptionView: React.FC<EditSubscriptionViewProps> = ({
  existing,
  defaultCurrency,
  onCancel,
  onSave,
  onArchive,
}) => {
  const isNew = !existing;
  const [name, setName] = useState(existing?.name || '');
  const [price, setPrice] = useState(existing ? String(existing.price) : '12.99');
  const [currency, setCurrency] = useState<CurrencyCode>(existing?.currency || defaultCurrency);
  const [category, setCategory] = useState<SubscriptionCategory>(existing?.category || 'Entertainment');
  const [status, setStatus] = useState<SubscriptionStatus>(existing?.status || 'active');
  const [cycle, setCycle] = useState<BillingCycle>(existing?.cycle || 'monthly');
  const [nextBillingDate, setNextBillingDate] = useState(existing?.nextBillingDate || '2026-12-01');
  const [reminderDays, setReminderDays] = useState<1 | 3 | 7>(existing?.reminderDays || 3);
  const [isShared, setIsShared] = useState(existing?.isShared ?? false);
  const [splitCount, setSplitCount] = useState(existing?.splitCount && existing.splitCount > 1 ? existing.splitCount : 2);
  const [paymentMethod, setPaymentMethod] = useState(existing?.paymentMethod || 'Apple Pay · ••4821');
  const [manageUrl, setManageUrl] = useState(existing?.manageUrl || 'https://');
  const [notes, setNotes] = useState(existing?.notes || '');

  const numericPrice = Math.max(0, parseFloat(price) || 0);
  const effectiveSplit = isShared ? Math.max(2, splitCount) : 1;
  const perPersonShare = numericPrice / effectiveSplit;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const defaultMembers = ['Alex (You)', 'Sam', 'Jordan', 'Maya', 'Taylor', 'Casey'];
    const membersList = isShared ? defaultMembers.slice(0, effectiveSplit) : ['Alex (You)'];

    const payload: Subscription = {
      id: existing?.id || `sub-${Date.now()}`,
      name: name.trim(),
      initials: existing?.initials || computeInitials(name),
      avatarBg: existing?.avatarBg || AVATAR_COLORS[name.length % AVATAR_COLORS.length],
      category,
      price: numericPrice,
      currency,
      cycle,
      status,
      nextBillingDate,
      reminderDays,
      startedOn: existing?.startedOn || '2026-11-26',
      paymentMethod: paymentMethod.trim() || 'Apple Pay',
      isShared,
      splitCount: effectiveSplit,
      sharedMembers: existing?.isShared && existing.sharedMembers.length === effectiveSplit ? existing.sharedMembers : membersList,
      manageUrl: manageUrl.trim(),
      notes: notes.trim(),
      priceChangeDelta: existing?.priceChangeDelta,
      trialEndsSoon: status === 'trial',
    };

    onSave(payload, isNew);
  };

  return (
    <div className="flex flex-col flex-1 pb-12">
      {/* Task Flow Header */}
      <header className="px-page-margin lg:px-gutter-xl pt-gutter-lg pb-gutter-md flex items-center justify-between gap-gutter-sm sticky top-0 z-20 bg-light-surface dark:bg-dark-surface">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel editing"
          className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest text-light-on-surface dark:text-dark-on-surface border border-light-outline-variant dark:border-dark-outline-variant transition-colors hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
        </button>

        <h1 className="font-headline text-title-md text-light-on-surface dark:text-dark-on-surface">
          {isNew ? 'Add subscription' : 'Edit subscription'}
        </h1>

        <button
          type="submit"
          form="subscription-form"
          className="inline-flex items-center justify-center min-h-[44px] px-5 py-2 rounded-md bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-label text-label-lg transition-colors hover:opacity-90 active:scale-[0.98]"
        >
          Save
        </button>
      </header>

      <main className="px-page-margin lg:px-gutter-xl flex-1 max-w-2xl w-full mx-auto lg:mx-0">
        <form id="subscription-form" onSubmit={handleSubmit} className="flex flex-col gap-gutter-lg">
          {/* Core Service Info Card */}
          <section
            aria-label="Service details"
            className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col gap-gutter-md"
          >
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="sub-name"
                className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant"
              >
                Service name
              </label>
              <input
                id="sub-name"
                type="text"
                placeholder="e.g. Spotify Family"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface font-body text-title-md focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-gutter-md">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="sub-price"
                  className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant"
                >
                  Price
                </label>
                <input
                  id="sub-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface font-mono text-title-md tabular-nums focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="sub-currency"
                  className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant"
                >
                  Currency
                </label>
                <select
                  id="sub-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface font-body text-title-md focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CAD">CAD ($)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-gutter-md">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="sub-category"
                  className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant"
                >
                  Category
                </label>
                <select
                  id="sub-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SubscriptionCategory)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface font-body text-title-md focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
                >
                  <option value="Entertainment">Entertainment</option>
                  <option value="Productivity & AI">Productivity &amp; AI</option>
                  <option value="Cloud & Utilities">Cloud &amp; Utilities</option>
                  <option value="Fitness">Fitness</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="sub-status"
                  className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant"
                >
                  Status
                </label>
                <select
                  id="sub-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface font-body text-title-md focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
                >
                  <option value="active">Active</option>
                  <option value="trial">Free trial</option>
                  <option value="paused">Paused</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </section>

          {/* Billing Cycle & Dates */}
          <section
            aria-label="Billing schedule"
            className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col gap-gutter-md"
          >
            <div className="flex flex-col gap-1.5">
              <span className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Billing cycle
              </span>
              <div className="flex flex-wrap gap-gutter-sm">
                {(['weekly', 'monthly', 'quarterly', 'yearly'] as BillingCycle[]).map((c) => {
                  const active = cycle === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCycle(c)}
                      className={`min-h-[36px] px-3.5 py-1.5 rounded-full font-label text-label-sm transition-colors ${
                        active
                          ? 'bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary'
                          : 'bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-on-surface-variant dark:text-dark-on-surface-variant border border-light-outline-variant dark:border-dark-outline-variant'
                      }`}
                    >
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-gutter-md">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="sub-next-date"
                  className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant"
                >
                  Next billing date
                </label>
                <input
                  id="sub-next-date"
                  type="date"
                  value={nextBillingDate}
                  onChange={(e) => setNextBillingDate(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2.5 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface font-mono text-title-md tabular-nums focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="sub-reminder"
                  className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant"
                >
                  Remind me
                </label>
                <select
                  id="sub-reminder"
                  value={reminderDays}
                  onChange={(e) => setReminderDays(Number(e.target.value) as 1 | 3 | 7)}
                  className="w-full min-h-[44px] px-3 py-2.5 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface font-body text-title-md focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
                >
                  <option value={1}>1 day before</option>
                  <option value={3}>3 days before</option>
                  <option value={7}>7 days before</option>
                </select>
              </div>
            </div>

            {/* Shared Cost Split */}
            <div className="flex flex-col gap-gutter-sm pt-gutter-sm border-t border-light-outline-variant dark:border-dark-outline-variant">
              <div className="flex items-center justify-between gap-gutter-md">
                <div className="flex flex-col">
                  <span className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface">
                    Shared household split
                  </span>
                  <span className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                    {isShared
                      ? `Divided across ${effectiveSplit} members (${formatMoney(perPersonShare, currency)} each)`
                      : 'Individual subscription (100% your share)'}
                  </span>
                </div>
                <input
                  id="shared-toggle"
                  type="checkbox"
                  checked={isShared}
                  onChange={(e) => setIsShared(e.target.checked)}
                  aria-label="Enable shared household split"
                  className="w-6 h-6 rounded-sm text-light-primary focus:ring-light-primary border-light-outline-variant"
                />
              </div>

              {isShared && (
                <div className="flex items-center justify-between gap-gutter-sm pt-1">
                  <label
                    htmlFor="split-count"
                    className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant"
                  >
                    Number of seats / members
                  </label>
                  <select
                    id="split-count"
                    value={splitCount}
                    onChange={(e) => setSplitCount(Number(e.target.value))}
                    className="min-h-[40px] px-3 py-1 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant font-mono text-mono-sm"
                  >
                    {[2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} ways
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </section>

          {/* Account Link & Notes */}
          <section
            aria-label="Account link and notes"
            className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col gap-gutter-md"
          >
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="sub-payment"
                className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant"
              >
                Payment method
              </label>
              <input
                id="sub-payment"
                type="text"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface font-body text-title-md focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="sub-url"
                className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant"
              >
                Manage or cancel link
              </label>
              <input
                id="sub-url"
                type="url"
                value={manageUrl}
                onChange={(e) => setManageUrl(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface font-body text-title-md focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="sub-notes"
                className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant"
              >
                Notes
              </label>
              <textarea
                id="sub-notes"
                rows={2}
                placeholder="Billed to Alex's Apple Pay. Never store service passwords here."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface font-body text-title-md focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
              />
            </div>
          </section>

          {/* Destructive Archive / Delete */}
          {!isNew && existing && onArchive && (
            <button
              type="button"
              onClick={() => onArchive(existing.id)}
              className="w-full min-h-[48px] px-5 py-3 rounded-md bg-light-error-container dark:bg-dark-error-container text-light-on-error-container dark:text-dark-on-error-container font-label text-label-lg transition-opacity hover:opacity-90"
            >
              Archive subscription
            </button>
          )}
        </form>
      </main>
    </div>
  );
};
