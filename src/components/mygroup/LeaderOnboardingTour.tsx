import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X, ChevronRight } from "lucide-react";
import { usePageTour } from "@/hooks/usePageTour";

interface TourStep {
  target: string; // CSS selector or data attribute
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const LEADER_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="quick-view-org"]',
    title: "Your Org Structure",
    description: "Tap here to view your teams and groups. Review what's been set up and create anything that's missing.",
    position: 'bottom',
  },
  {
    target: '[data-tour="add-action"]',
    title: "Add & Invite",
    description: "Use this button to add recruits, create invite links, or invite sub-leaders to your downline.",
    position: 'top',
  },
];

export const LeaderOnboardingTour = () => {
  const { showTour, completeTour, skipTour } = usePageTour({ page: 'my-group' });
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  const step = LEADER_TOUR_STEPS[currentStep];
  const isLastStep = currentStep === LEADER_TOUR_STEPS.length - 1;

  // Position tooltip relative to target element
  useEffect(() => {
    if (!showTour || !step) return;

    const positionTooltip = () => {
      const el = document.querySelector(step.target);
      if (!el) {
        setTooltipPos(null);
        return;
      }

      const rect = el.getBoundingClientRect();
      const padding = 12;

      let top = 0;
      let left = rect.left + rect.width / 2;

      switch (step.position) {
        case 'bottom':
          top = rect.bottom + padding;
          break;
        case 'top':
          top = rect.top - padding - 120; // approximate tooltip height
          break;
        default:
          top = rect.bottom + padding;
      }

      // Clamp within viewport
      left = Math.max(20, Math.min(left, window.innerWidth - 20));
      top = Math.max(20, Math.min(top, window.innerHeight - 160));

      setTooltipPos({ top, left });

      // Highlight element
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    // Wait a tick for elements to render
    const timer = setTimeout(positionTooltip, 300);

    // Re-position on resize
    window.addEventListener('resize', positionTooltip);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', positionTooltip);
    };
  }, [showTour, step, currentStep]);

  const handleNext = () => {
    if (isLastStep) {
      completeTour();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  if (!showTour) return null;

  return (
    <AnimatePresence>
      {showTour && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/40"
            onClick={skipTour}
          />

          {/* Tooltip */}
          {tooltipPos && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="fixed z-[201] w-[280px] -translate-x-1/2"
              style={{ top: tooltipPos.top, left: tooltipPos.left }}
            >
              <div className="bg-card border border-border rounded-xl p-4 shadow-xl">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-sm text-foreground">{step?.title}</h3>
                  <button onClick={skipTour} className="text-muted-foreground hover:text-foreground -mt-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{step?.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {currentStep + 1} of {LEADER_TOUR_STEPS.length}
                  </span>
                  <Button size="sm" className="h-7 text-xs gap-1" onClick={handleNext}>
                    {isLastStep ? "Got it!" : "Next"}
                    {!isLastStep && <ChevronRight className="w-3 h-3" />}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
};
