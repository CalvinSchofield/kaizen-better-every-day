/**
 * Constraint Analysis System
 * 
 * Determines the PRIMARY constraint limiting team performance:
 * 1. Effort (doors knocked, start/end times)
 * 2. Skill (funnel conversion rates)
 * 3. Consistency (work patterns)
 */

export interface FunnelStage {
  name: string;
  fromLabel: string;
  toLabel: string;
  rate: number;      // Actual conversion rate
  benchmark: number; // Expected conversion rate
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
  // Effort metrics
  avgDoorsPerHour: number;
  doorsPerHourBenchmark: number;
  lateStartCount: number;
  earlyEndCount: number;
  totalReps: number;
  
  // Funnel metrics
  totalDoors: number;
  totalDMs: number;
  totalPitches: number;
  totalTransitions: number;
  totalPresentations: number;
  totalCloses: number;
  totalFP: number;
  
  // Consistency metrics
  repsWithActivity: number;
  expectedReps?: number;
}

// Funnel benchmarks (industry standards for door-to-door)
const FUNNEL_BENCHMARKS = {
  doorsToDecisionMakers: 0.35,    // 35% of doors have DMs
  decisionMakersToPitches: 0.60,  // 60% of DMs hear a pitch
  pitchesToTransitions: 0.50,     // 50% of pitches get transitions
  transitionsToPresentations: 0.65, // 65% of transitions become presentations
  presentationsToCloses: 0.40,    // 40% of presentations close
};

const EFFORT_BENCHMARK_DOORS_PER_HOUR = 13; // Average benchmark

/**
 * Analyze funnel stages and find the biggest bottleneck
 */
export const analyzeFunnelBottleneck = (metrics: TeamMetrics): FunnelStage | null => {
  const stages: FunnelStage[] = [];
  
  // Doors → DMs
  if (metrics.totalDoors > 0) {
    const rate = metrics.totalDMs / metrics.totalDoors;
    stages.push({
      name: 'doors_to_dms',
      fromLabel: 'Doors',
      toLabel: 'Decision Makers',
      rate,
      benchmark: FUNNEL_BENCHMARKS.doorsToDecisionMakers,
    });
  }
  
  // DMs → Pitches
  if (metrics.totalDMs > 0) {
    const rate = metrics.totalPitches / metrics.totalDMs;
    stages.push({
      name: 'dms_to_pitches',
      fromLabel: 'Decision Makers',
      toLabel: 'Pitches',
      rate,
      benchmark: FUNNEL_BENCHMARKS.decisionMakersToPitches,
    });
  }
  
  // Pitches → Transitions
  if (metrics.totalPitches > 0) {
    const rate = metrics.totalTransitions / metrics.totalPitches;
    stages.push({
      name: 'pitches_to_transitions',
      fromLabel: 'Pitches',
      toLabel: 'Transitions',
      rate,
      benchmark: FUNNEL_BENCHMARKS.pitchesToTransitions,
    });
  }
  
  // Transitions → Presentations
  if (metrics.totalTransitions > 0) {
    const rate = metrics.totalPresentations / metrics.totalTransitions;
    stages.push({
      name: 'transitions_to_presentations',
      fromLabel: 'Transitions',
      toLabel: 'Presentations',
      rate,
      benchmark: FUNNEL_BENCHMARKS.transitionsToPresentations,
    });
  }
  
  // Presentations → Closes
  if (metrics.totalPresentations > 0) {
    const rate = metrics.totalCloses / metrics.totalPresentations;
    stages.push({
      name: 'presentations_to_closes',
      fromLabel: 'Presentations',
      toLabel: 'Closes',
      rate,
      benchmark: FUNNEL_BENCHMARKS.presentationsToCloses,
    });
  }
  
  // Find the stage with worst performance relative to benchmark
  let worstStage: FunnelStage | null = null;
  let worstGap = 0;
  
  for (const stage of stages) {
    const gap = stage.benchmark - stage.rate;
    if (gap > worstGap) {
      worstGap = gap;
      worstStage = stage;
    }
  }
  
  // Only return if the gap is significant (>15% below benchmark)
  if (worstStage && worstGap > 0.15) {
    return worstStage;
  }
  
  return null;
};

/**
 * Detect the primary constraint limiting team performance
 */
