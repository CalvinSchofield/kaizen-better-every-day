import { Target, Zap, Trophy } from 'lucide-react';

export type GoalTier = 'preseason' | 'mustDo' | 'willDo' | 'couldDo';
export type SummerTier = 'mustDo' | 'willDo' | 'couldDo';

export const GOAL_TIER_CONFIG = {
  preseason: {
    label: 'Preseason',
    shortLabel: 'Preseason',
    icon: Target,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    gradient: 'from-blue-400 to-blue-600',
    glowColor: 'shadow-blue-500/30',
    description: 'Before summer starts',
  },
  mustDo: {
    label: 'Must Do',
    shortLabel: 'Must',
    icon: Target,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    gradient: 'from-emerald-400 to-green-600',
    glowColor: 'shadow-emerald-500/30',
    description: 'Cover expenses minimum',
  },
  willDo: {
    label: 'Will Do',
    shortLabel: 'Will',
    icon: Zap,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    gradient: 'from-amber-400 to-orange-500',
    glowColor: 'shadow-amber-500/30',
    description: 'Committed target',
  },
  couldDo: {
    label: 'Could Do',
    shortLabel: 'Could',
    icon: Trophy,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    gradient: 'from-purple-400 to-purple-600',
    glowColor: 'shadow-purple-500/30',
    description: 'Stretch goal',
  },
} as const;
