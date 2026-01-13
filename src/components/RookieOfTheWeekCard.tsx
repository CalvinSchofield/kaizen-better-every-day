import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, TrendingUp, BookOpen, Timer, Dumbbell, Phone, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { useRookieOfTheWeek, RookieStats } from "@/hooks/useRookieOfTheWeek";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { getInitials } from "@/utils/nameUtils";


const formatTrainingHours = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

interface BreakdownPillProps {
  icon: React.ReactNode;
  value: number;
  previous: number | null;
  label: string;
  isTraining?: boolean;
}

const BreakdownPill = ({ icon, value, previous, label, isTraining }: BreakdownPillProps) => {
  const improvement = previous !== null ? value - previous : value;
  if (improvement <= 0) return null;

  const displayValue = isTraining ? formatTrainingHours(improvement) : `+${improvement}`;

  return (
    <Badge variant="secondary" className="gap-1 px-2 py-1">
      {icon}
      <span className="text-xs font-medium">{displayValue}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </Badge>
  );
};

const RunnerUpItem = ({ rookie, rank }: { rookie: RookieStats; rank: number }) => (
  <div className="flex items-center justify-between py-2">
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-muted-foreground w-5">{rank}</span>
      <Avatar className="h-8 w-8">
        <AvatarFallback className="text-xs bg-secondary">
          {getInitials(rookie.name)}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium">{rookie.name}</span>
    </div>
    <Badge variant="outline" className="text-xs">
      <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
      +{Math.round(rookie.improvement)} pts
    </Badge>
  </div>
);

export const RookieOfTheWeekCard = () => {
  const { data, isLoading } = useRookieOfTheWeek();
  const [showRunnerUps, setShowRunnerUps] = useState(false);
  const [hasShownConfetti, setHasShownConfetti] = useState(false);

  // Confetti when current user is the winner
  useEffect(() => {
    if (data?.isCurrentUserWinner && !hasShownConfetti) {
      setHasShownConfetti(true);
      // Delay slightly for better UX
      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#FFD700', '#FFA500', '#FF6347'],
        });
      }, 500);
    }
  }, [data?.isCurrentUserWinner, hasShownConfetti]);

  if (isLoading) return null;
  if (!data?.hasData || !data.winner) return null;

  const { winner, runnerUps, isCurrentUserWinner } = data;

  return (
    <Card className={cn(
      "mb-6 overflow-hidden transition-all",
      isCurrentUserWinner && "ring-2 ring-yellow-400/50 shadow-lg shadow-yellow-400/20"
    )}>
      {/* Hero Section */}
      <div className={cn(
        "relative bg-gradient-to-br from-yellow-400/20 via-orange-400/10 to-transparent p-4",
        isCurrentUserWinner && "from-yellow-400/30 via-orange-400/20"
      )}>
        <div className="absolute top-2 right-2">
          <Trophy className="h-12 w-12 text-yellow-500/30" />
        </div>
        
        <div className="flex items-center gap-3 relative z-10">
          <div className="relative">
            <Avatar className="h-14 w-14 ring-2 ring-yellow-400/50">
              <AvatarFallback className="bg-gradient-to-br from-yellow-400 to-orange-400 text-white text-lg font-bold">
                {getInitials(winner.name)}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-1">
              <Trophy className="h-3 w-3 text-yellow-900" />
            </div>
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg">{winner.name}</h3>
              {isCurrentUserWinner && (
                <Badge className="bg-yellow-400/20 text-yellow-600 dark:text-yellow-400 gap-1">
                  <Sparkles className="h-3 w-3" />
                  You!
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">Rookie of the Week</p>
          </div>
          
          <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 text-base px-3 py-1">
            <TrendingUp className="h-4 w-4 mr-1" />
            +{Math.round(winner.improvement)} pts
          </Badge>
        </div>
      </div>

      <CardContent className="pt-4 space-y-4">
        {/* Achievement Breakdown */}
        <div className="flex flex-wrap gap-2">
          <BreakdownPill
            icon={<BookOpen className="h-3 w-3" />}
            value={winner.breakdown.books}
            previous={winner.previousBreakdown?.books ?? null}
            label="📚"
          />
          <BreakdownPill
            icon={<Timer className="h-3 w-3" />}
            value={winner.breakdown.training}
            previous={winner.previousBreakdown?.training ?? null}
            label="⏱️"
            isTraining
          />
          <BreakdownPill
            icon={<Dumbbell className="h-3 w-3" />}
            value={winner.breakdown.roleplays}
            previous={winner.previousBreakdown?.roleplays ?? null}
            label="🎭"
          />
          <BreakdownPill
            icon={<Phone className="h-3 w-3" />}
            value={winner.breakdown.mnl}
            previous={winner.previousBreakdown?.mnl ?? null}
            label="📞"
          />
        </div>

        {/* Runner Ups */}
        {runnerUps.length > 0 && (
          <div className="pt-2 border-t">
            <button
              onClick={() => setShowRunnerUps(!showRunnerUps)}
              className="flex items-center justify-between w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Runner-ups</span>
              {showRunnerUps ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            
            {showRunnerUps && (
              <div className="space-y-1">
                {runnerUps.map((rookie, index) => (
                  <RunnerUpItem key={rookie.userId} rookie={rookie} rank={index + 2} />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
