import { format, getDay } from 'date-fns';

interface ReadinessProgress {
  trainingHoursGoal: number;
  trainingHoursProgress: number;
  booksGoal: number;
  booksProgress: number;
  rolePlaysGoal: number;
  rolePlaysProgress: number;
  mnlGoal: number;
  mnlProgress: number;
  behindCount: number;
  missingGoals: string[];
  fpGoal: number;
  fpCurrent: number;
}

interface SmartTextParams {
  recruitName: string;
  readinessProgress?: ReadinessProgress;
  isRecruiter?: boolean; // Current user is their recruiter
  isTeamLeader?: boolean; // Current user is their team leader
  currentUserName?: string;
}

/**
 * Generates a smart contextual text message based on the recruit's situation
 */
export const generateSmartTextMessage = ({
  recruitName,
  readinessProgress,
  isRecruiter,
  isTeamLeader,
  currentUserName,
}: SmartTextParams): string => {
  const firstName = recruitName.split(' ')[0];
  const dayOfWeek = getDay(new Date()); // 0 = Sunday, 1 = Monday, ...
  const isBeforeMonday = dayOfWeek >= 2 && dayOfWeek <= 6; // Tue-Sat
  const isAfterMonday = dayOfWeek === 0 || dayOfWeek === 1; // Sun or Mon
  
  const parts: string[] = [`Hey ${firstName}!`];
  
  if (!readinessProgress) {
    // No readiness data - generic check-in
    parts.push(`Just checking in - how's everything going?`);
    if (isRecruiter || isTeamLeader) {
      parts.push(`Let me know if you need any help!`);
    }
    return parts.join(' ');
  }
  
  const { 
    trainingHoursGoal, 
    trainingHoursProgress, 
    booksProgress,
    booksGoal,
    rolePlaysProgress,
    rolePlaysGoal,
    mnlGoal,
    mnlProgress,
    missingGoals,
  } = readinessProgress;
  
  // Calculate training hours pace
  const trainingGoalMinutes = trainingHoursGoal; // Already in minutes from the hook
  const trainingProgressMinutes = trainingHoursProgress;
  const trainingPct = trainingGoalMinutes > 0 ? (trainingProgressMinutes / trainingGoalMinutes) * 100 : 0;
  
  // Expected pace based on day of week (weekly goal, week starts Sunday)
  // Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
  const expectedPct = (dayOfWeek / 7) * 100;
  const isBehindOnTraining = trainingGoalMinutes > 0 && trainingPct < (expectedPct - 10);
  
  // Check MNL status
  const mnlGoalSet = mnlGoal > 0;
  const mnlBehind = mnlGoalSet && mnlProgress < mnlGoal;
  
  // Check books/role plays
  const booksBehind = booksGoal > 0 && booksProgress < booksGoal;
  const rolePlaysBehind = rolePlaysGoal > 0 && rolePlaysProgress < rolePlaysGoal;
  
  // Build message based on situation
  
  // MNL-related messaging
  if (mnlGoalSet) {
    if (isBeforeMonday) {
      // Remind and encourage attendance
      parts.push(`Don't forget Monday Night Lights is coming up! 🏈`);
      if (mnlBehind) {
        parts.push(`You're at ${mnlProgress}/${mnlGoal} for the season - showing up will help you hit your goal.`);
      }
    } else if (isAfterMonday) {
      // Ask if they went
      if (mnlBehind) {
        parts.push(`Did you make it to Monday Night Lights this week?`);
      }
    }
  }
  
  // Training hours messaging
  if (trainingGoalMinutes > 0) {
    if (isBehindOnTraining) {
      const hoursLogged = Math.round(trainingProgressMinutes / 60 * 10) / 10;
      const goalHours = Math.round(trainingGoalMinutes / 60 * 10) / 10;
      parts.push(`I noticed you're at ${hoursLogged}/${goalHours} training hours this week.`);
    }
  }
  
  // Remind about logging on app
  const needsLogging: string[] = [];
  if (booksGoal > 0 && booksProgress === 0) needsLogging.push('books');
  if (rolePlaysGoal > 0 && rolePlaysProgress === 0) needsLogging.push('role plays');
  
  if (needsLogging.length > 0) {
    parts.push(`Remember to log your ${needsLogging.join(' and ')} in the app!`);
  } else if (booksBehind || rolePlaysBehind) {
    const behind: string[] = [];
    if (booksBehind) behind.push('books');
    if (rolePlaysBehind) behind.push('role plays');
    parts.push(`Keep pushing on ${behind.join(' and ')} - you've got this!`);
  }
  
  // Offer help based on relationship
  if (isRecruiter || isTeamLeader) {
    if (missingGoals.length > 0 || isBehindOnTraining || booksBehind || rolePlaysBehind) {
      parts.push(`Is there anything I can help you with?`);
    }
  } else {
    // Viewing a leader's recruit - offer to connect them
    if (missingGoals.length > 0 || isBehindOnTraining) {
      parts.push(`Want me to help you schedule time with your leader to get on track?`);
    }
  }
  
  return parts.join(' ');
};
