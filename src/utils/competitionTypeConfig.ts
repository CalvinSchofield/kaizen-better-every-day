import { User, Users, UserPlus } from "lucide-react";

export type ChallengeType = '1v1' | 'group';
export type IncentiveTargetType = 'first_to' | 'anyone_who' | 'group_total';

export const challengeTypeConfig: Record<ChallengeType, {
  icon: typeof User;
  label: string;
  sublabel: string;
  color: string;
}> = {
  '1v1': {
    icon: User,
    label: '1v1',
    sublabel: 'Head to head',
    color: 'text-orange-600',
  },
  'group': {
    icon: Users,
    label: 'Team',
    sublabel: 'Team vs Team',
    color: 'text-blue-600',
  },
};

export const incentiveTypeConfig: Record<IncentiveTargetType, {
  icon: typeof User;
  label: string;
  sublabel: string;
  color: string;
}> = {
  'first_to': {
    icon: User,
    label: 'First To',
    sublabel: 'Race',
    color: 'text-orange-600',
  },
  'anyone_who': {
    icon: UserPlus,
    label: 'Anyone',
    sublabel: 'All qualify',
    color: 'text-green-600',
  },
  'group_total': {
    icon: Users,
    label: 'Group',
    sublabel: 'Team goal',
    color: 'text-blue-600',
  },
};

// Helper to get a short type badge for compact displays
export const getChallengeTypeBadge = (type: ChallengeType) => {
  const config = challengeTypeConfig[type];
  return {
    Icon: config.icon,
    label: config.label,
    color: config.color,
  };
};

export const getIncentiveTypeBadge = (targetType: IncentiveTargetType) => {
  const config = incentiveTypeConfig[targetType] || incentiveTypeConfig.first_to;
  return {
    Icon: config.icon,
    label: config.label,
    color: config.color,
  };
};
