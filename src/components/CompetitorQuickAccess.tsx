import { Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { COMPETITORS } from "@/data/competitorData";

export const CompetitorQuickAccess = () => {
  const navigate = useNavigate();

  // Get top 6 competitors from static data
  const topCompetitors = COMPETITORS.slice(0, 6);

  return (
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
              onClick={() => navigate('/tools/competitors')}
            >
              <img
                src={competitor.image}
                alt={competitor.name}
                className="w-12 h-12 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
              />
              <span className="text-xs font-medium">{competitor.name}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
