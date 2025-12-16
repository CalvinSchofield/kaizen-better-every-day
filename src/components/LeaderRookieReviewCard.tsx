import { useEffect, useState } from "react";
import { ChevronRight, Clock, Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface RookieNeedingReview {
  notionPageId: string;
  name: string;
  currentPhase: number;
  selfServiceComplete: boolean;
  completedItems: string[];
}

// Define self-service items for each phase
const PHASE_ITEMS: Record<number, { label: string; items: string[] }> = {
  1: {
    label: "Onboard & Get Ready",
    items: [
      "Watched intro videos (What is Blitz, How Pay Works)",
      "Completed Goals Setup with leader call",
      "Committed to a blitz trip"
    ]
  },
  2: {
    label: "Start Training",
    items: [
      "Studied product materials",
      "Passed product quiz",
      "Reviewed Upgrades 101",
      "Reviewed Takeover Door Approach",
      "Submitted pitch recording"
    ]
  },
  3: {
    label: "Practice",
    items: [
      "iPad setup reviewed",
      "Wrote their 'Why'",
      "Scheduled 1-on-1 practice"
    ]
  },
  4: {
    label: "Saddle Up",
    items: [
      "Reviewed packing list",
      "Self-reported equipment (iPad, Uniforms, ID Badge)",
      "Reviewed 'When It Gets Tough' playbook"
    ]
  }
};

export const LeaderRookieReviewCard = () => {
  const queryClient = useQueryClient();
  const { data: teamAccess } = useTeamAccess();
  const [rookiesReady, setRookiesReady] = useState<RookieNeedingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRookie, setSelectedRookie] = useState<RookieNeedingReview | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLeader = teamAccess?.accessLevel && teamAccess.accessLevel !== 'none';
  // Get all accessible reps from full hierarchy (Team Lead → MGMT → Area Director)
  const accessibleReps = teamAccess?.accessibleReps || [];

  useEffect(() => {
    if (!isLeader || accessibleReps.length === 0) {
      setLoading(false);
      return;
    }

    const fetchRookiesNeedingReview = async () => {
      try {
        // Get notion page IDs from accessible reps (includes full upline hierarchy)
        const accessibleNotionIds = accessibleReps
          .map((r: any) => r.notion_page_id)
          .filter(Boolean);

        if (accessibleNotionIds.length === 0) {
          setLoading(false);
          return;
        }

        // Get all rookie rep data to check self-service completion
        const { data: repsData } = await supabase
          .from('reps')
          .select('notion_page_id, name, year, watched_videos, ramp_phase_1_complete, ramp_phase_2_complete, ramp_phase_3_complete, ramp_phase_4_complete, committed_blitzes, user_id')
          .in('notion_page_id', accessibleNotionIds);

        // Get goals data for setup_complete check
        const userIds = (repsData || []).map(r => r.user_id).filter(Boolean);
        const { data: goalsData } = userIds.length > 0 
          ? await supabase
              .from('rep_goals')
              .select('user_id, setup_complete')
              .in('user_id', userIds)
          : { data: [] };

        const goalsMap = new Map((goalsData || []).map(g => [g.user_id, g.setup_complete]));

        const rookiesNeedingReview: RookieNeedingReview[] = [];

        (repsData || []).forEach((rep: any) => {
          // Only check rookies (year is 'Rookie' or null for new reps)
          if (rep.year !== 'Rookie' && rep.year !== null) return;

          const watchedVideos = Array.isArray(rep.watched_videos) ? rep.watched_videos : [];
          const goalsSetupComplete = rep.user_id ? goalsMap.get(rep.user_id) === true : false;
          const hasCommittedBlitz = Array.isArray(rep.committed_blitzes) && rep.committed_blitzes.length > 0;

          // Check Phase 1 self-service completion
          const phase1VideosWatched = ["what-is-blitz", "how-pay-works"].every(id => watchedVideos.includes(id));
          const phase1SelfComplete = phase1VideosWatched && goalsSetupComplete && hasCommittedBlitz;
          
          if (phase1SelfComplete && !rep.ramp_phase_1_complete) {
            const completedItems: string[] = [];
            if (phase1VideosWatched) completedItems.push("Watched intro videos (What is Blitz, How Pay Works)");
            if (goalsSetupComplete) completedItems.push("Completed Goals Setup with leader call");
            if (hasCommittedBlitz) completedItems.push("Committed to a blitz trip");
            
            rookiesNeedingReview.push({
              notionPageId: rep.notion_page_id,
              name: rep.name,
              currentPhase: 1,
              selfServiceComplete: true,
              completedItems
            });
            return;
          }

          // Check Phase 2
          if (rep.ramp_phase_1_complete) {
            const phase2Items = [
              { id: "phase2-product", label: "Studied product materials" },
              { id: "phase2-quiz-passed", label: "Passed product quiz" },
              { id: "phase2-upgrades", label: "Reviewed Upgrades 101" },
              { id: "phase2-takeover", label: "Reviewed Takeover Door Approach" },
              { id: "phase2-pitch-submitted", label: "Submitted pitch recording" }
            ];
            
            const completedItems = phase2Items
              .filter(item => watchedVideos.includes(item.id))
              .map(item => item.label);
            
            const phase2Complete = phase2Items.every(item => watchedVideos.includes(item.id));
            
            if (phase2Complete && !rep.ramp_phase_2_complete) {
              rookiesNeedingReview.push({
                notionPageId: rep.notion_page_id,
                name: rep.name,
                currentPhase: 2,
                selfServiceComplete: true,
                completedItems
              });
              return;
            }
          }

          // Check Phase 3
          if (rep.ramp_phase_2_complete) {
            const phase3Items = [
              { id: "phase3-ipad-ready", label: "iPad setup reviewed" },
              { id: "phase3-why-written", label: "Wrote their 'Why'" },
              { id: "phase3-practice-scheduled", label: "Scheduled 1-on-1 practice" }
            ];
            
            const completedItems = phase3Items
              .filter(item => watchedVideos.includes(item.id))
              .map(item => item.label);
            
            const phase3Complete = phase3Items.every(item => watchedVideos.includes(item.id));
            
            if (phase3Complete && !rep.ramp_phase_3_complete) {
              rookiesNeedingReview.push({
                notionPageId: rep.notion_page_id,
                name: rep.name,
                currentPhase: 3,
                selfServiceComplete: true,
                completedItems
              });
              return;
            }
          }

          // Check Phase 4
          if (rep.ramp_phase_3_complete) {
            const phase4Items = [
              { id: "phase4-packing-done", label: "Reviewed packing list" },
              { id: "phase4-essentials-checked", label: "Self-reported equipment (iPad, Uniforms, ID Badge)" },
              { id: "phase4-playbook-ready", label: "Reviewed 'When It Gets Tough' playbook" }
            ];
            
            const completedItems = phase4Items
              .filter(item => watchedVideos.includes(item.id))
              .map(item => item.label);
            
            const phase4Complete = phase4Items.every(item => watchedVideos.includes(item.id));
            
            if (phase4Complete && !rep.ramp_phase_4_complete) {
              rookiesNeedingReview.push({
                notionPageId: rep.notion_page_id,
                name: rep.name,
                currentPhase: 4,
                selfServiceComplete: true,
                completedItems
              });
            }
          }
        });

        setRookiesReady(rookiesNeedingReview);
      } catch (error) {
        console.error('Error fetching rookies needing review:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRookiesNeedingReview();
  }, [isLeader, accessibleReps]);

  const handleConfirmPhase = async () => {
    if (!selectedRookie) return;
    
    setIsSubmitting(true);
    try {
      const phaseParams: Record<string, boolean> = {};
      phaseParams[`rampPhase${selectedRookie.currentPhase}Complete`] = true;

      const { error } = await supabase.functions.invoke('update-rookie-status', {
        body: {
          rookieNotionPageId: selectedRookie.notionPageId,
          ...phaseParams
        }
      });

      if (error) throw error;

      toast.success(`Phase ${selectedRookie.currentPhase} verified for ${selectedRookie.name}!`, {
        description: "Notion and database updated"
      });

      // Remove from local list
      setRookiesReady(prev => prev.filter(r => r.notionPageId !== selectedRookie.notionPageId));
      setSelectedRookie(null);

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
      queryClient.invalidateQueries({ queryKey: ['rep-data'] });
    } catch (error: any) {
      console.error('Error confirming phase:', error);
      toast.error('Failed to verify phase', {
        description: error.message || 'Please try again'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLeader || loading || rookiesReady.length === 0) {
    return null;
  }

  const phaseInfo = selectedRookie ? PHASE_ITEMS[selectedRookie.currentPhase] : null;

  return (
    <>
      <Card 
        className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30 cursor-pointer hover:shadow-md transition-all"
        onClick={() => setSelectedRookie(rookiesReady[0])}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold text-foreground">Rookies Ready for Review</p>
                <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-0">
                  {rookiesReady.length}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {rookiesReady.length === 1 
                  ? `${rookiesReady[0].name} completed Phase ${rookiesReady[0].currentPhase}` 
                  : `${rookiesReady.length} rookies waiting for phase verification`}
              </p>
            </div>
            
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </div>

          {/* Show all rookies if more than one */}
          {rookiesReady.length > 1 && (
            <div className="mt-3 pt-3 border-t border-amber-500/20 space-y-2">
              {rookiesReady.map((rookie) => (
                <button
                  key={rookie.notionPageId}
                  className="flex items-center justify-between w-full text-left px-3 py-2 rounded-lg hover:bg-amber-500/10 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRookie(rookie);
                  }}
                >
                  <span className="text-sm font-medium">{rookie.name}</span>
                  <Badge variant="outline" className="text-xs">
                    Phase {rookie.currentPhase}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phase Verification Drawer */}
      <Drawer open={!!selectedRookie} onOpenChange={(open) => !open && setSelectedRookie(null)}>
        <DrawerContent className="max-h-[90dvh]">
          <DrawerHeader className="border-b border-border pb-4">
            <DrawerTitle className="text-center">
              Verify Phase {selectedRookie?.currentPhase}
            </DrawerTitle>
          </DrawerHeader>
          
          <div className="p-4 space-y-4 overflow-y-auto">
            {/* Rookie Info */}
            <div className="text-center">
              <h3 className="text-lg font-semibold">{selectedRookie?.name}</h3>
              <p className="text-sm text-muted-foreground">
                {phaseInfo?.label}
              </p>
            </div>

            {/* Completed Items Checklist */}
            <div className="bg-muted/50 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                Completed self-service items:
              </p>
              <div className="space-y-2">
                {selectedRookie?.completedItems.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Confirmation Note */}
            <p className="text-xs text-center text-muted-foreground">
              By verifying, you confirm {selectedRookie?.name} has completed all Phase {selectedRookie?.currentPhase} requirements. This will update Notion and unlock the next phase.
            </p>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setSelectedRookie(null)}
                disabled={isSubmitting}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={handleConfirmPhase}
                disabled={isSubmitting}
              >
                <Check className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Verifying...' : 'Verify Phase'}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};
