import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={
          compact
            ? 'inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-primary dark:text-dark-primary border border-light-outline-variant dark:border-dark-outline-variant font-label text-label-sm whitespace-nowrap shrink-0 hover:opacity-90'
            : 'w-full inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-primary dark:text-dark-primary border border-light-outline-variant dark:border-dark-outline-variant font-label text-label-sm whitespace-nowrap shrink-0 hover:opacity-90'
        }
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">install_desktop</span>
        <span>Install app</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={
            compact
              ? 'inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-primary dark:text-dark-primary border border-light-outline-variant dark:border-dark-outline-variant font-label text-label-sm whitespace-nowrap shrink-0'
              : 'w-full inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-primary dark:text-dark-primary border border-light-outline-variant dark:border-dark-outline-variant font-label text-label-sm whitespace-nowrap shrink-0'
          }
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">ios_share</span>
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-xl shadow-xl flex flex-col gap-gutter-md border border-light-outline-variant dark:border-dark-outline-variant">
              <div className="flex items-center justify-between">
                <h3 className="font-headline text-headline-md text-light-on-surface dark:text-dark-on-surface">
                  Install on iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close install guide"
                  className="w-9 h-9 rounded-full inline-flex items-center justify-center text-light-on-surface-variant dark:text-dark-on-surface-variant hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              <ol className="flex flex-col gap-gutter-sm text-body-sm text-light-on-surface dark:text-dark-on-surface">
                <li className="flex items-center gap-gutter-sm">
                  <span className="w-7 h-7 rounded-full bg-light-surface-container dark:bg-dark-surface-container text-light-primary dark:text-dark-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[16px]">ios_share</span>
                  </span>
                  <span>Tap the Share button in Safari&apos;s bottom bar.</span>
                </li>
                <li className="flex items-center gap-gutter-sm">
                  <span className="w-7 h-7 rounded-full bg-light-surface-container dark:bg-dark-surface-container text-light-primary dark:text-dark-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[16px]">add_box</span>
                  </span>
                  <span>Scroll down and choose &quot;Add to Home Screen&quot;.</span>
                </li>
                <li className="flex items-center gap-gutter-sm">
                  <span className="w-7 h-7 rounded-full bg-light-surface-container dark:bg-dark-surface-container text-light-primary dark:text-dark-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[16px]">notifications_active</span>
                  </span>
                  <span>Open SubPulse from Home Screen for offline sync &amp; push.</span>
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full min-h-[44px] rounded-md bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-label text-label-lg"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
