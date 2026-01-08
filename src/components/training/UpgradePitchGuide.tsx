import { PitchGuide } from "./PitchGuide";
import { UPGRADE_PITCH_SECTIONS } from "./pitchData";

interface UpgradePitchGuideProps {
  onBack?: () => void;
  initialMode?: "practice" | "reference";
}

export const UpgradePitchGuide = ({ onBack, initialMode }: UpgradePitchGuideProps) => {
  return (
    <PitchGuide 
      sections={UPGRADE_PITCH_SECTIONS} 
      pageTitle="Upgrade Pitch" 
      audioSrc="/audio/upgrade-pitch.m4a"
      onBack={onBack}
      initialMode={initialMode}
    />
  );
};
