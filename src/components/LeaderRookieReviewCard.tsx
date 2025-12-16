import { useEffect, useState } from "react";
import { ChevronRight, Clock, Check, X, Circle, Users } from "lucide-react";
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

// Define self-service items and leader-required items for each phase
const PHASE_ITEMS: Record<number, { 
  label: string; 
  selfServiceItems: { id: string; label: string }[];
  leaderItems: { label: string; description: string }[];
}> = {
  1: {
    label: "Onboard & Get Ready",
    selfServiceItems: [
      { id: "what-is-blitz", label: "Watched 'What is a Blitz?'" },
      { id: "how-pay-works", label: "Watched 'How You Get Paid'" },
      { id: "phase1-goals-why", label: "Reviewed Why" },
      { id: "phase1-goals-what", label: "Reviewed What" },
      { id: "phase1-goals-how", label: "Reviewed How" },
      { id: "phase1-goals-texted-leader", label: "Texted leader, waiting on goals call" }
    ],
    leaderItems: [
      { label: "Goals call completed", description: "Set Must Do, Will Do, Could Do FP+ targets together" },
      { label: "Blitz committed OR opted out", description: "Picked a blitz trip or confirmed no blitz available" }
    ]
  },
  2: {
    label: "Start Training",
    selfServiceItems: [
      { id: "phase2-product", label: "Studied product materials" },
      { id: "phase2-quiz-passed", label: "Passed product knowledge quiz" },
      { id: "phase2-upgrades", label: "Reviewed Upgrades 101" },
      { id: "phase2-takeover", label: "Reviewed Takeover Door Approach" },
      { id: "phase2-pitches-sent-waiting", label: "Sent pitches, waiting on feedback" }
    ],
    leaderItems: [
      { label: "Pitch feedback", description: "Review and provide feedback on their pitch recordings" }
    ]
  },
  3: {
    label: "Practice",
    selfServiceItems: [
      { id: "phase3-ipad-ready", label: "iPad setup reviewed" },
      { id: "phase3-why-written", label: "Wrote their personal 'Why'" },
      { id: "phase3-practice-scheduled", label: "Scheduled/completed 1-on-1 practice" }
    ],
    leaderItems: [
      { label: "1-on-1 pitch practice", description: "Complete practice session together" }
    ]
  },
  4: {
    label: "Saddle Up",
    selfServiceItems: [
      { id: "phase4-packing-done", label: "Reviewed packing list" },
      { id: "phase4-essentials-checked", label: "Self-reported equipment ready (iPad, Uniforms, ID)" },
      { id: "phase4-playbook-ready", label: "Reviewed 'When It Gets Tough' playbook" }
    ],
    leaderItems: [
      { label: "Final check-in", description: "Confirm they're ready for blitz" }
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
  const accessibleReps = teamAccess?.accessibleReps || [];

  useEffect(() => {
    if (!isLeader || accessibleReps.length === 0) {
      setLoading(false);
      return;
    }

    const fetchRookiesNeedingReview = async () => {
      try {
        const accessibleNotionIds = accessibleReps
          .map((r: any) => r.notion_page_id)
          .filter(Boolean);

        if (accessibleNotionIds.length === 0) {
          setLoading(false);
          return;
        }

        const { data: repsData } = await supabase
          .from('reps')
          .select('notion_page_id, name, year, watched_videos, ramp_phase_1_complete, ramp_phase_2_complete, ramp_phase_3_complete, ramp_phase_4_complete, committed_blitzes, user_id')
          .in('notion_page_id', accessibleNotionIds);

        const rookiesNeedingReview: RookieNeedingReview[] = [];

        (repsData || []).forEach((rep: any) => {
          // Only check rookies
          if (rep.year !== 'Rookie' && rep.year !== null && rep.year !== '2025' && rep.year !== '2026') return;

          const watchedVideos = Array.isArray(rep.watched_videos) ? rep.watched_videos : [];

          // Check Phase 1 self-service completion
          // Self-service: videos watched + goals reviewed (via sections or legacy) OR texted leader
          const phase1VideosDone = watchedVideos.includes("what-is-blitz") && watchedVideos.includes("how-pay-works");
          const phase1GoalsReviewed = (
            (watchedVideos.includes('phase1-goals-why') && watchedVideos.includes('phase1-goals-what') && watchedVideos.includes('phase1-goals-how')) ||
            watchedVideos.includes('phase1-goals-reviewed') ||
            watchedVideos.includes('phase1-goals-texted-leader')
          );
          const phase1SelfComplete = phase1VideosDone && phase1GoalsReviewed;
          
          if (phase1SelfComplete && !rep.ramp_phase_1_complete) {
            const completedItems = PHASE_ITEMS[1].selfServiceItems
              .filter(item => watchedVideos.includes(item.id))
              .map(item => item.label);
            
            rookiesNeedingReview.push({
              notionPageId: rep.notion_page_id,
              name: rep.name,
              currentPhase: 1,
              selfServiceComplete: true,
              completedItems
            });
            return;
          }

          // Check Phase 2 - include waiting on pitch feedback state
          if (rep.ramp_phase_1_complete) {
            const phase2SelfComplete = 
              watchedVideos.includes("phase2-product") &&
              watchedVideos.includes("phase2-quiz-passed") &&
              watchedVideos.includes("phase2-upgrades") &&
              watchedVideos.includes("phase2-takeover") &&
              (watchedVideos.includes("phase2-pitch-submitted") || watchedVideos.includes("phase2-pitches-sent-waiting"));
            
            if (phase2SelfComplete && !rep.ramp_phase_2_complete) {
              const completedItems = PHASE_ITEMS[2].selfServiceItems
                .filter(item => watchedVideos.includes(item.id))
                .map(item => item.label);
              
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
            const phase3SelfServiceIds = ["phase3-ipad-ready", "phase3-why-written", "phase3-practice-scheduled"];
            const phase3SelfComplete = phase3SelfServiceIds.every(id => watchedVideos.includes(id));
            
            if (phase3SelfComplete && !rep.ramp_phase_3_complete) {
              const completedItems = PHASE_ITEMS[3].selfServiceItems
                .filter(item => watchedVideos.includes(item.id))
                .map(item => item.label);
              
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
            const phase4SelfServiceIds = ["phase4-packing-done", "phase4-essentials-checked", "phase4-playbook-ready"];
            const phase4SelfComplete = phase4SelfServiceIds.every(id => watchedVideos.includes(id));
            
            if (phase4SelfComplete && !rep.ramp_phase_4_complete) {
              const completedItems = PHASE_ITEMS[4].selfServiceItems
                .filter(item => watchedVideos.includes(item.id))
                .map(item => item.label);
              
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

      setRookiesReady(prev => prev.filter(r => r.notionPageId !== selectedRookie.notionPageId));
      setSelectedRookie(null);

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
                  ? `${rookiesReady[0].name} completed Phase ${rookiesReady[0].currentPhase} self-service` 
                  : `${rookiesReady.length} rookies waiting for phase verification`}
              </p>
            </div>
            
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </div>

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
          
          <div className="p-4 space-y-5 overflow-y-auto">
            {/* Rookie Info */}
            <div className="text-center">
              <h3 className="text-lg font-semibold">{selectedRookie?.name}</h3>
              <p className="text-sm text-muted-foreground">
                {phaseInfo?.label}
              </p>
            </div>

            {/* Phase Overview */}
            <div className="space-y-4">
              {/* Self-Service Items (Completed by Rep) */}
              <div className="bg-emerald-500/5 rounded-xl p-4 border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    Rep completed on their own
                  </p>
                </div>
                <div className="space-y-2">
                  {phaseInfo?.selfServiceItems.map((item, idx) => {
                    const isCompleted = selectedRookie?.completedItems.includes(item.label);
                    return (
                      <div key={idx} className="flex items-start gap-2">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          isCompleted ? 'bg-emerald-500' : 'bg-muted'
                        }`}>
                          {isCompleted ? (
                            <Check className="h-3 w-3 text-white" />
                          ) : (
                            <Circle className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        <span className={`text-sm ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Leader-Required Items */}
              <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold text-primary">
                    You verify together
                  </p>
                </div>
                <div className="space-y-3">
                  {phaseInfo?.leaderItems.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="h-3 w-3 text-primary" />
                      </div>
                      <div>
                        <span className="text-sm font-medium">{item.label}</span>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Confirmation Note */}
            <p className="text-xs text-center text-muted-foreground px-4">
              By verifying, you confirm you've completed the leader items with {selectedRookie?.name} and they're ready to move on to {selectedRookie?.currentPhase === 4 ? 'Blitz!' : `Phase ${(selectedRookie?.currentPhase || 0) + 1}`}.
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
