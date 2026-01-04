import { useTodayLeaderboard } from "@/hooks/useTodayLeaderboard";
import { cn } from "@/lib/utils";

interface LiveLeaderboardSectionProps {
  filterByYear?: string;
  currentUserId: string | null;
}

// Working status indicator component
const WorkingIndicator = ({ isWorking }: { isWorking: boolean }) => {
  if (!isWorking) return null;
  
  return (
    <span className="relative flex h-2 w-2 ml-1" title="Currently working">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
    </span>
  );
};

export const LiveLeaderboardSection = ({ filterByYear, currentUserId }: LiveLeaderboardSectionProps) => {
  const { data: todayBoard, isLoading } = useTodayLeaderboard(filterByYear);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-20 bg-muted rounded-xl" />
        <div className="h-32 bg-muted rounded-xl" />
        <div className="h-24 bg-muted rounded-xl" />
      </div>
    );
  }

  const hasNoData = !todayBoard || (
    todayBoard.rankings.fp_plus.filter(r => r.value > 0).length === 0 &&
    todayBoard.rankings.prmr.filter(r => r.value > 0).length === 0 &&
    todayBoard.rankings.presentations.filter(r => r.value > 0).length === 0 &&
    todayBoard.rankings.transitions.filter(r => r.value > 0).length === 0 &&
    todayBoard.rankings.pitches.filter(r => r.value > 0).length === 0 &&
    todayBoard.rankings.doors_knocked.filter(r => r.value > 0).length === 0
  );

  if (hasNoData) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">
          {filterByYear === 'Rookie' 
            ? "No rookies knocking yet — try switching to All!"
            : "No one knocking yet. Be the first to set the pace!"}
        </p>
      </div>
    );
  }

  const fpRankings = todayBoard.rankings.fp_plus.filter(r => r.value > 0);
  const prmrMap = new Map(todayBoard.rankings.prmr.map(r => [r.userId, r.value]));
  const topFP = fpRankings[0];
  const topPRMR = todayBoard.rankings.prmr[0];

  return (
    <div className="space-y-6">
      {/* Top Sales Cards */}
      {(topFP || topPRMR) && (
        <div className="grid grid-cols-2 gap-3">
          {topFP && (
            <TopCard
              icon="🏆"
              label="Highest FP+"
              value={`${topFP.value.toFixed(1)}`}
              name={topFP.name}
              isCurrentUser={currentUserId === topFP.userId}
              isWorking={topFP.isWorking}
            />
          )}
          {topPRMR && (
            <TopCard
              icon="💰"
              label="Highest PRMR"
              value={`$${topPRMR.value.toFixed(0)}`}
              name={topPRMR.name}
              isCurrentUser={currentUserId === topPRMR.userId}
              isWorking={topPRMR.isWorking}
              isGreen
            />
          )}
        </div>
      )}

      {/* FP+ Rankings */}
      {fpRankings.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            📊 Sales Rankings
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          </h3>
          <div className="space-y-1.5">
            {fpRankings.slice(0, 5).map((entry, idx) => {
              const prmr = prmrMap.get(entry.userId) || 0;
              const isCurrentUser = currentUserId === entry.userId;
              
              return (
                <div
                  key={entry.userId}
                  className={cn(
                    "flex items-center justify-between py-2.5 px-3 rounded-lg transition-all",
                    isCurrentUser 
                      ? "bg-primary/10 border-2 border-primary/20" 
                      : "bg-secondary/30"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground w-6">#{idx + 1}</span>
                    {isCurrentUser && <span className="text-primary">⭐</span>}
                    <span className={cn(
                      "text-sm flex items-center",
                      isCurrentUser ? "font-bold text-primary" : "font-medium"
                    )}>
                      {isCurrentUser ? 'You' : entry.name}
                      <WorkingIndicator isWorking={!isCurrentUser && (entry.isWorking || false)} />
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{entry.value.toFixed(1)} FP+</span>
                    {prmr > 0 && (
                      <span className="text-sm font-bold text-green-600 dark:text-green-500">
                        ${prmr.toFixed(0)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            
            {/* Show user position if outside top 5 */}
            {(() => {
              const userRank = fpRankings.findIndex(r => r.userId === currentUserId) + 1;
              const userEntry = fpRankings.find(r => r.userId === currentUserId);
              const userPrmr = userEntry ? prmrMap.get(userEntry.userId) || 0 : 0;
              
              if (userRank > 5 && userEntry) {
                return (
                  <>
                    <div className="text-center text-xs text-muted-foreground py-1">···</div>
                    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-primary/10 border-2 border-primary/20">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground w-6">#{userRank}</span>
                        <span className="text-primary">⭐</span>
                        <span className="text-sm font-bold text-primary">You</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{userEntry.value.toFixed(1)} FP+</span>
                        {userPrmr > 0 && (
                          <span className="text-sm font-bold text-green-600 dark:text-green-500">
                            ${userPrmr.toFixed(0)}
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                );
              }
              return null;
            })()}
          </div>
        </div>
      )}

      {/* Activity Rankings */}
      {[
        { key: 'presentations', label: 'Presentations', icon: '🪑' },
        { key: 'transitions', label: 'Transitions', icon: '🏠' },
        { key: 'pitches', label: 'Pitches', icon: '🎤' },
        { key: 'doors_knocked', label: 'Doors Knocked', icon: '🚪' },
      ].map(({ key, label, icon }) => {
        const rankings = todayBoard.rankings[key as keyof typeof todayBoard.rankings];
        if (rankings.length === 0) return null;

        const leader = rankings[0];
        const userRank = rankings.findIndex(r => r.userId === currentUserId) + 1;
        const userEntry = rankings.find(r => r.userId === currentUserId);

        return (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground">{icon} {label}</h3>
              {userRank === 2 && userEntry && (
                <span className="text-xs text-amber-500 font-medium">
                  {leader.value - userEntry.value} behind — you got this! 💪
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              {rankings.slice(0, 3).map((entry, idx) => {
                const isCurrentUser = currentUserId === entry.userId;
                
                return (
                  <div
                    key={entry.userId}
                    className={cn(
                      "flex items-center justify-between py-2 px-3 rounded-lg transition-all",
                      isCurrentUser 
                        ? "bg-primary/10 border border-primary/20" 
                        : "bg-secondary/30"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground w-6">#{idx + 1}</span>
                      {isCurrentUser && <span className="text-primary text-sm">⭐</span>}
                      <span className={cn(
                        "text-sm flex items-center",
                        isCurrentUser ? "font-bold text-primary" : "font-medium"
                      )}>
                        {isCurrentUser ? 'You' : entry.name}
                        <WorkingIndicator isWorking={!isCurrentUser && (entry.isWorking || false)} />
                      </span>
                    </div>
                    <span className="text-sm font-bold">{entry.value}</span>
                  </div>
                );
              })}
              
              {userRank > 3 && userEntry && (
                <>
                  <div className="text-center text-xs text-muted-foreground py-0.5">···</div>
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground w-6">#{userRank}</span>
                      <span className="text-primary text-sm">⭐</span>
                      <span className="text-sm font-bold text-primary">You</span>
                    </div>
                    <span className="text-sm font-bold">{userEntry.value}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface TopCardProps {
  icon: string;
  label: string;
  value: string;
  name: string;
  isCurrentUser: boolean;
  isWorking?: boolean;
  isGreen?: boolean;
}

const TopCard = ({ icon, label, value, name, isCurrentUser, isWorking, isGreen }: TopCardProps) => (
  <div className={cn(
    "p-4 rounded-xl transition-all",
    isCurrentUser 
      ? "bg-primary/10 border-2 border-primary/30" 
      : "bg-card border border-border"
  )}>
    <div className="flex items-start justify-between mb-2">
      <span className="text-xl">{icon}</span>
      {isCurrentUser && (
        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">You!</span>
      )}
    </div>
    <p className="text-xs text-muted-foreground mb-1">{label}</p>
    <p className={cn(
      "text-2xl font-bold",
      isGreen ? "text-green-600 dark:text-green-500" : "text-foreground"
    )}>
      {value}
    </p>
    <p className={cn(
      "text-sm font-medium mt-1 flex items-center",
      isCurrentUser ? "text-primary" : "text-foreground"
    )}>
      {isCurrentUser ? 'You' : name}
      <WorkingIndicator isWorking={!isCurrentUser && (isWorking || false)} />
    </p>
  </div>
);
