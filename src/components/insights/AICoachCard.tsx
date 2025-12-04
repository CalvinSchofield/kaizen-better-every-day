import { Sparkles, Star, Target, HelpCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface AICoachCardProps {
  coaching: {
    strengths: string[];
    improvement: string;
    homework: string;
  } | null;
  isLoading: boolean;
  timeframe: string;
}

export const AICoachCard = ({ coaching, isLoading, timeframe }: AICoachCardProps) => {
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
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              <div className="h-4 w-full bg-muted rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-20 bg-muted rounded animate-pulse" />
              <div className="h-4 w-full bg-muted rounded animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-28 bg-muted rounded animate-pulse" />
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
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-medium text-primary">AI Coach · {timeframe}</span>
        </div>
        
        <div className="space-y-4">
          {/* Strengths */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Star className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-semibold text-foreground">What You Did Well</span>
            </div>
            <ul className="space-y-1.5 ml-5">
              {coaching.strengths.map((strength, index) => (
                <li key={index} className="text-sm text-muted-foreground leading-relaxed list-disc">
                  {strength}
                </li>
              ))}
            </ul>
          </div>

          {/* Improvement */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Focus On</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed ml-5">
              {coaching.improvement}
            </p>
          </div>

          {/* Homework */}
          <div className="pt-2 border-t border-border/50">
            <div className="flex items-center gap-1.5 mb-2">
              <HelpCircle className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-semibold text-foreground">Homework</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed ml-5 italic">
              {coaching.homework}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
