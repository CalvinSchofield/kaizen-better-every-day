// Shared EFP helper
// EFP = Total PRMR / 85
export const calculateEfp = (prmr: number): number => {
  return Number((prmr / 85).toFixed(2));
};
