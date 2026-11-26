import React, { useMemo, useState } from 'react';
import { formatMoney, getMonthlyShare, getUserSharePrice } from '../lib/formatters';
import { AIAuditResponse, AppSettings, Subscription } from '../types/subpulse';

interface SavingsAuditViewProps {
  subscriptions: Subscription[];
  settings: AppSettings;
  onBack: () => void;
  onSelectSubscription: (id: string) => void;
  onUpdateTrimGoal: (goal: number) => void;
  onShowToast: (msg: string) => void;
}

export const SavingsAuditView: React.FC<SavingsAuditViewProps> = ({
  subscriptions,
  settings,
  onBack,
  onSelectSubscription,
  onUpdateTrimGoal,
  onShowToast,
}) => {
  const [aiAudit, setAiAudit] = useState<AIAuditResponse | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(String(settings.annualTrimGoal));

  const goalProgress = useMemo(() => {
    const target = settings.annualTrimGoal || 500;
    const pct = Math.min(100, Math.round((settings.savedYtd / target) * 100));
    return { target, pct };
  }, [settings]);

  const localSuggestions = useMemo(() => {
    const items: Array<{
      id: string;
      subId: string;
      title: string;
      subtitle: string;
      amount: number;
      cta: string;
      urgent: boolean;
    }> = [];

    const linear = subscriptions.find((s) => s.id === 'sub-linear' && s.status === 'trial');
    if (linear) {
      items.push({
        id: 'sug-trial',
        subId: linear.id,
        title: linear.name,
        subtitle: 'Trial ends tomorrow · Rated "Not worth it"',
        amount: getUserSharePrice(linear),
        cta: 'Cancel before trial ends',
        urgent: true,
      });
    }

    const googleOne = subscriptions.find((s) => s.name.toLowerCase().includes('google one') && s.status === 'active');
    const icloud = subscriptions.find((s) => s.name.toLowerCase().includes('icloud') && s.status === 'active');
    if (googleOne && icloud) {
      items.push({
        id: 'sug-overlap',
        subId: googleOne.id,
        title: googleOne.name,
        subtitle: `Overlaps with ${icloud.name}`,
        amount: googleOne.price,
        cta: 'Review overlap',
        urgent: false,
      });
    }

    return items;
  }, [subscriptions]);

  const potentialLocalMonthlySavings = localSuggestions.reduce((s, x) => s + x.amount, 0);

  const runGeminiAudit = async () => {
    setIsAuditing(true);
    setAuditError(null);
    try {
      const payload = {
        monthlyBudgetCap: settings.monthlyBudgetCap,
        currency: settings.currency,
        subscriptions: subscriptions.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          price: s.price,
          yourShare: getMonthlyShare(s),
          cycle: s.cycle,
          status: s.status,
          nextBillingDate: s.nextBillingDate,
          splitCount: s.splitCount,
          notes: s.notes,
        })),
      };

      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to run AI audit.');
      }

      setAiAudit({
        summary: data.summary || 'Audit complete.',
        recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
        generatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      onShowToast('Gemini AI audit complete');
    } catch (err: unknown) {
      setAuditError(err instanceof Error ? err.message : 'Unable to reach AI audit service.');
    } finally {
      setIsAuditing(false);
    }
  };

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Math.max(50, parseFloat(goalDraft) || 500);
    onUpdateTrimGoal(val);
    setEditingGoal(false);
    onShowToast(`Annual trim goal updated to ${formatMoney(val, settings.currency)}`);
  };

  return (
    <div className="flex flex-col flex-1">
      {/* Contextual Header */}
      <header className="px-page-margin lg:px-gutter-xl pt-gutter-lg pb-gutter-md flex items-center justify-between gap-gutter-sm">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Insights"
          className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest text-light-on-surface dark:text-dark-on-surface border border-light-outline-variant dark:border-dark-outline-variant hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">arrow_back</span>
        </button>
        <h1 className="font-headline text-title-md lg:text-headline-md text-light-on-surface dark:text-dark-on-surface">
          Savings &amp; audit
        </h1>
        <button
          type="button"
          onClick={runGeminiAudit}
          disabled={isAuditing}
          className="min-h-[44px] px-4 py-2 rounded-md bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-label text-label-sm inline-flex items-center gap-1.5 disabled:opacity-60 whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">auto_awesome</span>
          <span>{isAuditing ? 'Auditing...' : 'Run AI audit'}</span>
        </button>
      </header>

      <main className="px-page-margin lg:px-gutter-xl flex flex-col gap-gutter-lg flex-1 max-w-2xl lg:max-w-3xl w-full mx-auto lg:mx-0">
        {/* Savings Goal Card */}
        <section
          aria-label="Annual savings goal"
          className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-xl shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col gap-gutter-md"
        >
          <div className="flex items-center justify-between gap-gutter-sm">
            <div className="flex items-center gap-gutter-sm">
              <span className="material-symbols-outlined text-[22px] text-success" aria-hidden="true">savings</span>
              <h2 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface">
                2026 trim goal
              </h2>
            </div>
            <span className="font-mono text-mono-sm text-success dark:text-success-container tabular-nums">
              {goalProgress.pct}% reached
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <span className="font-headline text-headline-lg-mobile text-light-on-surface dark:text-dark-on-surface tabular-nums">
              {formatMoney(settings.savedYtd, settings.currency)}
            </span>
            <div className="flex items-center gap-2">
              <span className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums">
                of {formatMoney(goalProgress.target, settings.currency)} target
              </span>
              <button
                type="button"
                onClick={() => {
                  setGoalDraft(String(goalProgress.target));
                  setEditingGoal((v) => !v);
                }}
                className="font-label text-label-sm text-light-primary dark:text-dark-primary underline"
              >
                Edit
              </button>
            </div>
          </div>

          {editingGoal && (
            <form onSubmit={handleSaveGoal} className="flex items-center gap-gutter-sm">
              <input
                type="number"
                step="25"
                min="50"
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                className="w-32 min-h-[40px] px-3 py-1.5 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant font-mono text-mono-sm"
              />
              <button
                type="submit"
                className="min-h-[40px] px-3 py-1.5 rounded-DEFAULT bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-label text-label-sm"
              >
                Save goal
              </button>
            </form>
          )}

          <div className="w-full h-2.5 rounded-full bg-light-surface-container dark:bg-dark-surface-container overflow-hidden">
            <div className="h-full rounded-full bg-success" style={{ width: `${goalProgress.pct}%` }} />
          </div>
        </section>

        {/* Gemini Live AI Audit Results / Error / Loading */}
        {isAuditing && (
          <section className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_2px_12px_-2px_rgba(26,27,35,0.05)] flex flex-col gap-gutter-md">
            <div className="flex items-center gap-2 font-label text-label-sm text-light-primary dark:text-dark-primary">
              <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
              <span>Analyzing {subscriptions.length} subscriptions with Gemini...</span>
            </div>
            <div className="h-4 w-3/4 rounded-full bg-light-surface-container-high dark:bg-dark-surface-container-high animate-pulse" />
            <div className="h-4 w-1/2 rounded-full bg-light-surface-container dark:bg-dark-surface-container animate-pulse" />
          </section>
        )}

        {auditError && (
          <section
            role="alert"
            className="rounded-xl bg-light-error-container dark:bg-dark-error-container p-gutter-lg text-light-on-error-container dark:text-dark-on-error-container flex items-start gap-gutter-md"
          >
            <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">error</span>
            <div className="flex flex-col gap-1">
              <span className="font-title text-title-md">AI audit unavailable</span>
              <span className="font-body text-body-sm">{auditError}</span>
            </div>
          </section>
        )}

        {aiAudit && (
          <section aria-label="Gemini AI recommendations" className="flex flex-col gap-gutter-sm">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface">
                AI portfolio findings
              </h2>
              <span className="font-mono text-mono-sm text-light-primary dark:text-dark-primary">
                Updated {aiAudit.generatedAt}
              </span>
            </div>
            <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant px-1">
              {aiAudit.summary}
            </p>
            {aiAudit.recommendations.map((rec, idx) => (
              <article
                key={`${rec.subscriptionId}-${idx}`}
                className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_2px_12px_-2px_rgba(26,27,35,0.05)] flex flex-col gap-gutter-md"
              >
                <div className="flex items-start justify-between gap-gutter-sm">
                  <div className="flex flex-col gap-0.5">
                    <h3 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface">
                      {rec.subscriptionName} · {rec.headline}
                    </h3>
                    <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                      {rec.reason}
                    </p>
                  </div>
                  <span className="font-mono text-mono-md text-success tabular-nums shrink-0">
                    -{formatMoney(rec.monthlySavings, settings.currency)}/mo
                  </span>
                </div>
                <div className="flex items-center justify-end gap-gutter-sm">
                  <button
                    type="button"
                    onClick={() => onSelectSubscription(rec.subscriptionId)}
                    className="min-h-[40px] px-4 py-2 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-primary dark:text-dark-primary font-label text-label-sm"
                  >
                    Inspect plan
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}

        {/* Suggested Cuts */}
        <section aria-label="AI subscription audit" className="flex flex-col gap-gutter-sm">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface">
              Suggested cuts
            </h2>
            <span className="font-mono text-mono-sm text-light-primary dark:text-dark-primary tabular-nums">
              Save {formatMoney(potentialLocalMonthlySavings, settings.currency)}/mo
            </span>
          </div>

          {localSuggestions.length === 0 ? (
            <article className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_2px_12px_-2px_rgba(26,27,35,0.05)] font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              No duplicate storage plans or urgent expiring trials detected right now. Run the Gemini AI audit above for deeper optimization ideas.
            </article>
          ) : (
            localSuggestions.map((item) => (
              <article
                key={item.id}
                className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_2px_12px_-2px_rgba(26,27,35,0.05)] flex flex-col gap-gutter-md"
              >
                <div className="flex items-start justify-between gap-gutter-sm">
                  <div className="flex flex-col gap-0.5">
                    <h3 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface">
                      {item.title}
                    </h3>
                    <p
                      className={`font-body text-body-sm ${
                        item.urgent
                          ? 'text-light-tertiary dark:text-dark-tertiary'
                          : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
                      }`}
                    >
                      {item.subtitle}
                    </p>
                  </div>
                  <span className="font-mono text-mono-md text-light-on-surface dark:text-dark-on-surface tabular-nums">
                    {formatMoney(item.amount, settings.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-gutter-sm">
                  <button
                    type="button"
                    onClick={() => onSelectSubscription(item.subId)}
                    className={`min-h-[44px] px-4 py-2 rounded-md font-label text-label-sm inline-flex items-center justify-center ${
                      item.urgent
                        ? 'bg-light-error-container dark:bg-dark-error-container text-light-on-error-container dark:text-dark-on-error-container'
                        : 'bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-primary dark:text-dark-primary'
                    }`}
                  >
                    {item.cta}
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      </main>
    </div>
  );
};
