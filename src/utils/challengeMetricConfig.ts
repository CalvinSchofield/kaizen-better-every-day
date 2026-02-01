import { ChallengeMetric } from "@/hooks/useChallenges";

interface MetricConfig {
  label: string;
  icon: string;
  format: (v: number) => string;
  unit: string;
}

export const metricConfig: Record<ChallengeMetric, MetricConfig> = {
  fp_plus: { 
    label: 'FP+', 
    icon: '🎯', 
    format: (v) => v.toFixed(1),
    unit: 'FP+'
  },
  prmr: { 
    label: 'PRMR', 
    icon: '💰', 
    format: (v) => `$${v.toLocaleString()}`,
    unit: ''
  },
  transitions: { 
    label: 'Transitions', 
    icon: '🚪', 
    format: (v) => v.toString(),
    unit: 'transitions'
  },
  doors_knocked: { 
    label: 'Doors', 
    icon: '🚪', 
    format: (v) => v.toString(),
    unit: 'doors'
  },
};

export const getMarginText = (
  leaderName: string,
  leaderValue: number,
  opponentValue: number,
  metric: ChallengeMetric
): string => {
  const config = metricConfig[metric];
  const margin = Math.abs(leaderValue - opponentValue);
  
  if (margin === 0) return "Tied!";
  
  // Use short format for margin
  const marginFormatted = metric === 'prmr' 
    ? `$${margin.toLocaleString()}`
    : metric === 'fp_plus'
    ? margin.toFixed(1)
    : margin.toString();
  
  return `${leaderName} leads by ${marginFormatted}`;
};
