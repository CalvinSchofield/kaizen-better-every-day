import { PitchGuide } from "./PitchGuide";
import { FRESH_PITCH_SECTIONS } from "./pitchData";

interface FreshDoorPitchGuideProps {
  onBack?: () => void;
}

export const FreshDoorPitchGuide = ({ onBack }: FreshDoorPitchGuideProps) => {
  return (
    <PitchGuide 
      sections={FRESH_PITCH_SECTIONS} 
      pageTitle="Fresh Pitch" 
      onBack={onBack} 
    />
  );
};
