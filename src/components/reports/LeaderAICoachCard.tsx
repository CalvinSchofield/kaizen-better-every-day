import { Sparkles, TrendingUp, Target, BookOpen, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface LeaderAICoachCardProps {
  coaching: {
    teamStrength: string;
    bottleneck: string;
    trainingRecommendation: string;
    checkInWith: Array<{
      name: string;
      reason: string;
    }>;
  } | null;
  isLoading: boolean;
  timeframe: string;
  scopeLabel: string;
}

export const LeaderAICoachCard = ({ coaching, isLoading, timeframe, scopeLabel }: LeaderAICoachCardProps) => {
  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-medium text-primary">AI Coach</span>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="h-4 w-28 bg-muted rounded animate-pulse" />
              <div className="h-4 w-full bg-muted rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              <div className="h-4 w-full bg-muted rounded animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
              <div className="h-4 w-full bg-muted rounded animate-pulse" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!coaching) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-medium text-primary">AI Coach</span>
          </div>
          <span className="text-xs text-muted-foreground">{scopeLabel} · {timeframe}</span>
        </div>
        
        <div className="space-y-4">
          {/* Team Strength */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-sm font-semibold text-foreground">Team Strength</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed ml-5">
              {coaching.teamStrength}
            </p>
          </div>

          {/* Bottleneck */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Target className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-foreground">Training Focus</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed ml-5">
              {coaching.bottleneck}
            </p>
          </div>

          {/* Training Recommendation */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Action Item</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed ml-5">
              {coaching.trainingRecommendation}
            </p>
          </div>

          {/* Check In With */}
          {coaching.checkInWith && coaching.checkInWith.length > 0 && (
            <div className="pt-2 border-t border-border/50">
              <div className="flex items-center gap-1.5 mb-2">
                <Users className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-semibold text-foreground">Check In With</span>
              </div>
              <ul className="space-y-1.5 ml-5">
                {coaching.checkInWith.map((rep, index) => (
                  <li key={index} className="text-sm text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground">{rep.name}</span>
                    <span className="text-muted-foreground"> — {rep.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
