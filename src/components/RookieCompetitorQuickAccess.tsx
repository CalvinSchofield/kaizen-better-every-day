import { Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useCompetitors } from "@/hooks/useCompetitors";
import { CompetitorDetailSheet } from "@/components/CompetitorDetailSheet";

export const RookieCompetitorQuickAccess = () => {
  const { competitors } = useCompetitors();
  const [selectedCompetitor, setSelectedCompetitor] = useState<any>(null);

  // Filter for the 8 specific competitors rookies face most
  const targetCompetitors = [
    "Ring Doorbell",
    "Ring Outdoor Camera", 
    "ADT Alarm Service",
    "Alarm.com Doorbell",
    "Alarm.com Outdoor Camera",
    "Blink Camera",
    "Google Camera",
    "Arlo Camera"
  ];
  
  const commonCompetitors = competitors.filter(c => 
    targetCompetitors.some(target => 
      c.name.toLowerCase().includes(target.toLowerCase()) ||
      target.toLowerCase().includes(c.name.toLowerCase())
    )
  ).slice(0, 8);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Common Competitors</CardTitle>
          </div>
          <CardDescription>Quick access to the ones you'll see most</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {commonCompetitors.map((competitor) => (
              <Button
                key={competitor.id}
                variant="outline"
                className="h-auto flex-col gap-1.5 p-3"
                onClick={() => setSelectedCompetitor(competitor)}
              >
                {competitor.main_image_url && (
                  <img
                    src={competitor.main_image_url}
                    alt={competitor.name}
                    className="w-10 h-10 object-contain"
                  />
                )}
                <span className="text-xs font-medium text-center leading-tight">{competitor.name}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <CompetitorDetailSheet
        competitor={selectedCompetitor}
        open={!!selectedCompetitor}
        onOpenChange={(open) => !open && setSelectedCompetitor(null)}
      />
    </>
  );
};
