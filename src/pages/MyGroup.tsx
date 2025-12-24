import { useState, useMemo, useCallback, useEffect } from "react";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useGroupRecruits, useMySuggestions, useDeleteMySuggestion, RecruitSuggestion, Recruit } from "@/hooks/useGroupRecruits";
import { useBlitzes } from "@/hooks/useBlitzes";
import { useBlitzAttendanceLogger } from "@/hooks/useBlitzAttendanceLogger";
import { useNeedsAttention, RepData, RepSummerConfigData, AttentionRecruit } from "@/hooks/useNeedsAttention";
import { useDismissedRecruits } from "@/hooks/useDismissedRecruits";
import { useSkippedRecruits } from "@/hooks/useSkippedRecruits";
import { useAssignedTasks } from "@/hooks/useAssignedTasks";
import { useRecruitActivitiesRealtime, useRecruitSuggestionsRealtime, useRepsRealtime } from "@/hooks/useRecruitActivitiesRealtime";
import { useSummerRecommendations, SummerRepData } from "@/hooks/useSummerRecommendations";
import { useRecordsTracking } from "@/hooks/useRecordsTracking";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Filter, X, Clock, CheckCircle2, XCircle, Pencil, Trash2, LayoutGrid } from "lucide-react";
import { TodaysFocusHero, OverdueScheduledItem } from "@/components/mygroup/TodaysFocusHero";
import { NeedsAttentionChips } from "@/components/mygroup/NeedsAttentionChips";
import { NeedsAttentionDrawer } from "@/components/mygroup/NeedsAttentionDrawer";
import { QuickViewDrawer } from "@/components/mygroup/QuickViewDrawer";
import { WeekPlannerSection } from "@/components/mygroup/WeekPlannerSection";
import { RecruitDetailDrawer } from "@/components/mygroup/RecruitDetailDrawer";
import { ContactMethodDrawer } from "@/components/mygroup/ContactMethodDrawer";
import { ScheduleFollowUpDrawer } from "@/components/mygroup/ScheduleFollowUpDrawer";
import { GoalsPaceDrawer } from "@/components/mygroup/GoalsPaceDrawer";
import { useRecruitingRecommendations } from "@/hooks/useRecruitingRecommendations";
import UpcomingTeamEventsCard from "@/components/mygroup/UpcomingTeamEventsCard";
import { AddRecruitDrawer } from "@/components/mygroup/AddRecruitDrawer";
import { PendingSuggestionsCard } from "@/components/mygroup/PendingSuggestionsCard";
import { TeamFilterSheet } from "@/components/mygroup/TeamFilterSheet";
import { EditSuggestionDrawer } from "@/components/mygroup/EditSuggestionDrawer";
import { AssignedTasksDrawer } from "@/components/mygroup/AssignedTasksDrawer";
import { Skeleton } from "@/components/ui/skeleton";
import Layout from "@/components/Layout";
import { format, parseISO, differenceInDays, isPast, isToday as isDateToday, startOfToday } from "date-fns";
import { toast } from "sonner";
import { UndoBanner } from "@/components/ui/UndoBanner";
import { AnimatePresence } from "framer-motion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Floating Add Button with scroll hide
const FloatingAddButton = ({ visible, onClick }: { visible: boolean; onClick: () => void }) => {
  const isScrollVisible = useScrollDirection(100);
  
  if (!visible) return null;
  
  return (
    <Button
      className={`fixed right-4 h-14 w-14 rounded-full shadow-lg z-40 transition-all duration-300 ${
        isScrollVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
      style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom) + 1.5rem)' }}
      onClick={onClick}
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
};

const MyGroup = () => {
  const location = useLocation();
  const { data: teamAccess, isLoading: accessLoading } = useTeamAccess();
  const { data: groupData, isLoading: recruitsLoading, isLeader } = useGroupRecruits();
  const { data: mySuggestions, isLoading: suggestionsLoading } = useMySuggestions();
  const deleteMutation = useDeleteMySuggestion();
  const { allBlitzes, allBlitzesIncludingPast } = useBlitzes();
  
  // UI State
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string | null>(null);
  const [editingSuggestion, setEditingSuggestion] = useState<RecruitSuggestion | null>(null);
  const [deletingSuggestionId, setDeletingSuggestionId] = useState<string | null>(null);
  
  // New Phase 1 state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [attentionDrawerOpen, setAttentionDrawerOpen] = useState(false);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [selectedRecruit, setSelectedRecruit] = useState<Recruit | null>(null);
  
  // Contact and Schedule drawer state
  const [contactMethodDrawerOpen, setContactMethodDrawerOpen] = useState(false);
  const [scheduleDrawerOpen, setScheduleDrawerOpen] = useState(false);
  const [assignedTasksDrawerOpen, setAssignedTasksDrawerOpen] = useState(false);
  const [contactingRecruit, setContactingRecruit] = useState<Recruit | null>(null);
  const [heroAnimatingOut, setHeroAnimatingOut] = useState(false);
  const [lastDismissedRecruit, setLastDismissedRecruit] = useState<{ notionPageId: string; name: string } | null>(null);
  const [undoBannerMessage, setUndoBannerMessage] = useState<string | null>(null);
  const [goalsPaceDrawerOpen, setGoalsPaceDrawerOpen] = useState(false);
  
  // Track if we've processed the navigation state
  const [hasProcessedNavState, setHasProcessedNavState] = useState(false);

  // Auto-log blitz attendance for recently ended blitzes (leaders only)
  useBlitzAttendanceLogger(allBlitzesIncludingPast, isLeader);

  const isLoading = accessLoading || (isLeader ? recruitsLoading : suggestionsLoading);

  // Fetch current user's rep data to get their team leader name
  const { data: currentUserRep } = useQuery({
    queryKey: ['current-user-rep-team'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data } = await supabase
        .from('reps')
        .select('name, team_leader, notion_page_id')
        .eq('user_id', user.id)
        .single();
      
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Handle navigation state for auto-opening readiness drawer with team filter
  useEffect(() => {
    if (hasProcessedNavState || isLoading || !teamAccess || !currentUserRep) return;
    
    const navState = location.state as { openCategory?: string; autoSelectMyTeam?: boolean } | null;
    if (navState?.openCategory && navState?.autoSelectMyTeam) {
      // Always filter to the leader's own direct team (named after them)
      // This applies regardless of whether they're team lead, MGMT lead, or Area Director
      const myTeam = teamAccess.teams?.find(t => t.name === currentUserRep.name);
      if (myTeam) {
        setSelectedTeamFilter(`team:${myTeam.id}`);
      }
      
      // Open the specified category drawer
      setSelectedCategoryId(navState.openCategory);
      setAttentionDrawerOpen(true);
      setHasProcessedNavState(true);
      
      // Clear the navigation state to prevent re-triggering
      window.history.replaceState({}, document.title);
    }
  }, [hasProcessedNavState, isLoading, teamAccess, location.state, currentUserRep]);

  const allRecruits = groupData?.recruits || [];
  const pendingSuggestions = groupData?.pendingSuggestions || [];
  const activities = groupData?.activities || [];

  // Subscribe to realtime updates for recruit activities, suggestions, and rep data
  const recruitNotionIds = useMemo(() => allRecruits.map(r => r.notionPageId), [allRecruits]);
  useRecruitActivitiesRealtime(recruitNotionIds);
  useRecruitSuggestionsRealtime(currentUserRep?.notion_page_id || null);
  useRepsRealtime(recruitNotionIds);

  // Fetch tasks assigned to current user
  const { data: assignedTasks = [] } = useAssignedTasks(allRecruits);

  // Fetch rep data for training progress tracking
  const { data: recruitsRepData } = useQuery({
    queryKey: ['recruits-rep-data', allRecruits.map(r => r.notionPageId).join(',')],
    queryFn: async () => {
      if (allRecruits.length === 0) return [];
      
      const notionIds = allRecruits.map(r => r.notionPageId);
      const { data } = await supabase
        .from('reps')
        .select('notion_page_id, user_id, onboarding_complete, trainings_complete, slack_joined, ipad_assigned, ramp_to_blitz_phase, ramp_phase_1_complete, ramp_phase_2_complete, ramp_phase_3_complete, ramp_phase_4_complete, committed_blitzes')
        .in('notion_page_id', notionIds);
      
      return data || [];
    },
    enabled: allRecruits.length > 0 && isLeader,
    staleTime: 0, // Always refetch when invalidated for real-time updates
  });

  // Build repDataMap for useNeedsAttention
  const repDataMap = useMemo(() => {
    if (!recruitsRepData) return undefined;
    const map = new Map<string, RepData>();
    recruitsRepData.forEach(rep => {
      if (rep.notion_page_id) {
        map.set(rep.notion_page_id, rep as RepData);
      }
    });
    return map;
  }, [recruitsRepData]);

  // Get user IDs from rep data for goals lookup
  const recruitUserIds = useMemo(() => {
    return recruitsRepData?.filter(r => r.user_id).map(r => r.user_id!) || [];
  }, [recruitsRepData]);

  // Fetch goals data for readiness category
  const { data: recruitsGoalsData } = useQuery({
    queryKey: ['recruits-goals-data', recruitUserIds.join(',')],
    queryFn: async () => {
      if (recruitUserIds.length === 0) return [];
      
      const { data } = await supabase
        .from('rep_goals')
        .select('user_id, training_hours_goal, training_hours_progress, books_goal, books_progress, role_plays_goal, role_plays_progress, monday_night_lights_goal, monday_night_lights_progress, blitzes_goal, blitzes_progress, must_do_fp_goal, will_do_fp_goal, could_do_fp_goal')
        .in('user_id', recruitUserIds);
      
      return data || [];
    },
    enabled: recruitUserIds.length > 0 && isLeader,
    staleTime: 1000 * 60 * 2,
  });

  // Fetch summer config data for pace calculations
  const { data: recruitsSummerConfigData } = useQuery({
    queryKey: ['recruits-summer-config', recruitUserIds.join(',')],
    queryFn: async () => {
      if (recruitUserIds.length === 0) return [];
      
      const { data } = await supabase
        .from('season_config')
        .select('user_id, personal_summer_start')
        .in('user_id', recruitUserIds);
      
      return data || [];
    },
    enabled: recruitUserIds.length > 0 && isLeader,
    staleTime: 1000 * 60 * 5,
  });

  // Build repGoalsMap for useNeedsAttention
  const repGoalsMap = useMemo(() => {
    if (!recruitsGoalsData) return undefined;
    const map = new Map<string, any>();
    recruitsGoalsData.forEach(goals => {
      if (goals.user_id) {
        map.set(goals.user_id, goals);
      }
    });
    return map;
  }, [recruitsGoalsData]);

  // Build repSummerConfigMap for useNeedsAttention
  const repSummerConfigMap = useMemo(() => {
    if (!recruitsSummerConfigData) return undefined;
    const map = new Map<string, RepSummerConfigData>();
    recruitsSummerConfigData.forEach(config => {
      if (config.user_id) {
        map.set(config.user_id, config as RepSummerConfigData);
      }
    });
    return map;
  }, [recruitsSummerConfigData]);

  // Fetch daily entries for summer reps (to calculate pace)
  const { data: summerEntriesData } = useQuery({
    queryKey: ['summer-entries', recruitUserIds.join(',')],
    queryFn: async () => {
      if (recruitUserIds.length === 0) return [];
      
      const { data } = await supabase
        .from('daily_entries')
        .select('user_id, entry_date, fp_plus, work_start_time, work_end_time, doors_knocked, is_finalized')
        .in('user_id', recruitUserIds)
        .eq('is_finalized', true)
        .order('entry_date', { ascending: false });
      
      return data || [];
    },
    enabled: recruitUserIds.length > 0 && isLeader,
    staleTime: 1000 * 60 * 2,
  });

  // Build SummerRepData for useSummerRecommendations
  const summerReps = useMemo<SummerRepData[]>(() => {
    if (!recruitsRepData || !recruitsGoalsData || !recruitsSummerConfigData) return [];
    
    const today = format(new Date(), 'yyyy-MM-dd');
    
    return recruitsRepData
      .filter(rep => {
        // Only include reps who have started their summer
        const config = recruitsSummerConfigData.find(c => c.user_id === rep.user_id);
        return config?.personal_summer_start && config.personal_summer_start <= today;
      })
      .map(rep => {
        const goals = recruitsGoalsData.find(g => g.user_id === rep.user_id);
        const config = recruitsSummerConfigData.find(c => c.user_id === rep.user_id);
        const entries = summerEntriesData?.filter(e => e.user_id === rep.user_id) || [];
        const recruit = allRecruits.find(r => r.notionPageId === rep.notion_page_id);
        
        const totalFp = entries.reduce((sum, e) => sum + (Number(e.fp_plus) || 0), 0);
        const knockingDays = entries.filter(e => 
          (e.doors_knocked || 0) >= 4 && e.work_start_time && e.work_end_time
        ).length;

        return {
          userId: rep.user_id || '',
          notionPageId: rep.notion_page_id || '',
          name: recruit?.name || '',
          year: recruit?.year || 'Rookie',
          personalSummerStart: config?.personal_summer_start || null,
          personalSummerEnd: null, // Not tracked yet
          mustDoGoal: Number(goals?.must_do_fp_goal) || 0,
          willDoGoal: Number(goals?.will_do_fp_goal) || 0,
          couldDoGoal: Number(goals?.could_do_fp_goal) || 0,
          currentFpPlus: totalFp,
          knockingDaysCount: knockingDays,
        };
      });
  }, [recruitsRepData, recruitsGoalsData, recruitsSummerConfigData, summerEntriesData, allRecruits]);

  // Get records tracking for accessible users
  const { recordBreakers } = useRecordsTracking({
    enabled: isLeader && recruitUserIds.length > 0,
    accessibleUserIds: recruitUserIds,
  });

  // Get summer recommendations
  const summerRecommendations = useSummerRecommendations({
    reps: summerReps,
    entries: summerEntriesData || [],
    recordBreakers,
  });

  // Top summer recommendation (BAGEL/RECORD takes priority)
  const topSummerRecommendation = summerRecommendations[0] || null;

  // Build Goals & Pace data for the drawer
  const goalsPaceData = useMemo(() => {
    if (!summerReps.length) return [];
    
    const today = new Date();
    
    return summerReps
      .filter(rep => rep.willDoGoal > 0 && rep.personalSummerStart)
      .map(rep => {
        const summerStart = new Date(rep.personalSummerStart + 'T12:00:00');
        // Assume 18 weeks of summer (~126 days)
        const totalSummerDays = 126;
        const daysElapsed = Math.max(1, differenceInDays(today, summerStart) + 1);
        const daysRemaining = Math.max(0, totalSummerDays - daysElapsed);
        
        const expectedProgress = (rep.willDoGoal / totalSummerDays) * daysElapsed;
        const pacePercentage = expectedProgress > 0 ? (rep.currentFpPlus / expectedProgress) * 100 : 100;
        const dailyTarget = daysRemaining > 0 ? (rep.willDoGoal - rep.currentFpPlus) / daysRemaining : 0;
        
        let status: 'ahead' | 'on-track' | 'behind' | 'critical';
        if (pacePercentage >= 110) status = 'ahead';
        else if (pacePercentage >= 90) status = 'on-track';
        else if (pacePercentage >= 70) status = 'behind';
        else status = 'critical';
        
        return {
          userId: rep.userId,
          notionPageId: rep.notionPageId,
          name: rep.name,
          year: rep.year,
          currentFp: rep.currentFpPlus,
          willDoGoal: rep.willDoGoal,
          mustDoGoal: rep.mustDoGoal,
          couldDoGoal: rep.couldDoGoal,
          pacePercentage,
          dailyTarget: Math.max(0, dailyTarget),
          daysRemaining,
          status,
        };
      })
      .sort((a, b) => a.pacePercentage - b.pacePercentage); // Critical first
  }, [summerReps]);


  // Filter recruits by selected team if applicable
  const filteredRecruits = useMemo(() => {
    if (!selectedTeamFilter) return allRecruits;
    
    if (selectedTeamFilter.startsWith('team:')) {
      const teamId = selectedTeamFilter.replace('team:', '');
      return allRecruits.filter(r => r.teamId === teamId);
    } else if (selectedTeamFilter.startsWith('mgmt:')) {
      const mgmtId = selectedTeamFilter.replace('mgmt:', '');
      return allRecruits.filter(r => r.mgmtGroupId === mgmtId);
    }
    return allRecruits;
  }, [selectedTeamFilter, allRecruits]);

  // Filter activities to match filtered recruits
  const filteredActivities = useMemo(() => {
    if (!selectedTeamFilter) return activities;
    return activities.filter(a => filteredRecruits.some(r => r.notionPageId === a.rep_notion_page_id));
  }, [selectedTeamFilter, activities, filteredRecruits]);

  // Get active filter name for display
  const activeFilterName = useMemo(() => {
    if (!selectedTeamFilter) return null;
    if (selectedTeamFilter.startsWith('team:')) {
      const teamId = selectedTeamFilter.replace('team:', '');
      return teamAccess?.teams?.find(t => t.id === teamId)?.name || null;
    } else if (selectedTeamFilter.startsWith('mgmt:')) {
      const mgmtId = selectedTeamFilter.replace('mgmt:', '');
      return teamAccess?.mgmtGroups?.find(g => g.id === mgmtId)?.name || null;
    }
    return null;
  }, [selectedTeamFilter, teamAccess]);

  // Calculate recruit counts per team for the filter sheet
  const teamRecruitCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    
    teamAccess?.teams?.forEach(team => {
      counts[`team:${team.id}`] = allRecruits.filter(r => r.teamId === team.id).length;
    });
    
    teamAccess?.mgmtGroups?.forEach(group => {
      counts[`mgmt:${group.id}`] = allRecruits.filter(r => r.mgmtGroupId === group.id).length;
    });
    
    return counts;
  }, [allRecruits, teamAccess]);

  // Dismissed recruits for Today's Focus
  const { dismissedIds, dismissRecruit, undismissRecruit, isRecuitDismissed } = useDismissedRecruits();
  
  // Temporary skip system for "skip for now" and "skip today"
  const { skipForNow, skipToday, isSkipped } = useSkippedRecruits();

  // Calculate needs attention metrics for chips - use allBlitzesIncludingPast to properly detect past attendance
  const { categories, totalCount } = useNeedsAttention(
    filteredRecruits,
    filteredActivities,
    allBlitzesIncludingPast,
    repDataMap,
    repGoalsMap,
    repSummerConfigMap
  );

  // Add Goals & Pace category to attention chips if there are summer reps
  const categoriesWithSummer = useMemo(() => {
    if (goalsPaceData.length === 0) return categories;
    
    const behindCount = goalsPaceData.filter(r => r.status === 'behind' || r.status === 'critical').length;
    
    return [
      ...categories,
      {
        id: 'goals-pace',
        label: 'Goals & Pace',
        emoji: '📊',
        count: behindCount > 0 ? behindCount : goalsPaceData.length,
        recruits: [],
        priority: 85,
      },
    ].sort((a, b) => b.priority - a.priority);
  }, [categories, goalsPaceData]);

  // Get smart recommendations with blitz awareness, filtering out dismissed and skipped ones
  const rawRecommendations = useRecruitingRecommendations(
    filteredRecruits, 
    filteredActivities,
    allBlitzesIncludingPast,
    repDataMap
  );
  const recommendations = useMemo(() => {
    return rawRecommendations.filter(r => 
      !isRecuitDismissed(r.recruit.notionPageId) && !isSkipped(r.recruit.notionPageId)
    );
  }, [rawRecommendations, isRecuitDismissed, isSkipped]);

  // Hero card now uses the top recommendation (unified with recommendations list)
  const topRecommendation = recommendations[0] || null;

  // Calculate overdue scheduled items as highest-priority fallback
  const overdueScheduledFallback = useMemo<OverdueScheduledItem | null>(() => {
    // Only show if no top recommendation
    if (topRecommendation) return null;

    const today = startOfToday();
    
    // Get latest next action for each recruit
    const latestNextActions = new Map<string, typeof filteredActivities[0]>();
    filteredActivities.forEach(activity => {
      if (activity.next_action_due && activity.next_action) {
        const existing = latestNextActions.get(activity.rep_notion_page_id);
        if (!existing || parseISO(activity.created_at) > parseISO(existing.created_at)) {
          latestNextActions.set(activity.rep_notion_page_id, activity);
        }
      }
    });

    // Find the first overdue item (respecting skip/dismiss)
    const overdueItems: OverdueScheduledItem[] = [];
    latestNextActions.forEach((activity, recruitId) => {
      const dueDate = parseISO(activity.next_action_due!);
      if (isPast(dueDate) && !isDateToday(dueDate)) {
        const recruit = filteredRecruits.find(r => r.notionPageId === recruitId);
        if (recruit && 
            !isSkipped(recruit.notionPageId) && 
            !isRecuitDismissed(recruit.notionPageId)) {
          overdueItems.push({
            recruit,
            activity,
            daysOverdue: differenceInDays(today, dueDate),
          });
        }
      }
    });

    // Sort by most overdue first
    overdueItems.sort((a, b) => b.daysOverdue - a.daysOverdue);
    return overdueItems[0] || null;
  }, [topRecommendation, filteredActivities, filteredRecruits, isSkipped, isRecuitDismissed]);

  // Fallback: if no top recommendation AND no overdue, find the top priority from Needs Attention
  // (respecting skip functionality)
  const needsAttentionFallback = useMemo(() => {
    // Only show fallback if there's no top recommendation AND no overdue items
    if (topRecommendation || overdueScheduledFallback) return null;
    
    // Flatten all recruits from all categories and filter out skipped ones
    for (const category of categories) {
      for (const attentionRecruit of category.recruits) {
        if (!isSkipped(attentionRecruit.recruit.notionPageId) && 
            !isRecuitDismissed(attentionRecruit.recruit.notionPageId)) {
          return attentionRecruit;
        }
      }
    }
    return null;
  }, [topRecommendation, overdueScheduledFallback, categories, isSkipped, isRecuitDismissed]);

  // Get selected category for drawer
  const selectedCategory = useMemo(() => {
    if (!selectedCategoryId) return null;
    return categories.find(c => c.id === selectedCategoryId) || null;
  }, [selectedCategoryId, categories]);

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setAttentionDrawerOpen(true);
  };

  const handleRecruitClick = (recruit: Recruit) => {
    setSelectedRecruit(recruit);
  };

  // Handle contact from hero - opens contact method drawer
  const handleHeroContact = useCallback((recruit: Recruit) => {
    setContactingRecruit(recruit);
    setContactMethodDrawerOpen(true);
  }, []);

  // Handle schedule from hero - opens schedule drawer
  const handleHeroSchedule = useCallback((recruit: Recruit) => {
    setContactingRecruit(recruit);
    setScheduleDrawerOpen(true);
  }, []);

  // Handle completion from contact method drawer - only dismiss if connected
  const handleContactMethodComplete = useCallback((wasConnected: boolean) => {
    if (wasConnected && contactingRecruit) {
      // Connected - animate out and dismiss
      setHeroAnimatingOut(true);
      const recruit = contactingRecruit;
      setTimeout(() => {
        dismissRecruit(recruit.notionPageId);
        setLastDismissedRecruit({ notionPageId: recruit.notionPageId, name: recruit.name || 'Recruit' });
        setHeroAnimatingOut(false);
        setContactingRecruit(null);
        setUndoBannerMessage(`Contact logged for ${recruit.name || 'recruit'}`);
      }, 300);
    } else {
      // Not connected (no answer) - just close, keep card visible
      setContactingRecruit(null);
      setContactMethodDrawerOpen(false);
    }
  }, [contactingRecruit, dismissRecruit]);

  // Handle schedule completion - animate out and dismiss
  const handleScheduleComplete = useCallback(() => {
    if (contactingRecruit) {
      setHeroAnimatingOut(true);
      const recruit = contactingRecruit;
      setTimeout(() => {
        dismissRecruit(recruit.notionPageId);
        setLastDismissedRecruit({ notionPageId: recruit.notionPageId, name: recruit.name || 'Recruit' });
        setHeroAnimatingOut(false);
        setContactingRecruit(null);
        setUndoBannerMessage(`Follow-up scheduled for ${recruit.name || 'recruit'}`);
      }, 300);
    }
  }, [contactingRecruit, dismissRecruit]);

  // Handle undo from banner
  const handleUndoDismiss = useCallback(() => {
    if (lastDismissedRecruit) {
      undismissRecruit(lastDismissedRecruit.notionPageId);
      setLastDismissedRecruit(null);
    }
    setUndoBannerMessage(null);
  }, [lastDismissedRecruit, undismissRecruit]);

  const handleBannerDismiss = useCallback(() => {
    setUndoBannerMessage(null);
    setLastDismissedRecruit(null);
  }, []);

  // Handle dismissal from WeekPlannerSection recommendations
  const handleWeekPlannerDismiss = useCallback((recruit: Recruit, message: string) => {
    dismissRecruit(recruit.notionPageId);
    setLastDismissedRecruit({ notionPageId: recruit.notionPageId, name: recruit.name || 'Recruit' });
    setUndoBannerMessage(message);
  }, [dismissRecruit]);

  // State for newly created recruit pending detail drawer
  const [pendingNewRecruitId, setPendingNewRecruitId] = useState<string | null>(null);

  // Handle recruit created - wait for data refresh then open detail drawer (leaders only)
  const handleRecruitCreated = useCallback((notionPageId: string, name: string) => {
    if (!isLeader) return;
    // Store the pending recruit ID and wait for the query to refresh
    setPendingNewRecruitId(notionPageId);
  }, [isLeader]);

  // Effect to open detail drawer when newly created recruit appears in data
  useEffect(() => {
    if (!pendingNewRecruitId || !allRecruits.length) return;
    
    const newRecruit = allRecruits.find(r => r.notionPageId === pendingNewRecruitId);
    if (newRecruit) {
      // Found the newly created recruit, open detail drawer
      setSelectedRecruit(newRecruit);
      setPendingNewRecruitId(null);
    }
  }, [pendingNewRecruitId, allRecruits]);

  if (isLoading) {
    return (
      <Layout>
        <div className="p-4 space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  // Simplified header - just filter button for higher-level leaders
  const headerControls = (
    <div className="flex items-center gap-2">
      {activeFilterName && (
        <Badge 
          variant="secondary" 
          className="flex items-center gap-1 cursor-pointer hover:bg-secondary/80"
          onClick={() => setSelectedTeamFilter(null)}
        >
          {activeFilterName}
          <X className="h-3 w-3" />
        </Badge>
      )}
      {(teamAccess?.accessLevel === 'area_director' || teamAccess?.accessLevel === 'mgmt_group_lead') && (
        <Button 
          variant={selectedTeamFilter ? 'default' : 'ghost'} 
          size="icon" 
          onClick={() => setFilterSheetOpen(true)}
        >
          <Filter className="h-4 w-4" />
        </Button>
      )}
      {isLeader && (
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => setQuickViewOpen(true)}
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
      )}
    </div>
  );

  return (
    <Layout headerRightContent={headerControls}>
      <div className="p-4 space-y-5">
        {/* Leader View */}
        {isLeader ? (
          <>
            {/* Today's Focus Hero */}
            <TodaysFocusHero
              topRecommendation={topRecommendation}
              summerRecommendation={topSummerRecommendation}
              overdueScheduledFallback={overdueScheduledFallback}
              needsAttentionFallback={needsAttentionFallback}
              totalNeedsAttention={totalCount}
              onRecruitClick={handleRecruitClick}
              onSummerRepClick={(notionPageId) => {
                const recruit = allRecruits.find(r => r.notionPageId === notionPageId);
                if (recruit) setSelectedRecruit(recruit);
              }}
              onViewAll={() => setQuickViewOpen(true)}
              onContactClick={handleHeroContact}
              onScheduleClick={handleHeroSchedule}
              onSkipForNow={(recruit) => skipForNow(recruit.notionPageId)}
              onSkipToday={(recruit) => skipToday(recruit.notionPageId)}
              animatingOut={heroAnimatingOut}
            />

            {/* Undo Banner */}
            <AnimatePresence>
              {undoBannerMessage && (
                <UndoBanner
                  message={undoBannerMessage}
                  onUndo={handleUndoDismiss}
                  onDismiss={handleBannerDismiss}
                />
              )}
            </AnimatePresence>

            <NeedsAttentionChips
              categories={categoriesWithSummer}
              selectedCategory={selectedCategoryId}
              onCategoryClick={(catId) => {
                if (catId === 'goals-pace') {
                  setGoalsPaceDrawerOpen(true);
                } else {
                  handleCategoryClick(catId);
                }
              }}
              assignedTasksCount={assignedTasks.length}
              onAssignedTasksClick={() => setAssignedTasksDrawerOpen(true)}
            />

            {/* Week Planner Section - includes week overview, today's tasks, and recommendations */}
            {/* Pass recommendations starting from index 1 to avoid duplicating hero */}
            <WeekPlannerSection
              recruits={filteredRecruits}
              activities={filteredActivities}
              onRecruitClick={handleRecruitClick}
              blitzes={allBlitzesIncludingPast}
              repDataMap={repDataMap}
              dismissedIds={dismissedIds}
              onDismiss={handleWeekPlannerDismiss}
              recommendations={recommendations.slice(1)}
              onSkipForNow={(recruit) => skipForNow(recruit.notionPageId)}
              onSkipToday={(recruit) => skipToday(recruit.notionPageId)}
            />

            {/* Pending Suggestions */}
            {pendingSuggestions.length > 0 && (
              <PendingSuggestionsCard suggestions={pendingSuggestions} />
            )}

            {/* Upcoming Team Events */}
            <UpcomingTeamEventsCard />
          </>
        ) : (
          // Non-leader view: Show their suggestions list
          <div className="space-y-4">
            {mySuggestions && mySuggestions.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Your suggestions to your team leader
                </p>
                <div className="space-y-3">
                {mySuggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="bg-card rounded-xl p-4 border border-border"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{suggestion.name}</span>
                        <div className="flex items-center gap-2">
                          {suggestion.status === 'pending' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setEditingSuggestion(suggestion)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setDeletingSuggestionId(suggestion.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Pending
                              </Badge>
                            </>
                          )}
                          {suggestion.status === 'approved' && (
                            <div className="flex flex-col items-end gap-1">
                              <Badge className="bg-green-500 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> They're doing it!
                              </Badge>
                              <span className="text-xs text-muted-foreground">Help them practice & prepare!</span>
                            </div>
                          )}
                          {suggestion.status === 'rejected' && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <XCircle className="h-3 w-3" /> Not interested for now
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {suggestion.phone}
                      </p>
                      {suggestion.relationship && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {suggestion.relationship}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Submitted {format(parseISO(suggestion.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Know someone who'd be great?</p>
                <p className="text-sm mb-4">Suggest a recruit to your team leader</p>
                <Button onClick={() => setAddSheetOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Someone
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Add Button */}
      <FloatingAddButton 
        visible={(isLeader || (mySuggestions && mySuggestions.length > 0)) ?? false}
        onClick={() => setAddSheetOpen(true)}
      />

      {/* Drawers */}
      <AddRecruitDrawer open={addSheetOpen} onOpenChange={setAddSheetOpen} onRecruitCreated={handleRecruitCreated} />
      <EditSuggestionDrawer 
        open={!!editingSuggestion} 
        onOpenChange={(open) => !open && setEditingSuggestion(null)}
        suggestion={editingSuggestion}
      />
      <TeamFilterSheet 
        open={filterSheetOpen} 
        onOpenChange={setFilterSheetOpen}
        teams={teamAccess?.teams || []}
        mgmtGroups={teamAccess?.mgmtGroups || []}
        selectedFilter={selectedTeamFilter}
        onFilterChange={setSelectedTeamFilter}
        accessLevel={teamAccess?.accessLevel || 'none'}
        recruitCounts={teamRecruitCounts}
        totalRecruits={allRecruits.length}
      />
      <NeedsAttentionDrawer
        open={attentionDrawerOpen}
        onOpenChange={setAttentionDrawerOpen}
        category={selectedCategory}
        onRecruitClick={handleRecruitClick}
        blitzes={allBlitzes}
        repDataMap={repDataMap}
        currentUserNotionId={currentUserRep?.notion_page_id}
        currentUserName={currentUserRep?.name}
      />
      <QuickViewDrawer
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
        recruits={filteredRecruits}
        activities={filteredActivities}
      />
      <RecruitDetailDrawer
        open={!!selectedRecruit}
        onOpenChange={(open) => !open && setSelectedRecruit(null)}
        recruit={selectedRecruit}
        activities={filteredActivities.filter(a => a.rep_notion_page_id === selectedRecruit?.notionPageId)}
        onExitStage={(notionPageId) => {
          // Dismiss the recruit from hero/recommendations when moved to exit stage
          dismissRecruit(notionPageId);
          setLastDismissedRecruit({ notionPageId, name: selectedRecruit?.name || 'Recruit' });
          setSelectedRecruit(null);
        }}
      />
      <ContactMethodDrawer
        open={contactMethodDrawerOpen}
        onOpenChange={setContactMethodDrawerOpen}
        recruit={contactingRecruit}
        onComplete={handleContactMethodComplete}
        onScheduleLaterToday={() => {
          if (contactingRecruit) {
            const recruit = contactingRecruit;
            setContactMethodDrawerOpen(false);
            setTimeout(() => {
              setContactingRecruit(recruit);
              setScheduleDrawerOpen(true);
            }, 300);
          }
        }}
      />
      <ScheduleFollowUpDrawer
        open={scheduleDrawerOpen}
        onOpenChange={(open) => {
          setScheduleDrawerOpen(open);
          if (!open) {
            setContactingRecruit(null);
          }
        }}
        recruit={contactingRecruit}
        onComplete={handleScheduleComplete}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingSuggestionId} onOpenChange={(open) => !open && setDeletingSuggestionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete suggestion?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this recruit suggestion. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deletingSuggestionId) {
                  try {
                    await deleteMutation.mutateAsync(deletingSuggestionId);
                    toast.success('Suggestion deleted');
                  } catch {
                    toast.error('Failed to delete');
                  }
                  setDeletingSuggestionId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assigned Tasks Drawer */}
      <AssignedTasksDrawer
        open={assignedTasksDrawerOpen}
        onOpenChange={setAssignedTasksDrawerOpen}
        tasks={assignedTasks}
        onRecruitClick={(notionPageId) => {
          const recruit = allRecruits.find(r => r.notionPageId === notionPageId);
          if (recruit) handleRecruitClick(recruit);
        }}
      />

      {/* Goals & Pace Drawer */}
      <GoalsPaceDrawer
        open={goalsPaceDrawerOpen}
        onOpenChange={setGoalsPaceDrawerOpen}
        reps={goalsPaceData}
        onRepClick={(notionPageId) => {
          const recruit = allRecruits.find(r => r.notionPageId === notionPageId);
          if (recruit) {
            setGoalsPaceDrawerOpen(false);
            setSelectedRecruit(recruit);
          }
        }}
      />
    </Layout>
  );
};

export default MyGroup;
