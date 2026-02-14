import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { LeaderboardHeroBanner } from "@/components/leaderboard/LeaderboardHeroBanner";
import { LeaderboardFilters, TimeFilter, ScopeFilter } from "@/components/leaderboard/LeaderboardFilters";
import { UnifiedRaceSection } from "@/components/leaderboard/UnifiedRaceSection";
import { LeaderboardSpotlightRow } from "@/components/leaderboard/LeaderboardSpotlightRow";
import { useExpandedLeaderboard, CustomDateRange, getDateRange } from "@/hooks/useExpandedLeaderboard";
import { useTodayLeaderboard } from "@/hooks/useTodayLeaderboard";
import { useAwardStreaks } from "@/hooks/useAwardStreaks";
import { useAvailableLeaderboardPresets } from "@/hooks/useAvailableLeaderboardPresets";
import { useSalesRealtime } from "@/hooks/useSalesRealtime";
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
  </div>
);

const Leaderboard = () => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter | null>(null);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [customDateRange, setCustomDateRange] = useState<CustomDateRange | undefined>(undefined);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserYear, setCurrentUserYear] = useState<string | null>(null);
  const [isUserInitialized, setIsUserInitialized] = useState(false);

  useSalesRealtime();

  const { availablePresets, autoSelectedPreset, isLoading: presetsLoading } = useAvailableLeaderboardPresets();

  useEffect(() => {
    if (!presetsLoading && timeFilter === null) {
      setTimeFilter(autoSelectedPreset);
    }
  }, [presetsLoading, autoSelectedPreset, timeFilter]);

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

  const { data: todayLeaderboard, isLoading: todayLoading, isFetching: todayFetching } = useTodayLeaderboard(filterByYear);

  const { data: streakData } = useAwardStreaks(filterByYear);

  const hasCachedLeaderboard = !!expandedLeaderboard || !!todayLeaderboard;
  const isInitializing = !isUserInitialized || presetsLoading || timeFilter === null;

  if (isInitializing && !hasCachedLeaderboard) {
    return (
      <Layout>
        <LeaderboardSkeleton />
      </Layout>
    );
  }

  const isLive = timeFilter === 'live';
  const currentDateRange = timeFilter ? getDateRange(timeFilter, timeFilter === 'custom' ? customDateRange : undefined) : undefined;

  const hasNoData = isLive
    ? !todayLeaderboard?.rankings || Object.values(todayLeaderboard.rankings).every(arr => arr.length === 0)
    : !expandedLeaderboard || (
        !expandedLeaderboard.salesLeaders.mostFP &&
        !expandedLeaderboard.activityLeaders.mostDoors &&
        !expandedLeaderboard.gritAwards.earliestDoor
      );

  return (
    <Layout>
      <div className="p-4 space-y-6 pb-24">
        {/* Hero Banner */}
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
        {(isLive ? todayLoading : isLoading) ? (
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
                : isLive
                  ? "No one knocking yet. Be the first to set the pace!"
                  : "No data for this timeframe yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Rankings — always front and center */}
            {isLive ? (
              todayLeaderboard && (
                <UnifiedRaceSection
                  rankings={todayLeaderboard.rankings}
                  currentUserId={currentUserId}
                  isLive={true}
                  isFetching={todayFetching}
                  title="Live Race"
                />
              )
            ) : (
              expandedLeaderboard && (
                <div data-tour="leaderboard-sales">
                  <UnifiedRaceSection
                    rankings={expandedLeaderboard.rankings}
                    currentUserId={currentUserId}
                    isLive={false}
                    title="Rankings"
                  />
                </div>
              )
            )}

            {/* Spotlight Row — compact horizontal cards */}
            <LeaderboardSpotlightRow
              gritAwards={expandedLeaderboard?.gritAwards}
              currentUserId={currentUserId}
              streaks={streakData}
              showCompetitions={true}
              dateRange={currentDateRange}
            />
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Leaderboard;
