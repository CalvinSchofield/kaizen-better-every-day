import { useEffect, useState } from "react";
import { ChevronRight, Clock, Check, X, Circle, Users, ClipboardCheck, GraduationCap, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useRepData } from "@/hooks/useRepData";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { OnboardingVerificationDrawer, ONBOARDING_STEPS, OnboardingStepType } from "@/components/mygroup/OnboardingVerificationDrawer";

interface RookieNeedingReview {
  id: string;
  name: string;
  currentPhase: number | null; // null for onboarding steps
  onboardingStep: OnboardingStepType | null; // for pre-ramp steps
  selfServiceComplete: boolean;
  selfReported: boolean;
  completedItems: string[];
}

// Define self-service items and leader-required items for each ramp phase
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
  const { repData: viewerRepData } = useRepData();
  const [rookiesReady, setRookiesReady] = useState<RookieNeedingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRookie, setSelectedRookie] = useState<RookieNeedingReview | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLeader = teamAccess?.accessLevel && teamAccess.accessLevel !== 'none';
  const accessibleReps = teamAccess?.accessibleReps || [];
  
  // Exclude rookies from seeing this card (even if they have recruited someone)
  const isViewerRookie = viewerRepData?.year === 'Rookie' || viewerRepData?.year === '2025' || viewerRepData?.year === '2026';

  useEffect(() => {
    if (!isLeader || isViewerRookie || accessibleReps.length === 0) {
      setLoading(false);
      return;
    }

    const fetchRookiesNeedingReview = async () => {
      try {
        const accessibleIds = accessibleReps
          .map((r: any) => r.id)
          .filter(Boolean);

        if (accessibleIds.length === 0) {
          setLoading(false);
          return;
        }

        const { data: repsData } = await supabase
          .from('reps')
          .select('id, name, year, watched_videos, onboarding_complete, trainings_complete, slack_joined, ramp_phase_1_complete, ramp_phase_2_complete, ramp_phase_3_complete, ramp_phase_4_complete, committed_blitzes, user_id, self_reported_onboarding_complete, self_reported_trainings_complete, self_reported_slack_joined')
          .in('id', accessibleIds);

        const rookiesNeedingReview: RookieNeedingReview[] = [];

        (repsData || []).forEach((rep: any) => {
          // Only check rookies
          if (rep.year !== 'Rookie' && rep.year !== null && rep.year !== '2025' && rep.year !== '2026') return;

          const watchedVideos = Array.isArray(rep.watched_videos) ? rep.watched_videos : [];

          // Check PRE-RAMP onboarding steps first (these come before Phase 1)
          // ONLY show rookies who have SELF-REPORTED completion and are awaiting verification
          
          // Step 1: Basic Onboarding - must be self-reported to appear
          if (rep.self_reported_onboarding_complete && !rep.onboarding_complete) {
            rookiesNeedingReview.push({
              id: rep.id,
              name: rep.name,
              currentPhase: null,
              onboardingStep: 'onboarding',
              selfServiceComplete: true,
              selfReported: true,
              completedItems: ['Completed Vivint onboarding portal']
            });
            return;
          }

          // Step 2: Required Trainings - must be self-reported to appear
          if (rep.onboarding_complete && rep.self_reported_trainings_complete && !rep.trainings_complete) {
            rookiesNeedingReview.push({
              id: rep.id,
              name: rep.name,
              currentPhase: null,
              onboardingStep: 'trainings',
              selfServiceComplete: true,
              selfReported: true,
              completedItems: ['Passed all required training modules']
            });
            return;
          }

          // Step 3: Join Slack - must be self-reported to appear
          if (rep.onboarding_complete && rep.trainings_complete && rep.self_reported_slack_joined && !rep.slack_joined) {
            rookiesNeedingReview.push({
              id: rep.id,
              name: rep.name,
              currentPhase: null,
              onboardingStep: 'slack',
              selfServiceComplete: true,
              selfReported: true,
              completedItems: ['Joined Slack and posted intro']
            });
            return;
          }

          // Now check RAMP PHASES (after all pre-ramp steps are verified)
          if (!rep.onboarding_complete || !rep.trainings_complete || !rep.slack_joined) {
            return; // Still in pre-ramp onboarding
          }

          // Check Phase 1 self-service completion
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
              id: rep.id,
              name: rep.name,
              currentPhase: 1,
              onboardingStep: null,
              selfServiceComplete: true,
              selfReported: false,
              completedItems
            });
            return;
          }

          // Check Phase 2
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
                id: rep.id,
                name: rep.name,
                currentPhase: 2,
                onboardingStep: null,
                selfServiceComplete: true,
                selfReported: false,
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
                id: rep.id,
                name: rep.name,
                currentPhase: 3,
                onboardingStep: null,
                selfServiceComplete: true,
                selfReported: false,
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
                id: rep.id,
                name: rep.name,
                currentPhase: 4,
                onboardingStep: null,
                selfServiceComplete: true,
                selfReported: false,
                completedItems
              });
            }
          }
        });

        // Sort: onboarding steps first (earlier in journey), then by phase
        rookiesNeedingReview.sort((a, b) => {
          if (a.onboardingStep && !b.onboardingStep) return -1;
          if (!a.onboardingStep && b.onboardingStep) return 1;
          if (a.onboardingStep && b.onboardingStep) {
            const order = ['onboarding', 'trainings', 'slack'];
            return order.indexOf(a.onboardingStep) - order.indexOf(b.onboardingStep);
          }
          return (a.currentPhase || 0) - (b.currentPhase || 0);
        });

        setRookiesReady(rookiesNeedingReview);
      } catch (error) {
        console.error('Error fetching rookies needing review:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRookiesNeedingReview();
  }, [isLeader, isViewerRookie, accessibleReps]);

  const handleConfirmPhase = async () => {
    if (!selectedRookie) return;
    
    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const body: Record<string, any> = { rookieId: selectedRookie.id };
      
      if (selectedRookie.onboardingStep) {
        // Leader verification for onboarding steps
        if (selectedRookie.onboardingStep === 'onboarding') {
          body.onboardingComplete = true;
        } else if (selectedRookie.onboardingStep === 'trainings') {
          body.trainingsComplete = true;
        } else if (selectedRookie.onboardingStep === 'slack') {
          body.slackJoined = true;
        }
      } else if (selectedRookie.currentPhase) {
        // Ramp phase verification
        body[`rampPhase${selectedRookie.currentPhase}Complete`] = true;
      }

      const { error } = await supabase.functions.invoke('update-rookie-status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body
      });

      if (error) throw error;

      const stepLabel = selectedRookie.onboardingStep 
        ? ONBOARDING_STEPS[selectedRookie.onboardingStep].label
        : `Phase ${selectedRookie.currentPhase}`;
      
      toast.success(`${stepLabel} verified for ${selectedRookie.name}!`);

      setRookiesReady(prev => prev.filter(r => r.id !== selectedRookie.id));
      setSelectedRookie(null);

      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
      queryClient.invalidateQueries({ queryKey: ['rep-data'] });
      queryClient.invalidateQueries({ queryKey: ['recruits-rep-data'] });
    } catch (error: any) {
      console.error('Error confirming step:', error);
      toast.error('Failed to verify step', {
        description: error.message || 'Please try again'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLeader || isViewerRookie || loading || rookiesReady.length === 0) {
    return null;
  }

  // Count breakdown for badge
  const onboardingCount = rookiesReady.filter(r => r.onboardingStep).length;
  const phaseCount = rookiesReady.filter(r => r.currentPhase).length;
  
  const phaseInfo = selectedRookie?.currentPhase ? PHASE_ITEMS[selectedRookie.currentPhase] : null;

  const getStepIcon = (step: OnboardingStepType | null) => {
    if (!step) return Clock;
    const icons = { onboarding: ClipboardCheck, trainings: GraduationCap, slack: MessageSquare };
    return icons[step];
  };

  const getStepLabel = (rookie: RookieNeedingReview) => {
    if (rookie.onboardingStep) {
      return ONBOARDING_STEPS[rookie.onboardingStep].label;
    }
    return `Phase ${rookie.currentPhase}`;
  };

  return (
    <>
      <Card 
        className="home-card-spacing bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30 cursor-pointer hover:shadow-md transition-all"
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
                  ? `${rookiesReady[0].name} completed ${getStepLabel(rookiesReady[0])}` 
                  : onboardingCount > 0 && phaseCount > 0
                    ? `${onboardingCount} onboarding, ${phaseCount} ramp phases`
                    : `${rookiesReady.length} rookies waiting for verification`}
              </p>
            </div>
            
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </div>

          {rookiesReady.length > 1 && (
            <div className="mt-3 pt-3 border-t border-amber-500/20 space-y-2">
              {rookiesReady.map((rookie) => {
                const StepIcon = getStepIcon(rookie.onboardingStep);
                return (
                  <button
                    key={rookie.id}
                    className="flex items-center justify-between w-full text-left px-3 py-2 rounded-lg hover:bg-amber-500/10 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRookie(rookie);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <StepIcon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{rookie.name}</span>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${rookie.onboardingStep ? 'border-blue-500/50 text-blue-600' : ''}`}
                    >
                      {getStepLabel(rookie)}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Onboarding Step Verification Drawer */}
      {selectedRookie?.onboardingStep && (
        <OnboardingVerificationDrawer
          open={!!selectedRookie?.onboardingStep}
          onOpenChange={(open) => !open && setSelectedRookie(null)}
          recruitName={selectedRookie.name}
          step={selectedRookie.onboardingStep}
          selfReported={selectedRookie.selfReported}
          isSubmitting={isSubmitting}
          onConfirm={handleConfirmPhase}
        />
      )}

      {/* Ramp Phase Verification Drawer */}
      {selectedRookie?.currentPhase && (
        <Drawer open={!!selectedRookie?.currentPhase} onOpenChange={(open) => !open && setSelectedRookie(null)}>
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
      )}
    </>
  );
};
