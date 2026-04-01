import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { LeaderboardHeroBanner } from "@/components/leaderboard/LeaderboardHeroBanner";
import { LeaderboardFilters, TimeFilter } from "@/components/leaderboard/LeaderboardFilters";
import { UnifiedRaceSection } from "@/components/leaderboard/UnifiedRaceSection";
import { LeaderboardSpotlightRow } from "@/components/leaderboard/LeaderboardSpotlightRow";
import { WatchlistDrawer } from "@/components/leaderboard/WatchlistDrawer";
import { UnifiedFilterDrawer, UnifiedFilterState, DEFAULT_UNIFIED_FILTER, isUnifiedFilterActive, resolveFilteredUserIds } from "@/components/filters/UnifiedFilterDrawer";
import { useExpandedLeaderboard, CustomDateRange, getDateRange } from "@/hooks/useExpandedLeaderboard";
import { useTodayLeaderboard } from "@/hooks/useTodayLeaderboard";
import { useAwardStreaks } from "@/hooks/useAwardStreaks";
import { useAvailableLeaderboardPresets } from "@/hooks/useAvailableLeaderboardPresets";
import { useSalesRealtime } from "@/hooks/useSalesRealtime";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useHeader } from "@/contexts/HeaderContext";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";
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
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('live');
  const [smartFilter, setSmartFilter] = useState<UnifiedFilterState>(DEFAULT_UNIFIED_FILTER);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<CustomDateRange | undefined>(undefined);
  const [watchlistDrawerOpen, setWatchlistDrawerOpen] = useState(false);
  const { userId: currentUserId } = useCurrentUserId();
  const { setCustomRightContent } = useHeader();
  const queryClient = useQueryClient();
  const { data: teamAccess } = useTeamAccess();

  useSalesRealtime();
  const { watchedUserIds } = useWatchlist();
  const { availablePresets } = useAvailableLeaderboardPresets();

  // Catch in-flight counter queue events: re-fetch after a short delay on mount
  // so the leaderboard reflects taps that were still being processed when the user navigated here
  useEffect(() => {
    const timer = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['today-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['expanded-leaderboard'] });
    }, 1500);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let isMounted = true;

    const fetchCurrentUserYear = async () => {
      if (!currentUserId) {
        if (!isMounted) return;
        setSmartFilter((prev) =>
          prev.yearFilters.length === 0 ? prev : { ...prev, yearFilters: [] }
        );
        return;
      }

      try {
        const { data: repData } = await supabase
          .from('reps')
          .select('year')
          .eq('user_id', currentUserId)
          .maybeSingle();

        if (!isMounted) return;

        const rookieOnlyFilter = repData?.year === 'Rookie' ? ['Rookie'] : [];
        setSmartFilter((prev) => {
          const unchanged =
            prev.yearFilters.length === rookieOnlyFilter.length &&
            prev.yearFilters.every((value, index) => value === rookieOnlyFilter[index]);
          return unchanged ? prev : { ...prev, yearFilters: rookieOnlyFilter };
        });
      } catch (err) {
        console.error('[Leaderboard] Failed to fetch user/rep data:', err);
      }
    };

    fetchCurrentUserYear();

    return () => {
      isMounted = false;
    };
  }, [currentUserId]);

  // Inject filter icon into header
  useEffect(() => {
    const active = isUnifiedFilterActive(smartFilter);
    setCustomRightContent(
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setShowFilterDrawer(true)}
        className="relative h-10 w-10"
      >
        <Filter className="h-5 w-5" />
        {active && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
        )}
      </Button>
    );
    return () => setCustomRightContent(null);
  }, [setCustomRightContent, smartFilter]);

  // Derive scope from smart filter
  const scopeFilter = smartFilter.scope === 'watchlist' ? 'watchlist' 
    : smartFilter.yearFilters.includes('Rookie') && smartFilter.yearFilters.length === 1 ? 'rookies' 
    : 'all';
  const filterByYear = scopeFilter === 'rookies' ? 'Rookie' : undefined;
  const isWatchlistMode = scopeFilter === 'watchlist';

  const { data: expandedLeaderboard, isLoading } = useExpandedLeaderboard(
    timeFilter ?? 'live',
    filterByYear,
    timeFilter === 'custom' ? customDateRange : undefined
  );

  const { data: todayLeaderboard, isLoading: todayLoading, isFetching: todayFetching } = useTodayLeaderboard(filterByYear);

  const { data: streakData } = useAwardStreaks(filterByYear);

  const hasCachedLeaderboard = !!expandedLeaderboard || !!todayLeaderboard;
  const isLive = timeFilter === 'live';
  const currentDateRange = getDateRange(timeFilter, timeFilter === 'custom' ? customDateRange : undefined);

  // Compute allowed user IDs from unified filter (for non-watchlist node-based filtering)
  const filterAllowedUserIds = useMemo(() => {
    if (!teamAccess || smartFilter.selectedNodes.length === 0) return null;
    return new Set(resolveFilteredUserIds(
      { ...smartFilter, scope: 'all', yearFilters: [] },
      teamAccess.accessibleReps || [],
      teamAccess.mgmtGroups || [],
      teamAccess.accessibleUserIds || [],
      currentUserId || null,
      teamAccess.accessLevel || 'none',
    ));
  }, [teamAccess, smartFilter.selectedNodes, currentUserId]);

  // Helper to filter any rankings object by filter state
  const filterRankings = (rankings: any): any => {
    const allowedIds = new Set<string>();
    
    if (isWatchlistMode && watchedUserIds.length > 0) {
      watchedUserIds.forEach(id => allowedIds.add(id));
      if (currentUserId) allowedIds.add(currentUserId);
    }

    const nodeIds = filterAllowedUserIds;

    let yearIds: Set<string> | null = null;
    if (smartFilter.yearFilters.length > 0 && teamAccess?.accessibleReps) {
      const allowedYears = new Set(smartFilter.yearFilters);
      yearIds = new Set(
        teamAccess.accessibleReps
          .filter(r => r.userId && allowedYears.has(r.year || ''))
          .map(r => r.userId!)
      );
    }

    const hasAnyFilter = (isWatchlistMode && watchedUserIds.length > 0) || nodeIds || yearIds;
    if (!hasAnyFilter) return rankings;

    const filtered: any = {};
    for (const [key, entries] of Object.entries(rankings)) {
      if (Array.isArray(entries)) {
        filtered[key] = entries.filter((e: any) => {
          if (isWatchlistMode && watchedUserIds.length > 0 && !allowedIds.has(e.userId)) return false;
          if (nodeIds && !nodeIds.has(e.userId)) return false;
          if (yearIds && !yearIds.has(e.userId)) return false;
          return true;
        });
      } else {
        filtered[key] = entries;
      }
    }
    return filtered;
  };

  if (!hasCachedLeaderboard && (isLive ? todayLoading : isLoading)) {
    return (
      <Layout>
        <LeaderboardSkeleton />
      </Layout>
    );
  }

  const hasNoData = isLive
    ? !todayLeaderboard?.rankings || Object.values(todayLeaderboard.rankings).every(arr => arr.length === 0)
    : !expandedLeaderboard || (
        !expandedLeaderboard.salesLeaders.mostFP &&
        !expandedLeaderboard.activityLeaders.mostDoors &&
        !expandedLeaderboard.gritAwards.earliestDoor
      );

  const watchlistEmpty = isWatchlistMode && watchedUserIds.length === 0;

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
            availablePresets={availablePresets}
            customDateRange={customDateRange}
            onTimeFilterChange={setTimeFilter}
            onCustomDateRangeChange={setCustomDateRange}
          />
        </div>

        {/* Unified Filter Drawer */}
        <UnifiedFilterDrawer
          open={showFilterDrawer}
          onOpenChange={setShowFilterDrawer}
          filterState={smartFilter}
          onFilterApply={setSmartFilter}
          mode="leaderboard"
          hierarchy={teamAccess?.hierarchy}
          mgmtGroups={teamAccess?.mgmtGroups || []}
          teams={teamAccess?.teams || []}
          accessibleReps={teamAccess?.accessibleReps || []}
          accessLevel={teamAccess?.accessLevel}
        />

        {/* Content */}
        {(isLive ? todayLoading : isLoading) ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-24 bg-muted rounded-xl" />
            <div className="h-32 bg-muted rounded-xl" />
            <div className="h-24 bg-muted rounded-xl" />
          </div>
        ) : watchlistEmpty ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">Your watchlist is empty</p>
            <p className="text-sm mt-1">Visit someone's profile and tap 👁 to start watching</p>
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
                  rankings={filterRankings(todayLeaderboard.rankings)}
                  currentUserId={currentUserId}
                  isLive={true}
                  isFetching={todayFetching}
                  title={isWatchlistMode ? "Watchlist Race" : "Live Race"}
                />
              )
            ) : (
              expandedLeaderboard && (
                <div data-tour="leaderboard-sales">
                  <UnifiedRaceSection
                    rankings={filterRankings(expandedLeaderboard.rankings)}
                    currentUserId={currentUserId}
                    isLive={false}
                    title={isWatchlistMode ? "Watchlist Rankings" : "Rankings"}
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
        {/* Watchlist Drawer */}
        <WatchlistDrawer
          open={watchlistDrawerOpen}
          onOpenChange={setWatchlistDrawerOpen}
        />
      </div>
    </Layout>
  );
};

export default Leaderboard;