export const detectPrimaryConstraint = (metrics: TeamMetrics): ConstraintResult => {
  const effortBenchmark = metrics.doorsPerHourBenchmark || EFFORT_BENCHMARK_DOORS_PER_HOUR;
  
  // 1. Check effort first (doors per hour)
  if (metrics.avgDoorsPerHour < effortBenchmark * 0.75) {
    const percentBelow = ((effortBenchmark - metrics.avgDoorsPerHour) / effortBenchmark * 100).toFixed(0);
    return {
      type: 'effort',
      severity: 'critical',
      message: 'Effort is the constraint',
      details: `Team averaging ${metrics.avgDoorsPerHour.toFixed(1)} doors/hr (${percentBelow}% below ${effortBenchmark} benchmark)`,
      actionLabel: 'Hold Accountable',
    };
  }
  
  if (metrics.avgDoorsPerHour < effortBenchmark * 0.90) {
    return {
      type: 'effort',
      severity: 'warning',
      message: 'Effort is slightly below standard',
      details: `Team averaging ${metrics.avgDoorsPerHour.toFixed(1)} doors/hr (goal: ${effortBenchmark})`,
      actionLabel: 'Coach Effort',
    };
  }
  
  // 2. Check skill bottlenecks
  const bottleneck = analyzeFunnelBottleneck(metrics);
  if (bottleneck) {
    const actualPercent = (bottleneck.rate * 100).toFixed(0);
    const benchmarkPercent = (bottleneck.benchmark * 100).toFixed(0);
    
    const severity = bottleneck.rate < bottleneck.benchmark * 0.6 ? 'critical' : 'warning';
    
    return {
      type: 'skill',
      severity,
      message: `Skill gap: ${bottleneck.fromLabel} → ${bottleneck.toLabel}`,
      details: `${actualPercent}% conversion (benchmark: ${benchmarkPercent}%)`,
      actionLabel: 'Train',
      skillBottleneck: bottleneck,
    };
  }
  
  // 3. Check consistency (late starts / early ends)
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
 * Generate leader action recommendations based on analysis
 */
export interface LeaderAction {
  type: 'coach' | 'train' | 'praise' | 'accountable';
  label: string;
  repNames?: string[];
  count?: number;
  priority: number; // 1 = highest
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
  
  // Find reps needing accountability (low effort)
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
  
  // Find reps to coach (standard effort but could improve)
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
  
  // Training recommendation based on skill bottleneck
  if (constraint.type === 'skill' && constraint.skillBottleneck) {
    actions.push({
      type: 'train',
      label: `Train: ${constraint.skillBottleneck.fromLabel} → ${constraint.skillBottleneck.toLabel}`,
      priority: constraint.severity === 'critical' ? 1 : 3,
    });
  }
  
  // Find top performers to praise
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
  
  // Sort by priority
  return actions.sort((a, b) => a.priority - b.priority);
};

/**
 * Calculate impact if underperforming reps matched median
 */
export const calculateImpactPotential = (
  metrics: TeamMetrics,
  bottleneck: FunnelStage | null
): string | null => {
  if (!bottleneck) return null;
  
  // Calculate additional closes if conversion matched benchmark
  const conversionGap = bottleneck.benchmark - bottleneck.rate;
  if (conversionGap <= 0) return null;
  
  // Estimate additional outcomes based on funnel stage
  let additionalCloses = 0;
  
  switch (bottleneck.name) {
    case 'pitches_to_transitions':
      // More transitions → more presentations → more closes
      const additionalTransitions = metrics.totalPitches * conversionGap;
      additionalCloses = additionalTransitions * FUNNEL_BENCHMARKS.transitionsToPresentations * FUNNEL_BENCHMARKS.presentationsToCloses;
      break;
    case 'transitions_to_presentations':
      const additionalPresentations = metrics.totalTransitions * conversionGap;
      additionalCloses = additionalPresentations * FUNNEL_BENCHMARKS.presentationsToCloses;
      break;
    case 'presentations_to_closes':
      additionalCloses = metrics.totalPresentations * conversionGap;
      break;
    default:
      // For earlier stages, calculate cascading impact
      additionalCloses = metrics.totalDoors * conversionGap * 0.02; // Rough estimate
  }
  
  if (additionalCloses >= 0.5) {
    return `+${additionalCloses.toFixed(1)} FP/week if bottom half matched median`;
  }
  
  return null;
};
