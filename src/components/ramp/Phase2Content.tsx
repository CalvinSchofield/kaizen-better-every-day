import { useState, useEffect } from "react";
import { CheckCircle2, Circle, BookOpen, GraduationCap, MessageSquare, Play, ExternalLink, ChevronDown, ChevronUp, Video } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { RepData } from "@/hooks/useRepData";

interface Phase2ContentProps {
  repData: RepData | null;
  isComplete: boolean;
  onOpenPitchGuide: (guide: "takeover" | "upgrade") => void;
}

interface ProductLink {
  title: string;
  href: string;
}

const PRODUCT_KNOWLEDGE_LINKS: ProductLink[] = [
  { title: "Vivint App", href: "https://thehub.nrg.com/esc?id=microsite&topic_id=4db5a381976b269050e0b0121153afbc&in_context=true" },
  { title: "Doorbell Camera", href: "https://thehub.nrg.com/esc?id=microsite&topic_id=fd976b45976b269050e0b0121153afce&&in_context=true" },
  { title: "Outdoor Camera Pro", href: "https://thehub.nrg.com/esc?id=microsite&topic_id=d2f7c8a897b8b6104599b09ad053afff&&in_context=true" },
  { title: "Indoor Camera Pro", href: "https://thehub.nrg.com/esc?id=microsite&topic_id=bed76385976b269050e0b0121153afe4&in_context=true" },
  { title: "24/7 Playback", href: "https://thehub.nrg.com/esc?id=microsite&topic_id=fde76385976b269050e0b0121153afc0&&in_context=true" },
  { title: "Smart Lock", href: "https://thehub.nrg.com/esc?id=microsite&topic_id=e6362bc1976b269050e0b0121153afb6&in_context=true" },
  { title: "Smart Thermostat", href: "https://thehub.nrg.com/esc?id=microsite&topic_id=9e466fc1976b269050e0b0121153afe2&&in_context=true" },
];

const PRODUCT_QUIZ_URL = "https://docs.google.com/forms/d/e/1FAIpQLSc9CiA33lB2VXYz9RAGv1IPp1bjn9ypbZ9xMVa1bJ3huHwhSg/viewform";

