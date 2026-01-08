import { PitchGuide } from "./PitchGuide";
import { TAKEOVER_PITCH_SECTIONS } from "./pitchData";

interface TakeoverPitchGuideProps {
  onBack?: () => void;
  initialMode?: "practice" | "reference";
}

export const TakeoverPitchGuide = ({ onBack, initialMode }: TakeoverPitchGuideProps) => {
  return (
    <PitchGuide 
      sections={TAKEOVER_PITCH_SECTIONS} 
      pageTitle="Takeover Pitch" 
      audioSrc="/audio/takeover-pitch.m4a"
      onBack={onBack}
      initialMode={initialMode}
    />
  );
};
