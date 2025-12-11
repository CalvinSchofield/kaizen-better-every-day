import { PitchGuide } from "./PitchGuide";
import { TAKEOVER_PITCH_SECTIONS } from "./pitchData";

interface TakeoverPitchGuideProps {
  onBack?: () => void;
}

export const TakeoverPitchGuide = ({ onBack }: TakeoverPitchGuideProps) => {
  return (
    <PitchGuide 
      sections={TAKEOVER_PITCH_SECTIONS} 
      pageTitle="Takeover Pitch" 
      onBack={onBack} 
    />
  );
};
