import { Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useCompetitors } from "@/hooks/useCompetitors";
import { CompetitorDetailSheet } from "@/components/CompetitorDetailSheet";
import { Loader2 } from "lucide-react";

export const CompetitorQuickAccess = () => {
  const { competitors, loading } = useCompetitors();
  const [selectedCompetitor, setSelectedCompetitor] = useState<any>(null);

  // Get top 6 most common competitors
  const topCompetitors = competitors
    .filter(c => c.category !== null)
    .slice(0, 6);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <CardTitle>Quick Competitor Access</CardTitle>
          </div>
          <CardDescription>Tap to view competitor info</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {topCompetitors.map((competitor) => (
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
