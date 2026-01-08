import { useState } from "react";
import { Lightbulb, ChevronLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FreshDoorPitchGuide } from "@/components/training/FreshDoorPitchGuide";
import { TakeoverPitchGuide } from "@/components/training/TakeoverPitchGuide";
import { UpgradePitchGuide } from "@/components/training/UpgradePitchGuide";
import { InHomePitchGuide } from "@/components/training/InHomePitchGuide";
import { useAppMode } from "@/hooks/useAppMode";

type ActiveGuide = "fresh" | "upgrade" | "takeover" | "presentation" | null;

interface PitchPresentationQuickAccessProps {
  className?: string;
}

export const PitchPresentationQuickAccess = ({ className }: PitchPresentationQuickAccessProps) => {
  const [activeGuide, setActiveGuide] = useState<ActiveGuide>(null);
  const { isKnockingMode } = useAppMode();
  
  // In knocking mode, show reference view for quick lookups
  // Otherwise, show practice mode for learning/memorization
  const initialMode = isKnockingMode ? "reference" : "practice";

  const getGuideTitle = (guide: ActiveGuide) => {
    switch (guide) {
      case "fresh": return "Fresh Door Approach";
      case "upgrade": return "Upgrade Door Approach";
      case "takeover": return "Takeover Door Approach";
      case "presentation": return "In-Home Presentation";
      default: return "";
    }
  };

  const getGuideEmoji = (guide: ActiveGuide) => {
    switch (guide) {
      case "fresh": return "🚪";
      case "upgrade": return "⬆️";
      case "takeover": return "🔄";
      case "presentation": return "🏠";
      default: return "";
    }
  };

  if (activeGuide) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setActiveGuide(null)} className="gap-1 -ml-2">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <span className="text-2xl">{getGuideEmoji(activeGuide)}</span>
            <CardTitle>{getGuideTitle(activeGuide)}</CardTitle>
          </div>
          <CardDescription>
            {isKnockingMode ? "Quick reference while on doors" : "Practice the pitch flow"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeGuide === "fresh" && (
            <FreshDoorPitchGuide initialMode={initialMode} />
          )}
          {activeGuide === "upgrade" && (
            <UpgradePitchGuide initialMode={initialMode} />
          )}
          {activeGuide === "takeover" && (
            <TakeoverPitchGuide initialMode={initialMode} />
          )}
          {activeGuide === "presentation" && (
            <InHomePitchGuide initialMode={initialMode} />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          <CardTitle>Pitch & Presentation</CardTitle>
        </div>
        <CardDescription>Quick access to training resources</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="w-full h-auto py-3 px-2 flex items-center justify-center gap-1.5"
          onClick={() => setActiveGuide("upgrade")}
        >
          <span className="text-xs font-medium">Upgrade</span>
          <span className="text-xs">⬆️</span>
        </Button>
        <Button
          variant="outline"
          className="w-full h-auto py-3 px-2 flex items-center justify-center gap-1.5"
          onClick={() => setActiveGuide("fresh")}
        >
          <span className="text-xs font-medium">Fresh</span>
          <span className="text-xs">🚪</span>
        </Button>
        <Button
          variant="outline"
          className="w-full h-auto py-3 px-2 flex items-center justify-center gap-1.5"
          onClick={() => setActiveGuide("takeover")}
        >
          <span className="text-xs font-medium">Takeover</span>
          <span className="text-xs">🔄</span>
        </Button>
        <Button
          variant="outline"
          className="w-full h-auto py-3 px-2 flex items-center justify-center gap-1.5"
          onClick={() => setActiveGuide("presentation")}
        >
          <span className="text-xs font-medium">Presentation</span>
          <span className="text-xs">🏠</span>
        </Button>
      </CardContent>
    </Card>
  );
};
