import { Shield, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { COMPETITORS, ROOKIE_COMPETITORS } from "@/data/competitorData";

export const RookieCompetitorQuickAccess = () => {
  const navigate = useNavigate();

  // Get the rookie-friendly competitors from static data
  const commonCompetitors = ROOKIE_COMPETITORS
    .map(id => COMPETITORS.find(c => c.id === id))
    .filter(Boolean)
    .slice(0, 8);

  return (
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
          {commonCompetitors.map((competitor) => competitor && (
            <Button
              key={competitor.id}
              variant="outline"
              className="h-auto flex-col gap-1.5 p-3"
              onClick={() => navigate('/tools/competitors')}
            >
              <img
                src={competitor.image}
                alt={competitor.name}
                className="w-10 h-10 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
              />
              <span className="text-xs font-medium text-center leading-tight">{competitor.name}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
