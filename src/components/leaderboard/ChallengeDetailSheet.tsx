import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Challenge } from "@/hooks/useChallenges";
import { useChallengeProgress } from "@/hooks/useChallengeProgress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChallengeDetailSheetProps {
  challenge: Challenge;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ChallengeDetailSheet = ({ challenge, open, onOpenChange }: ChallengeDetailSheetProps) => {
  const { data: progress } = useChallengeProgress(challenge.status === 'active' ? challenge : null);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-center">
          <DrawerTitle>Challenge Details</DrawerTitle>
        </DrawerHeader>
        
        <div className="p-4 space-y-6">
          {/* Status */}
          <div className="text-center">
            <span className={cn(
              "inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium",
              challenge.status === 'active' && "bg-green-500/20 text-green-600",
              challenge.status === 'pending' && "bg-amber-500/20 text-amber-600",
              challenge.status === 'completed' && "bg-muted text-muted-foreground"
            )}>
              {challenge.status === 'active' && <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
              {challenge.status.toUpperCase()}
            </span>
          </div>

          {/* Matchup */}
          {progress && (
            <div className="flex items-center justify-around">
              {progress.participants.slice(0, 2).map((p, i) => (
                <div key={p.user_id} className="text-center">
                  <Avatar className="h-16 w-16 mx-auto mb-2 border-2 border-border">
                    <AvatarImage src={p.profile_photo_url} />
                    <AvatarFallback>{p.rep_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <p className="font-semibold">{p.rep_name}</p>
                  <p className="text-2xl font-bold text-primary">{p.current_value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Progress bar */}
          {progress && (
            <div className="space-y-2">
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${(progress.userProgress?.current_value || 0) / ((progress.leader?.current_value || 1) + (progress.userProgress?.current_value || 0)) * 100}%` }}
                />
              </div>
              <p className="text-center text-sm text-muted-foreground">{progress.timeRemaining}</p>
            </div>
          )}

          {/* Stakes */}
          {challenge.stakes && (
            <div className="bg-muted/50 rounded-xl p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Stakes</p>
              <p className="font-medium">{challenge.stakes}</p>
            </div>
          )}

          {/* Spectators placeholder */}
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Eye className="h-4 w-4" />
            <span className="text-sm">Public challenge</span>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
