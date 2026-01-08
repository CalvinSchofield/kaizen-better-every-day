import { PitchGuide } from "./PitchGuide";
import { FRESH_PITCH_SECTIONS } from "./pitchData";

interface FreshDoorPitchGuideProps {
  onBack?: () => void;
  initialMode?: "practice" | "reference";
}

export const FreshDoorPitchGuide = ({ onBack, initialMode }: FreshDoorPitchGuideProps) => {
  return (
    <PitchGuide 
      sections={FRESH_PITCH_SECTIONS} 
      pageTitle="Fresh Pitch" 
      audioSrc="/audio/fresh-pitch.m4a"
      onBack={onBack}
      initialMode={initialMode}
    />
  );
};
