import React from 'react';
import { REFERENCE_TODAY } from '../data/seedData';
import { downloadFile, generateICSFeed } from '../lib/formatters';
import { AlertItem, AppSettings, Subscription } from '../types/subpulse';

interface NotificationsViewProps {
  alerts: AlertItem[];
  subscriptions: Subscription[];
  settings: AppSettings;
  onBack: () => void;
  onMarkAllRead: () => void;
  onSelectSubscription: (id: string) => void;
  onToggleSetting: (key: 'webPushEnabled' | 'emailFallbackEnabled', value: boolean) => void;
  onShowToast: (msg: string) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  alerts,
  subscriptions,
  settings,
  onBack,
  onMarkAllRead,
  onSelectSubscription,
  onToggleSetting,
  onShowToast,
}) => {
  const handleToggleWebPush = async (checked: boolean) => {
    if (checked && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {
        // ignore if unsupported in sandbox iframe
      }
    }
    onToggleSetting('webPushEnabled', checked);
    onShowToast(checked ? 'Web Push alerts enabled' : 'Web Push alerts paused');
  };

  const handleDownloadICS = () => {
    const ics = generateICSFeed(subscriptions);
    downloadFile(`subpulse-renewals-${REFERENCE_TODAY}.ics`, ics, 'text/calendar;charset=utf-8;');
    onShowToast('Downloaded .ICS calendar feed');
  };

  const iconForType = (type: AlertItem['type']) => {
    switch (type) {
      case 'trial':
        return {
          wrapper: 'bg-light-error-container dark:bg-dark-error-container text-light-on-error-container dark:text-dark-on-error-container',
          icon: 'schedule',
        };
      case 'price_hike':
        return {
          wrapper: 'bg-warning-container text-on-warning-container',
          icon: 'trending_up',
        };
      default:
        return {
          wrapper: 'bg-light-surface-container dark:bg-dark-surface-container text-light-primary dark:text-dark-primary',
          icon: 'summarize',
        };
    }
  };

  return (
    <div className="flex flex-col flex-1">
      {/* Contextual Header */}
      <header className="px-page-margin lg:px-gutter-xl pt-gutter-lg pb-gutter-md flex items-center justify-between gap-gutter-sm">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Dashboard"
          className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest text-light-on-surface dark:text-dark-on-surface border border-light-outline-variant dark:border-dark-outline-variant"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">arrow_back</span>
        </button>
        <h1 className="font-headline text-title-md lg:text-headline-md text-light-on-surface dark:text-dark-on-surface">
          Notifications
        </h1>
        <button
          type="button"
          onClick={onMarkAllRead}
          className="inline-flex items-center justify-center min-h-[44px] px-3 font-label text-label-sm text-light-primary dark:text-dark-primary hover:underline"
        >
          Mark read
        </button>
      </header>

      <main className="px-page-margin lg:px-gutter-xl flex flex-col gap-gutter-lg flex-1 max-w-2xl lg:max-w-3xl w-full mx-auto lg:mx-0">
        {/* Alerts Feed */}
        <section aria-label="Recent alerts" className="flex flex-col gap-gutter-sm">
          {alerts.map((alert) => {
            const style = iconForType(alert.type);
            return (
              <button
                key={alert.id}
                type="button"
                onClick={() => alert.subscriptionId && onSelectSubscription(alert.subscriptionId)}
                className={`w-full text-left rounded-lg bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_2px_12px_-2px_rgba(26,27,35,0.05)] flex items-start gap-gutter-md transition-opacity ${
                  alert.read ? 'opacity-75' : ''
                }`}
              >
                <div className={`w-10 h-10 rounded-full ${style.wrapper} flex items-center justify-center shrink-0`}>
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                    {style.icon}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface truncate">
                      {alert.title}
                    </h2>
                    <span
                      className={`font-mono text-mono-sm shrink-0 ${
                        alert.type === 'trial' && !alert.read
                          ? 'text-light-tertiary dark:text-dark-tertiary'
                          : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
                      }`}
                    >
                      {alert.timestampLabel}
                    </span>
                  </div>
                  <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                    {alert.description}
                  </p>
                </div>
              </button>
            );
          })}
        </section>

        {/* Delivery & Calendar Sync Controls */}
        <section
          aria-label="Notification channels"
          className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col gap-gutter-md"
        >
          <h2 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface">
            Delivery channels
          </h2>

          <div className="flex items-center justify-between gap-gutter-md">
            <div className="flex flex-col">
              <span className="font-body text-body-md text-light-on-surface dark:text-dark-on-surface">
                Web Push (Home Screen)
              </span>
              <span className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                iOS 16.4+ PWA enabled
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.webPushEnabled}
              onChange={(e) => handleToggleWebPush(e.target.checked)}
              aria-label="Enable Web Push notifications"
              className="w-6 h-6 rounded-sm text-light-primary focus:ring-light-primary border-light-outline-variant"
            />
          </div>

          <div className="flex items-center justify-between gap-gutter-md pt-gutter-sm border-t border-light-outline-variant dark:border-dark-outline-variant">
            <div className="flex flex-col">
              <span className="font-body text-body-md text-light-on-surface dark:text-dark-on-surface">
                Email fallback
              </span>
              <span className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Backup for trial &amp; price alerts
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.emailFallbackEnabled}
              onChange={(e) => {
                onToggleSetting('emailFallbackEnabled', e.target.checked);
                onShowToast(e.target.checked ? 'Email fallback enabled' : 'Email fallback disabled');
              }}
              aria-label="Enable email fallback alerts"
              className="w-6 h-6 rounded-sm text-light-primary focus:ring-light-primary border-light-outline-variant"
            />
          </div>

          <button
            type="button"
            onClick={handleDownloadICS}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-primary dark:text-dark-primary font-label text-label-lg inline-flex items-center justify-center gap-2 hover:opacity-90"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">event</span>
            <span>Subscribe to .ICS calendar feed</span>
          </button>
        </section>
      </main>
    </div>
  );
};
