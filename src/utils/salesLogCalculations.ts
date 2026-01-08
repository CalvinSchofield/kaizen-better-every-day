/**
 * Calculate FP+ and PRMR from sales_log entries.
 * Used for live data calculation when entries are unfinalized.
 * 
 * Logic:
 * - Skips sales with install_status === 'never_installed'
 * - FP: 1 for 'fp' type, PRMR/85 for 'upgrade' type
 * - PRMR: Sum of all sale PRMR values
 */
export const calculateFromSalesLog = (salesLog: any[]): { fp: number; prmr: number } => {
  if (!salesLog || !Array.isArray(salesLog)) return { fp: 0, prmr: 0 };
  
  let fp = 0;
  let prmr = 0;
  
  for (const sale of salesLog) {
    // Skip sales that were never installed
    if (sale.install_status === 'never_installed') continue;
    
    const salePrmr = Number(sale.prmr) || 0;
    prmr += salePrmr;
    
    if (sale.type === 'fp') {
      fp += 1;
    } else if (sale.type === 'upgrade') {
      // Upgrade FP+ = PRMR / 85
      fp += salePrmr / 85;
    }
  }
  
  return { fp, prmr };
};
