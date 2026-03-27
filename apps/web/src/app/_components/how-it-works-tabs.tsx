'use client';

import React, { useState } from 'react';
import {
  ClipboardList,
  Search,
  Handshake,
  UserCircle,
  Gavel,
  BadgeCheck,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Data ─────────────────────────────────────────────────────────────────────

const clientSteps = [
  {
    step: 1,
    icon: ClipboardList,
    title: 'Post Your Project',
    description:
      'Describe your project in detail — set your budget, timeline, and required skills. Choose between fixed-price, hourly, or contest formats.',
    highlight: 'Takes less than 5 minutes',
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    step: 2,
    icon: Search,
    title: 'Review Bids',
    description:
      'Receive competitive bids from verified freelancers. Compare cover letters, portfolios, ratings, and pricing to find the perfect match.',
    highlight: 'Average 12 bids in 24h',
    color: 'text-violet-600',
    bg: 'bg-violet-50 dark:bg-violet-900/20',
    border: 'border-violet-200 dark:border-violet-800',
    gradient: 'from-violet-500 to-purple-500',
  },
  {
    step: 3,
    icon: Handshake,
    title: 'Hire & Collaborate',
    description:
      'Award the project, fund milestones via secure escrow, and collaborate in real-time. Release payments only when you\'re fully satisfied.',
    highlight: '100% money-back guarantee',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    gradient: 'from-emerald-500 to-green-500',
  },
];

const freelancerSteps = [
  {
    step: 1,
    icon: UserCircle,
    title: 'Build Your Profile',
    description:
      'Create a standout profile showcasing your skills, experience, and portfolio. Get verified to unlock premium project access and higher trust scores.',
    highlight: 'Verified profiles get 3× more bids',
    color: 'text-orange-600',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    border: 'border-orange-200 dark:border-orange-800',
    gradient: 'from-orange-500 to-amber-500',
  },
  {
    step: 2,
    icon: Gavel,
    title: 'Bid on Projects',
    description:
      'Browse thousands of open projects filtered by your skills and preferences. Submit personalised proposals with your rate and delivery timeline.',
    highlight: 'Thousands of new projects daily',
    color: 'text-rose-600',
    bg: 'bg-rose-50 dark:bg-rose-900/20',
    border: 'border-rose-200 dark:border-rose-800',
    gradient: 'from-rose-500 to-pink-500',
  },
  {
    step: 3,
    icon: BadgeCheck,
    title: 'Deliver & Get Paid',
    description:
      'Complete milestones, submit your work through the platform, and receive secure escrow payments directly to your preferred payout method.',
    highlight: 'Instant payouts available',
    color: 'text-teal-600',
    bg: 'bg-teal-50 dark:bg-teal-900/20',
    border: 'border-teal-200 dark:border-teal-800',
    gradient: 'from-teal-500 to-cyan-500',
  },
];

type TabId = 'client' | 'freelancer';

// ─── Component ────────────────────────────────────────────────────────────────

export function HowItWorksTabs() {
  const [activeTab, setActiveTab] = useState<TabId>('client');

  const steps = activeTab === 'client' ? clientSteps : freelancerSteps;

  return (
    <div className="w-full space-y-10">
      {/* ── Tab switcher ──────────────────────────────────────────────────── */}
      <div className="flex justify-center">
        <div className="inline-flex items-center rounded-xl border border-border bg-muted p-1.5 gap-1">
          {(
            [
              { id: 'client', label: "I'm Hiring", emoji: '🏢' },
              { id: 'freelancer', label: "I'm Freelancing", emoji: '💻' },
            ] satisfies { id: TabId; label: string; emoji: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-200',
                activeTab === tab.id
                  ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
              )}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              <span aria-hidden="true">{tab.emoji}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Steps ─────────────────────────────────────────────────────────── */}
      <div
        key={activeTab}
        className="grid gap-6 sm:gap-8 md:grid-cols-3"
        role="tabpanel"
        aria-label={activeTab === 'client' ? 'For Clients' : 'For Freelancers'}
      >
        {steps.map((item, index) => {
          const Icon = item.icon;
          const isLast = index === steps.length - 1;

          return (
            <div key={item.step} className="relative flex flex-col">
              {/* Connector arrow between steps (desktop only) */}
              {!isLast && (
                <div
                  aria-hidden="true"
                  className="absolute -right-4 top-8 z-10 hidden md:flex items-center"
                >
                  <ArrowRight className="h-5 w-5 text-muted-foreground/40" />
                </div>
              )}

              {/* Step card */}
              <div
                className={cn(
                  'group relative flex flex-col h-full rounded-2xl border bg-card p-6 shadow-soft',
                  'hover:shadow-medium hover:-translate-y-0.5 transition-all duration-200',
                  item.border,
                )}
              >
                {/* Gradient top accent */}
                <div
                  className={cn(
                    'absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300',
                    item.gradient,
                  )}
                />

                {/* Step number + icon */}
                <div className="mb-5 flex items-center gap-3">
                  {/* Icon */}
                  <div
                    className={cn(
                      'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
                      item.bg,
                    )}
                  >
                    <Icon className={cn('h-6 w-6', item.color)} />
                  </div>

                  {/* Step badge */}
                  <div
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold',
                      item.border,
                      item.color,
                    )}
                  >
                    {item.step}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 space-y-3">
                  <h3 className="text-lg font-bold text-foreground leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* Highlight pill */}
                <div
                  className={cn(
                    'mt-5 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
                    item.bg,
                    item.color,
                  )}
                >
                  <span
                    className={cn('h-1.5 w-1.5 rounded-full bg-current')}
                    aria-hidden="true"
                  />
                  {item.highlight}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── CTA below steps ───────────────────────────────────────────────── */}
      <div className="flex justify-center pt-2">
        <a
          href={activeTab === 'client' ? '/register?role=CLIENT' : '/register?role=FREELANCER'}
          className={cn(
            'group inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold',
            'shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-200',
            activeTab === 'client'
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-emerald-600 text-white hover:bg-emerald-700',
          )}
        >
          {activeTab === 'client' ? 'Post Your First Project' : 'Create a Free Profile'}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </a>
      </div>
    </div>
  );
}
