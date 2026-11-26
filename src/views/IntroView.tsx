import React, { useState } from 'react';

interface IntroViewProps {
  onStartSetup: () => void;
  onSignIn: () => void;
  onExploreDemo: () => void;
}

interface IntroSlide {
  id: string;
  icon: string;
  badge: string;
  title: string;
  description: string;
  highlights: string[];
}

const SLIDES: IntroSlide[] = [
  {
    id: 'renewals',
    icon: 'calendar_today',
    badge: 'Renewal radar',
    title: 'Never miss a renewal again',
    description:
      'Catch ending free trials, price hikes, and upcoming charges before they hit your card.',
    highlights: [
      '1, 3, or 7-day customizable renewal alerts',
      'Free trial countdowns & price-change flags',
      'Calendar timeline & .ICS feed export',
    ],
  },
  {
    id: 'splits',
    icon: 'group',
    badge: 'Household splits',
    title: 'Split plans with your household',
    description:
      'Track shared family plans like Netflix, Spotify, and iCloud+ and see everyone’s exact share.',
    highlights: [
      'Automatic per-person split math',
      'Monthly settle-up status per member',
      'Shareable read-only split summaries',
    ],
  },
  {
    id: 'budgets',
    icon: 'bar_chart',
    badge: 'Smart budgets',
    title: 'Stay under your monthly cap',
    description:
      'Spot overlapping tools, view 12-month forecasts, and trim unused subscriptions effortlessly.',
    highlights: [
      'Category budgets & over-cap warnings',
      'Duplicate service & low-value detection',
      'Offline-first PWA with local IndexedDB',
    ],
  },
];

export const IntroView: React.FC<IntroViewProps> = ({
  onStartSetup,
  onSignIn,
  onExploreDemo,
}) => {
  const [slideIndex, setSlideIndex] = useState(0);
  const slide = SLIDES[slideIndex];
  const isLast = slideIndex === SLIDES.length - 1;

  const handleNext = () => {
    if (isLast) {
      onStartSetup();
    } else {
      setSlideIndex((i) => Math.min(SLIDES.length - 1, i + 1));
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col justify-between max-w-[430px] mx-auto px-page-margin pt-gutter-lg pb-8 bg-light-surface dark:bg-dark-surface text-light-on-surface dark:text-dark-on-surface">
      {/* Top Bar: Step Indicators + Skip */}
      <header className="flex items-center justify-between gap-gutter-md">
        <div className="flex items-center gap-1.5" aria-label={`Intro slide ${slideIndex + 1} of ${SLIDES.length}`}>
          {SLIDES.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSlideIndex(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                idx === slideIndex
                  ? 'w-7 bg-light-primary dark:bg-dark-primary'
                  : 'w-2.5 bg-light-outline-variant dark:bg-dark-outline-variant'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={onStartSetup}
          className="inline-flex items-center justify-center min-h-[44px] px-3 font-label text-label-lg text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface dark:hover:text-dark-on-surface"
        >
          Skip intro
        </button>
      </header>

      {/* Slide Content */}
      <main className="flex flex-col gap-gutter-xl my-auto py-gutter-lg">
        <section className="flex flex-col gap-gutter-lg">
          <div className="flex items-center justify-between">
            <div className="w-16 h-16 rounded-2xl bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-[32px]" aria-hidden="true">
                {slide.icon}
              </span>
            </div>
            <span className="px-3 py-1 rounded-full bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-primary dark:text-dark-primary font-label text-label-sm">
              {slide.badge}
            </span>
          </div>

          <div className="flex flex-col gap-gutter-sm">
            <h1 className="font-headline text-display-lg-mobile text-light-on-surface dark:text-dark-on-surface text-balance">
              {slide.title}
            </h1>
            <p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant text-pretty">
              {slide.description}
            </p>
          </div>
        </section>

        <section
          aria-label="Key capabilities"
          className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col gap-gutter-md"
        >
          {slide.highlights.map((item) => (
            <div key={item} className="flex items-center gap-gutter-sm">
              <span
                className="w-6 h-6 rounded-full bg-success-container text-on-success-container flex items-center justify-center shrink-0"
                aria-hidden="true"
              >
                <span className="material-symbols-outlined text-[15px]">check</span>
              </span>
              <span className="font-body text-body-sm text-light-on-surface dark:text-dark-on-surface">
                {item}
              </span>
            </div>
          ))}
        </section>
      </main>

      {/* Navigation & Secondary Actions */}
      <footer className="flex flex-col gap-gutter-sm">
        <div className="flex items-center gap-gutter-sm">
          {slideIndex > 0 && (
            <button
              type="button"
              onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
              aria-label="Previous slide"
              className="inline-flex items-center justify-center min-h-[48px] px-4 rounded-md border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface font-label text-label-lg"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={handleNext}
            className="flex-1 inline-flex items-center justify-center gap-2 min-h-[48px] px-6 py-3 rounded-md bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-label text-label-lg transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            <span>{isLast ? 'Start setup' : 'Next'}</span>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              arrow_forward
            </span>
          </button>
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={onSignIn}
            className="min-h-[44px] px-2 font-label text-label-sm text-light-primary dark:text-dark-primary hover:underline"
          >
            I already have an account
          </button>
          <button
            type="button"
            onClick={onExploreDemo}
            className="min-h-[44px] px-2 font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface dark:hover:text-dark-on-surface"
          >
            Explore sample demo
          </button>
        </div>
      </footer>
    </div>
  );
};

