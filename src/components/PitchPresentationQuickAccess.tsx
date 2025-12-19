import { Lightbulb } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const PitchPresentationQuickAccess = () => {
  return (
    <Card className="opacity-75">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-muted-foreground">Pitch & Presentation</CardTitle>
          <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
        </div>
        <CardDescription>Quick access to training resources</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="w-full h-auto py-3 px-2 flex items-center justify-center gap-1.5 opacity-50 cursor-not-allowed"
          disabled
        >
          <span className="text-xs font-medium">Upgrade</span>
        </Button>
        <Button
          variant="outline"
          className="w-full h-auto py-3 px-2 flex items-center justify-center gap-1.5 opacity-50 cursor-not-allowed"
          disabled
        >
          <span className="text-xs font-medium">Fresh</span>
        </Button>
        <Button
          variant="outline"
          className="w-full h-auto py-3 px-2 flex items-center justify-center gap-1.5 opacity-50 cursor-not-allowed"
          disabled
        >
          <span className="text-xs font-medium">Takeover</span>
        </Button>
        <Button
          variant="outline"
          className="w-full h-auto py-3 px-2 flex items-center justify-center gap-1.5 opacity-50 cursor-not-allowed"
          disabled
        >
          <span className="text-xs font-medium">Presentation</span>
        </Button>
      </CardContent>
    </Card>
  );
};