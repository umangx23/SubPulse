import React, { useState } from 'react';

interface SystemStatesViewProps {
  onBack: () => void;
  onAddNew: () => void;
  onShowToast: (msg: string) => void;
}

export const SystemStatesView: React.FC<SystemStatesViewProps> = ({
  onBack,
  onAddNew,
  onShowToast,
}) => {
  const [snackbarVisible, setSnackbarVisible] = useState(true);

  return (
    <div className="flex flex-col flex-1">
      {/* Offline Mode Banner Preview */}
      <div
        role="status"
        className="bg-warning-container text-on-warning-container px-page-margin lg:px-gutter-xl py-2.5 flex items-center justify-between gap-gutter-sm"
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">cloud_off</span>
          <span className="font-label text-label-sm">Offline · Saved locally in IndexedDB</span>
        </div>
        <button
          type="button"
          onClick={() => onShowToast('IndexedDB sync verified')}
          className="font-label text-label-sm underline"
        >
          Retry
        </button>
      </div>

      {/* Header */}
      <header className="px-page-margin lg:px-gutter-xl pt-gutter-lg pb-gutter-md flex items-center justify-between gap-gutter-sm">
        <div className="flex items-center gap-gutter-sm">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to Settings"
            className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest border border-light-outline-variant dark:border-dark-outline-variant"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">arrow_back</span>
          </button>
          <div className="flex flex-col">
            <span className="font-headline text-title-md text-light-on-surface dark:text-dark-on-surface leading-tight">
              SubPulse
            </span>
            <span className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              System states
            </span>
          </div>
        </div>
      </header>

      <main className="px-page-margin lg:px-gutter-xl flex flex-col gap-gutter-lg flex-1 max-w-2xl w-full mx-auto lg:mx-0">
        {/* Empty Subscriptions State */}
        <section
          aria-label="Empty subscriptions state"
          className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-xl shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col items-center text-center gap-gutter-md"
        >
          <div className="w-14 h-14 rounded-full bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-primary dark:text-dark-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px]" aria-hidden="true">receipt_long</span>
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface">
              No subscriptions yet
            </h1>
            <p className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant text-pretty">
              Add your first recurring plan or import a CSV to see upcoming renewals and budget totals.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddNew}
            className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-md bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-label text-label-lg"
          >
            Add first subscription
          </button>
        </section>

        {/* Skeleton Loader Preview */}
        <section aria-label="Loading skeleton state" className="flex flex-col gap-gutter-sm">
          <span className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant px-1">
            Loading skeleton
          </span>
          <div className="rounded-lg bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_2px_12px_-2px_rgba(26,27,35,0.05)] flex items-center justify-between gap-gutter-md">
            <div className="flex items-center gap-gutter-md">
              <div className="w-11 h-11 rounded-md bg-light-surface-container-high dark:bg-dark-surface-container-high animate-pulse" />
              <div className="flex flex-col gap-2">
                <div className="w-28 h-3.5 rounded-full bg-light-surface-container-high dark:bg-dark-surface-container-high animate-pulse" />
                <div className="w-20 h-3 rounded-full bg-light-surface-container dark:bg-dark-surface-container animate-pulse" />
              </div>
            </div>
            <div className="w-14 h-4 rounded-full bg-light-surface-container-high dark:bg-dark-surface-container-high animate-pulse" />
          </div>
        </section>

        {/* Undo Snackbar */}
        {snackbarVisible ? (
          <div
            role="alert"
            className="rounded-lg bg-light-inverse-surface dark:bg-dark-inverse-surface text-light-inverse-on-surface dark:text-dark-inverse-on-surface px-4 py-3 flex items-center justify-between gap-gutter-md shadow-md"
          >
            <span className="font-body text-body-sm">Archived &quot;Apple Arcade&quot;</span>
            <button
              type="button"
              onClick={() => {
                setSnackbarVisible(false);
                onShowToast('Restored "Apple Arcade"');
              }}
              className="font-label text-label-sm text-light-inverse-primary dark:text-dark-inverse-primary"
            >
              Undo
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSnackbarVisible(true)}
            className="self-start font-label text-label-sm text-light-primary dark:text-dark-primary underline"
          >
            Show undo snackbar again
          </button>
        )}
      </main>
    </div>
  );
};
