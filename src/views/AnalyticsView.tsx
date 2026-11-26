import React, { useMemo, useState } from 'react';
import { HISTORICAL_SPEND_TREND, REFERENCE_TODAY } from '../data/seedData';
import { downloadFile, formatMoney, getMonthlyShare } from '../lib/formatters';
import { AppSettings, AppView, Subscription, SubscriptionCategory } from '../types/subpulse';

interface AnalyticsViewProps {
  subscriptions: Subscription[];
  settings: AppSettings;
  onNavigate: (view: AppView) => void;
  onUpdateMonthlyCap: (cap: number) => void;
  onShowToast: (msg: string) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  subscriptions,
  settings,
  onNavigate,
  onUpdateMonthlyCap,
  onShowToast,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('Nov');
  const [editingCap, setEditingCap] = useState(false);
  const [capDraft, setCapDraft] = useState(String(settings.monthlyBudgetCap));

  const metrics = useMemo(() => {
    const monthlyTotal = subscriptions.reduce((sum, s) => sum + getMonthlyShare(s), 0);
    const yearlyForecast = monthlyTotal * 12;
    const dailyCost = yearlyForecast / 365;
    const weeklyCost = yearlyForecast / 52;

    const trend = [
      ...HISTORICAL_SPEND_TREND,
      { month: 'Nov', amount: Number(monthlyTotal.toFixed(2)) },
    ];
    const avgTrend = trend.reduce((sum, m) => sum + m.amount, 0) / trend.length;

    const categories: SubscriptionCategory[] = ['Productivity & AI', 'Entertainment', 'Cloud & Utilities'];
    const breakdown = categories.map((cat) => {
      const spend = subscriptions
        .filter((s) => s.category === cat)
        .reduce((sum, s) => sum + getMonthlyShare(s), 0);
      const cap = settings.categoryCaps[cat] || 80;
      const pctOfCap = Math.min(100, Math.round((spend / cap) * 100));
      const pctOfTotal = monthlyTotal > 0 ? Math.round((spend / monthlyTotal) * 100) : 0;
      return { category: cat, spend, cap, pctOfCap, pctOfTotal };
    });

    // Detect overlapping cloud storage or multiple AI tools
    const icloud = subscriptions.find((s) => s.name.toLowerCase().includes('icloud') && s.status === 'active');
    const googleOne = subscriptions.find((s) => s.name.toLowerCase().includes('google one') && s.status === 'active');
    const hasStorageOverlap = Boolean(icloud && googleOne);
    const overlapSavingsYr = hasStorageOverlap ? (googleOne!.price * 12) : 0;

    return {
      monthlyTotal,
      yearlyForecast,
      dailyCost,
      weeklyCost,
      trend,
      avgTrend,
      breakdown,
      hasStorageOverlap,
      overlapSavingsYr,
    };
  }, [subscriptions, settings]);

  const activeMonthPoint = metrics.trend.find((t) => t.month === selectedMonth) || metrics.trend[metrics.trend.length - 1];

  const handleExportReport = (mode: 'pdf' | 'json') => {
    if (mode === 'pdf') {
      window.print();
      onShowToast('Opened print-ready PDF report');
    } else {
      downloadFile(
        `subpulse-insights-${REFERENCE_TODAY}.json`,
        JSON.stringify({ generatedAt: REFERENCE_TODAY, metrics, subscriptions }, null, 2),
        'application/json'
      );
      onShowToast('Exported insights JSON report');
    }
  };

