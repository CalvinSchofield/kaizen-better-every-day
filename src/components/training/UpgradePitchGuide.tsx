import { PitchGuide } from "./PitchGuide";
import { UPGRADE_PITCH_SECTIONS } from "./pitchData";

interface UpgradePitchGuideProps {
  onBack?: () => void;
}

export const UpgradePitchGuide = ({ onBack }: UpgradePitchGuideProps) => {
  return (
    <PitchGuide 
      sections={UPGRADE_PITCH_SECTIONS} 
      pageTitle="Upgrade Pitch" 
      onBack={onBack} 
    />
  );
};
