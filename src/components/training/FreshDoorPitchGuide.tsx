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

interface PitchSection {
  id: number;
  title: string;
  emoji: string;
  script: string;
  stageTip?: string;
}

const PITCH_SECTIONS: PitchSection[] = [
  {
    id: 1,
    title: "Break Preoccupation",
    emoji: "👋",
    script: "Hey sorry to bug ya. You must be the home owner? 😄",
    stageTip: "Knock the door, stand back about 6 feet and take note on Street Genie why you knocked what you saw. Lean back and be casual and calm."
  },
  {
    id: 2,
    title: "Who you are / who you're with",
    emoji: "🤝",
    script: "Okay I'll be super quick — I'm [Name] with Vivint. You've probably seen our orange signs or talked to one of us before right?\n\nAwesome! We do the doorbell cameras, cameras around the house, security on the inside with a bunch of your neighbors. Check this out.",
    stageTip: "Show the video of the Spotlight finding and following on fast pitch while talking about what it does. Show one real example after that. Then show the \"online all the time\" page on tiled."
  },
  {
    id: 3,
    title: "Show something",
    emoji: "📱",
    script: "Two reasons why everyone is loving these cameras:\n\nThe first is the cameras are super smart. Every other camera out there is designed to record crime, this one prevents it.\n\nThe second is these cameras are super reliable. The other cameras out there have to have the wifi to record, and without it you just see \"camera offline\", right? Our camera records even without the wifi, kind of like your phone. Because of that it actually records 24/7.",
    stageTip: "Show spotlight tracking and scaring video for first point. Show video of camera recording 24/7 for second point."
  },
  {
    id: 4,
    title: "Pullback and option close",
    emoji: "🎯",
    script: "Now obviously, this may not be a good fit — [insert objections here]…\n\nBut if you had to say, would it be more the cameras being smart and scaring away the bad guy or the cameras being more reliable and not depending on the wifi kind of like a phone that would be more important to you?\n\nMake sense — that's what everyone says. Why do you say that?",
    stageTip: "Physically step back for this step. Insert all common objections you're hearing in the area before the option closes to preempt them."
  },
  {
    id: 5,
    title: "Deal",
    emoji: "✨",
    script: "Well cool. Like I said it may not be for ya, but my job is super simple. When we come out here we cover all the upfront costs like install fees and all the equipment, we even give you a free doorbell. What's in it for us is we get another happy customer with a smile on their face if we earn it so you advertise us to your friends and family.\n\nSo I just want to give you two quotes — one is our normal price when you call in and the other is the price while we're out here bugging you, and it's obviously lower. If you like that lower price, great! But if not, no worries. I'll just move onto the next house. 😄"
  },
  {
    id: 6,
    title: "Transition",
    emoji: "🚶",
    script: "For that doorbell camera, do you know the model number on your chime box? That's okay, nobody does 😄. Let me take a quick peek. Do you want my shoes on or off?",
    stageTip: "Start wiping your feet down and head down, no eye contact. Don't wait to be invited inside; apply pressure to get invited. We call this assumptive body language and high confidence."
  }
];

interface FreshDoorPitchGuideProps {
  onBack?: () => void;
  pageTitle?: string;
}

export const FreshDoorPitchGuide = ({ onBack, pageTitle = "Fresh Pitch" }: FreshDoorPitchGuideProps) => {
  const [mode, setMode] = useState<"practice" | "reference">("practice");
  const [currentStep, setCurrentStep] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<number[]>([]);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');
  
  const { setCustomTitle, setCustomRightContent } = useHeader();

  const currentSection = PITCH_SECTIONS[currentStep];

  const goNext = () => {
    if (currentStep < PITCH_SECTIONS.length - 1) {
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
            {PITCH_SECTIONS.map((_, idx) => (
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
                          <p className="text-xs text-muted-foreground font-medium">Step {currentSection.id} of 6</p>
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

          {currentStep === PITCH_SECTIONS.length - 1 && (
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
          {PITCH_SECTIONS.map((section) => (
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
                if (expandedSections.length === PITCH_SECTIONS.length) {
                  setExpandedSections([]);
                } else {
                  setExpandedSections(PITCH_SECTIONS.map(s => s.id));
                }
              }}
            >
              {expandedSections.length === PITCH_SECTIONS.length ? "Collapse all" : "Expand all"}
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
