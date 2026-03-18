/**
 * Constraint Analysis System
 * 
 * Determines the PRIMARY constraint limiting team performance.
 * 
 * IMPORTANT: All benchmarks are derived from the team's own 14-day rolling
 * baseline. Hardcoded "industry standards" are only used as a last resort
 * when no baseline data exists yet.
 */

import { BaselineConversions } from "@/utils/baselineCalculations";

export interface FunnelStage {
  name: string;
  fromLabel: string;
  toLabel: string;
  rate: number;      // Actual conversion rate
  benchmark: number; // Team's own baseline conversion rate
}

export interface ConstraintResult {
  type: 'effort' | 'skill' | 'consistency' | 'on_track';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  details?: string;
  actionLabel?: string;
  skillBottleneck?: FunnelStage;
}

export interface TeamMetrics {
  avgDoorsPerHour: number;
  doorsPerHourBenchmark: number;
  lateStartCount: number;
  earlyEndCount: number;
  totalReps: number;
  totalDoors: number;
  totalDMs: number;
  totalPitches: number;
  totalTransitions: number;
  totalPresentations: number;
  totalCloses: number;
  totalFP: number;
  repsWithActivity: number;
  expectedReps?: number;
}

/**
 * Fallback benchmarks — only used when no baseline history exists.
 * Once a team has 3+ days of data, these are NEVER used.
 */
const FALLBACK_BENCHMARKS: BaselineConversions = {
  doorsToDMs: 0.35,
  dmsToPitches: 0.60,
  pitchesToTransitions: 0.50,
  transitionsToPres: 0.65,
  presToCloses: 0.40,
  doorsPerHour: 13,
  avgStartMinutes: null,
  avgHoursWorked: 0,
  hasEnoughData: false,
};

/**
 * Resolve which benchmarks to use — team's own baseline, or fallback
 */
const resolveBenchmarks = (baseline?: BaselineConversions): BaselineConversions => {
  if (baseline && baseline.hasEnoughData) return baseline;
  return FALLBACK_BENCHMARKS;
};

/**
 * Analyze funnel stages and find the biggest bottleneck vs the team's own baseline
 */
export const analyzeFunnelBottleneck = (
  metrics: TeamMetrics,
  baseline?: BaselineConversions,
): FunnelStage | null => {
  const bench = resolveBenchmarks(baseline);
  const stages: FunnelStage[] = [];
  
  if (metrics.totalDoors > 0) {
    stages.push({
      name: 'doors_to_dms',
      fromLabel: 'Doors',
      toLabel: 'Decision Makers',
      rate: metrics.totalDMs / metrics.totalDoors,
      benchmark: bench.doorsToDMs,
    });
  }
  
  if (metrics.totalDMs > 0) {
    stages.push({
      name: 'dms_to_pitches',
      fromLabel: 'Decision Makers',
      toLabel: 'Pitches',
      rate: metrics.totalPitches / metrics.totalDMs,
      benchmark: bench.dmsToPitches,
    });
  }
  
  if (metrics.totalPitches > 0) {
    stages.push({
      name: 'pitches_to_transitions',
      fromLabel: 'Pitches',
      toLabel: 'Transitions',
      rate: metrics.totalTransitions / metrics.totalPitches,
      benchmark: bench.pitchesToTransitions,
    });
  }
  
  if (metrics.totalTransitions > 0) {
    stages.push({
      name: 'transitions_to_presentations',
      fromLabel: 'Transitions',
      toLabel: 'Presentations',
      rate: metrics.totalPresentations / metrics.totalTransitions,
      benchmark: bench.transitionsToPres,
    });
  }
  
  if (metrics.totalPresentations > 0) {
    stages.push({
      name: 'presentations_to_closes',
      fromLabel: 'Presentations',
      toLabel: 'Closes',
      rate: metrics.totalCloses / metrics.totalPresentations,
      benchmark: bench.presToCloses,
    });
  }
  
  let worstStage: FunnelStage | null = null;
  let worstGap = 0;
  
  for (const stage of stages) {
    const gap = stage.benchmark - stage.rate;
    if (gap > worstGap) {
      worstGap = gap;
      worstStage = stage;
    }
  }
  
  // Only flag if gap is >15% below the team's own baseline
  if (worstStage && worstGap > 0.15) {
    return worstStage;
  }
  
  return null;
};

/**
 * Detect the primary constraint limiting team performance
 */
