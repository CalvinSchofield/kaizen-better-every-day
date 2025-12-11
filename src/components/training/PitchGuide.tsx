import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Eye, BookOpen, GraduationCap, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { useHeader } from "@/contexts/HeaderContext";

export interface PitchSection {
  id: number;
  title: string;
  emoji: string;
  script: string;
  stageTip?: string;
}

interface PitchGuideProps {
  sections: PitchSection[];
  pageTitle: string;
  onBack?: () => void;
}

export const PitchGuide = ({ sections, pageTitle, onBack }: PitchGuideProps) => {
  const [mode, setMode] = useState<"practice" | "reference">("practice");
  const [currentStep, setCurrentStep] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<number[]>([]);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');
  
  const { setCustomTitle, setCustomRightContent } = useHeader();

  const currentSection = sections[currentStep];

  const goNext = () => {
    if (currentStep < sections.length - 1) {
      setSlideDirection('left');
      setCurrentStep(currentStep + 1);
      setRevealed(false);
    }
  };

  const goPrev = () => {
    if (currentStep > 0) {
      setSlideDirection('right');
      setCurrentStep(currentStep - 1);
      setRevealed(false);
    }
  };

  const { onTouchStart, onTouchMove, onTouchEnd, swipeState } = useSwipeNavigation({
    onSwipeLeft: goNext,
    onSwipeRight: goPrev,
    threshold: 50,
  });

  const toggleSection = (id: number) => {
    setExpandedSections(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  // Set custom header when mounted, clear on unmount
  useEffect(() => {
    setCustomTitle(pageTitle);
    
    return () => {
      setCustomTitle(null);
      setCustomRightContent(null);
    };
  }, [pageTitle, setCustomTitle, setCustomRightContent]);

  // Update header right content with tabs whenever mode changes
  useEffect(() => {
    setCustomRightContent(
      <Tabs value={mode} onValueChange={(v) => setMode(v as "practice" | "reference")}>
        <TabsList className="h-8">
          <TabsTrigger value="practice" className="text-xs px-2 gap-1">
            <GraduationCap className="h-3.5 w-3.5" />
            Practice
          </TabsTrigger>
          <TabsTrigger value="reference" className="text-xs px-2 gap-1">
            <BookOpen className="h-3.5 w-3.5" />
            Reference
          </TabsTrigger>
        </TabsList>
      </Tabs>
    );
  }, [mode, setCustomRightContent]);

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      {/* Back button */}
      {onBack && (
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-2">
          <ChevronLeft className="h-4 w-4" />
          Back to Training
        </Button>
      )}

      {/* Practice Mode - Flashcard Stepper */}
      {mode === "practice" && (
        <div className="space-y-4">
          {/* Progress dots */}
          <div className="flex justify-center gap-2">
            {sections.map((_, idx) => (
              <button
                key={idx}
                onClick={() => { 
                  setSlideDirection(idx > currentStep ? 'left' : 'right');
                  setCurrentStep(idx); 
                  setRevealed(false); 
                }}
                className={cn(
                  "h-2 w-2 rounded-full transition-all",
                  idx === currentStep ? "bg-primary w-6" : "bg-muted-foreground/30"
                )}
              />
            ))}
          </div>

          {/* Card with swipe */}
          <div
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            className="relative touch-pan-y"
            style={{
              transform: swipeState.isSwiping ? `translateX(${swipeState.direction === 'left' ? -swipeState.offset : swipeState.offset}px)` : undefined,
              transition: swipeState.isSwiping ? 'none' : 'transform 0.2s ease-out',
            }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: slideDirection === 'left' ? 50 : -50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: slideDirection === 'left' ? -50 : 50 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    {/* Section header */}
                    <div className="bg-primary/10 p-4 border-b">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{currentSection.emoji}</span>
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">Step {currentSection.id} of {sections.length}</p>
                          <h3 className="font-semibold text-lg">{currentSection.title}</h3>
                        </div>
                      </div>
                    </div>

                    {/* Script content */}
                    <div className="p-4 space-y-4">
                      {!revealed ? (
                        <button
                          onClick={() => setRevealed(true)}
                          className="w-full min-h-[120px] border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                        >
                          <Eye className="h-8 w-8" />
                          <span className="font-medium">Tap to reveal script</span>
                          <span className="text-xs">Try to recall first!</span>
                        </button>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-4"
                        >
                          {/* Script - tap to hide */}
                          <button
                            onClick={() => setRevealed(false)}
                            className="w-full text-left"
                          >
                            <div className="bg-primary/5 rounded-lg p-4 border-l-4 border-primary hover:bg-primary/10 transition-colors">
                              <p className="text-base leading-relaxed whitespace-pre-line">
                                {currentSection.script}
                              </p>
                            </div>
                          </button>

                          {/* Stage tip */}
                          {currentSection.stageTip && (
                            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground italic">
                              <p className="font-medium text-foreground mb-1 not-italic text-xs uppercase tracking-wide">💡 Stage Direction</p>
                              {currentSection.stageTip}
                            </div>
                          )}

                          {/* Hide hint */}
                          <p className="text-center text-xs text-muted-foreground">
                            Tap script to hide
                          </p>
                        </motion.div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>

            {/* Swipe hint */}
            <p className="text-center text-xs text-muted-foreground mt-2">
              Swipe left/right to navigate
            </p>
          </div>

          {currentStep === sections.length - 1 && (
            <Button
              variant="secondary"
              onClick={() => { setCurrentStep(0); setRevealed(false); }}
              className="w-full"
            >
              Start over from the beginning
            </Button>
          )}
        </div>
      )}

      {/* Reference Mode - Accordion */}
      {mode === "reference" && (
        <div className="space-y-2">
          {sections.map((section) => (
            <Collapsible
              key={section.id}
              open={expandedSections.includes(section.id)}
              onOpenChange={() => toggleSection(section.id)}
            >
              <CollapsibleTrigger asChild>
                <button className="w-full">
                  <Card className={cn(
                    "transition-colors",
                    expandedSections.includes(section.id) && "border-primary/50"
                  )}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                        {section.id}
                      </div>
                      <span className="text-lg">{section.emoji}</span>
                      <span className="flex-1 text-left font-medium">{section.title}</span>
                      <ChevronRight className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        expandedSections.includes(section.id) && "rotate-90"
                      )} />
                    </CardContent>
                  </Card>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 py-3 space-y-3">
                  {/* Script */}
                  <div className="bg-primary/5 rounded-lg p-4 border-l-4 border-primary">
                    <p className="text-base leading-relaxed whitespace-pre-line">
                      {section.script}
                    </p>
                  </div>

                  {/* Stage tip */}
                  {section.stageTip && (
                    <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground italic">
                      <p className="font-medium text-foreground mb-1 not-italic text-xs uppercase tracking-wide">💡 Stage Direction</p>
                      {section.stageTip}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}

          {/* Expand/Collapse All */}
          <div className="flex justify-center pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (expandedSections.length === sections.length) {
                  setExpandedSections([]);
                } else {
                  setExpandedSections(sections.map(s => s.id));
                }
              }}
            >
              {expandedSections.length === sections.length ? "Collapse all" : "Expand all"}
            </Button>
          </div>
        </div>
      )}

      {/* Audio placeholder - always at bottom */}
      <Card className="bg-muted/30">
        <CardContent className="p-4 flex items-center gap-3 text-muted-foreground">
          <Volume2 className="h-5 w-5" />
          <div className="text-sm">
            <p className="font-medium">Audio recording coming soon</p>
            <p className="text-xs">Listen to the pitch delivered</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
