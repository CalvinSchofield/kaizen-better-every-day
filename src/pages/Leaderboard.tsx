import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { LeaderboardHeroBanner } from "@/components/leaderboard/LeaderboardHeroBanner";
import { LeaderboardFilters, TimeFilter, ScopeFilter } from "@/components/leaderboard/LeaderboardFilters";
import { SalesLeadersSection } from "@/components/leaderboard/SalesLeadersSection";
import { ActivityLeadersSection } from "@/components/leaderboard/ActivityLeadersSection";
import { GritAwardsSection } from "@/components/leaderboard/GritAwardsSection";
import { TimingBreakdownSection } from "@/components/leaderboard/TimingBreakdownSection";
import { RecordsSection } from "@/components/leaderboard/RecordsSection";
import { LiveRaceSection } from "@/components/leaderboard/LiveRaceSection";
import { useExpandedLeaderboard, CustomDateRange } from "@/hooks/useExpandedLeaderboard";
import { useAwardStreaks } from "@/hooks/useAwardStreaks";
import { useAvailableLeaderboardPresets } from "@/hooks/useAvailableLeaderboardPresets";
import { usePageTour } from "@/hooks/usePageTour";
import { PageTour } from "@/components/PageTour";
import { leaderboardTourSteps } from "@/config/pageTours";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const LeaderboardSkeleton = () => (
  <div className="p-4 space-y-6">
    <Skeleton className="h-24 rounded-xl" />
    <div className="flex gap-2 overflow-hidden">
      <Skeleton className="h-10 w-16 rounded-full" />
      <Skeleton className="h-10 w-24 rounded-full" />
      <Skeleton className="h-10 w-16 rounded-full" />
      <Skeleton className="h-10 w-16 rounded-full" />
    </div>
    <div className="grid grid-cols-2 gap-3">
      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-28 rounded-xl" />
    </div>
    <Skeleton className="h-40 rounded-xl" />
    <Skeleton className="h-32 rounded-xl" />
  </div>
);

const Leaderboard = () => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter | null>(null);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [customDateRange, setCustomDateRange] = useState<CustomDateRange | undefined>(undefined);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserYear, setCurrentUserYear] = useState<string | null>(null);
  const [isUserInitialized, setIsUserInitialized] = useState(false);

  // Page tour
  const { showTour, completeTour, skipTour } = usePageTour({
    page: 'leaderboard',
    enabled: isUserInitialized,
    delay: 600,
  });

  // Get available presets based on actual data
  const { availablePresets, autoSelectedPreset, isLoading: presetsLoading } = useAvailableLeaderboardPresets();

  // Auto-select best preset when data loads
  useEffect(() => {
    if (!presetsLoading && timeFilter === null) {
      setTimeFilter(autoSelectedPreset);
    }
  }, [presetsLoading, autoSelectedPreset, timeFilter]);

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
          setScopeFilter(repData.year === 'Rookie' ? 'rookies' : 'all');
        }
      }
      setIsUserInitialized(true);
    };
    
    fetchUser();
  }, []);

  const filterByYear = scopeFilter === 'rookies' ? 'Rookie' : undefined;

  const { data: expandedLeaderboard, isLoading } = useExpandedLeaderboard(
    timeFilter ?? 'live',
    filterByYear,
    timeFilter === 'custom' ? customDateRange : undefined
  );

  const { data: streakData } = useAwardStreaks(filterByYear);

  // Show skeleton during initial load
  if (!isUserInitialized || presetsLoading || timeFilter === null) {
    return (
      <Layout>
        <LeaderboardSkeleton />
      </Layout>
    );
  }

  const hasNoData = !expandedLeaderboard || (
    !expandedLeaderboard.salesLeaders.mostFP && 
    !expandedLeaderboard.activityLeaders.mostDoors && 
    !expandedLeaderboard.gritAwards.earliestDoor
  );

  return (
    <Layout>
      <div className="p-4 space-y-6 pb-24">
        {/* Hero Banner - Personal Achievement */}
        <div data-tour="leaderboard-hero">
          <LeaderboardHeroBanner 
            userId={currentUserId} 
            filterByYear={filterByYear} 
          />
        </div>

        {/* Filters */}
        <div data-tour="leaderboard-filters">
          <LeaderboardFilters
            timeFilter={timeFilter}
            scopeFilter={scopeFilter}
            availablePresets={availablePresets}
            customDateRange={customDateRange}
            onTimeFilterChange={setTimeFilter}
            onScopeFilterChange={setScopeFilter}
            onCustomDateRangeChange={setCustomDateRange}
          />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-24 bg-muted rounded-xl" />
            <div className="h-32 bg-muted rounded-xl" />
            <div className="h-24 bg-muted rounded-xl" />
          </div>
        ) : hasNoData ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">
              {scopeFilter === 'rookies' 
                ? "No rookies knocking yet — try switching to All!"
                : timeFilter === 'live'
                  ? "No one knocking yet. Be the first to set the pace!"
                  : "No data for this timeframe yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Live Race - Only show for live timeframe */}
            {timeFilter === 'live' && (
              <LiveRaceSection
                currentUserId={currentUserId}
                filterByYear={filterByYear}
              />
            )}

            {/* Sales Leaders - Show for non-live timeframes OR as secondary for live */}
            {timeFilter !== 'live' && (
              <div data-tour="leaderboard-sales">
                <SalesLeadersSection
                  mostFP={expandedLeaderboard.salesLeaders.mostFP}
                  mostPRMR={expandedLeaderboard.salesLeaders.mostPRMR}
                  mostUpgradeFP={expandedLeaderboard.salesLeaders.mostUpgradeFP}
                  mostCloses={expandedLeaderboard.activityLeaders.mostCloses}
                  currentUserId={currentUserId}
                />
              </div>
            )}

            {/* Activity Leaders - Show for non-live timeframes */}
            {timeFilter !== 'live' && (
              <ActivityLeadersSection
                mostDoors={expandedLeaderboard.activityLeaders.mostDoors}
                mostDMs={expandedLeaderboard.activityLeaders.mostDMs}
                mostPitches={expandedLeaderboard.activityLeaders.mostPitches}
                mostTransitions={expandedLeaderboard.activityLeaders.mostTransitions}
                mostPresentations={expandedLeaderboard.activityLeaders.mostPresentations}
                currentUserId={currentUserId}
              />
            )}

            {/* Grit Awards */}
            <div data-tour="leaderboard-grit">
              <GritAwardsSection
                gritAwards={expandedLeaderboard.gritAwards}
                currentUserId={currentUserId}
                streaks={streakData}
              />
            </div>

            {/* Timing Breakdown (Collapsible) */}
            <TimingBreakdownSection
              gritAwards={expandedLeaderboard.gritAwards}
              currentUserId={currentUserId}
            />
          </div>
        )}

        {/* Records Section (Collapsible) - Personal Bests & Class Records */}
        <RecordsSection userId={currentUserId} />
      </div>

      {/* Page Tour */}
      <PageTour
        steps={leaderboardTourSteps}
        isOpen={showTour}
        onComplete={completeTour}
        onSkip={skipTour}
      />
    </Layout>
  );
};

export default Leaderboard;
