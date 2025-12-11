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
  if (markingComplete) {
    switch (field) {
      case 'onboarding_complete': return `This confirms ${recruitFirstName} has finished the initial onboarding steps.`;
      case 'trainings_complete': return `This confirms ${recruitFirstName} has completed all required trainings.`;
      case 'slack_joined': return `This confirms ${recruitFirstName} has joined the team Slack.`;
      case 'ramp_phase_1_complete': return `This confirms ${recruitFirstName} completed Phase 1: Onboard and get ready.`;
      case 'ramp_phase_2_complete': return `This confirms ${recruitFirstName} completed Phase 2: Start training.`;
      case 'ramp_phase_3_complete': return `This confirms ${recruitFirstName} completed Phase 3: Practice.`;
      case 'ramp_phase_4_complete': return `This confirms ${recruitFirstName} completed Phase 4: Saddle up!`;
      default: return '';
    }
  } else {
    // Undo messaging
    switch (field) {
      case 'onboarding_complete': return `This will undo onboarding and all following steps.`;
      case 'trainings_complete': return `This will undo trainings and all following steps.`;
      case 'slack_joined': return `This will undo Slack and all following steps.`;
      case 'ramp_phase_1_complete': return `This will undo Phase 1 and all following phases.`;
      case 'ramp_phase_2_complete': return `This will undo Phase 2 and all following phases.`;
      case 'ramp_phase_3_complete': return `This will undo Phase 3 and Phase 4.`;
      case 'ramp_phase_4_complete': return `This will undo Phase 4.`;
      default: return '';
    }
  }
};
