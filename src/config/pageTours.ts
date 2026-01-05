import { TourStep } from '@/components/PageTour';

export const homeTourSteps: TourStep[] = [
  {
    target: 'home-journey-card',
    title: 'Your Daily Focus',
    description: 'This card shows your next step in the journey. Complete each task to level up and stay on track.',
    position: 'bottom',
  },
  {
    target: 'home-quick-actions',
    title: 'Quick Actions',
    description: 'Jump straight into tracking your day, viewing insights, or checking your calendar.',
    position: 'bottom',
  },
  {
    target: 'bottom-nav',
    title: 'Navigate Your App',
    description: 'Use the bottom bar to move between pages. Track your sales, view insights, and more.',
    position: 'top',
  },
];

export const trackTourSteps: TourStep[] = [
  {
    target: 'track-time-bar',
    title: 'Start Your Day Here',
    description: "Tap 'Start' when you begin knocking. This tracks your hours automatically. Pause for breaks, then resume when you're back.",
    position: 'auto',
  },
  {
    target: 'track-counter-grid',
    title: 'Count Your Activity',
    description: 'Tap any counter to add one. Swipe down to subtract. Your progress saves automatically.',
    position: 'auto',
  },
  {
    target: 'track-fp-counter',
    title: 'Log Your Sales',
    description: 'This is the big one! Tap here each time you close a deal. 🎉',
    position: 'top',
  },
  {
    target: 'track-sale-type-toggle',
    title: 'FP or Upgrade?',
    description: "Choose 'FP' for new accounts or 'Upgrade' when you add equipment to an existing customer.",
    position: 'top',
    action: 'openLogSaleSheet',
    lightOverlay: true,
  },
  {
    target: 'track-prmr-help-button',
    title: 'Need Help with PRMR?',
    description: "Tap the ? icon anytime. For upgrades, it opens a calculator that adds up your equipment automatically.",
    position: 'top',
    action: 'switchToUpgradeAndShowHelp',
    lightOverlay: true,
  },
  {
    target: 'track-upgrade-calculator',
    title: 'Chat to Calculate PRMR',
    description: "Example: '2 outdoor cameras, 1 replacement doorbell, 2 spotlights, 24/7 playback' = $46.32 PRMR. Just type what you sold!",
    position: 'top',
    action: 'openUpgradeCalculator',
    lightOverlay: true,
  },
];

export const calendarTourSteps: TourStep[] = [
  {
    target: 'calendar-grid',
    title: 'Your Progress at a Glance',
    description: "Here you can see how you're doing on any given week or month. Once you set up goals, you'll see the breakdown of your daily and weekly targets.",
    position: 'bottom',
  },
  {
    target: 'calendar-day-tile',
    title: 'Tap to See Details',
    description: 'Tap any day to view or edit your numbers for that date.',
    position: 'bottom',
  },
];

export const insightsTourSteps: TourStep[] = [
  {
    target: 'insights-date-range',
    title: 'Pick Your Time Range',
    description: 'Filter your data by this week, last week, month, or the whole summer.',
    position: 'bottom',
  },
  {
    target: 'insights-tabs',
    title: 'Explore Your Data',
    description: 'Switch between Overview, Performance, and Patterns to see different angles of your stats.',
    position: 'bottom',
  },
  {
    target: 'insights-metrics',
    title: 'Key Numbers',
    description: 'These cards show your most important metrics at a glance. Tap any card for more detail.',
    position: 'bottom',
  },
];

export const myGroupTourSteps: TourStep[] = [
  {
    target: 'group-hero-card',
    title: "Today's Priority",
    description: 'This shows who needs your attention most right now. One clear action to take.',
    position: 'bottom',
  },
  {
    target: 'group-attention-chips',
    title: 'Quick Filters',
    description: 'Tap any chip to see recruits in that category. Red badges mean action needed.',
    position: 'bottom',
  },
  {
    target: 'group-week-planner',
    title: 'Week Planner',
    description: 'Schedule and track your follow-ups. Never let a recruit slip through the cracks.',
    position: 'top',
  },
  {
    target: 'group-recruit-drawer',
    title: 'Move Them Forward',
    description: "Tap a recruit to see their full profile. For rookies, this is where you move them along in the process — from first contact all the way to signed!",
    position: 'top',
    action: 'openRecruitDrawer',
    lightOverlay: true, // Lighter overlay so drawer content is visible
  },
  {
    target: 'group-add-recruit',
    title: 'Add New Recruits',
    description: 'Tap here to add someone new to your pipeline. Build your team!',
    position: 'top',
  },
];

export const customersTourSteps: TourStep[] = [
  {
    target: 'customers-list',
    title: 'Your Customers',
    description: "All your sales in one place. Scroll through to see everyone you've helped.",
    position: 'bottom',
  },
  {
    target: 'customers-tabs',
    title: 'Filter by Status',
    description: 'Switch between Pending, Installed, and Cancelled to find what you need.',
    position: 'bottom',
  },
  {
    target: 'customers-map-toggle',
    title: 'Map View',
    description: 'See all your customers on a map. Great for planning follow-up visits!',
    position: 'bottom',
  },
];

export const reportsTourSteps: TourStep[] = [
  {
    target: 'reports-date-range',
    title: 'Set Your Period',
    description: 'Choose the date range for your report. Weekly reports are most common.',
    position: 'bottom',
  },
  {
    target: 'reports-scope',
    title: 'Choose Your Scope',
    description: 'View your personal stats or expand to see your whole team.',
    position: 'bottom',
  },
  {
    target: 'reports-export',
    title: 'Export Data',
    description: 'Download your report as a spreadsheet to share or analyze further.',
    position: 'bottom',
  },
];

export const goalsTourSteps: TourStep[] = [
  {
    target: 'goals-hero-ring',
    title: 'Your Goal Progress',
    description: 'This ring shows how close you are to hitting your active goal, plus your projected take-home pay.',
    position: 'bottom',
  },
  {
    target: 'goals-tier-selector',
    title: 'Focus Tiers',
    description: 'Must Do = your minimum to cover expenses. Will Do = your real target. Could Do = your stretch goal. Tap any to switch focus.',
    position: 'top',
  },
  {
    target: 'goals-commitment-chips',
    title: 'Preseason Commitments',
    description: 'Track blitzes, training hours, and books here. Tap any chip to update your progress.',
    position: 'bottom',
  },
  {
    target: 'goals-calendar-planning',
    title: 'Plan Your Work Days',
    description: 'Tap any date to mark it as a knocking day, or tap the blitz button to commit to a blitz. Your daily goal adjusts based on planned days.',
    position: 'top',
    action: 'openGoalsCalendarPlanning',
  },
  {
    target: 'goals-settings-button',
    title: 'Edit Your Goals',
    description: 'Tap here anytime to update your goals, expenses, or summer dates.',
    position: 'bottom',
  },
];
