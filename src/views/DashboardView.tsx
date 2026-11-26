import React, { useMemo, useState } from 'react';
import { CalendarWidget } from '../components/CalendarWidget';
import { REFERENCE_TODAY } from '../data/seedData';
import {
  daysBetween,
  downloadFile,
  formatMoney,
  formatMonthDay,
  formatWeekdayAndDate,
  getMonthlyShare,
  getUserSharePrice,
  subscriptionsToCSV,
} from '../lib/formatters';
import {
  AppSettings,
  AppView,
  Subscription,
  SubscriptionCategory,
  SubscriptionStatus,
} from '../types/subpulse';

interface DashboardViewProps {
  subscriptions: Subscription[];
  settings: AppSettings;
  isDark: boolean;
  unreadAlertsCount: number;
  isLoading: boolean;
  onToggleTheme: () => void;
  onNavigate: (view: AppView) => void;
  onFilterPlans: (status: SubscriptionStatus | 'all') => void;
  onSelectSubscription: (id: string) => void;
  onAddNew: () => void;
  onShowToast: (msg: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  subscriptions,
  settings,
  isDark,
  unreadAlertsCount,
  isLoading,
  onToggleTheme,
  onNavigate,
  onFilterPlans,
  onSelectSubscription,
  onAddNew,
  onShowToast,
}) => {
  const [isYearly, setIsYearly] = useState(false);
  const [budgetDrawerOpen, setBudgetDrawerOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'list' | 'calendar'>('list');
  const [windowFilter, setWindowFilter] = useState<'7d' | '30d'>('7d');

  const stats = useMemo(() => {
    const activeCount = subscriptions.filter((s) => s.status === 'active').length;
    const trialCount = subscriptions.filter((s) => s.status === 'trial').length;
    const pausedCount = subscriptions.filter((s) => s.status === 'paused').length;

    const monthlyTotal = subscriptions.reduce((sum, s) => sum + getMonthlyShare(s), 0);
    const yearlyTotal = monthlyTotal * 12;
    const cap = settings.monthlyBudgetCap || 250;
    const budgetPct = Math.min(100, Math.round((monthlyTotal / cap) * 100));
    const budgetLeft = Math.max(0, cap - monthlyTotal);

    const upcomingAll = subscriptions
      .filter((s) => s.status !== 'paused' && s.status !== 'cancelled')
      .map((s) => ({
        sub: s,
        daysAway: daysBetween(REFERENCE_TODAY, s.nextBillingDate),
      }))
      .filter((item) => item.daysAway >= 0)
      .sort((a, b) => a.daysAway - b.daysAway);

    const due7dItems = upcomingAll.filter((item) => item.daysAway <= 7);
    const due7dTotal = due7dItems.reduce((sum, item) => sum + getUserSharePrice(item.sub), 0);
    const trialsEndingSoon = due7dItems.filter((item) => item.sub.status === 'trial').length;

    const categories: SubscriptionCategory[] = ['Entertainment', 'Productivity & AI', 'Cloud & Utilities'];
    const categoryTotals = categories.map((cat) => {
      const spend = subscriptions
        .filter((s) => s.category === cat)
        .reduce((sum, s) => sum + getMonthlyShare(s), 0);
      const catCap = settings.categoryCaps[cat] || 80;
      const pct = Math.min(100, Math.round((spend / catCap) * 100));
      return { category: cat, spend, cap: catCap, pct };
    });

    return {
      activeCount,
      trialCount,
      pausedCount,
      monthlyTotal,
      yearlyTotal,
      budgetPct,
      budgetLeft,
      upcomingAll,
      due7dItems,
      due7dTotal,
      trialsEndingSoon,
      categoryTotals,
    };
  }, [subscriptions, settings]);

  const filteredUpcoming = useMemo(() => {
    const maxDays = windowFilter === '7d' ? 7 : 30;
    return stats.upcomingAll.filter((item) => item.daysAway <= maxDays);
  }, [stats.upcomingAll, windowFilter]);

  const groupedUpcoming = useMemo(() => {
    const groups = new Map<string, Subscription[]>();
    for (const item of filteredUpcoming) {
      const key = item.sub.nextBillingDate;
      const list = groups.get(key) || [];
      list.push(item.sub);
      groups.set(key, list);
    }
    return Array.from(groups.entries());
  }, [filteredUpcoming]);

  const handleExportCSV = () => {
    const csv = subscriptionsToCSV(subscriptions);
    downloadFile(`subpulse-subscriptions-${REFERENCE_TODAY}.csv`, csv, 'text/csv;charset=utf-8;');
    onShowToast(`Exported ${subscriptions.length} subscriptions to CSV`);
  };

  if (isLoading) {
    return (
      <div className="p-page-margin lg:p-gutter-xl flex flex-col gap-gutter-lg">
        <div className="h-10 w-48 rounded-md bg-light-surface-container-high dark:bg-dark-surface-container-high animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-gutter-md">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg flex flex-col justify-between"
            >
              <div className="h-3.5 w-24 rounded-full bg-light-surface-container-high dark:bg-dark-surface-container-high" />
              <div className="h-7 w-28 rounded-full bg-light-surface-container-high dark:bg-dark-surface-container-high" />
              <div className="h-3 w-32 rounded-full bg-light-surface-container dark:bg-dark-surface-container" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <div className="px-page-margin lg:p-gutter-xl pt-gutter-lg flex flex-col gap-gutter-xl flex-1">
        <header className="flex items-center justify-between gap-gutter-md">
          <div>
            <h1 className="font-headline text-headline-lg-mobile lg:text-headline-lg text-light-on-surface dark:text-dark-on-surface">
              Dashboard
            </h1>
            <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
              {settings.workspaceName} · {settings.currency}
            </p>
          </div>
        </header>

        <section
          aria-label="Empty subscriptions state"
          className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-xl shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col items-center text-center gap-gutter-md max-w-md mx-auto my-auto"
        >
          <div className="w-14 h-14 rounded-full bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-primary dark:text-dark-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px]" aria-hidden="true">receipt_long</span>
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface">
              No subscriptions yet
            </h2>
            <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant text-pretty">
              Add your first recurring plan or import a CSV to see upcoming renewals and budget totals.
            </p>
          </div>
          <div className="flex items-center gap-gutter-sm">
            <button
              type="button"
              onClick={onAddNew}
              className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-md bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-label text-label-lg"
            >
              Add first subscription
            </button>
            <button
              type="button"
              onClick={() => onNavigate('onboarding')}
              className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-primary dark:text-dark-primary font-label text-label-sm"
            >
              Quick setup
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <>
      {/* MOBILE DASHBOARD (< lg) */}
      <div className="lg:hidden flex flex-col flex-1">
        {/* Top App Header */}
        <header className="px-page-margin pt-gutter-lg pb-gutter-md flex items-center justify-between gap-gutter-sm">
          <div className="flex items-center gap-gutter-sm">
            <div className="w-9 h-9 rounded-md bg-light-primary dark:bg-dark-primary flex items-center justify-center text-light-on-primary dark:text-dark-on-primary shadow-sm">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                account_balance_wallet
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-headline text-title-md text-light-on-surface dark:text-dark-on-surface leading-tight">
                SubPulse
              </span>
              <span className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                {settings.workspaceName} · {settings.currency}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-gutter-sm">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Toggle dark mode"
              className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest text-light-on-surface dark:text-dark-on-surface border border-light-outline-variant dark:border-dark-outline-variant transition-colors duration-state-change ease-state-change hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low active:scale-95"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                {isDark ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('notifications')}
              aria-label={`Notifications, ${unreadAlertsCount} unread alerts`}
              className="relative inline-flex items-center justify-center w-11 h-11 rounded-full bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest text-light-on-surface dark:text-dark-on-surface border border-light-outline-variant dark:border-dark-outline-variant transition-colors duration-state-change ease-state-change hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low active:scale-95"
            >
              <span className="material-symbols-outlined text-[22px]" aria-hidden="true">notifications</span>
              {unreadAlertsCount > 0 && (
                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-accent ring-2 ring-light-surface-container-lowest dark:ring-dark-surface-container-lowest" />
              )}
            </button>
          </div>
        </header>

        <main className="px-page-margin flex flex-col gap-gutter-lg flex-1">
          {/* Split Metric Tiles: Spend + Budget */}
          <section aria-label="Spend and budget summary" className="grid grid-cols-2 gap-gutter-md items-stretch">
            {/* Tile 1: Monthly / Yearly Spend */}
            <article className="h-full rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col justify-between gap-gutter-md">
              <header className="flex items-center justify-between gap-gutter-xs">
                <h2 className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  Spend
                </h2>
                <button
                  type="button"
                  onClick={() => setIsYearly((v) => !v)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-primary dark:text-dark-primary font-label text-label-sm transition-colors duration-state-change ease-state-change"
                >
                  <span>{isYearly ? 'Yearly' : 'Monthly'}</span>
                  <span className="material-symbols-outlined text-[14px]" aria-hidden="true">swap_horiz</span>
                </button>
              </header>
              <div className="flex flex-col gap-gutter-xs">
                <p className="font-headline text-headline-lg-mobile text-light-on-surface dark:text-dark-on-surface tabular-nums">
                  {formatMoney(isYearly ? stats.yearlyTotal : stats.monthlyTotal, settings.currency)}
                </p>
                <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums">
                  {isYearly
                    ? `${formatMoney(stats.monthlyTotal, settings.currency)} / mo avg.`
                    : `${formatMoney(stats.yearlyTotal, settings.currency)} / yr est.`}
                </p>
              </div>
            </article>

            {/* Tile 2: Monthly Budget */}
            <button
              type="button"
              onClick={() => setBudgetDrawerOpen((v) => !v)}
              aria-expanded={budgetDrawerOpen}
              className="h-full text-left rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col justify-between gap-gutter-md cursor-pointer transition-transform duration-state-change ease-state-change active:scale-[0.98]"
            >
              <header className="flex items-center justify-between gap-gutter-xs w-full">
                <span className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  Budget
                </span>
                <span className="font-mono text-mono-sm text-success dark:text-success-container tabular-nums">
                  {stats.budgetPct}%
                </span>
              </header>
              <div className="flex flex-col gap-gutter-sm w-full">
                <div className="w-full h-2 rounded-full bg-light-surface-container dark:bg-dark-surface-container overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      stats.budgetPct > 90 ? 'bg-accent' : 'bg-light-primary dark:bg-dark-primary'
                    }`}
                    style={{ width: `${stats.budgetPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-gutter-xs">
                  <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums">
                    {formatMoney(stats.budgetLeft, settings.currency)} left
                  </p>
                  <span
                    className="material-symbols-outlined text-[16px] text-light-on-surface-variant dark:text-dark-on-surface-variant"
                    aria-hidden="true"
                  >
                    {budgetDrawerOpen ? 'expand_less' : 'expand_more'}
                  </span>
                </div>
              </div>
            </button>
          </section>

          {/* Expandable Category Budget Breakdown */}
          {budgetDrawerOpen && (
            <section
              aria-label="Category budget breakdown"
              className="rounded-xl bg-light-surface-container-low dark:bg-dark-surface-container-low p-gutter-lg flex flex-col gap-gutter-md"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface">
                  Spend by category
                </h3>
                <span className="font-mono text-mono-sm text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums">
                  {formatMoney(settings.monthlyBudgetCap, settings.currency)} cap
                </span>
              </div>
              <div className="grid grid-cols-1 gap-gutter-sm">
                {stats.categoryTotals.map((cat) => (
                  <div key={cat.category} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-gutter-sm">
                      <span className="font-body text-body-sm text-light-on-surface dark:text-dark-on-surface">
                        {cat.category}
                      </span>
                      <span
                        className={`font-mono text-mono-sm tabular-nums ${
                          cat.pct >= 90
                            ? 'text-light-tertiary dark:text-dark-tertiary'
                            : 'text-light-on-surface dark:text-dark-on-surface'
                        }`}
                      >
                        {formatMoney(cat.spend, settings.currency)} / {formatMoney(cat.cap, settings.currency)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-light-surface-container-highest dark:bg-dark-surface-container-highest overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          cat.pct >= 90
                            ? 'bg-accent'
                            : cat.category === 'Cloud & Utilities'
                            ? 'bg-success'
                            : 'bg-light-primary dark:bg-dark-primary'
                        }`}
                        style={{ width: `${cat.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Status Counts Strip */}
          <section aria-label="Subscription status counts" className="flex items-center gap-gutter-sm overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => onFilterPlans('active')}
              className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-full bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest text-light-on-surface dark:text-dark-on-surface border border-light-outline-variant dark:border-dark-outline-variant font-label text-label-sm shrink-0"
            >
              <span className="material-symbols-outlined filled text-[16px] text-success" aria-hidden="true">
                check_circle
              </span>
              <span>{stats.activeCount} Active</span>
            </button>

            <button
              type="button"
              onClick={() => onFilterPlans('trial')}
              className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-full bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest text-light-on-surface dark:text-dark-on-surface border border-light-outline-variant dark:border-dark-outline-variant font-label text-label-sm shrink-0"
            >
              <span className="material-symbols-outlined text-[16px] text-light-tertiary dark:text-dark-tertiary" aria-hidden="true">
                schedule
              </span>
              <span>{stats.trialCount} Trials</span>
            </button>

            <button
              type="button"
              onClick={() => onFilterPlans('paused')}
              className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-full bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest text-light-on-surface-variant dark:text-dark-on-surface-variant border border-light-outline-variant dark:border-dark-outline-variant font-label text-label-sm shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">pause_circle</span>
              <span>{stats.pausedCount} Paused</span>
            </button>
          </section>

          {/* Segmented View Switch: List vs Calendar */}
          <section aria-label="Upcoming renewals view" className="flex flex-col gap-gutter-md">
            <div className="flex items-center justify-between gap-gutter-sm">
              <h2 className="font-headline text-headline-md text-light-on-surface dark:text-dark-on-surface">
                Upcoming renewals
              </h2>
              <span className="font-mono text-mono-sm text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums">
                {formatMoney(stats.due7dTotal, settings.currency)} due
              </span>
            </div>

            <div role="tablist" aria-label="Dashboard views" className="grid grid-cols-2 p-1 rounded-md bg-light-surface-container dark:bg-dark-surface-container">
              <button
                role="tab"
                type="button"
                aria-selected={mobileTab === 'list'}
                onClick={() => setMobileTab('list')}
                className={`inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-DEFAULT font-label text-label-lg transition-colors duration-state-change ease-state-change ${
                  mobileTab === 'list'
                    ? 'bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest text-light-primary dark:text-dark-primary shadow-sm'
                    : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">view_agenda</span>
                <span>List</span>
              </button>
              <button
                role="tab"
                type="button"
                aria-selected={mobileTab === 'calendar'}
                onClick={() => setMobileTab('calendar')}
                className={`inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-DEFAULT font-label text-label-lg transition-colors duration-state-change ease-state-change ${
                  mobileTab === 'calendar'
                    ? 'bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest text-light-primary dark:text-dark-primary shadow-sm'
                    : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">calendar_month</span>
                <span>Calendar</span>
              </button>
            </div>

            {mobileTab === 'list' ? (
              <div className="flex flex-col gap-gutter-md">
                <div className="flex items-center gap-gutter-sm">
                  <button
                    type="button"
                    onClick={() => setWindowFilter('7d')}
                    className={`inline-flex items-center justify-center min-h-[36px] px-gutter-lg py-1.5 rounded-full font-label text-label-sm transition-colors ${
                      windowFilter === '7d'
                        ? 'bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary'
                        : 'bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-on-surface-variant dark:text-dark-on-surface-variant border border-light-outline-variant dark:border-dark-outline-variant'
                    }`}
                  >
                    Next 7 days
                  </button>
                  <button
                    type="button"
                    onClick={() => setWindowFilter('30d')}
                    className={`inline-flex items-center justify-center min-h-[36px] px-gutter-lg py-1.5 rounded-full font-label text-label-sm transition-colors ${
                      windowFilter === '30d'
                        ? 'bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary'
                        : 'bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-on-surface-variant dark:text-dark-on-surface-variant border border-light-outline-variant dark:border-dark-outline-variant'
                    }`}
                  >
                    Next 30 days
                  </button>
                </div>

                {groupedUpcoming.length === 0 ? (
                  <div className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg text-center font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                    No renewals scheduled in the next {windowFilter === '7d' ? '7' : '30'} days.
                  </div>
                ) : (
                  groupedUpcoming.map(([dateKey, items]) => {
                    const hasTrial = items.some((s) => s.status === 'trial');
                    const priceHike = items.find((s) => s.priceChangeDelta);
                    const groupTotal = items.reduce((sum, s) => sum + getUserSharePrice(s), 0);

                    return (
                      <div key={dateKey} className="flex flex-col gap-gutter-sm">
                        <div className="flex items-center justify-between px-1">
                          <span className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                            {formatWeekdayAndDate(dateKey, REFERENCE_TODAY)}
                          </span>
                          {hasTrial ? (
                            <span className="font-label text-label-sm text-light-tertiary dark:text-dark-tertiary">
                              Trial ending
                            </span>
                          ) : priceHike ? (
                            <span className="font-label text-label-sm text-warning dark:text-warning-container">
                              +{formatMoney(priceHike.priceChangeDelta || 0, settings.currency)} price hike
                            </span>
                          ) : (
                            <span className="font-mono text-mono-sm text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums">
                              {formatMoney(groupTotal, settings.currency)} net
                            </span>
                          )}
                        </div>

                        {items.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => onSelectSubscription(sub.id)}
                            className="w-full text-left rounded-lg bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_2px_12px_-2px_rgba(26,27,35,0.05)] flex items-center justify-between gap-gutter-md transition-transform duration-state-change ease-state-change active:scale-[0.99]"
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
                                    ? 'Free trial ends · Auto-renews'
                                    : sub.isShared
                                    ? `Split ${sub.splitCount} ways · ${formatMoney(sub.price, sub.currency)} total`
                                    : `${sub.paymentMethod}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-0.5 shrink-0">
                              <p className="font-mono text-mono-md text-light-on-surface dark:text-dark-on-surface tabular-nums">
                                {formatMoney(getUserSharePrice(sub), sub.currency)}
                              </p>
                              <span
                                className={`font-label text-label-sm ${
                                  sub.isShared
                                    ? 'text-light-primary dark:text-dark-primary'
                                    : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
                                }`}
                              >
                                {sub.isShared ? 'Your share' : sub.cycle.charAt(0).toUpperCase() + sub.cycle.slice(1)}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <CalendarWidget
                subscriptions={subscriptions}
                currency={settings.currency}
                onSelectSubscription={onSelectSubscription}
                showMonthNavigation
                showDayDetail
              />
            )}
          </section>
        </main>

        {/* Floating Quick-Add Button */}
        <div className="fixed bottom-20 right-5 z-30">
          <button
            type="button"
            onClick={onAddNew}
            className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-3 rounded-full bg-light-primary-container dark:bg-dark-primary-container text-light-on-primary shadow-[0_8px_24px_-4px_rgba(29,78,216,0.38)] font-label text-label-lg transition-transform duration-state-change ease-state-change hover:opacity-95 active:scale-[0.97]"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* DESKTOP DASHBOARD (>= lg) */}
      <main className="hidden lg:flex flex-1 p-gutter-xl flex-col gap-gutter-xl">
        {/* Top Bar */}
        <header className="flex items-center justify-between gap-gutter-md">
          <div>
            <h1 className="font-headline text-headline-lg text-light-on-surface dark:text-dark-on-surface">
              Dashboard
            </h1>
            <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
              November 2026 · {stats.activeCount} active, {stats.trialCount} trials, {stats.pausedCount} paused
            </p>
          </div>
          <div className="flex items-center gap-gutter-sm">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Toggle dark mode"
              className="min-h-[44px] w-11 rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface inline-flex items-center justify-center hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                {isDark ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="min-h-[44px] px-4 py-2 rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface font-label text-label-sm inline-flex items-center gap-1.5 hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low transition-colors whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">download</span>
              <span>Export CSV</span>
            </button>
          </div>
        </header>

        {/* 3-Up KPI Summary Row */}
        <section aria-label="Spend and budget metrics" className="grid grid-cols-3 gap-gutter-lg items-stretch">
          <article className="h-full rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-xl shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col justify-between gap-gutter-md">
            <span className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              Monthly share
            </span>
            <p className="font-headline text-headline-lg text-light-on-surface dark:text-dark-on-surface tabular-nums">
              {formatMoney(stats.monthlyTotal, settings.currency)}
            </p>
            <span className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums">
              {formatMoney(stats.yearlyTotal, settings.currency)} / yr projected
            </span>
          </article>

          <article className="h-full rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-xl shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col justify-between gap-gutter-md">
            <div className="flex items-center justify-between">
              <span className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Monthly budget
              </span>
              <span className="font-mono text-mono-sm text-success dark:text-success-container tabular-nums">
                {stats.budgetPct}% used
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-light-surface-container dark:bg-dark-surface-container overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  stats.budgetPct > 90 ? 'bg-accent' : 'bg-light-primary dark:bg-dark-primary'
                }`}
                style={{ width: `${stats.budgetPct}%` }}
              />
            </div>
            <span className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums">
              {formatMoney(stats.budgetLeft, settings.currency)} left of{' '}
              {formatMoney(settings.monthlyBudgetCap, settings.currency)} cap
            </span>
          </article>

          <article className="h-full rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-xl shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col justify-between gap-gutter-md">
            <span className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              Due next 7 days
            </span>
            <p className="font-headline text-headline-lg text-light-on-surface dark:text-dark-on-surface tabular-nums">
              {formatMoney(stats.due7dTotal, settings.currency)}
            </p>
            <span className="font-body text-body-sm text-light-tertiary dark:text-dark-tertiary">
              {stats.trialsEndingSoon > 0
                ? `${stats.trialsEndingSoon} trial ending tomorrow`
                : `${stats.due7dItems.length} renewals in next 7 days`}
            </span>
          </article>
        </section>

        {/* 2-Column Split: Upcoming Renewals List + November Billing Calendar */}
        <section aria-label="Renewals and calendar" className="grid grid-cols-12 gap-gutter-xl items-start">
          {/* Left 7 cols: Upcoming Renewals */}
          <div className="col-span-7 flex flex-col gap-gutter-md">
            <div className="flex items-center justify-between">
              <h2 className="font-headline text-headline-md text-light-on-surface dark:text-dark-on-surface">
                Upcoming renewals
              </h2>
              <button
                type="button"
                onClick={() => onFilterPlans('all')}
                className="font-label text-label-sm text-light-primary dark:text-dark-primary hover:underline"
              >
                View all {subscriptions.length}
              </button>
            </div>

            <div className="flex flex-col gap-gutter-sm">
              {stats.upcomingAll.slice(0, 5).map(({ sub }) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => onSelectSubscription(sub.id)}
                  className="w-full text-left rounded-lg bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_2px_12px_-2px_rgba(26,27,35,0.05)] flex items-center justify-between gap-gutter-md hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low transition-colors"
                >
                  <div className="flex items-center gap-gutter-md min-w-0">
                    <div
                      className={`w-11 h-11 rounded-md ${sub.avatarBg} flex items-center justify-center font-headline text-title-md shrink-0`}
                    >
                      {sub.initials}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface truncate">
                        {sub.name}
                      </h3>
                      <p
                        className={`font-body text-body-sm truncate ${
                          sub.status === 'trial'
                            ? 'text-light-tertiary dark:text-dark-tertiary'
                            : sub.priceChangeDelta
                            ? 'text-warning dark:text-warning-container'
                            : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
                        }`}
                      >
                        {sub.status === 'trial'
                          ? `${formatMonthDay(sub.nextBillingDate)} · Free trial ends`
                          : sub.priceChangeDelta
                          ? `${formatMonthDay(sub.nextBillingDate)} · +${formatMoney(
                              sub.priceChangeDelta,
                              sub.currency
                            )} price hike`
                          : sub.isShared
                          ? `${formatMonthDay(sub.nextBillingDate)} · Split ${sub.splitCount} ways (${formatMoney(
                              sub.price,
                              sub.currency
                            )} total)`
                          : `${formatMonthDay(sub.nextBillingDate)} · ${sub.paymentMethod}`}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-mono-md text-light-on-surface dark:text-dark-on-surface tabular-nums shrink-0">
                    {formatMoney(getUserSharePrice(sub), sub.currency)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Right 5 cols: Billing Calendar */}
          <aside className="col-span-5">
            <CalendarWidget
              subscriptions={subscriptions}
              currency={settings.currency}
              onSelectSubscription={onSelectSubscription}
              showMonthNavigation={false}
              showDayDetail
            />
          </aside>
        </section>
      </main>
    </>
  );
};
