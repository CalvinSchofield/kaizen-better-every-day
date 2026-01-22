import { STAGES, STAGE_DESCRIPTIONS } from "@/utils/stageConstants";
import { getCleanName, getCleanFirstName } from "@/utils/nameUtils";

// Re-export for backward compatibility
export { getCleanName as stripEmojis };

export const getFirstName = (name: string | null): string => {
  return getCleanFirstName(name);
};

// Re-export STAGES for backward compatibility
export { STAGES };

// All stages in display order
export const ALL_STAGES = [
  STAGES.LIST_100,
  STAGES.POTENTIAL_FOLLOW_UP,
  STAGES.REACHED_OUT,
  STAGES.EVALUATING,
  STAGES.SIGNED,
  STAGES.SHADOW,
  STAGES.SOLD,
  STAGES.SOLD_5_PLUS,
  STAGES.SIGNED_BUT_NOT_INTERESTED,
  STAGES.NOT_INTERESTED,
];

export const getStageDescription = (stage: string): string => {
  return STAGE_DESCRIPTIONS[stage] || '';
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
