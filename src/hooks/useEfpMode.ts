import { useRepData } from "./useRepData";

export const useEfpMode = () => {
  const { repData } = useRepData();
  
  const isVet = repData?.year === "Vet";
  const efpModeEnabled = isVet && (repData?.efp_mode_enabled || false);
  
  // EFP = Total PRMR / 85
  // Total PRMR = prmr (FP sales) + upgrade_prmr (upgrade sales)
  const calculateEfp = (prmr: number, upgradePrmr?: number): number => {
    const totalPrmr = prmr + (upgradePrmr || 0);
    return Number((totalPrmr / 85).toFixed(2));
  };
  
  return {
    efpModeEnabled,
    calculateEfp,
    isVet,
  };
};
