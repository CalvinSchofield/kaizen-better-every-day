import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ChallengeScoreSliderProps {
  /** For 1v1: My score */
  myValue?: number;
  /** For 1v1: Opponent's score */
  theirValue?: number;
  /** For team battles: Red team (team A) total */
  redTotal?: number;
  /** For team battles: Blue team (team B) total */
  blueTotal?: number;
  /** Is this a team/group challenge? */
  isTeamBattle?: boolean;
  /** Height variant - compact for lists, normal for detail views */
  variant?: 'compact' | 'normal';
  /** Show labels below the slider */
  showLabels?: boolean;
  /** Labels for 1v1 */
  myLabel?: string;
  theirLabel?: string;
}

export const ChallengeScoreSlider = ({
  myValue = 0,
  theirValue = 0,
  redTotal = 0,
  blueTotal = 0,
  isTeamBattle = false,
  variant = 'compact',
  showLabels = false,
  myLabel = 'You',
  theirLabel,
}: ChallengeScoreSliderProps) => {
  const heightClass = variant === 'compact' ? 'h-2' : 'h-3';
  
  if (isTeamBattle) {
    const total = redTotal + blueTotal;
    const redPercent = total > 0 ? (redTotal / total) * 100 : 50;
    
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-red-600 w-8 text-right">
            {Math.round(redTotal)}
          </span>
          <div className={cn("flex-1 rounded-full bg-blue-500 overflow-hidden relative", heightClass)}>
            <motion.div 
              className="h-full bg-red-500"
              initial={false}
              animate={{ width: `${redPercent}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
            {/* Center indicator */}
            <motion.div 
              className="absolute top-1/2 -translate-y-1/2 w-1 h-full bg-white/80 rounded-full shadow-sm"
              initial={false}
              animate={{ left: `calc(${redPercent}% - 2px)` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>
          <span className="text-xs font-semibold text-blue-600 w-8">
            {Math.round(blueTotal)}
          </span>
        </div>
        {showLabels && (
          <div className="flex justify-between text-[10px] text-muted-foreground px-10">
            <span className="text-red-600">🔴 Red</span>
            <span className="text-blue-600">🔵 Blue</span>
          </div>
        )}
      </div>
    );
  }

  // 1v1 challenge
  const total = myValue + theirValue;
  const myPercent = total > 0 ? (myValue / total) * 100 : 50;
  const isWinning = myValue > theirValue;
  const isTied = myValue === theirValue;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className={cn(
          "text-xs font-semibold w-8 text-right",
          isWinning ? "text-primary" : isTied ? "text-muted-foreground" : "text-muted-foreground"
        )}>
          {Math.round(myValue)}
        </span>
        <div className={cn("flex-1 rounded-full bg-muted overflow-hidden relative", heightClass)}>
          <motion.div 
            className={cn(
              "h-full",
              isWinning ? "bg-primary" : isTied ? "bg-muted-foreground" : "bg-muted-foreground/50"
            )}
            initial={false}
            animate={{ width: `${myPercent}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
          {/* Center indicator */}
          <motion.div 
            className="absolute top-1/2 -translate-y-1/2 w-1 h-full bg-white/80 rounded-full shadow-sm"
            initial={false}
            animate={{ left: `calc(${myPercent}% - 2px)` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
        <span className={cn(
          "text-xs font-semibold w-8",
          !isWinning && !isTied ? "text-destructive" : "text-muted-foreground"
        )}>
          {Math.round(theirValue)}
        </span>
      </div>
      {showLabels && (
        <div className="flex justify-between text-[10px] text-muted-foreground px-10">
          <span>{myLabel}</span>
          <span>{theirLabel || 'Them'}</span>
        </div>
      )}
    </div>
  );
};
