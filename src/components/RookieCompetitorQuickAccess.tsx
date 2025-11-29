import { Shield, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useCompetitors } from "@/hooks/useCompetitors";
import { CompetitorDetailSheet } from "@/components/CompetitorDetailSheet";
import { useNavigate } from "react-router-dom";

export const RookieCompetitorQuickAccess = () => {
  const { competitors } = useCompetitors();
  const [selectedCompetitor, setSelectedCompetitor] = useState<any>(null);
  const navigate = useNavigate();

  // Filter for the 8 specific competitors rookies face most
  const targetCompetitors = [
    { search: "alarm.com doorbell", prefer: "newer" },
    { search: "alarm.com outdoor", prefer: "" },
    { search: "ring doorbell", prefer: "battery" },
    { search: "ring outdoor", prefer: "" },
    { search: "adt alarm", prefer: "" },
    { search: "google", prefer: "camera" },
    { search: "ring spotlight", prefer: "" },
    { search: "blink", prefer: "" }
  ];
  
  const commonCompetitors = targetCompetitors.map(target => {
    const matches = competitors.filter(c => 
      c.name.toLowerCase().includes(target.search.toLowerCase())
    );
    
    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0];
    
    // If multiple matches, prefer one with the preferred term
    const preferred = matches.find(m => 
      target.prefer && m.name.toLowerCase().includes(target.prefer.toLowerCase())
    );
    
    return preferred || matches[0];
  }).filter(Boolean).slice(0, 8);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle>Common Competitors</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/tools/competitors')}
              className="text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              View all
              <ChevronRight className="h-3 w-3" />
            </Button>
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
