import { useState } from "react";
import { Lightbulb, ExternalLink, ChevronLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink as ExternalLinkComponent } from "@/components/ExternalLink";
import { FreshDoorPitchGuide } from "@/components/training/FreshDoorPitchGuide";

type ActiveGuide = "fresh" | null;

export const PitchPresentationQuickAccess = () => {
  const [activeGuide, setActiveGuide] = useState<ActiveGuide>(null);

  if (activeGuide === "fresh") {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setActiveGuide(null)} className="gap-1 -ml-2">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <span className="text-2xl">🚪</span>
            <CardTitle>Fresh Door Approach</CardTitle>
          </div>
          <CardDescription>Master the 6-step pitch flow</CardDescription>
        </CardHeader>
        <CardContent>
          <FreshDoorPitchGuide />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          <CardTitle>Pitch & Presentation</CardTitle>
        </div>
        <CardDescription>Quick access to training resources</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        <ExternalLinkComponent href="https://calvinschofield.notion.site/Upgrade-Door-Approach-18c070fe3bc28077a280ee0783b4881b">
          <Button
            variant="outline"
            className="w-full h-auto py-3 px-2 flex items-center justify-center gap-1.5"
          >
            <span className="text-xs font-medium">Upgrade</span>
            <ExternalLink className="h-3 w-3" />
          </Button>
        </ExternalLinkComponent>
        <Button
          variant="outline"
          className="w-full h-auto py-3 px-2 flex items-center justify-center gap-1.5"
          onClick={() => setActiveGuide("fresh")}
        >
          <span className="text-xs font-medium">Fresh</span>
          <span className="text-xs">🚪</span>
        </Button>
        <ExternalLinkComponent href="https://calvinschofield.notion.site/Takeover-Door-Approach-18c070fe3bc2800bad33c0818f0f0489">
          <Button
            variant="outline"
            className="w-full h-auto py-3 px-2 flex items-center justify-center gap-1.5"
          >
            <span className="text-xs font-medium">Takeover</span>
            <ExternalLink className="h-3 w-3" />
          </Button>
        </ExternalLinkComponent>
        <ExternalLinkComponent href="https://calvinschofield.notion.site/In-Home-Presentation-18c070fe3bc280648438c57ea4c5d0b7">
          <Button
            variant="outline"
            className="w-full h-auto py-3 px-2 flex items-center justify-center gap-1.5"
          >
            <span className="text-xs font-medium">Presentation</span>
            <ExternalLink className="h-3 w-3" />
          </Button>
        </ExternalLinkComponent>
      </CardContent>
    </Card>
  );
};
