import { Lightbulb, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink as ExternalLinkComponent } from "@/components/ExternalLink";

export const PitchPresentationQuickAccess = () => {
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
            className="w-full h-auto py-3 px-2 flex-col gap-1"
          >
            <span className="text-xs font-medium">Upgrade</span>
          </Button>
        </ExternalLinkComponent>
        <ExternalLinkComponent href="https://calvinschofield.notion.site/Fresh-Door-Approach-18c070fe3bc2803fbffdd0642363096c">
          <Button
            variant="outline"
            className="w-full h-auto py-3 px-2 flex-col gap-1"
          >
            <span className="text-xs font-medium">Fresh</span>
          </Button>
        </ExternalLinkComponent>
        <ExternalLinkComponent href="https://calvinschofield.notion.site/Takeover-Door-Approach-18c070fe3bc2800bad33c0818f0f0489">
          <Button
            variant="outline"
            className="w-full h-auto py-3 px-2 flex-col gap-1"
          >
            <span className="text-xs font-medium">Takeover</span>
          </Button>
        </ExternalLinkComponent>
        <ExternalLinkComponent href="https://calvinschofield.notion.site/In-Home-Presentation-18c070fe3bc280648438c57ea4c5d0b7">
          <Button
            variant="outline"
            className="w-full h-auto py-3 px-2 flex-col gap-1"
          >
            <span className="text-xs font-medium">Presentation</span>
          </Button>
        </ExternalLinkComponent>
      </CardContent>
    </Card>
  );
};
