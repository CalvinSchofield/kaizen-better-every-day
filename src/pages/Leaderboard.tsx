import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { LeaderboardHeroBanner } from "@/components/leaderboard/LeaderboardHeroBanner";
import { LeaderboardFilters, TimeFilter, ScopeFilter } from "@/components/leaderboard/LeaderboardFilters";
import { SalesLeadersSection } from "@/components/leaderboard/SalesLeadersSection";
import { ActivityLeadersSection } from "@/components/leaderboard/ActivityLeadersSection";
import { GritAwardsSection } from "@/components/leaderboard/GritAwardsSection";
import { TimingBreakdownSection } from "@/components/leaderboard/TimingBreakdownSection";
import { LiveLeaderboardSection } from "@/components/leaderboard/LiveLeaderboardSection";
import { useExpandedLeaderboard } from "@/hooks/useExpandedLeaderboard";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const Leaderboard = () => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('live');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserYear, setCurrentUserYear] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch current user info
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        
        const { data: repData } = await supabase
          .from('reps')
          .select('year')
          .eq('user_id', user.id)
          .single();
        
        if (repData) {
          setCurrentUserYear(repData.year);
          // Set default scope based on user's year
          setScopeFilter(repData.year === 'Rookie' ? 'rookies' : 'all');
        }
      }
      setIsInitialized(true);
    };
    
    fetchUser();
  }, []);

  // Convert timeFilter to hook format
  const hookTimeframe = timeFilter === 'live' ? 'yesterday' : timeFilter === 'season' ? 'season' : timeFilter;
  const filterByYear = scopeFilter === 'rookies' ? 'Rookie' : undefined;

  const { data: expandedLeaderboard, isLoading } = useExpandedLeaderboard(
    hookTimeframe as 'yesterday' | 'week' | 'month' | 'season' | 'ytd',
    filterByYear
  );

  if (!isInitialized) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 space-y-6 pb-24">
        {/* Hero Banner - Personal Achievement */}
        <LeaderboardHeroBanner 
          userId={currentUserId} 
          filterByYear={filterByYear} 
        />

        {/* Filters */}
        <LeaderboardFilters
          timeFilter={timeFilter}
          scopeFilter={scopeFilter}
          onTimeFilterChange={setTimeFilter}
          onScopeFilterChange={setScopeFilter}
        />

        {/* Content based on time filter */}
        {timeFilter === 'live' ? (
          <LiveLeaderboardSection 
            filterByYear={filterByYear}
            currentUserId={currentUserId}
          />
        ) : isLoading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-24 bg-muted rounded-xl" />
            <div className="h-32 bg-muted rounded-xl" />
            <div className="h-24 bg-muted rounded-xl" />
          </div>
        ) : expandedLeaderboard ? (
          <div className="space-y-6">
            {/* Sales Leaders */}
            <SalesLeadersSection
              mostFP={expandedLeaderboard.salesLeaders.mostFP}
              mostPRMR={expandedLeaderboard.salesLeaders.mostPRMR}
              mostUpgradeFP={expandedLeaderboard.salesLeaders.mostUpgradeFP}
              mostCloses={expandedLeaderboard.activityLeaders.mostCloses}
              currentUserId={currentUserId}
            />

            {/* Activity Leaders */}
            <ActivityLeadersSection
              mostDoors={expandedLeaderboard.activityLeaders.mostDoors}
              mostDMs={expandedLeaderboard.activityLeaders.mostDMs}
              mostPitches={expandedLeaderboard.activityLeaders.mostPitches}
              mostTransitions={expandedLeaderboard.activityLeaders.mostTransitions}
              mostPresentations={expandedLeaderboard.activityLeaders.mostPresentations}
              currentUserId={currentUserId}
            />

            {/* Grit Awards */}
            <GritAwardsSection
              gritAwards={expandedLeaderboard.gritAwards}
              currentUserId={currentUserId}
            />

            {/* Timing Breakdown (Collapsible) */}
            <TimingBreakdownSection
              gritAwards={expandedLeaderboard.gritAwards}
              currentUserId={currentUserId}
            />

            {/* Empty state */}
            {!expandedLeaderboard.salesLeaders.mostFP && 
             !expandedLeaderboard.activityLeaders.mostDoors && 
             !expandedLeaderboard.gritAwards.earliestDoor && (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg font-medium">
                  {scopeFilter === 'rookies' 
                    ? "No rookies knocking yet — try switching to All!"
                    : "No data for this timeframe yet."}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">
              {scopeFilter === 'rookies' 
                ? "No rookies knocking yet — try switching to All!"
                : "No data for this timeframe yet."}
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Leaderboard;
