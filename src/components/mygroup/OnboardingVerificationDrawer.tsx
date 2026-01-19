import { Check, X, ExternalLink, ClipboardCheck, GraduationCap, MessageSquare, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

// Define onboarding steps with verification instructions
export const ONBOARDING_STEPS = {
  onboarding: {
    label: "Basic Onboarding",
    icon: ClipboardCheck,
    selfServiceLabel: "Completed Vivint onboarding portal",
    verificationTitle: "How to verify:",
    verificationInstructions: "Check Pipeline to confirm they appear in the system with all documents complete (I-9, W-4, background check, etc.)",
    externalLink: null, // Pipeline link if available
    externalLinkLabel: null,
    dbSelfReportField: "self_reported_onboarding_complete",
    dbCompleteField: "onboarding_complete"
  },
  trainings: {
    label: "Required Trainings",
    icon: GraduationCap,
    selfServiceLabel: "Passed all required training modules",
    verificationTitle: "How to verify:",
    verificationInstructions: "Ask the rookie to send you a screenshot of the Conveyour Training Portal showing all required trainings marked complete with green checkmarks.",
    externalLink: null,
    externalLinkLabel: null,
    dbSelfReportField: "self_reported_trainings_complete",
    dbCompleteField: "trainings_complete"
  },
  slack: {
    label: "Join Slack",
    icon: MessageSquare,
    selfServiceLabel: "Joined Slack and posted intro",
    verificationTitle: "How to verify:",
    verificationInstructions: "Open the team Slack channel and verify they've joined and posted their introduction message sharing who they are and why they're excited.",
    externalLink: "https://kaizen-better-daily.slack.com",
    externalLinkLabel: "Open Slack",
    dbSelfReportField: "self_reported_slack_joined",
    dbCompleteField: "slack_joined"
  }
} as const;

export type OnboardingStepType = keyof typeof ONBOARDING_STEPS;

interface OnboardingVerificationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recruitName: string;
  step: OnboardingStepType;
  selfReported: boolean;
  isSubmitting: boolean;
  onConfirm: () => void;
}

export const OnboardingVerificationDrawer = ({
  open,
  onOpenChange,
  recruitName,
  step,
  selfReported,
  isSubmitting,
  onConfirm
}: OnboardingVerificationDrawerProps) => {
  const stepInfo = ONBOARDING_STEPS[step];
  const StepIcon = stepInfo.icon;

  const openExternalLink = () => {
    if (stepInfo.externalLink) {
      window.open(stepInfo.externalLink, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader className="border-b border-border pb-4">
          <DrawerTitle className="text-center">
            Verify {stepInfo.label}
          </DrawerTitle>
        </DrawerHeader>
        
        <div className="p-4 space-y-5 overflow-y-auto">
          {/* Recruit Info */}
          <div className="text-center">
            <h3 className="text-lg font-semibold">{recruitName}</h3>
            <p className="text-sm text-muted-foreground">
              {stepInfo.label}
            </p>
          </div>

          {/* What the rookie has done */}
          <div className="bg-emerald-500/5 rounded-xl p-4 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-3">
              {selfReported ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Clock className="w-4 h-4 text-amber-600" />
              )}
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                {selfReported ? "Rookie marked complete:" : "Rookie should have completed:"}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                selfReported ? 'bg-emerald-500' : 'bg-muted'
              }`}>
                {selfReported ? (
                  <Check className="h-3 w-3 text-white" />
                ) : (
                  <StepIcon className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
              <span className={`text-sm ${selfReported ? 'text-foreground' : 'text-muted-foreground'}`}>
                {stepInfo.selfServiceLabel}
              </span>
            </div>
          </div>

          {/* How leader should verify */}
          <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-xl border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 mb-2">
              <ExternalLink className="w-4 h-4 text-amber-700 dark:text-amber-400" />
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                {stepInfo.verificationTitle}
              </p>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {stepInfo.verificationInstructions}
            </p>
            
            {stepInfo.externalLink && stepInfo.externalLinkLabel && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={openExternalLink}
                className="w-full"
              >
                <ExternalLink className="w-3 h-3 mr-2" />
                {stepInfo.externalLinkLabel}
              </Button>
            )}
          </div>

          {/* Confirmation Note */}
          <p className="text-xs text-center text-muted-foreground px-4">
            By verifying, you confirm you've checked that {recruitName} has completed {stepInfo.label.toLowerCase()} and is ready to move on.
          </p>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              onClick={onConfirm}
              disabled={isSubmitting}
            >
              <Check className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Verifying...' : 'Confirm Verified'}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
