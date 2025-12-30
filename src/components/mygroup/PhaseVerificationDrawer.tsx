import { Check, Circle, Users, X, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

// Define self-service items and leader-required items for each phase
export const PHASE_ITEMS: Record<number, { 
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

interface PhaseVerificationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recruitName: string;
  phase: number;
  isSubmitting: boolean;
  hasError?: boolean;
  onConfirm: () => void;
  mode?: 'verify' | 'undo';
  onUndo?: () => void;
  watchedVideos?: string[];
  goalsSetupComplete?: boolean;
  hasCommittedBlitz?: boolean;
}

export const PhaseVerificationDrawer = ({
  open,
  onOpenChange,
  recruitName,
  phase,
  isSubmitting,
  hasError = false,
  onConfirm,
  mode = 'verify',
  onUndo,
  watchedVideos = [],
  goalsSetupComplete = false,
  hasCommittedBlitz = false,
}: PhaseVerificationDrawerProps) => {
  const phaseInfo = PHASE_ITEMS[phase];
  const isUndoMode = mode === 'undo';

  // Check if an item is completed based on its ID
  const isItemComplete = (itemId: string): boolean => {
    // Special cases for Phase 1 leader items
    if (itemId === 'goals-call-completed') return goalsSetupComplete;
    if (itemId === 'blitz-committed') return hasCommittedBlitz;
    
    // For regular video/watched items
    return watchedVideos.includes(itemId);
  };

  // Calculate completion counts for display
  const completedSelfServiceCount = phaseInfo?.selfServiceItems.filter(item => isItemComplete(item.id)).length || 0;
  const totalSelfServiceCount = phaseInfo?.selfServiceItems.length || 0;

  if (!phaseInfo) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader className="border-b border-border pb-4">
          <DrawerTitle className="text-center">
            {isUndoMode ? `Phase ${phase} Complete` : `Verify Phase ${phase}`}
          </DrawerTitle>
        </DrawerHeader>
        
        <div className="p-4 space-y-5 overflow-y-auto">
          {/* Rookie Info */}
          <div className="text-center">
            <h3 className="text-lg font-semibold">{recruitName}</h3>
            <p className="text-sm text-muted-foreground">
              {phaseInfo.label}
            </p>
          </div>

          {/* Phase Overview */}
          <div className="space-y-4">
            {/* Self-Service Items */}
            <div className={`rounded-xl p-4 border ${isUndoMode ? 'bg-green-500/10 border-green-500/30' : 'bg-muted/50 border-border'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Check className={`w-4 h-4 ${isUndoMode ? 'text-green-600' : 'text-muted-foreground'}`} />
                  <p className={`text-sm font-semibold ${isUndoMode ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'}`}>
                    {isUndoMode ? 'Rep completed' : 'Rep should have completed'}
                  </p>
                </div>
                {!isUndoMode && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    completedSelfServiceCount === totalSelfServiceCount 
                      ? 'bg-green-500/20 text-green-700 dark:text-green-400' 
                      : 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                  }`}>
                    {completedSelfServiceCount}/{totalSelfServiceCount}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {phaseInfo.selfServiceItems.map((item, idx) => {
                  const completed = isUndoMode ? true : isItemComplete(item.id);
                  return (
                    <div key={idx} className="flex items-start gap-2">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        completed ? 'bg-green-500/20' : 'bg-muted'
                      }`}>
                        {completed ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Circle className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                      <span className={`text-sm ${completed ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Leader-Required Items */}
            <div className={`rounded-xl p-4 border ${isUndoMode ? 'bg-green-500/10 border-green-500/30' : 'bg-primary/5 border-primary/20'}`}>
              <div className="flex items-center gap-2 mb-3">
                <Users className={`w-4 h-4 ${isUndoMode ? 'text-green-600' : 'text-primary'}`} />
                <p className={`text-sm font-semibold ${isUndoMode ? 'text-green-700 dark:text-green-400' : 'text-primary'}`}>
                  {isUndoMode ? 'Verified together' : 'You verify together'}
                </p>
              </div>
              <div className="space-y-3">
                {phaseInfo.leaderItems.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isUndoMode ? 'bg-green-500/20' : 'bg-primary/20'}`}>
                      <Check className={`h-3 w-3 ${isUndoMode ? 'text-green-600' : 'text-primary'}`} />
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

          {/* Error State */}
          {hasError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">
                {isUndoMode ? 'Failed to undo phase.' : 'Failed to verify phase.'} Check your connection and try again.
              </p>
            </div>
          )}

          {/* Confirmation Note */}
          {isUndoMode ? (
            <p className="text-xs text-center text-muted-foreground px-4">
              This phase was marked complete. If needed, you can undo this to reset {recruitName} back to Phase {phase}.
            </p>
          ) : (
            <p className="text-xs text-center text-muted-foreground px-4">
              By verifying, you confirm you've completed the leader items with {recruitName} and they're ready to move on to {phase === 4 ? 'Blitz!' : `Phase ${phase + 1}`}.
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              <X className="h-4 w-4 mr-2" />
              {isUndoMode ? 'Close' : 'Cancel'}
            </Button>
            {isUndoMode ? (
              <Button
                variant="destructive"
                className="flex-1"
                onClick={onUndo}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Undoing...' : 'Undo Phase'}
              </Button>
            ) : (
              <Button
                className={`flex-1 ${hasError ? 'bg-primary hover:bg-primary/90' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                onClick={onConfirm}
                disabled={isSubmitting}
              >
                {hasError ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {isSubmitting ? 'Retrying...' : 'Retry'}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    {isSubmitting ? 'Verifying...' : 'Verify Phase'}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
