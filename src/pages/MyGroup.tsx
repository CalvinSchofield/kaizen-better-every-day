import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useGroupRecruits, useMySuggestions, useDeleteMySuggestion, RecruitSuggestion, Recruit } from "@/hooks/useGroupRecruits";
import { useBlitzes } from "@/hooks/useBlitzes";
import { useBlitzAttendanceLogger } from "@/hooks/useBlitzAttendanceLogger";
import { useNeedsAttention, RepData } from "@/hooks/useNeedsAttention";
import { useDismissedRecruits } from "@/hooks/useDismissedRecruits";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Filter, X, Clock, CheckCircle2, XCircle, Pencil, Trash2, LayoutGrid } from "lucide-react";
import { TodaysFocusHero } from "@/components/mygroup/TodaysFocusHero";
import { NeedsAttentionChips } from "@/components/mygroup/NeedsAttentionChips";
import { NeedsAttentionDrawer } from "@/components/mygroup/NeedsAttentionDrawer";
import { QuickViewDrawer } from "@/components/mygroup/QuickViewDrawer";
import { RecruitDetailDrawer } from "@/components/mygroup/RecruitDetailDrawer";
import { RecommendationsSection } from "@/components/mygroup/RecommendationsSection";
import { PostContactDrawer } from "@/components/mygroup/PostContactDrawer";
import { useRecruitingRecommendations } from "@/hooks/useRecruitingRecommendations";
import UpcomingTeamEventsCard from "@/components/mygroup/UpcomingTeamEventsCard";
import { AddRecruitDrawer } from "@/components/mygroup/AddRecruitDrawer";
import { PendingSuggestionsCard } from "@/components/mygroup/PendingSuggestionsCard";
import { TeamFilterSheet } from "@/components/mygroup/TeamFilterSheet";
import { EditSuggestionDrawer } from "@/components/mygroup/EditSuggestionDrawer";
import { Skeleton } from "@/components/ui/skeleton";
import Layout from "@/components/Layout";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
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

