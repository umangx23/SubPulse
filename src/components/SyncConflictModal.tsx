import React from 'react';
import { CloudSnapshot, SyncResolutionStrategy } from '../types/subpulse';

interface SyncConflictModalProps {
  userEmail: string;
  localCounts: {
    subscriptions: number;
    members: number;
    alerts: number;
  };
  cloudSnapshot: CloudSnapshot;
  isResolving: boolean;
  errorMessage: string | null;
  onResolve: (strategy: SyncResolutionStrategy) => void;
}

export const SyncConflictModal: React.FC<SyncConflictModalProps> = ({
  userEmail,
  localCounts,
  cloudSnapshot,
  isResolving,
  errorMessage,
  onResolve,
}) => {
  const cloudCounts = {
    subscriptions: cloudSnapshot.subscriptions.length,
    members: cloudSnapshot.members.length,
    alerts: cloudSnapshot.alerts.length,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-conflict-title"
    >
      <div className="w-full max-w-md rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-xl shadow-2xl border border-light-outline-variant dark:border-dark-outline-variant flex flex-col gap-gutter-lg">
        {/* Header */}
        <div className="flex items-start gap-gutter-md">
          <div className="w-11 h-11 rounded-lg bg-light-primary-container dark:bg-dark-primary-container text-light-on-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
              cloud_sync
            </span>
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <h2
              id="sync-conflict-title"
              className="font-headline text-headline-md text-light-on-surface dark:text-dark-on-surface"
            >
              Choose how to sync your data
            </h2>
            <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              Both this device and <span className="font-medium text-light-on-surface dark:text-dark-on-surface">{userEmail}</span> already have saved SubPulse records.
            </p>
          </div>
        </div>

        {/* Side-by-Side Comparison */}
        <div className="grid grid-cols-2 gap-gutter-sm">
          <div className="rounded-lg bg-light-surface-container-low dark:bg-dark-surface-container-low p-gutter-md border border-light-outline-variant dark:border-dark-outline-variant flex flex-col gap-1.5">
            <span className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              On this device
            </span>
            <p className="font-mono text-mono-md text-light-on-surface dark:text-dark-on-surface tabular-nums">
              {localCounts.subscriptions} {localCounts.subscriptions === 1 ? 'plan' : 'plans'}
            </p>
            <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums">
              {localCounts.members} {localCounts.members === 1 ? 'member' : 'members'} · {localCounts.alerts}{' '}
              {localCounts.alerts === 1 ? 'alert' : 'alerts'}
            </p>
          </div>

          <div className="rounded-lg bg-light-surface-container-low dark:bg-dark-surface-container-low p-gutter-md border border-light-outline-variant dark:border-dark-outline-variant flex flex-col gap-1.5">
            <span className="font-label text-label-sm text-light-primary dark:text-dark-primary">
              In cloud account
            </span>
            <p className="font-mono text-mono-md text-light-on-surface dark:text-dark-on-surface tabular-nums">
              {cloudCounts.subscriptions} {cloudCounts.subscriptions === 1 ? 'plan' : 'plans'}
            </p>
            <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums">
              {cloudCounts.members} {cloudCounts.members === 1 ? 'member' : 'members'} · {cloudCounts.alerts}{' '}
              {cloudCounts.alerts === 1 ? 'alert' : 'alerts'}
            </p>
          </div>
        </div>

        {errorMessage && (
          <p
            role="alert"
            className="rounded-md bg-light-error-container/60 dark:bg-dark-error-container/50 px-3.5 py-2.5 font-body text-body-sm text-light-on-error-container dark:text-dark-on-error-container"
          >
            {errorMessage}
          </p>
        )}

        {/* Resolution Options */}
        <div className="flex flex-col gap-gutter-sm">
          <button
            type="button"
            disabled={isResolving}
            onClick={() => onResolve('merge')}
            className="w-full text-left rounded-lg bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary p-gutter-md flex items-center justify-between gap-gutter-sm transition-opacity disabled:opacity-60"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-label text-label-lg">
                {isResolving ? 'Syncing…' : 'Merge local & cloud (Recommended)'}
              </span>
              <span className="font-body text-body-sm opacity-90">
                Keep unique plans, members, and alerts from both and back up to cloud.
              </span>
            </div>
            <span className="material-symbols-outlined text-[20px] shrink-0" aria-hidden="true">
              merge_type
            </span>
          </button>

          <button
            type="button"
            disabled={isResolving}
            onClick={() => onResolve('keep_cloud')}
            className="w-full text-left rounded-lg bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface p-gutter-md flex items-center justify-between gap-gutter-sm hover:bg-light-surface-container dark:hover:bg-dark-surface-container transition-colors disabled:opacity-60"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-label text-label-lg">Keep cloud data</span>
              <span className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Replace this device&apos;s guest data with your saved cloud backup.
              </span>
            </div>
            <span className="material-symbols-outlined text-[20px] shrink-0 text-light-primary dark:text-dark-primary" aria-hidden="true">
              cloud_download
            </span>
          </button>

          <button
            type="button"
            disabled={isResolving}
            onClick={() => onResolve('overwrite_cloud')}
            className="w-full text-left rounded-lg bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface p-gutter-md flex items-center justify-between gap-gutter-sm hover:bg-light-surface-container dark:hover:bg-dark-surface-container transition-colors disabled:opacity-60"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-label text-label-lg">Overwrite cloud with local</span>
              <span className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Upload this device&apos;s data and replace what is currently in the cloud.
              </span>
            </div>
            <span className="material-symbols-outlined text-[20px] shrink-0 text-warning" aria-hidden="true">
              cloud_upload
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
