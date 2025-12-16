import { useState, useEffect } from "react";
import { CheckCircle2, Circle, BookOpen, GraduationCap, MessageSquare, Play, ExternalLink, ChevronDown, ChevronUp, Video, ArrowRight, Lightbulb, Target, DollarSign, MapPin, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useRampProgress } from "@/hooks/useRampProgress";
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

// Upgrades 101 content
const UPGRADES_CONTENT = {
  whatAre: {
    title: "What are upgrades?",
    icon: Lightbulb,
    content: "Upgrades are sales made to existing Vivint customers. These customers already trust the brand and have a working system — your job is to show them the latest and greatest technology that's come out since they first signed up."
  },
  whyDo: {
    title: "Why do upgrades?",
    icon: DollarSign,
    items: [
      "Higher close rates — they already know and trust Vivint",
      "Easier conversations — no need to sell the company, just the new tech",
      "Great PRMR — upgrade deals often have strong commissions",
      "Build confidence before knocking fresh doors"
    ]
  },
  whichDoors: {
    title: "Which doors should you focus on?",
    icon: MapPin,
    items: [
      "Customers with older equipment (2+ years)",
      "Homes with basic packages missing cameras",
      "Customers who've had service issues",
      "Anyone without the latest smart home features"
    ]
  }
};

