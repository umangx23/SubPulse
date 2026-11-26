import React, { useMemo, useRef, useState } from 'react';
import {
  formatCycleLabel,
  formatMoney,
  formatMonthDay,
  formatShortDate,
  getMonthlyShare,
  getUserSharePrice,
  parseCSVSubscriptions,
} from '../lib/formatters';
import { AppSettings, Subscription, SubscriptionStatus } from '../types/subpulse';

interface SubscriptionsViewProps {
  subscriptions: Subscription[];
  settings: AppSettings;
  initialFilter: SubscriptionStatus | 'all';
  onFilterChange: (filter: SubscriptionStatus | 'all') => void;
  onSelectSubscription: (id: string) => void;
  onAddNew: () => void;
  onImportSubscriptions: (items: Partial<Subscription>[]) => void;
}

export const SubscriptionsView: React.FC<SubscriptionsViewProps> = ({
  subscriptions,
  settings,
  initialFilter,
  onFilterChange,
  onSelectSubscription,
  onAddNew,
  onImportSubscriptions,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvInput, setCsvInput] = useState(
    'Service,Category,Cycle,Status,Next Renewal,Total Price,Split Count,Your Share,Currency,Notes\nNotion Plus,Productivity & AI,monthly,active,2026-12-05,10.00,1,10.00,USD,Team notes'
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const counts = useMemo(() => {
    return {
      all: subscriptions.length,
      active: subscriptions.filter((s) => s.status === 'active').length,
      trial: subscriptions.filter((s) => s.status === 'trial').length,
      paused: subscriptions.filter((s) => s.status === 'paused').length,
      cancelled: subscriptions.filter((s) => s.status === 'cancelled').length,
    };
  }, [subscriptions]);

  const monthlyShareTotal = useMemo(
    () => subscriptions.reduce((sum, s) => sum + getMonthlyShare(s), 0),
    [subscriptions]
  );

  const filteredSubs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return subscriptions.filter((s) => {
      const matchesStatus = initialFilter === 'all' || s.status === initialFilter;
      const matchesQuery =
        !q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [subscriptions, initialFilter, searchQuery]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const parsed = parseCSVSubscriptions(text);
      if (parsed.length > 0) {
        onImportSubscriptions(parsed);
        setShowImportModal(false);
      }
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseCSVSubscriptions(csvInput);
    if (parsed.length > 0) {
      onImportSubscriptions(parsed);
      setShowImportModal(false);
    }
  };

  const statusBadge = (status: SubscriptionStatus) => {
    switch (status) {
      case 'trial':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-light-error-container dark:bg-dark-error-container text-light-on-error-container dark:text-dark-on-error-container font-label text-label-sm">
            Trial
          </span>
        );
      case 'active':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-success-container text-on-success-container font-label text-label-sm">
            Active
          </span>
        );
      case 'paused':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-warning-container text-on-warning-container font-label text-label-sm">
            Paused
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-light-surface-container-high dark:bg-dark-surface-container-high text-light-on-surface-variant dark:text-dark-on-surface-variant font-label text-label-sm">
            Cancelled
          </span>
        );
    }
  };

  const filterChips: Array<{ id: SubscriptionStatus | 'all'; label: string; count: number }> = [
    { id: 'all', label: `All (${counts.all})`, count: counts.all },
    { id: 'active', label: `Active (${counts.active})`, count: counts.active },
    { id: 'trial', label: `Trials (${counts.trial})`, count: counts.trial },
    { id: 'paused', label: `Paused (${counts.paused})`, count: counts.paused },
  ];

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
              All plans
            </span>
            <span className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              {subscriptions.length} total · {formatMoney(monthlyShareTotal, settings.currency)}/mo
            </span>
          </div>
        </div>

        <div className="flex items-center gap-gutter-sm">
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            aria-label="Import CSV"
            className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">upload_file</span>
          </button>
          <button
            type="button"
            onClick={onAddNew}
            aria-label="Add subscription"
            className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-light-primary-container dark:bg-dark-primary-container text-light-on-primary shadow-sm transition-transform duration-state-change ease-state-change active:scale-95"
          >
            <span className="material-symbols-outlined text-[22px]" aria-hidden="true">add</span>
          </button>
        </div>
      </header>

      {/* DESKTOP HEADER */}
      <header className="hidden lg:flex px-gutter-xl pt-gutter-xl pb-gutter-md items-center justify-between gap-gutter-md">
        <div>
          <h1 className="font-headline text-headline-lg text-light-on-surface dark:text-dark-on-surface">
            All subscriptions
          </h1>
          <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
            {subscriptions.length} tracked plans · {formatMoney(monthlyShareTotal, settings.currency)}/mo household share
          </p>
        </div>
        <div className="flex items-center gap-gutter-sm">
          <div className="relative flex items-center w-64">
            <span
              className="material-symbols-outlined text-[18px] text-light-on-surface-variant dark:text-dark-on-surface-variant absolute left-3 pointer-events-none"
              aria-hidden="true"
            >
              search
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search plans..."
              aria-label="Search plans"
              className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface font-body text-title-md focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="min-h-[44px] px-4 py-2 rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface font-label text-label-sm inline-flex items-center gap-1.5 hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">upload_file</span>
            <span>Import CSV</span>
          </button>
        </div>
      </header>

      <main className="px-page-margin lg:px-gutter-xl flex flex-col gap-gutter-md lg:gap-gutter-lg flex-1">
        {/* Mobile Search Bar */}
        <div className="lg:hidden relative flex items-center">
          <span
            className="material-symbols-outlined text-[20px] text-light-on-surface-variant dark:text-dark-on-surface-variant absolute left-3.5 pointer-events-none"
            aria-hidden="true"
          >
            search
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search subscriptions..."
            aria-label="Search subscriptions"
            className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-full bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface placeholder:text-light-on-surface-variant font-body text-title-md focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
          />
        </div>

        {/* Filter Chips */}
        <section aria-label="Filter subscriptions" className="flex items-center gap-gutter-sm overflow-x-auto pb-0.5">
          {filterChips.map((chip) => {
            const active = initialFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => onFilterChange(chip.id)}
                className={`inline-flex items-center justify-center min-h-[36px] px-4 py-1.5 rounded-full font-label text-label-sm shrink-0 transition-colors ${
                  active
                    ? 'bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary'
                    : 'bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface-variant dark:text-dark-on-surface-variant hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </section>

        {filteredSubs.length === 0 ? (
          <section className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-xl shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col items-center text-center gap-gutter-md">
            <div className="w-12 h-12 rounded-full bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-primary dark:text-dark-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]" aria-hidden="true">search_off</span>
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface">
                No matching subscriptions
              </h2>
              <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Try clearing your search or switching status filters, or add a new plan.
              </p>
            </div>
            <div className="flex items-center gap-gutter-sm">
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  onFilterChange('all');
                }}
                className="min-h-[44px] px-4 py-2 rounded-md border border-light-outline-variant dark:border-dark-outline-variant font-label text-label-sm"
              >
                Reset filters
              </button>
              <button
                type="button"
                onClick={onAddNew}
                className="min-h-[44px] px-4 py-2 rounded-md bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-label text-label-sm"
              >
                Add subscription
              </button>
            </div>
          </section>
        ) : (
          <>
            {/* Mobile Subscription Rows */}
            <section aria-label="Subscription directory" className="lg:hidden flex flex-col gap-gutter-sm">
              {filteredSubs.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => onSelectSubscription(sub.id)}
                  className="w-full text-left rounded-lg bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_2px_12px_-2px_rgba(26,27,35,0.05)] flex items-center justify-between gap-gutter-md active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-center gap-gutter-md min-w-0">
                    <div
                      className={`w-11 h-11 rounded-md ${sub.avatarBg} flex items-center justify-center font-headline text-title-md shrink-0`}
                    >
                      {sub.initials}
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <h3 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface truncate">
                        {sub.name}
                      </h3>
                      <p
                        className={`font-body text-body-sm truncate ${
                          sub.status === 'trial'
                            ? 'text-light-tertiary dark:text-dark-tertiary'
                            : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
                        }`}
                      >
                        {sub.status === 'trial'
                          ? `Trial ends ${formatMonthDay(sub.nextBillingDate)} · ${sub.category}`
                          : sub.status === 'paused'
                          ? `Paused · Resumes ${formatMonthDay(sub.nextBillingDate)}`
                          : sub.isShared
                          ? `${formatMonthDay(sub.nextBillingDate)} · Split ${sub.splitCount} ways`
                          : `${formatMonthDay(sub.nextBillingDate)} · ${sub.category}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <p
                      className={`font-mono text-mono-md tabular-nums ${
                        sub.status === 'paused'
                          ? 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
                          : 'text-light-on-surface dark:text-dark-on-surface'
                      }`}
                    >
                      {formatMoney(getUserSharePrice(sub), sub.currency)}
                    </p>
                    <span
                      className={`font-label text-label-sm ${
                        sub.isShared
                          ? 'text-light-primary dark:text-dark-primary'
                          : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
                      }`}
                    >
                      {sub.status === 'paused'
                        ? 'Paused'
                        : sub.isShared
                        ? 'Your share'
                        : formatCycleLabel(sub.cycle)}
                    </span>
                  </div>
                </button>
              ))}
            </section>

            {/* Desktop Subscriptions Data Table */}
            <section
              aria-label="Subscriptions table"
              className="hidden lg:block rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] overflow-hidden"
            >
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-light-outline-variant dark:border-dark-outline-variant bg-light-surface-container-low dark:bg-dark-surface-container-low">
                    <th className="py-3.5 px-4 font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                      Service
                    </th>
                    <th className="py-3.5 px-4 font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                      Category
                    </th>
                    <th className="py-3.5 px-4 font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                      Cycle
                    </th>
                    <th className="py-3.5 px-4 font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                      Next renewal
                    </th>
                    <th className="py-3.5 px-4 font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                      Status
                    </th>
                    <th className="py-3.5 px-4 font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant text-right">
                      Your share
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-light-outline-variant dark:divide-dark-outline-variant">
                  {filteredSubs.map((sub) => (
                    <tr
                      key={sub.id}
                      onClick={() => onSelectSubscription(sub.id)}
                      className="hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4 font-title text-title-md text-light-on-surface dark:text-dark-on-surface">
                        <div className="flex items-center gap-gutter-sm">
                          <span
                            className={`w-8 h-8 rounded-sm ${sub.avatarBg} inline-flex items-center justify-center font-headline text-label-sm shrink-0`}
                          >
                            {sub.initials}
                          </span>
                          <span>{sub.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                        {sub.category}
                      </td>
                      <td className="py-3.5 px-4 font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                        {sub.isShared
                          ? `${formatCycleLabel(sub.cycle)} · ${sub.splitCount}-way split`
                          : formatCycleLabel(sub.cycle)}
                      </td>
                      <td
                        className={`py-3.5 px-4 font-mono text-mono-sm tabular-nums ${
                          sub.status === 'trial'
                            ? 'text-light-tertiary dark:text-dark-tertiary'
                            : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
                        }`}
                      >
                        {formatShortDate(sub.nextBillingDate)}
                      </td>
                      <td className="py-3.5 px-4">{statusBadge(sub.status)}</td>
                      <td
                        className={`py-3.5 px-4 font-mono text-mono-md text-right tabular-nums ${
                          sub.status === 'paused'
                            ? 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
                            : 'text-light-on-surface dark:text-dark-on-surface'
                        }`}
                      >
                        {formatMoney(getUserSharePrice(sub), sub.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>

      {/* Import CSV Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleImportSubmit}
            className="w-full max-w-lg rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-xl shadow-xl flex flex-col gap-gutter-md border border-light-outline-variant dark:border-dark-outline-variant"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-headline text-headline-md text-light-on-surface dark:text-dark-on-surface">
                Import subscriptions (CSV)
              </h2>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="w-9 h-9 rounded-full inline-flex items-center justify-center hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex items-center justify-between gap-gutter-sm">
              <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Upload a `.csv` file or paste rows below.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[40px] px-3 py-1.5 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-primary dark:text-dark-primary font-label text-label-sm shrink-0"
              >
                Choose CSV file
              </button>
            </div>

            <textarea
              rows={5}
              value={csvInput}
              onChange={(e) => setCsvInput(e.target.value)}
              className="w-full p-3 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant font-mono text-mono-sm text-light-on-surface dark:text-dark-on-surface focus:border-light-primary focus:outline-none"
            />

            <div className="flex items-center justify-end gap-gutter-sm">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="min-h-[44px] px-4 py-2 rounded-md border border-light-outline-variant dark:border-dark-outline-variant font-label text-label-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 py-2 rounded-md bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-label text-label-lg"
              >
                Import rows
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
