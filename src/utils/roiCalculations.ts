import { getTier } from './payscaleCalculator';

/**
 * Standard upfront multiplier for all reps - PRMR × 4 = Upfront Pay
 */
export const UPFRONT_MULTIPLIER = 4;

/**
 * Calculate upfront pay from PRMR
 * Upfront pay is always PRMR × 4 for all reps
 */
export function calculateUpfrontPay(prmr: number): number {
  return prmr * UPFRONT_MULTIPLIER;
}

/**
 * Calculate total pay based on PRMR and pay tier
 * @param prmr - Total PRMR
 * @param payRate - Pay rate per PRMR (from payscale tier)
 */
export function calculateTotalPay(prmr: number, payRate: number): number {
  return prmr * payRate;
}

/**
 * Calculate upfront ROI
 * Formula: (PRMR × 4) / totalSpent
 * @returns ROI multiplier (e.g., 2.5 means 2.5x return)
 */
export function calculateUpfrontRoi(prmr: number, totalSpent: number): number {
  if (totalSpent <= 0) return 0;
  const upfrontPay = calculateUpfrontPay(prmr);
  return upfrontPay / totalSpent;
}

/**
 * Calculate total pay ROI based on tier rate
 * Formula: (PRMR × payRate) / totalSpent
 * @returns ROI multiplier
 */
export function calculateTotalRoi(prmr: number, totalSpent: number, payRate: number): number {
  if (totalSpent <= 0) return 0;
  const totalPay = calculateTotalPay(prmr, payRate);
  return totalPay / totalSpent;
}

/**
 * Calculate net pay (gross pay - spending)
 */
export function calculateNetPay(grossPay: number, totalSpent: number): number {
  return grossPay - totalSpent;
}

/**
 * Get pay rate for a given FP+ level
 * @param fpPlus - Cumulative FP+ count
 * @param customPayLevel - Optional custom pay level override
 */
export function getPayRate(fpPlus: number, customPayLevel?: number | null): number {
  const targetFpPlus = customPayLevel ?? fpPlus;
  return getTier(targetFpPlus).rate;
}

/**
 * Complete ROI calculations for a given PRMR and spending amount
 */
export interface RoiMetrics {
  upfrontPay: number;
  totalPay: number;
  netUpfront: number;
  netTotal: number;
  upfrontRoi: number;
  totalRoi: number;
  payRate: number;
}

export function calculateRoiMetrics(
  prmr: number,
  totalSpent: number,
  fpPlus: number,
  customPayLevel?: number | null
): RoiMetrics {
  const payRate = getPayRate(fpPlus, customPayLevel);
  
  const upfrontPay = calculateUpfrontPay(prmr);
  const totalPay = calculateTotalPay(prmr, payRate);
  
  return {
    upfrontPay,
    totalPay,
    netUpfront: calculateNetPay(upfrontPay, totalSpent),
    netTotal: calculateNetPay(totalPay, totalSpent),
    upfrontRoi: calculateUpfrontRoi(prmr, totalSpent),
    totalRoi: calculateTotalRoi(prmr, totalSpent, payRate),
    payRate,
  };
}

/**
 * Format ROI value for display (e.g., "2.5x")
 */
export function formatRoi(roi: number, decimals: number = 1): string {
  return `${roi.toFixed(decimals)}x`;
}

/**
 * Determine if ROI is positive (>= 1x means you made more than you spent)
 */
export function isPositiveRoi(roi: number): boolean {
  return roi >= 1;
}
