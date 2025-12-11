// Helper to strip emojis from names for cleaner display
export const stripEmojis = (text: string | null): string | null => {
  if (!text) return null;
  return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '').trim();
};

export const getFirstName = (name: string | null): string => {
  if (!name) return '';
  const cleaned = stripEmojis(name) || '';
  return cleaned.split(' ')[0];
};

export const STAGES = [
  '100 List',
  'Potential Follow Up',
  'Reached Out',
  'Evaluating',
  'Signed',
  'Shadow ✅',
  'Sold 💲',
  'Sold (5+) 💰',
  'Signed but Not Interested',
  'Not Interested',
];

export const getStageDescription = (stage: string): string => {
  switch (stage) {
    case '100 List': return 'A potential recruit on the initial list who hasn\'t been contacted yet.';
    case 'Reached Out': return 'You\'ve made initial contact but haven\'t had a meaningful conversation yet.';
    case 'Evaluating': return 'They\'re interested and actively considering the opportunity.';
    case 'Signed': return 'They\'ve committed to join and are starting onboarding!';
    case 'Shadow ✅': return 'They\'ve attended a blitz and shadowed in the field.';
    case 'Sold 💲': return 'They\'ve made their first sale!';
    case 'Sold (5+) 💰': return 'They\'ve sold 5 or more FP+ and are on track!';
    case 'Not Interested': return 'They declined the opportunity.';
    case 'Signed but Not Interested': return 'They signed but later decided not to continue.';
    case 'Potential Follow Up': return 'Not ready now but worth following up later.';
    default: return '';
  }
};

export const getOnboardingStepDescription = (field: string, markingComplete: boolean, recruitFirstName: string): string => {
  const action = markingComplete ? 'This confirms that' : 'This will mark that';
  switch (field) {
    case 'onboarding_complete': return `${action} ${recruitFirstName} has finished the initial onboarding steps and is ready to proceed.`;
    case 'trainings_complete': return `${action} ${recruitFirstName} has completed all required training videos and materials.`;
    case 'slack_joined': return `${action} ${recruitFirstName} has joined the team Slack workspace.`;
    case 'ramp_phase_1_complete': return `${action} ${recruitFirstName} has completed Phase 1: Onboard and get ready.`;
    case 'ramp_phase_2_complete': return `${action} ${recruitFirstName} has completed Phase 2: Start training.`;
    case 'ramp_phase_3_complete': return `${action} ${recruitFirstName} has completed Phase 3: Practice.`;
    case 'ramp_phase_4_complete': return `${action} ${recruitFirstName} has completed Phase 4: Saddle up and is blitz-ready!`;
    default: return '';
  }
};
