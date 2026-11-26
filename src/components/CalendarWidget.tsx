import React, { useMemo, useState } from 'react';
import { REFERENCE_TODAY } from '../data/seedData';
import { formatMoney, formatMonthDay, getUserSharePrice } from '../lib/formatters';
import { CurrencyCode, Subscription } from '../types/subpulse';

interface CalendarWidgetProps {
  subscriptions: Subscription[];
  currency: CurrencyCode;
  onSelectSubscription: (id: string) => void;
  showMonthNavigation?: boolean;
  showDayDetail?: boolean;
}

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({
  subscriptions,
  currency,
  onSelectSubscription,
  showMonthNavigation = true,
  showDayDetail = true,
}) => {
  const [yearMonth, setYearMonth] = useState<{ year: number; month: number }>({
    year: 2026,
    month: 10, // 0-indexed: 10 = November
  });
  const [selectedDay, setSelectedDay] = useState<string>('2026-11-27');

  const monthLabel = useMemo(() => {
    const d = new Date(yearMonth.year, yearMonth.month, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [yearMonth]);

  const { leadingBlanks, daysInMonth } = useMemo(() => {
    const firstDay = new Date(yearMonth.year, yearMonth.month, 1).getDay(); // 0=Sun..6=Sat
    // Monday-first grid: Mon=0..Sun=6
    const mondayFirstOffset = (firstDay + 6) % 7;
    const totalDays = new Date(yearMonth.year, yearMonth.month + 1, 0).getDate();
    return { leadingBlanks: mondayFirstOffset, daysInMonth: totalDays };
  }, [yearMonth]);

  const subsByDay = useMemo(() => {
    const map = new Map<string, Subscription[]>();
    for (const sub of subscriptions) {
      if (sub.status === 'cancelled' || sub.status === 'paused') continue;
      // Match exact date OR day-of-month for monthly subscriptions in displayed month
      const [sy, sm, sd] = sub.nextBillingDate.split('-').map(Number);
      const padM = String(yearMonth.month + 1).padStart(2, '0');
      let targetKey: string | null = null;
      if (sy === yearMonth.year && sm - 1 === yearMonth.month) {
        targetKey = sub.nextBillingDate;
      } else if (sub.cycle === 'monthly' && sd <= daysInMonth) {
        targetKey = `${yearMonth.year}-${padM}-${String(sd).padStart(2, '0')}`;
      }
      if (targetKey) {
        const list = map.get(targetKey) || [];
        list.push(sub);
        map.set(targetKey, list);
      }
    }
    return map;
  }, [subscriptions, yearMonth, daysInMonth]);

  const selectedSubs = subsByDay.get(selectedDay) || [];

  const handlePrevMonth = () => {
    setYearMonth((prev) => {
      const m = prev.month - 1;
      return m < 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: m };
    });
  };

  const handleNextMonth = () => {
    setYearMonth((prev) => {
      const m = prev.month + 1;
      return m > 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: m };
    });
  };

  const padMonth = String(yearMonth.month + 1).padStart(2, '0');

  return (
    <div className="flex flex-col gap-gutter-md">
      <div className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-xl shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col gap-gutter-md">
        <div className="flex items-center justify-between">
          <h2 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface">
            {monthLabel}
          </h2>
          {showMonthNavigation ? (
            <div className="flex items-center gap-gutter-xs">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Previous month"
                className="w-9 h-9 rounded-full inline-flex items-center justify-center hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low text-light-on-surface dark:text-dark-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">chevron_left</span>
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Next month"
                className="w-9 h-9 rounded-full inline-flex items-center justify-center hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low text-light-on-surface dark:text-dark-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">chevron_right</span>
              </button>
            </div>
          ) : (
            <span className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              Billing dates
            </span>
          )}
        </div>

        <div className="grid grid-cols-7 text-center gap-1">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, idx) => (
            <span
              key={idx}
              className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant"
            >
              {d}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <span key={`blank-${i}`} className="h-10" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const day = idx + 1;
            const iso = `${yearMonth.year}-${padMonth}-${String(day).padStart(2, '0')}`;
            const daySubs = subsByDay.get(iso) || [];
            const isToday = iso === REFERENCE_TODAY;
            const isSelected = iso === selectedDay;
            const hasTrial = daySubs.some((s) => s.status === 'trial');

            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelectedDay(iso)}
                className={`h-10 rounded-DEFAULT flex flex-col items-center justify-center gap-0.5 font-mono text-mono-sm transition-colors ${
                  isSelected
                    ? 'bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-semibold'
                    : isToday
                    ? 'bg-light-surface-container-low dark:bg-dark-surface-container-low ring-1 ring-light-primary dark:ring-dark-primary text-light-primary dark:text-dark-primary font-semibold'
                    : 'text-light-on-surface dark:text-dark-on-surface hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low'
                }`}
              >
                <span>{day}</span>
                {daySubs.length > 0 && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      hasTrial
                        ? 'bg-accent'
                        : isSelected
                        ? 'bg-light-on-primary dark:bg-dark-on-primary'
                        : 'bg-light-primary dark:bg-dark-primary'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {showDayDetail && (
        <div className="flex flex-col gap-gutter-sm">
          {selectedSubs.length > 0 ? (
            selectedSubs.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => onSelectSubscription(sub.id)}
                className="w-full text-left rounded-lg bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_2px_12px_-2px_rgba(26,27,35,0.05)] flex items-center justify-between gap-gutter-md hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low transition-colors"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface truncate">
                    {formatMonthDay(selectedDay)} · {sub.name}
                  </span>
                  <span
                    className={`font-body text-body-sm ${
                      sub.status === 'trial'
                        ? 'text-light-tertiary dark:text-dark-tertiary'
                        : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
                    }`}
                  >
                    {sub.status === 'trial'
                      ? 'Free trial ends tomorrow'
                      : sub.isShared
                      ? `Split ${sub.splitCount} ways · ${sub.paymentMethod}`
                      : sub.paymentMethod}
                  </span>
                </div>
                <span className="font-mono text-mono-md text-light-on-surface dark:text-dark-on-surface tabular-nums shrink-0">
                  {formatMoney(getUserSharePrice(sub), currency)}
                </span>
              </button>
            ))
          ) : (
            <div className="rounded-lg bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_2px_12px_-2px_rgba(26,27,35,0.05)] flex items-center justify-between">
              <span className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                {formatMonthDay(selectedDay)} · No renewals scheduled
              </span>
              <span className="font-mono text-mono-sm text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums">
                {formatMoney(0, currency)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
