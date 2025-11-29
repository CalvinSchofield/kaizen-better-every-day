import { Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useCompetitors } from "@/hooks/useCompetitors";
import { CompetitorDetailSheet } from "@/components/CompetitorDetailSheet";

export const RookieCompetitorQuickAccess = () => {
  const { competitors } = useCompetitors();
  const [selectedCompetitor, setSelectedCompetitor] = useState<any>(null);

  // Filter for specific common competitors rookies face
  const commonCompetitorNames = ["Ring", "Blink", "ADT", "Alarm.com"];
  const commonCompetitors = competitors.filter(c => 
    commonCompetitorNames.some(name => c.name.toLowerCase().includes(name.toLowerCase()))
  ).slice(0, 4);

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
          <div className="grid grid-cols-2 gap-3">
            {commonCompetitors.map((competitor) => (
              <Button
                key={competitor.id}
                variant="outline"
                className="h-auto flex-col gap-2 p-4"
                onClick={() => setSelectedCompetitor(competitor)}
              >
                {competitor.main_image_url && (
                  <img
                    src={competitor.main_image_url}
                    alt={competitor.name}
                    className="w-12 h-12 object-contain"
                  />
                )}
                <span className="text-xs font-medium">{competitor.name}</span>
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