const MyGroup = () => {
  const { data: teamAccess, isLoading: accessLoading } = useTeamAccess();
  const { data: groupData, isLoading: recruitsLoading, isLeader } = useGroupRecruits();
  const { data: mySuggestions, isLoading: suggestionsLoading } = useMySuggestions();
  const deleteMutation = useDeleteMySuggestion();
  const { allBlitzes } = useBlitzes();
  
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
  
  // Post-contact drawer state
  const [postContactDrawerOpen, setPostContactDrawerOpen] = useState(false);
  const [contactingRecruit, setContactingRecruit] = useState<Recruit | null>(null);
  const [contactMethod, setContactMethod] = useState<'call' | 'text' | 'in_person'>('call');
  const [heroAnimatingOut, setHeroAnimatingOut] = useState(false);

  // Auto-log blitz attendance for recently ended blitzes (leaders only)
  useBlitzAttendanceLogger(allBlitzes, isLeader);

  const isLoading = accessLoading || (isLeader ? recruitsLoading : suggestionsLoading);

  const allRecruits = groupData?.recruits || [];
  const pendingSuggestions = groupData?.pendingSuggestions || [];
  const activities = groupData?.activities || [];

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
    staleTime: 1000 * 60 * 2,
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
        .select('user_id, training_hours_goal, training_hours_progress, books_goal, books_progress, role_plays_goal, role_plays_progress, monday_night_lights_goal, monday_night_lights_progress, blitzes_goal, blitzes_progress')
        .in('user_id', recruitUserIds);
      
      return data || [];
    },
    enabled: recruitUserIds.length > 0 && isLeader,
    staleTime: 1000 * 60 * 2,
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
  const { dismissRecruit, isRecuitDismissed } = useDismissedRecruits();

  // Calculate needs attention metrics
  const { categories, topPriority: rawTopPriority, totalCount } = useNeedsAttention(
    filteredRecruits,
    filteredActivities,
    allBlitzes,
    repDataMap,
    repGoalsMap
  );

  // Filter out dismissed recruits from top priority
  const topPriority = useMemo(() => {
    if (!rawTopPriority) return null;
    if (isRecuitDismissed(rawTopPriority.recruit.notionPageId)) {
      // Find next non-dismissed priority from categories
      for (const category of categories) {
        const nextPriority = category.recruits.find(r => !isRecuitDismissed(r.recruit.notionPageId));
        if (nextPriority) return nextPriority;
      }
      return null;
    }
    return rawTopPriority;
  }, [rawTopPriority, categories, isRecuitDismissed]);

  // Get smart recommendations, filtering out dismissed ones
  const rawRecommendations = useRecruitingRecommendations(filteredRecruits, filteredActivities);
  const recommendations = useMemo(() => {
    return rawRecommendations.filter(r => !isRecuitDismissed(r.recruit.notionPageId));
  }, [rawRecommendations, isRecuitDismissed]);

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

  // Handle call/text from hero - opens drawer after initiating contact
  const handleHeroCall = useCallback((recruit: Recruit) => {
    setContactingRecruit(recruit);
    setContactMethod('call');
    // Small delay to let phone app open first
    setTimeout(() => setPostContactDrawerOpen(true), 500);
  }, []);

  const handleHeroText = useCallback((recruit: Recruit) => {
    setContactingRecruit(recruit);
    setContactMethod('text');
    // Small delay to let SMS app open first
    setTimeout(() => setPostContactDrawerOpen(true), 500);
  }, []);

  // Handle post-contact completion - animate out and dismiss
  const handleContactComplete = useCallback(() => {
    if (contactingRecruit) {
      // Animate the hero card out
      setHeroAnimatingOut(true);
      // After animation, dismiss and reset
      setTimeout(() => {
        dismissRecruit(contactingRecruit.notionPageId);
        setHeroAnimatingOut(false);
        setContactingRecruit(null);
      }, 300);
    }
  }, [contactingRecruit, dismissRecruit]);

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
              topPriority={topPriority}
              totalNeedsAttention={totalCount}
              onRecruitClick={handleRecruitClick}
              onViewAll={() => setQuickViewOpen(true)}
              onCallClick={handleHeroCall}
              onTextClick={handleHeroText}
              animatingOut={heroAnimatingOut}
            />

            {/* Needs Attention Chips */}
            <NeedsAttentionChips
              categories={categories}
              selectedCategory={selectedCategoryId}
              onCategoryClick={handleCategoryClick}
            />

            {/* Smart Recommendations */}
            {recommendations.length > 0 && (
              <RecommendationsSection
                recommendations={recommendations}
                onRecruitClick={handleRecruitClick}
                maxItems={4}
              />
            )}

            {/* Pending Suggestions */}
            {pendingSuggestions.length > 0 && (
              <PendingSuggestionsCard suggestions={pendingSuggestions} />
            )}

            {/* Upcoming Team Events */}
            <UpcomingTeamEventsCard />

            {/* Quick Stats Summary */}
            <div className="bg-card rounded-xl p-4 border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Recruits</p>
                  <p className="text-2xl font-semibold">{filteredRecruits.length}</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setQuickViewOpen(true)}
                >
                  View All
                </Button>
              </div>
            </div>
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
      {(isLeader || (mySuggestions && mySuggestions.length > 0)) && (
        <Button
          className="fixed right-4 h-14 w-14 rounded-full shadow-lg z-40"
          style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom) + 1.5rem)' }}
          onClick={() => setAddSheetOpen(true)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

      {/* Drawers */}
      <AddRecruitDrawer open={addSheetOpen} onOpenChange={setAddSheetOpen} />
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
      />
      <PostContactDrawer
        open={postContactDrawerOpen}
        onOpenChange={setPostContactDrawerOpen}
        recruit={contactingRecruit}
        contactMethod={contactMethod}
        onComplete={handleContactComplete}
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
    </Layout>
  );
};

export default MyGroup;
