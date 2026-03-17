/**
 * Calculate FP+ and PRMR from sales_log entries.
 * Used for live data calculation when entries are unfinalized.
 * 
 * Logic:
 * - Skips sales with install_status === 'never_installed'
 * - Pending (scheduled out) sales are INCLUDED in totals to reward activity
 *   but tracked separately for visual distinction
 * - FP: 1 for 'fp' type, PRMR/85 for 'upgrade' type
 * - PRMR: Sum of all sale PRMR values
 */
export const calculateFromSalesLog = (salesLog: any[]): { 
  fp: number; 
  prmr: number; 
  upgradePrmr: number;
  pendingFp: number;
  pendingPrmr: number;
} => {
  if (!salesLog || !Array.isArray(salesLog)) return { fp: 0, prmr: 0, upgradePrmr: 0, pendingFp: 0, pendingPrmr: 0 };
  
  let fp = 0;
  let prmr = 0;
  let upgradePrmr = 0;
  let pendingFp = 0;
  let pendingPrmr = 0;
  
  for (const sale of salesLog) {
    // Skip sales that were never installed
    if (sale.install_status === 'never_installed') continue;
    
    const salePrmr = Number(sale.prmr) || 0;
    const isPending = sale.install_status === 'pending';
    
    prmr += salePrmr;
    if (isPending) pendingPrmr += salePrmr;
    
    if (sale.type === 'fp') {
      fp += 1;
      if (isPending) pendingFp += 1;
    } else if (sale.type === 'upgrade') {
      // Upgrade FP+ = PRMR / 85
      const upgFp = salePrmr / 85;
      fp += upgFp;
      upgradePrmr += salePrmr;
      if (isPending) pendingFp += upgFp;
    }
  }
  
  return { fp, prmr, upgradePrmr, pendingFp, pendingPrmr };
};
