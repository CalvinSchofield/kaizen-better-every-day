import { useRepData } from "./useRepData";

export const useEfpMode = () => {
  const { repData } = useRepData();
  
  const isVet = repData?.year === "Vet";
  const efpModeEnabled = isVet && (repData?.efp_mode_enabled || false);
  
  const calculateEfp = (prmr: number): number => {
    return Number((prmr / 85).toFixed(2));
  };
  
  return {
    efpModeEnabled,
    calculateEfp,
    isVet,
  };
};