  const handleCapSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Math.max(20, parseFloat(capDraft) || 250);
    onUpdateMonthlyCap(parsed);
    setEditingCap(false);
    onShowToast(`Monthly cap updated to ${formatMoney(parsed, settings.currency)}`);
  };

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
              Insights
            </span>
            <span className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              {settings.workspaceName} · 2026
            </span>
          </div>
        </div>

        <div className="flex items-center gap-gutter-sm">
          <button
            type="button"
            onClick={() => onNavigate('savings')}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-label text-label-sm"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">savings</span>
            <span>AI Audit</span>
          </button>
          <button
            type="button"
            onClick={() => handleExportReport('json')}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-full bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest text-light-primary dark:text-dark-primary border border-light-outline-variant dark:border-dark-outline-variant font-label text-label-sm hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">ios_share</span>
            <span>Export</span>
          </button>
        </div>
      </header>

      {/* DESKTOP HEADER */}
      <header className="hidden lg:flex px-gutter-xl pt-gutter-xl pb-gutter-md items-center justify-between gap-gutter-md">
        <div>
          <h1 className="font-headline text-headline-lg text-light-on-surface dark:text-dark-on-surface">
            Insights &amp; budget
          </h1>
          <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
            2026 spend trend, category caps, and overlap detection
          </p>
        </div>
        <div className="flex items-center gap-gutter-sm">
          <button
            type="button"
            onClick={() => onNavigate('savings')}
            className="min-h-[44px] px-4 py-2 rounded-md bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-label text-label-sm inline-flex items-center gap-1.5 hover:opacity-90 whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">savings</span>
            <span>Savings &amp; AI audit</span>
          </button>
          <button
            type="button"
            onClick={() => handleExportReport('pdf')}
            className="min-h-[44px] px-4 py-2 rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface font-label text-label-sm inline-flex items-center gap-1.5 hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">ios_share</span>
            <span>Export PDF</span>
          </button>
        </div>
      </header>

      <main className="px-page-margin lg:px-gutter-xl flex flex-col gap-gutter-lg lg:gap-gutter-xl flex-1">
        {/* KPI Row (2-up mobile, 3-up desktop) */}
        <section aria-label="Insights summary" className="grid grid-cols-2 lg:grid-cols-3 gap-gutter-md lg:gap-gutter-lg items-stretch">
          <article className="h-full rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg lg:p-gutter-xl shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col justify-between gap-gutter-sm lg:gap-gutter-md">
            <span className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              Daily cost
            </span>
            <p className="font-headline text-headline-lg-mobile lg:text-headline-lg text-light-on-surface dark:text-dark-on-surface tabular-nums">
              {formatMoney(metrics.dailyCost, settings.currency)}
            </p>
            <span className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums">
              {formatMoney(metrics.weeklyCost, settings.currency)} / week equivalent
            </span>
          </article>

          <button
            type="button"
            onClick={() => onNavigate('savings')}
            className="h-full text-left rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg lg:p-gutter-xl shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col justify-between gap-gutter-sm lg:gap-gutter-md hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low transition-colors"
          >
            <span className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              Saved YTD
            </span>
            <p className="font-headline text-headline-lg-mobile lg:text-headline-lg text-success tabular-nums">
              {formatMoney(settings.savedYtd, settings.currency)}
            </p>
            <span className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              From {settings.cancelledCountYtd} cancelled plans
            </span>
          </button>

          <article className="hidden lg:flex h-full rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-xl shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex-col justify-between gap-gutter-md">
            <span className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              12-month forecast
            </span>
            <p className="font-headline text-headline-lg text-light-on-surface dark:text-dark-on-surface tabular-nums">
              {formatMoney(metrics.yearlyForecast, settings.currency)}
            </p>
            <span className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              Assumes current active plans
            </span>
          </article>
        </section>

        {/* 2-Column Split on Desktop, Stacked on Mobile */}
        <section aria-label="Trend and categories" className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg lg:gap-gutter-xl items-start">
          {/* Left 7 cols: 6-Month Spend Trend */}
          <article className="lg:col-span-7 rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg lg:p-gutter-xl shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col gap-gutter-md lg:gap-gutter-lg">
            <div className="flex items-center justify-between gap-gutter-sm">
              <div>
                <h2 className="font-headline text-title-md lg:text-headline-md text-light-on-surface dark:text-dark-on-surface">
                  6-month spend trend
                </h2>
                <div className="flex items-center gap-2">
                  <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                    Jun – Nov 2026 · {formatMoney(settings.monthlyBudgetCap, settings.currency)} cap
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCapDraft(String(settings.monthlyBudgetCap));
                      setEditingCap((v) => !v);
                    }}
                    className="font-label text-label-sm text-light-primary dark:text-dark-primary underline"
                  >
                    Edit cap
                  </button>
                </div>
              </div>
              <span className="font-mono text-mono-sm text-light-primary dark:text-dark-primary tabular-nums">
                Avg {formatMoney(metrics.avgTrend, settings.currency)}
              </span>
            </div>

            {editingCap && (
              <form onSubmit={handleCapSubmit} className="flex items-center gap-gutter-sm pt-1">
                <input
                  type="number"
                  step="10"
                  min="20"
                  value={capDraft}
                  onChange={(e) => setCapDraft(e.target.value)}
                  className="w-32 min-h-[40px] px-3 py-1.5 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant font-mono text-mono-sm"
                />
                <button
                  type="submit"
                  className="min-h-[40px] px-3 py-1.5 rounded-DEFAULT bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-label text-label-sm"
                >
                  Save cap
                </button>
              </form>
            )}

            <div className="grid grid-cols-6 gap-gutter-sm lg:gap-gutter-md items-end h-44 lg:h-56 pt-4">
              {metrics.trend.map((pt) => {
                const heightPct = Math.min(100, Math.max(15, Math.round((pt.amount / settings.monthlyBudgetCap) * 100)));
                const isSelected = pt.month === selectedMonth;
                return (
                  <button
                    key={pt.month}
                    type="button"
                    onClick={() => setSelectedMonth(pt.month)}
                    className="flex flex-col items-center gap-1.5 lg:gap-2 h-full justify-end group"
                  >
                    <span
                      className={`font-mono text-mono-sm tabular-nums ${
                        isSelected
                          ? 'text-light-primary dark:text-dark-primary font-semibold'
                          : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
                      }`}
                    >
                      ${Math.round(pt.amount)}
                    </span>
                    <div
                      className={`w-full rounded-t-md transition-colors ${
                        isSelected
                          ? 'bg-light-primary dark:bg-dark-primary'
                          : 'bg-light-surface-container-high dark:bg-dark-surface-container-high group-hover:bg-light-secondary-container dark:group-hover:bg-dark-secondary-container'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                    <span
                      className={`font-mono text-mono-sm ${
                        isSelected
                          ? 'text-light-primary dark:text-dark-primary font-semibold'
                          : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
                      }`}
                    >
                      {pt.month}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-gutter-sm border-t border-light-outline-variant dark:border-dark-outline-variant font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              <span>{activeMonthPoint.month} 2026 total</span>
              <span className="font-mono text-mono-sm text-light-on-surface dark:text-dark-on-surface tabular-nums">
                {formatMoney(activeMonthPoint.amount, settings.currency)} ({Math.round((activeMonthPoint.amount / settings.monthlyBudgetCap) * 100)}% of cap)
              </span>
            </div>
          </article>

          {/* Right 5 cols: Category Breakdown & Overlap */}
          <div className="lg:col-span-5 flex flex-col gap-gutter-lg">
            <article className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg lg:p-gutter-xl shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col gap-gutter-md">
              <div className="flex items-center justify-between">
                <h2 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface">
                  Category breakdown
                </h2>
                <span className="lg:hidden font-mono text-mono-md text-light-on-surface dark:text-dark-on-surface tabular-nums">
                  {formatMoney(metrics.yearlyForecast, settings.currency)}/yr
                </span>
              </div>

              {metrics.breakdown.map((row) => (
                <div key={row.category} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-body text-body-md text-light-on-surface dark:text-dark-on-surface">
                      {row.category}
                    </span>
                    <span
                      className={`font-mono text-mono-sm tabular-nums ${
                        row.pctOfCap >= 90
                          ? 'text-light-tertiary dark:text-dark-tertiary'
                          : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
                      }`}
                    >
                      {formatMoney(row.spend, settings.currency)} / {formatMoney(row.cap, settings.currency)}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-light-surface-container dark:bg-dark-surface-container overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        row.pctOfCap >= 90
                          ? 'bg-accent'
                          : row.category === 'Cloud & Utilities'
                          ? 'bg-success'
                          : 'bg-light-primary dark:bg-dark-primary'
                      }`}
                      style={{ width: `${row.pctOfCap}%` }}
                    />
                  </div>
                </div>
              ))}
            </article>

            {metrics.hasStorageOverlap && (
              <button
                type="button"
                onClick={() => onNavigate('savings')}
                className="w-full text-left rounded-xl bg-light-error-container dark:bg-dark-error-container p-gutter-lg flex items-start gap-gutter-md hover:opacity-95 transition-opacity"
              >
                <span
                  className="material-symbols-outlined text-[22px] text-light-on-error-container dark:text-dark-on-error-container shrink-0 mt-0.5"
                  aria-hidden="true"
                >
                  warning
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="font-title text-title-md text-light-on-error-container dark:text-dark-on-error-container">
                    Overlapping storage
                  </h3>
                  <p className="font-body text-body-sm text-light-on-error-container dark:text-dark-on-error-container text-pretty">
                    iCloud+ 2TB and Google One 2TB both cost $9.99/mo. Consolidating saves{' '}
                    {formatMoney(metrics.overlapSavingsYr, settings.currency)}/yr.
                  </p>
                </div>
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};