export const Phase2Content = ({ repData, isComplete, onOpenPitchGuide }: Phase2ContentProps) => {
  const [expandedSection, setExpandedSection] = useState<string | null>("product");
  const [productStudied, setProductStudied] = useState(false);
  const [quizPassed, setQuizPassed] = useState(false);
  const [upgradesStudied, setUpgradesStudied] = useState(false);
  const [takeoverStudied, setTakeoverStudied] = useState(false);
  const [pitchSubmitted, setPitchSubmitted] = useState(false);

  // Load progress from watched_videos
  useEffect(() => {
    if (repData?.watched_videos && Array.isArray(repData.watched_videos)) {
      const watched = repData.watched_videos as string[];
      setProductStudied(watched.includes('phase2-product'));
      setQuizPassed(watched.includes('phase2-quiz-passed'));
      setUpgradesStudied(watched.includes('phase2-upgrades'));
      setTakeoverStudied(watched.includes('phase2-takeover'));
      setPitchSubmitted(watched.includes('phase2-pitch-submitted'));
    }
  }, [repData?.watched_videos]);

  const saveProgress = async (itemId: string) => {
    if (!repData?.user_id) return;
    
    const currentWatched = Array.isArray(repData.watched_videos) ? repData.watched_videos as string[] : [];
    if (!currentWatched.includes(itemId)) {
      const newWatched = [...currentWatched, itemId];
      const { error } = await supabase
        .from('reps')
        .update({ watched_videos: newWatched })
        .eq('user_id', repData.user_id);
      
      if (error) {
        console.error('Failed to save progress:', error);
      }
    }
  };

  const handleMarkProductStudied = async () => {
    setProductStudied(true);
    await saveProgress('phase2-product');
    toast({
      title: "Product knowledge complete!",
      description: "Now take the quiz to test your knowledge",
    });
  };

  const handleQuizComplete = async () => {
    setQuizPassed(true);
    await saveProgress('phase2-quiz-passed');
    toast({
      title: "Quiz passed! 🎉",
      description: "Great job! You've demonstrated your product knowledge",
    });
  };

  const handleUpgradesStudied = async () => {
    setUpgradesStudied(true);
    await saveProgress('phase2-upgrades');
    toast({
      title: "Upgrades 101 complete!",
      description: "You now know how to pitch upgrades",
    });
  };

  const handleTakeoverStudied = async () => {
    setTakeoverStudied(true);
    await saveProgress('phase2-takeover');
    toast({
      title: "Takeover approach complete!",
      description: "Ready to handle existing system homes",
    });
  };

  const handleTextLeaderForPitch = () => {
    if (!repData?.team_leader_phone) {
      toast({
        title: "No leader phone found",
        description: "Contact your recruiter to get connected with your leader",
        variant: "destructive",
      });
      return;
    }

    const cleanPhone = repData.team_leader_phone.replace(/\D/g, '');
    const message = encodeURIComponent(
      "Hey! I've studied the product and practiced my pitches. I'm ready to record my pitch video for feedback. What's the best way to send it to you?"
    );
    
    window.location.href = `sms:${cleanPhone}?body=${message}`;
  };

  const completedSteps = [
    productStudied,
    quizPassed,
    upgradesStudied,
    takeoverStudied,
    pitchSubmitted,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6 pb-20">
      {/* Phase Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">Start Trainings</h3>
          <p className="text-sm text-muted-foreground">
            Learn the product and master your pitch
          </p>
        </div>
        {isComplete ? (
          <Badge className="bg-primary/10 text-primary border-primary/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Complete
          </Badge>
        ) : (
          <Badge variant="outline">
            {completedSteps}/5 done
          </Badge>
        )}
      </div>

      {/* Step 1: Product Knowledge */}
      <TrainingSection
        id="product"
        title="Study the Product"
        icon={<BookOpen className="w-4 h-4" />}
        description="Learn about Vivint's smart home products"
        isComplete={productStudied}
        isExpanded={expandedSection === "product"}
        onToggle={() => setExpandedSection(expandedSection === "product" ? null : "product")}
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Review each product to understand features, benefits, and how to explain them to customers.
          </p>
          
          <div className="grid gap-2">
            {PRODUCT_KNOWLEDGE_LINKS.map((link) => (
              <a
                key={link.title}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
              >
                <span className="font-medium text-sm group-hover:text-primary transition-colors">{link.title}</span>
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </a>
            ))}
          </div>

          {!productStudied && (
            <Button 
              className="w-full mt-3"
              onClick={handleMarkProductStudied}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              I've Studied the Products
            </Button>
          )}
        </div>
      </TrainingSection>

      {/* Step 2: Product Quiz */}
      <TrainingSection
        id="quiz"
        title="Product Knowledge Quiz"
        icon={<GraduationCap className="w-4 h-4" />}
        description="Test your knowledge (70% to pass)"
        isComplete={quizPassed}
        isLocked={!productStudied}
        isExpanded={expandedSection === "quiz"}
        onToggle={() => setExpandedSection(expandedSection === "quiz" ? null : "quiz")}
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Take this quiz to verify your product knowledge. You need 70% or higher to pass. You can retake it as many times as needed.
          </p>
          
          <a
            href={PRODUCT_QUIZ_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 p-4 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors"
          >
            <GraduationCap className="w-5 h-5 text-primary" />
            <span className="font-medium text-primary">Take Product Quiz</span>
            <ExternalLink className="w-4 h-4 text-primary" />
          </a>

          {!quizPassed && (
            <Button 
              variant="outline"
              className="w-full"
              onClick={handleQuizComplete}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              I Passed the Quiz (70%+)
            </Button>
          )}
          
          <p className="text-xs text-muted-foreground text-center">
            Honor system - mark complete when you've passed with 70% or higher
          </p>
        </div>
      </TrainingSection>

      {/* Step 3: Upgrades 101 */}
      <TrainingSection
        id="upgrades"
        title="Upgrades 101"
        icon={<Play className="w-4 h-4" />}
        description="Master the upgrade pitch approach"
        isComplete={upgradesStudied}
        isLocked={!quizPassed}
        isExpanded={expandedSection === "upgrades"}
        onToggle={() => setExpandedSection(expandedSection === "upgrades" ? null : "upgrades")}
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Learn how to approach homes with existing systems and pitch upgrades effectively.
          </p>
          
          <Button 
            variant="outline"
            className="w-full justify-between"
            onClick={() => onOpenPitchGuide("upgrade")}
          >
            <span className="flex items-center gap-2">
              <Play className="w-4 h-4" />
              Open Upgrade Pitch Guide
            </span>
            <ExternalLink className="w-4 h-4" />
          </Button>

          <a
            href="https://calvinschofield.notion.site/Upgrades-101-f027467a0a5e405a853abdc26e92401e"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
          >
            <span className="font-medium text-sm group-hover:text-primary transition-colors">Full Upgrades 101 Guide</span>
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </a>

          {!upgradesStudied && (
            <Button 
              className="w-full"
              onClick={handleUpgradesStudied}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              I've Studied Upgrades
            </Button>
          )}
        </div>
      </TrainingSection>

      {/* Step 4: Takeover Door Approach */}
      <TrainingSection
        id="takeover"
        title="Takeover Door Approach"
        icon={<Play className="w-4 h-4" />}
        description="Handle existing system homes"
        isComplete={takeoverStudied}
        isLocked={!upgradesStudied}
        isExpanded={expandedSection === "takeover"}
        onToggle={() => setExpandedSection(expandedSection === "takeover" ? null : "takeover")}
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Learn the takeover approach for homes that already have a security system.
          </p>
          
          <Button 
            variant="outline"
            className="w-full justify-between"
            onClick={() => onOpenPitchGuide("takeover")}
          >
            <span className="flex items-center gap-2">
              <Play className="w-4 h-4" />
              Open Takeover Pitch Guide
            </span>
            <ExternalLink className="w-4 h-4" />
          </Button>

          <a
            href="https://calvinschofield.notion.site/Takeover-Door-Approach-18c070fe3bc2800bad33c0818f0f0489"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
          >
            <span className="font-medium text-sm group-hover:text-primary transition-colors">Full Takeover Guide</span>
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </a>

          {!takeoverStudied && (
            <Button 
              className="w-full"
              onClick={handleTakeoverStudied}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              I've Studied Takeover
            </Button>
          )}
        </div>
      </TrainingSection>

      {/* Step 5: Pitch Submission */}
      <TrainingSection
        id="pitch"
        title="Submit Your Pitch"
        icon={<Video className="w-4 h-4" />}
        description="Record and get feedback from your leader"
        isComplete={pitchSubmitted}
        isLocked={!takeoverStudied}
        requiresLeader
        isExpanded={expandedSection === "pitch"}
        onToggle={() => setExpandedSection(expandedSection === "pitch" ? null : "pitch")}
      >
        <div className="space-y-3">
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <h5 className="font-medium text-sm">How to submit your pitch:</h5>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li>Record yourself doing the Fresh Door pitch (1-2 minutes)</li>
              <li>Send the video to your leader via text</li>
              <li>Get feedback and make improvements</li>
              <li>Once approved, mark this complete</li>
            </ol>
          </div>

          <a
            href="https://calvinschofield.notion.site/Pitch-Feedback-Instructions-03901d3e606b4aa29fbc5f5b20de8a8e"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
          >
            <span className="font-medium text-sm group-hover:text-primary transition-colors">Pitch Feedback Instructions</span>
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </a>

          <Button 
            className="w-full"
            onClick={handleTextLeaderForPitch}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Text Leader to Submit Pitch
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Your leader will mark this complete after reviewing your pitch
          </p>
        </div>
      </TrainingSection>
    </div>
  );
};

interface TrainingSectionProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  isComplete: boolean;
  isLocked?: boolean;
  requiresLeader?: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const TrainingSection = ({
  id,
  title,
  icon,
  description,
  isComplete,
  isLocked,
  requiresLeader,
  isExpanded,
  onToggle,
  children,
}: TrainingSectionProps) => {
  return (
    <Card className={cn(
      "transition-all duration-200 overflow-hidden",
      isComplete && "bg-primary/5 border-primary/20",
      isLocked && "opacity-50"
    )}>
      <Collapsible open={isExpanded && !isLocked} onOpenChange={isLocked ? undefined : onToggle}>
        <CollapsibleTrigger asChild disabled={isLocked}>
          <CardContent className={cn("p-4", !isLocked && "cursor-pointer")}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {isComplete ? (
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground/50" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-primary">{icon}</span>
                  <h4 className={cn(
                    "font-medium text-sm",
                    isComplete && "text-muted-foreground"
                  )}>
                    {title}
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isLocked ? "Complete previous step to unlock" : description}
                </p>
                {requiresLeader && !isLocked && (
                  <Badge variant="outline" className="mt-2 text-xs">
                    Requires leader
                  </Badge>
                )}
              </div>
              {!isLocked && (
                <div className="shrink-0">
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-0 border-t">
            <div className="pt-4">
              {children}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
