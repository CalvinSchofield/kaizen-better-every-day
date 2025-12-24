import { ChevronLeft, Play, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PitchGuide } from "./PitchGuide";
import { inHomeSections } from "./inHomePitchData";

interface InHomePitchGuideProps {
  onBack?: () => void;
}

const VIDEO_URL = "https://dthvivinttraining.conveyour.com/ui/portal/course/682b650d0866a26ac3318a1f/lesson/682b665eae62a2345d538e1a";

export const InHomePitchGuide = ({ onBack }: InHomePitchGuideProps) => {
  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      {/* Back button */}
      {onBack && (
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-2">
          <ChevronLeft className="h-4 w-4" />
          Back to Training
        </Button>
      )}

      {/* Video Hero Banner */}
      <Card className="overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
        <a
          href={VIDEO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Play className="w-7 h-7 text-primary ml-1" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg">Watch Full Sales Sample</h3>
                <p className="text-sm text-muted-foreground">See the complete in-home presentation</p>
              </div>
              <ExternalLink className="w-5 h-5 text-primary flex-shrink-0" />
            </div>
          </CardContent>
        </a>
      </Card>

      {/* Main Pitch Guide Component */}
      <PitchGuide
        sections={inHomeSections}
        pageTitle="In-Home Presentation"
        audioSrc="/audio/in-home-presentation.m4a"
      />
    </div>
  );
};
