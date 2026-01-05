import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { hapticLight, hapticMedium, hapticSuccess } from '@/utils/haptics';

export interface TourStep {
  target: string; // data-tour attribute value
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'auto';
  action?: string; // Optional action to trigger when entering this step
  lightOverlay?: boolean; // Use lighter overlay for drawer/sheet content
}

interface PageTourProps {
  steps: TourStep[];
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
  onStepAction?: (action: string) => void; // Callback when a step has an action
}

interface SpotlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const PageTour = ({ steps, isOpen, onComplete, onSkip, onStepAction }: PageTourProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const [cardPosition, setCardPosition] = useState<'top' | 'bottom'>('bottom');
  const [cardOffset, setCardOffset] = useState(0); // Additional offset to avoid spotlight
  const containerRef = useRef<HTMLDivElement>(null);

  const step = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  // Calculate spotlight position
  const updateSpotlight = useCallback(() => {
    if (!step) return;

    const element = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!element) {
      setSpotlightRect(null);
      return;
    }

    const padding = 8;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const applyRect = (r: DOMRect) => {
      setSpotlightRect({
        x: r.left - padding,
        y: r.top - padding,
        width: r.width + padding * 2,
        height: r.height + padding * 2,
      });
      calculateCardPosition(r, viewportHeight);
    };

    const rect = element.getBoundingClientRect();

    // Scroll element into view if needed
    const needsScroll =
      rect.top < 100 ||
      rect.bottom > viewportHeight - 200 ||
      rect.left < 0 ||
      rect.right > viewportWidth;

    if (needsScroll) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

      // Recalculate after scroll settles (smooth scroll duration varies by device)
      window.setTimeout(() => applyRect(element.getBoundingClientRect()), 450);
      window.setTimeout(() => applyRect(element.getBoundingClientRect()), 900);
    } else {
      applyRect(rect);
    }
  }, [step]);

  const calculateCardPosition = (rect: DOMRect, viewportHeight: number) => {
    // Determine card position based on step config or available space
    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;
    const cardHeight = 200; // Approximate card height
    const safeMargin = 24;
    const bottomNavHeight = 100; // Account for bottom nav + safe area

    if (step?.position === 'top') {
      // Card should appear ABOVE the spotlight element
      setCardPosition('top');
      setCardOffset(0);
    } else if (step?.position === 'bottom') {
      // Card should appear BELOW the spotlight element
      // Calculate where the card should sit (just below the element)
      const desiredCardTop = rect.bottom + safeMargin;
      const availableSpaceBelow = viewportHeight - desiredCardTop - bottomNavHeight;
      
      if (availableSpaceBelow >= cardHeight) {
        // Enough space below element - position card there
        // We use 'bottom' positioning from viewport bottom, so calculate offset
        const cardBottomOffset = viewportHeight - desiredCardTop - cardHeight;
        setCardPosition('bottom');
        setCardOffset(Math.max(0, cardBottomOffset - 32)); // 32 is base bottom offset
      } else {
        // Not enough space below - place at bottom of screen
        setCardPosition('bottom');
        setCardOffset(0);
      }
    } else {
      // Auto: place card where there's more space, with offset if needed
      if (spaceBelow > spaceAbove && spaceBelow > cardHeight + safeMargin + bottomNavHeight) {
        setCardPosition('bottom');
        setCardOffset(0);
      } else if (spaceAbove > cardHeight + safeMargin) {
        setCardPosition('top');
        setCardOffset(0);
      } else {
        // Default to bottom with no offset
        setCardPosition('bottom');
        setCardOffset(0);
      }
    }
  };

  useLayoutEffect(() => {
    if (!isOpen) return;

    updateSpotlight();

    let recalcTimer: number | undefined;

    // Trigger step action if present (e.g., open a drawer/collapsible), then recalc spotlight
    if (step?.action && onStepAction) {
      onStepAction(step.action);
      recalcTimer = window.setTimeout(() => updateSpotlight(), 450);
    }

    return () => {
      if (recalcTimer) window.clearTimeout(recalcTimer);
    };
  }, [isOpen, currentStep, updateSpotlight, step?.action, onStepAction]);

  // Recalculate on resize
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => updateSpotlight();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, updateSpotlight]);

  // Handle swipe navigation
  const handleDragEnd = (_: any, info: PanInfo) => {
    const threshold = 50;
    
    if (info.offset.x < -threshold && !isLastStep) {
      handleNext();
    } else if (info.offset.x > threshold && !isFirstStep) {
      handlePrev();
    }
  };

  const handleNext = () => {
    hapticLight();
    if (isLastStep) {
      hapticSuccess();
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    hapticLight();
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    hapticMedium();
    onSkip();
  };

  // Reset step when closing
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Use lighter overlay for drawer/sheet focused steps
  const overlayOpacity = step?.lightOverlay ? '0.4' : 'var(--tour-overlay-opacity)';

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        className="fixed inset-0 z-[100]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* SVG Mask for spotlight effect */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <mask
              id="spotlight-mask"
              maskUnits="userSpaceOnUse"
              maskContentUnits="userSpaceOnUse"
              x="0"
              y="0"
              width="100%"
              height="100%"
            >
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {spotlightRect && (
                <motion.rect
                  x={spotlightRect.x}
                  y={spotlightRect.y}
                  width={spotlightRect.width}
                  height={spotlightRect.height}
                  rx="12"
                  fill="black"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                />
              )}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill={`hsl(var(--tour-overlay) / ${overlayOpacity})`}
            mask="url(#spotlight-mask)"
          />
        </svg>

        {/* Interaction blocker - but let the card buttons work */}
        <div 
          className="absolute inset-0" 
          aria-hidden="true"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        />

        {/* Spotlight border glow */}
        {spotlightRect && (
          <motion.div
            className="absolute rounded-xl border-2 border-primary/50 pointer-events-none"
            style={{
              left: spotlightRect.x,
              top: spotlightRect.y,
              width: spotlightRect.width,
              height: spotlightRect.height,
            }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          />
        )}

        {/* Skip button */}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleSkip();
          }}
          className="absolute top-4 right-4 p-2 rounded-full bg-background/20 backdrop-blur-sm text-white/80 hover:text-white transition-colors z-[102] pointer-events-auto"
          style={{ paddingTop: 'calc(0.5rem + var(--effective-safe-area-top, 0px))' }}
        >
          <X className="h-5 w-5" />
        </button>

        {/* Tour card - positioned to avoid spotlight */}
        <motion.div
          className={`absolute left-4 right-4 z-[101] pointer-events-auto ${
            cardPosition === 'bottom' ? '' : ''
          }`}
          style={{
            bottom: cardPosition === 'bottom' ? `calc(${32 + cardOffset}px + env(safe-area-inset-bottom, 0px))` : 'auto',
            top: cardPosition === 'top' ? `calc(${80 + cardOffset}px + var(--effective-safe-area-top, 0px))` : 'auto',
          }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          initial={{ y: cardPosition === 'bottom' ? 100 : -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: cardPosition === 'bottom' ? 100 : -100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          <div 
            className="bg-card rounded-2xl shadow-2xl border border-border/50 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* Progress indicator */}
            <div className="flex justify-center gap-1.5 pt-4 pb-2">
              {steps.map((_, idx) => (
                <motion.div
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentStep 
                      ? 'w-6 bg-primary' 
                      : idx < currentStep 
                        ? 'w-1.5 bg-primary/50' 
                        : 'w-1.5 bg-muted-foreground/30'
                  }`}
                />
              ))}
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                className="px-6 py-4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {step?.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {step?.description}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex items-center justify-between px-4 pb-4">
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrev();
                }}
                disabled={isFirstStep}
                className={`p-3 rounded-xl transition-all ${
                  isFirstStep
                    ? 'opacity-0 pointer-events-none'
                    : 'bg-muted hover:bg-muted/80 active:scale-95'
                }`}
              >
                <ChevronLeft className="h-5 w-5 text-foreground" />
              </button>

              <span className="text-xs text-muted-foreground">
                {currentStep + 1} of {steps.length}
              </span>

              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                className="p-3 rounded-xl bg-primary hover:bg-primary/90 active:scale-95 transition-all"
              >
                {isLastStep ? (
                  <span className="text-primary-foreground font-medium px-2">Got it</span>
                ) : (
                  <ChevronRight className="h-5 w-5 text-primary-foreground" />
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