export const Phase2Content = ({ repData, isComplete, onOpenPitchGuide }: Phase2ContentProps) => {
  const [expandedSection, setExpandedSection] = useState<string | null>("product");
  const [productStudied, setProductStudied] = useState(false);
  const [quizPassed, setQuizPassed] = useState(false);
  const [upgradesStudied, setUpgradesStudied] = useState(false);
  const [takeoverStudied, setTakeoverStudied] = useState(false);
  const [pitchSubmitted, setPitchSubmitted] = useState(false);

  const { saveProgress } = useRampProgress(repData?.user_id);

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

  const handleMarkProductStudied = async () => {
    const success = await saveProgress('phase2-product');
    if (success) {
      setProductStudied(true);
      toast({
        title: "Product knowledge complete!",
        description: "Now take the quiz to test your knowledge",
      });
    }
  };

  const handleQuizComplete = async () => {
    const success = await saveProgress('phase2-quiz-passed');
    if (success) {
      setQuizPassed(true);
      toast({
        title: "Quiz complete! 🎉",
        description: "Great job! You're ready for the next step",
      });
    }
  };

  const handleUpgradesStudied = async () => {
    const success = await saveProgress('phase2-upgrades');
    if (success) {
      setUpgradesStudied(true);
      toast({
        title: "Upgrades 101 complete!",
        description: "You now understand the upgrade opportunity",
      });
    }
  };

  const handleTakeoverStudied = async () => {
    const success = await saveProgress('phase2-takeover');
    if (success) {
      setTakeoverStudied(true);
      toast({
        title: "Takeover approach complete!",
        description: "Ready to handle existing system homes",
      });
    }
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
    <div className="space-y-4 pb-20">
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
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Review each product to understand features, benefits, and how to explain them to customers.
          </p>
          
          {/* Login prompt card */}
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-xl p-4 border border-primary/20">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Sign in with your Vivint credentials</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Use your Vivint username and password to access the product training materials on TheHub.
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid gap-2">
            {PRODUCT_KNOWLEDGE_LINKS.map((link) => (
              <a
                key={link.title}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-all group active:scale-[0.98]"
              >
                <span className="font-medium text-sm group-hover:text-primary transition-colors">{link.title}</span>
                <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </a>
            ))}
          </div>

          {!productStudied && (
            <Button 
              className="w-full mt-2 rounded-xl h-12"
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
        description="Test your knowledge of the products"
        isComplete={quizPassed}
        isLocked={!productStudied}
        isExpanded={expandedSection === "quiz"}
        onToggle={() => setExpandedSection(expandedSection === "quiz" ? null : "quiz")}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Take this quiz to reinforce what you've learned and make sure you understand the products inside and out.
          </p>
          
          <a
            href={PRODUCT_QUIZ_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 p-4 rounded-xl bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 hover:from-primary/30 hover:to-primary/20 transition-all active:scale-[0.98] group"
          >
            <GraduationCap className="w-5 h-5 text-primary" />
            <span className="font-semibold text-primary">Take Product Quiz</span>
            <ArrowRight className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform" />
          </a>

          {!quizPassed && (
            <Button 
              variant="outline"
              className="w-full rounded-xl h-12"
              onClick={handleQuizComplete}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              I've Completed the Quiz
            </Button>
          )}
        </div>
      </TrainingSection>

      {/* Step 3: Upgrades 101 */}
      <TrainingSection
        id="upgrades"
        title="Upgrades 101"
        icon={<Target className="w-4 h-4" />}
        description="Understand the upgrade opportunity"
        isComplete={upgradesStudied}
        isLocked={!quizPassed}
        isExpanded={expandedSection === "upgrades"}
        onToggle={() => setExpandedSection(expandedSection === "upgrades" ? null : "upgrades")}
      >
        <div className="space-y-4">
          {/* What are upgrades */}
          <div className="rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <UPGRADES_CONTENT.whatAre.icon className="w-4 h-4 text-blue-500" />
              </div>
              <h5 className="font-semibold text-sm">{UPGRADES_CONTENT.whatAre.title}</h5>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {UPGRADES_CONTENT.whatAre.content}
            </p>
          </div>

          {/* Why do upgrades */}
          <div className="rounded-xl bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-green-500/20 flex items-center justify-center">
                <UPGRADES_CONTENT.whyDo.icon className="w-4 h-4 text-green-500" />
              </div>
              <h5 className="font-semibold text-sm">{UPGRADES_CONTENT.whyDo.title}</h5>
            </div>
            <ul className="space-y-2">
              {UPGRADES_CONTENT.whyDo.items.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Which doors to focus on */}
          <div className="rounded-xl bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <UPGRADES_CONTENT.whichDoors.icon className="w-4 h-4 text-orange-500" />
              </div>
              <h5 className="font-semibold text-sm">{UPGRADES_CONTENT.whichDoors.title}</h5>
            </div>
            <ul className="space-y-2">
              {UPGRADES_CONTENT.whichDoors.items.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <div className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-orange-500">{idx + 1}</span>
                  </div>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {!upgradesStudied && (
            <Button 
              className="w-full rounded-xl h-12"
              onClick={handleUpgradesStudied}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              I Understand Upgrades
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
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Learn the takeover approach for homes that already have a security system from another company.
          </p>
          
          <Button 
            variant="outline"
            className="w-full justify-between rounded-xl h-12 group"
            onClick={() => onOpenPitchGuide("takeover")}
          >
            <span className="flex items-center gap-2">
              <Play className="w-4 h-4" />
              Open Takeover Pitch Guide
            </span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>

          {!takeoverStudied && (
            <Button 
              className="w-full rounded-xl h-12"
              onClick={handleTakeoverStudied}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              I've Studied Takeover
            </Button>
          )}
        </div>
      </TrainingSection>

      {/* Step 5: What to Say (Upgrade Pitch) */}
      <TrainingSection
        id="whattosay"
        title="What to Say on Upgrades"
        icon={<MessageSquare className="w-4 h-4" />}
        description="Master your upgrade pitch"
        isComplete={pitchSubmitted}
        isLocked={!takeoverStudied}
        requiresLeader
        isExpanded={expandedSection === "whattosay"}
        onToggle={() => setExpandedSection(expandedSection === "whattosay" ? null : "whattosay")}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Now that you understand upgrades, learn exactly what to say when you knock on an existing customer's door.
          </p>

          {/* Upgrade Module CTA */}
          <div 
            onClick={() => onOpenPitchGuide("upgrade")}
            className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/30 p-5 cursor-pointer active:scale-[0.98] transition-all group"
          >
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h5 className="font-semibold">Upgrade Pitch Module</h5>
                  <p className="text-xs text-muted-foreground">Step-by-step script with audio</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-primary font-medium">Start learning</span>
                <ArrowRight className="w-5 h-5 text-primary group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
            {/* Decorative gradient */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
          </div>

          <div className="bg-muted/50 rounded-xl p-4 space-y-2">
            <h5 className="font-medium text-sm">Ready for feedback?</h5>
            <p className="text-xs text-muted-foreground">
              Once you've practiced your pitch, record yourself and send it to your leader for feedback.
            </p>
          </div>

          <Button 
            className="w-full rounded-xl h-12"
            onClick={handleTextLeaderForPitch}
          >
            <Video className="w-4 h-4 mr-2" />
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
      "transition-all duration-200 overflow-hidden rounded-2xl",
      isComplete && "bg-primary/5 border-primary/20",
      isLocked && "opacity-50"
    )}>
      <Collapsible open={isExpanded && !isLocked} onOpenChange={isLocked ? undefined : onToggle}>
        <CollapsibleTrigger asChild disabled={isLocked}>
          <CardContent className={cn("p-4", !isLocked && "cursor-pointer active:bg-muted/50")}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {isComplete ? (
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
                    <Circle className="w-3 h-3 text-muted-foreground/50" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-primary">{icon}</span>
                  <h4 className={cn(
                    "font-semibold text-sm",
                    isComplete && "text-muted-foreground"
                  )}>
                    {title}
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isLocked ? "Complete previous step to unlock" : description}
                </p>
                {requiresLeader && !isLocked && (
                  <Badge variant="outline" className="mt-2 text-xs rounded-lg">
                    Requires leader
                  </Badge>
                )}
              </div>
              {!isLocked && (
                <div className="shrink-0 w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
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
          <div className="px-4 pb-4 pt-0 border-t border-border/50">
            <div className="pt-4">
              {children}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
