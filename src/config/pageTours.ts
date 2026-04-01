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
  // Phase 1: Context — The Three States
  {
    target: 'track-pre-work-state',
    title: 'Track Adapts to Your Day',
    description: 'Track has three modes: before you start, while you\'re knocking, and after you save your day. Right now you\'re in Pre-Work mode — let\'s walk through it.',
    position: 'bottom',
  },
  {
    target: 'track-start-button',
    title: 'Start Your Day',
    description: 'When you\'re ready to hit doors, tap this button. It starts your clock, which will help you see how much money you make per hour as you continue to track and sell!',
    position: 'top',
  },
  // Phase 2: Active Working Mode
  {
    target: 'track-time-bar',
    title: 'Your Time Clock',
    description: 'Your hours are tracked automatically. Tap pause for lunch or breaks — it keeps your actual knocking time accurate.',
    position: 'bottom',
  },
  {
    target: 'track-counter-grid',
    title: 'Count Your Activity',
    description: 'Tap any counter to add one. Swipe down to subtract. Doors, pitches, presentations, closes — everything saves automatically as you go.',
    position: 'auto',
  },
  {
    target: 'track-fp-counter',
    title: 'Log Your Sales',
    description: 'This is the big one. Each time you close a deal, tap here to log it. You\'ll choose FP or Upgrade and enter the PRMR.',
    position: 'top',
  },
  // Phase 3: Log Sale Sheet
  {
    target: 'track-sale-type-toggle',
    title: 'FP or Upgrade?',
    description: 'Choose \'FP\' for brand-new accounts or \'Upgrade\' when adding equipment to an existing customer. Let\'s see how it works.',
    position: 'bottom',
    action: 'openLogSaleSheet',
    lightOverlay: true,
  },
  {
    target: 'track-prmr-help-button',
    title: 'PRMR Help',
    description: 'Not sure about the PRMR? Tap the ? icon. For upgrades, it opens a calculator — just type what you sold and it does the math.',
    position: 'bottom',
    action: 'switchToUpgradeAndShowHelp',
    lightOverlay: true,
  },
  // Phase 4: Day Complete
  {
    target: 'track-end-clock',
    title: 'Save & Review Your Day',
    description: 'When you\'re done knocking, tap \'End\' to set your stop time, then save your day. You\'ll see a summary of your activity, sales, and goal progress.',
    position: 'bottom',
  },
  {
    target: 'track-day-complete-preview',
    title: 'Your Day Complete View',
    description: 'After saving, Track transforms into your day recap — an activity ring, your stats, and how today moved you toward your goal. Here\'s what a great day looks like!',
    position: 'top',
    action: 'showDayCompletePreview',
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
      target: 'group-first-task',
      title: 'Your Scheduled Tasks',
      description: 'Each task card shows a planned action. Swipe left to reschedule or contact, swipe right to mark it done.',
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
