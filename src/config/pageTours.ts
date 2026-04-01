import { TourStep } from '@/components/PageTour';

export const homeTourSteps: TourStep[] = [
  {
    target: 'home-header',
    title: 'Your Home Base',
    description: 'This is your daily dashboard. It adapts based on whether you are pre-work, actively knocking, or done for the day.',
    position: 'bottom',
  },
  {
    target: 'home-cards',
    title: 'Your Daily Cards',
    description: 'These cards show your focus, activity summary, and leaderboard position. They update in real-time as you work.',
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
    description: "Tap 'Start' when you begin knocking. This tracks your hours automatically. Pause for breaks, then resume.",
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
    description: 'This is the big one! Tap here each time you close a deal.',
    position: 'top',
  },
  {
    target: 'track-sale-type-toggle',
    title: 'FP or Upgrade?',
    description: "Choose 'FP' for new accounts or 'Upgrade' when you add equipment to an existing customer.",
    position: 'bottom',
    action: 'openLogSaleSheet',
    lightOverlay: true,
  },
  {
    target: 'track-prmr-help-button',
    title: 'Need Help with PRMR?',
    description: 'Tap the ? icon anytime. For upgrades, it opens a calculator that adds up your equipment automatically.',
    position: 'bottom',
    action: 'switchToUpgradeAndShowHelp',
    lightOverlay: true,
  },
  {
    target: 'track-upgrade-calculator',
    title: 'Chat to Calculate Upgrade PRMR',
    description: 'Just type what you sold and the calculator does the math for you!',
    position: 'bottom',
    action: 'openUpgradeCalculator',
    lightOverlay: true,
  },
];

export const calendarTourSteps: TourStep[] = [
  {
    target: 'calendar-grid',
    title: 'Your Progress at a Glance',
    description: 'See how you are doing on any given week or month. Once you set up goals, you will see the breakdown of your daily and weekly targets.',
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
    description: 'Filter your data by this week, last week, month, or custom dates. The app auto-selects the most recent period with data.',
    position: 'bottom',
  },
  {
    target: 'insights-tabs',
    title: 'Explore Your Data',
    description: 'Switch between Overview, Performance, Patterns, and Deals to see different angles of your stats.',
    position: 'bottom',
  },
  {
    target: 'insights-metrics',
    title: 'Key Numbers',
    description: 'Your most important metrics at a glance. Tap any card for more detail!',
    position: 'bottom',
  },
];

export const leaderboardTourSteps: TourStep[] = [
  {
    target: 'leaderboard-hero',
    title: 'Your Standing',
    description: 'See how you rank and what awards you have earned. This updates in real-time during knocking hours!',
    position: 'bottom',
  },
  {
    target: 'leaderboard-filters',
    title: 'Change Timeframe',
    description: 'Switch between Live (today), Yesterday, This Week, and more. Live mode shows real-time rankings!',
    position: 'bottom',
  },
  {
    target: 'leaderboard-sales',
    title: 'Sales Leaders',
    description: 'Who is closing the most deals? See top performers for FP+, PRMR, and more.',
    position: 'bottom',
  },
];

export const getMyGroupTourSteps = (accessLevel?: string): TourStep[] => {
  // Role-adaptive invite description
  const isTeamLead = accessLevel === 'team_lead' || accessLevel === 'assistant_manager';
  const inviteDesc = isTeamLead
    ? 'Use the + button to add recruits to your pipeline and create invite links for your reps.'
    : 'Use the + button to create invite links for your leaders. They will get their own onboarding and can build their teams.';

  return [
    {
      target: 'group-hero-card',
      title: 'Today\'s Focus',
      description: 'This card highlights your most important recruit action for today — the person who needs your attention most right now.',
      position: 'bottom',
    },
    {
      target: 'add-action',
      title: 'Invite & Add People',
      description: inviteDesc,
      position: 'bottom',
    },
    {
      target: 'group-attention-chips',
      title: 'Track What Needs Attention',
      description: 'These chips show who needs follow-up, has overdue tasks, or needs onboarding help. Tap any to filter.',
      position: 'top',
    },
    {
      target: 'group-week-planner',
      title: 'Your Scheduled Tasks',
      description: 'See your planned tasks for the week. Swipe a task left to reschedule or contact, swipe right to mark it done.',
      position: 'top',
    },
  ];
};

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
    description: 'Must Do = your minimum. Will Do = your real target. Could Do = your stretch goal. Tap any to switch focus.',
    position: 'top',
  },
  {
    target: 'goals-calendar-planning',
    title: 'Plan Your Work Days',
    description: 'Mark your knocking days here. More planned days = lower daily goal. Request time off by tapping planned days during summer.',
    position: 'top',
  },
  {
    target: 'goals-settings-button',
    title: 'Edit Your Goals',
    description: 'Tap here anytime to update your goals, expenses, or summer dates.',
    position: 'bottom',
  },
];