export const detectPrimaryConstraint = (
  metrics: TeamMetrics,
  baseline?: BaselineConversions,
): ConstraintResult => {
  const bench = resolveBenchmarks(baseline);
  const effortBenchmark = bench.doorsPerHour > 0 ? bench.doorsPerHour : 13;
  
  const hasValidTimeData = metrics.avgDoorsPerHour > 0 || metrics.totalDoors === 0;
  
  // 1. Check effort (doors per hour vs team's own baseline)
  if (hasValidTimeData && metrics.avgDoorsPerHour < effortBenchmark * 0.75) {
    const percentBelow = ((effortBenchmark - metrics.avgDoorsPerHour) / effortBenchmark * 100).toFixed(0);
    return {
      type: 'effort',
      severity: 'critical',
      message: 'Effort is the constraint',
      details: `Team averaging ${metrics.avgDoorsPerHour.toFixed(1)} doors/hr (${percentBelow}% below baseline of ${effortBenchmark.toFixed(1)})`,
      actionLabel: 'Hold Accountable',
    };
  }
  
  if (hasValidTimeData && metrics.avgDoorsPerHour < effortBenchmark * 0.90) {
    return {
      type: 'effort',
      severity: 'warning',
      message: 'Effort is slightly below baseline',
      details: `Team averaging ${metrics.avgDoorsPerHour.toFixed(1)} doors/hr (baseline: ${effortBenchmark.toFixed(1)})`,
      actionLabel: 'Coach Effort',
    };
  }
  
  // 2. Check skill bottlenecks vs team's own baseline
  const bottleneck = analyzeFunnelBottleneck(metrics, baseline);
  if (bottleneck) {
    const actualPercent = (bottleneck.rate * 100).toFixed(0);
    const benchmarkPercent = (bottleneck.benchmark * 100).toFixed(0);
    
    const severity = bottleneck.rate < bottleneck.benchmark * 0.6 ? 'critical' : 'warning';
    
    return {
      type: 'skill',
      severity,
      message: `Skill gap: ${bottleneck.fromLabel} → ${bottleneck.toLabel}`,
      details: `${actualPercent}% conversion (baseline: ${benchmarkPercent}%)`,
      actionLabel: 'Train',
      skillBottleneck: bottleneck,
    };
  }
  
  // 3. Check consistency
  const lateStartPercent = metrics.totalReps > 0 ? (metrics.lateStartCount / metrics.totalReps) * 100 : 0;
  const earlyEndPercent = metrics.totalReps > 0 ? (metrics.earlyEndCount / metrics.totalReps) * 100 : 0;
  
  if (lateStartPercent > 40 || earlyEndPercent > 40) {
    return {
      type: 'consistency',
      severity: 'warning',
      message: 'Work schedule consistency needs attention',
      details: lateStartPercent > earlyEndPercent 
        ? `${Math.round(lateStartPercent)}% of reps had late starts`
        : `${Math.round(earlyEndPercent)}% of reps ended early`,
      actionLabel: 'Address Schedule',
    };
  }
  
  // 4. Default: on track
  return {
    type: 'on_track',
    severity: 'info',
    message: 'Team is performing well',
    details: 'Effort and skill metrics are within expected ranges',
  };
};

/**
 * Generate leader action recommendations
 */
export interface LeaderAction {
  type: 'coach' | 'train' | 'praise' | 'accountable';
  label: string;
  repNames?: string[];
  count?: number;
  priority: number;
}

export interface RepPerformanceData {
  name: string;
  effortScore: number;
  effortCategory: 'outstanding' | 'standard' | 'needs_improvement';
  fp: number;
  hasLateStart: boolean;
  hasEarlyEnd: boolean;
  hasLowDoors: boolean;
}

export const generateLeaderActions = (
  reps: RepPerformanceData[],
  constraint: ConstraintResult
): LeaderAction[] => {
  const actions: LeaderAction[] = [];
  
  const needsAccountability = reps.filter(r => r.effortCategory === 'needs_improvement');
  if (needsAccountability.length > 0) {
    actions.push({
      type: 'accountable',
      label: 'Hold Accountable',
      repNames: needsAccountability.slice(0, 3).map(r => r.name),
      count: needsAccountability.length,
      priority: 1,
    });
  }
  
  const needsCoaching = reps.filter(r => 
    r.effortCategory === 'standard' && 
    (r.hasLateStart || r.hasEarlyEnd || r.hasLowDoors)
  );
  if (needsCoaching.length > 0) {
    actions.push({
      type: 'coach',
      label: 'Coach',
      repNames: needsCoaching.slice(0, 3).map(r => r.name),
      count: needsCoaching.length,
      priority: 2,
    });
  }
  
  if (constraint.type === 'skill' && constraint.skillBottleneck) {
    actions.push({
      type: 'train',
      label: `Train: ${constraint.skillBottleneck.fromLabel} → ${constraint.skillBottleneck.toLabel}`,
      priority: constraint.severity === 'critical' ? 1 : 3,
    });
  }
  
  const topPerformers = reps
    .filter(r => r.effortCategory === 'outstanding' && r.fp > 0)
    .sort((a, b) => b.fp - a.fp)
    .slice(0, 3);
  
  if (topPerformers.length > 0) {
    actions.push({
      type: 'praise',
      label: 'Praise',
      repNames: topPerformers.map(r => r.name),
      priority: 4,
    });
  }
  
  return actions.sort((a, b) => a.priority - b.priority);
};

/**
 * Calculate impact if underperforming reps matched the team's own baseline
 */
export const calculateImpactPotential = (
  metrics: TeamMetrics,
  bottleneck: FunnelStage | null,
  baseline?: BaselineConversions,
): string | null => {
  if (!bottleneck) return null;
  const bench = resolveBenchmarks(baseline);
  
  const conversionGap = bottleneck.benchmark - bottleneck.rate;
  if (conversionGap <= 0) return null;
  
  let additionalCloses = 0;
  
  switch (bottleneck.name) {
    case 'pitches_to_transitions': {
      const additionalTransitions = metrics.totalPitches * conversionGap;
      additionalCloses = additionalTransitions * bench.transitionsToPres * bench.presToCloses;
      break;
    }
    case 'transitions_to_presentations': {
      const additionalPresentations = metrics.totalTransitions * conversionGap;
      additionalCloses = additionalPresentations * bench.presToCloses;
      break;
    }
    case 'presentations_to_closes':
      additionalCloses = metrics.totalPresentations * conversionGap;
      break;
    default:
      additionalCloses = metrics.totalDoors * conversionGap * 0.02;
  }
  
  if (additionalCloses >= 0.5) {
    return `+${additionalCloses.toFixed(1)} FP if conversions matched baseline`;
  }
  
  return null;
};
