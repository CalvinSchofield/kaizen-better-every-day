import { useState, useEffect } from "react";
import { CheckCircle2, Circle, BookOpen, GraduationCap, MessageSquare, Play, ExternalLink, ChevronDown, ChevronUp, Video, ArrowRight, Lightbulb, Target, DollarSign, MapPin, Lock, Camera, Send, X, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
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

interface CameraInfo {
  name: string;
  note: string;
  image: string;
  painPoints: {
    title: string;
    description: string;
  }[];
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

// Camera images and pain points for upgrades section
const CAMERA_DATA: CameraInfo[] = [
  {
    name: "Doorbell Camera",
    note: "Original model",
    image: "/images/cameras/doorbell-camera.jpeg",
    painPoints: [
      { title: "Bad at night", description: "Poor night vision quality makes it hard to see who's at the door after dark" },
      { title: "Miss things", description: "Only records 30 second clips — you miss important moments" },
      { title: "Has to have the WiFi", description: "Falls offline all the time when WiFi hiccups" },
      { title: "Button falls off a lot", description: "Mechanical doorbell button breaks often" }
    ]
  },
  {
    name: "Doorbell Camera Pro",
    note: "does not say Gen II",
    image: "/images/cameras/doorbell-camera-pro.jpeg",
    painPoints: [
      { title: "Has to have the WiFi", description: "Falls offline all the time when WiFi hiccups" },
      { title: "24/7 is unreliable", description: "Can only do it with WiFi working and if they have the 'space monkey' DVR" },
      { title: "Not as smart", description: "Older processor — doesn't notify all the time or maybe too much when it doesn't matter" },
      { title: "Not great audio", description: "Speaker and microphone aren't as good as the new one" }
    ]
  },
  {
    name: "Outdoor Camera",
    note: "Original model",
    image: "/images/cameras/outdoor-camera.jpeg",
    painPoints: [
      { title: "No sound", description: "Literally just video — no sound or talking through cameras" },
      { title: "Not clear", description: "Bad quality and can't see anything at night" },
      { title: "Miss things", description: "Only records 30 second clips — you miss important moments" },
      { title: "Has to have the WiFi", description: "Falls offline all the time when WiFi hiccups" }
    ]
  },
  {
    name: "Outdoor Camera Pro",
    note: "does not say Gen II",
    image: "/images/cameras/outdoor-camera-pro.jpeg",
    painPoints: [
      { title: "Has to have the WiFi", description: "Falls offline all the time when WiFi hiccups" },
      { title: "24/7 is unreliable", description: "Can only do it with WiFi working and if they have the 'space monkey' DVR" },
      { title: "Not as smart", description: "Older processor — doesn't notify all the time or maybe too much when it doesn't matter" },
      { title: "Not great audio", description: "Speaker and microphone aren't as good as the new one" }
    ]
  }
];

// Upgrades 101 content
const UPGRADES_CONTENT = {
  whatAre: {
    title: "What are upgrades?",
    icon: Lightbulb,
    content: "Vivint constantly releases newer, better products. Like smartphones, SmartHomes can be upgraded with new features and equipment. This creates great opportunities to offer current customers more and earn money doing it."
  },
  whyDo: {
    title: "Why do upgrades?",
    icon: DollarSign,
    items: [
      "Fastest first commission",
      "Build momentum early",
      "Learn real stories to establish credibility fast",
      "Climb the payscale",
      "Avoid bagel days 🥯"
    ]
  },
  whichDoors: {
    title: "Which doors should you focus on?",
    icon: MapPin,
    intro: "Focus on customers with older Vivint equipment—they're most likely to upgrade, just like someone with an old iPhone is more likely to get the newest model.",
    subtitle: "Look for people that have these cameras:"
  }
};

export const Phase2Content = ({ repData, isComplete, onOpenPitchGuide }: Phase2ContentProps) => {
  const [expandedSection, setExpandedSection] = useState<string | null>("product");
  const [productStudied, setProductStudied] = useState(false);
  const [quizPassed, setQuizPassed] = useState(false);
  const [upgradesStudied, setUpgradesStudied] = useState(false);
  const [takeoverStudied, setTakeoverStudied] = useState(false);
  const [pitchSubmitted, setPitchSubmitted] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<CameraInfo | null>(null);

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
      "Hey! I've studied the product and practiced my pitches. I'm ready to send my Takeover pitch and Upgrade pitch recordings for feedback. What's the best way to send them to you?"
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
    <div className="space-y-5 pb-20">
      {/* Completed Steps as Chips */}
      {completedSteps > 0 && completedSteps < 5 && (
        <div className="flex flex-wrap gap-2">
          {productStudied && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Product
            </div>
          )}
          {quizPassed && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Quiz
            </div>
          )}
          {upgradesStudied && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Upgrades
            </div>
          )}
          {takeoverStudied && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Takeover
            </div>
          )}
          {pitchSubmitted && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Pitch
            </div>
          )}
        </div>
      )}

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
        description="Learn upgrades and what to say"
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
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              {UPGRADES_CONTENT.whichDoors.intro}
            </p>
            <p className="text-xs font-medium text-foreground mb-3">{UPGRADES_CONTENT.whichDoors.subtitle}</p>
            
            {/* Camera cards grid */}
            <div className="grid grid-cols-2 gap-2">
              {CAMERA_DATA.map((camera, idx) => (
                <div 
                  key={idx} 
                  onClick={() => setSelectedCamera(camera)}
                  className="rounded-xl bg-background/80 border border-orange-500/20 p-3 flex flex-col items-center text-center cursor-pointer hover:bg-orange-500/5 active:scale-[0.98] transition-all"
                >
                  <div className="w-16 h-16 rounded-xl bg-white flex items-center justify-center mb-2 overflow-hidden">
                    <img 
                      src={camera.image} 
                      alt={camera.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="text-xs font-medium text-foreground leading-tight">{camera.name}</span>
                  {camera.note && (
                    <span className="text-[10px] italic text-muted-foreground mt-0.5">({camera.note})</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* What to say on upgrades - CTA to module */}
          <div className="rounded-xl bg-gradient-to-br from-primary/15 via-primary/10 to-transparent border border-primary/25 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-primary" />
              </div>
              <h5 className="font-semibold text-sm">What to say on upgrades</h5>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Study the Upgrade Door Approach and know it like the back of your hand.
            </p>
            
            {/* Upgrade Module CTA */}
            <div 
              onClick={() => onOpenPitchGuide("upgrade")}
              className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 p-4 cursor-pointer active:scale-[0.98] transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                    <Play className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-sm">Upgrade Pitch Module</h5>
                    <p className="text-xs text-muted-foreground">Step-by-step script with audio</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-primary group-hover:translate-x-1 transition-transform shrink-0" />
              </div>
            </div>
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

      {/* Step 5: Submit Your Pitches */}
      <TrainingSection
        id="submitpitches"
        title="Submit Your Pitches"
        icon={<Send className="w-4 h-4" />}
        description="Record and send both pitches for feedback"
        isComplete={pitchSubmitted}
        isLocked={!takeoverStudied}
        requiresLeader
        isExpanded={expandedSection === "submitpitches"}
        onToggle={() => setExpandedSection(expandedSection === "submitpitches" ? null : "submitpitches")}
      >
        <div className="space-y-4">
          {/* Info card */}
          <div className="rounded-xl bg-gradient-to-br from-violet-500/10 to-violet-600/5 border border-violet-500/20 p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
                <Video className="w-5 h-5 text-violet-500" />
              </div>
              <div>
                <h5 className="font-semibold text-sm mb-1">Record Both Pitches</h5>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Record yourself delivering both your <span className="font-medium text-foreground">Takeover pitch</span> and <span className="font-medium text-foreground">Upgrade pitch</span>. Send both videos to your leader for feedback.
                </p>
              </div>
            </div>
          </div>


          {/* Text leader CTA */}
          <Button 
            className="w-full rounded-xl h-14 text-base"
            onClick={handleTextLeaderForPitch}
          >
            <MessageSquare className="w-5 h-5 mr-2" />
            Text Leader to Submit Pitches
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Your leader will mark this complete after reviewing both pitches
          </p>
        </div>
      </TrainingSection>

      {/* Camera Detail Drawer */}
      <Drawer open={!!selectedCamera} onOpenChange={(open) => !open && setSelectedCamera(null)}>
        <DrawerContent className="max-h-[90dvh]">
          <DrawerHeader className="border-b border-border/50 pb-4">
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-lg font-bold">{selectedCamera?.name}</DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9">
                  <X className="w-5 h-5" />
                </Button>
              </DrawerClose>
            </div>
            {selectedCamera?.note && (
              <p className="text-sm text-muted-foreground italic">({selectedCamera.note})</p>
            )}
          </DrawerHeader>
          
          <div className="p-4 space-y-4 overflow-y-auto">
            {/* Camera Image */}
            <div className="flex justify-center">
              <div className="w-32 h-32 rounded-2xl bg-white border border-border/50 flex items-center justify-center overflow-hidden">
                <img 
                  src={selectedCamera?.image} 
                  alt={selectedCamera?.name || ''}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* Why customers upgrade */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                </div>
                <h4 className="font-semibold text-sm">Why customers want to upgrade</h4>
              </div>
              
              <div className="space-y-2">
                {selectedCamera?.painPoints.map((point, idx) => (
                  <div 
                    key={idx}
                    className="rounded-xl bg-orange-500/5 border border-orange-500/20 p-3"
                  >
                    <p className="font-medium text-sm text-foreground">{point.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{point.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tip */}
            <div className="rounded-xl bg-primary/10 border border-primary/20 p-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-primary">Tip:</span> When you see this camera at a door, bring up these pain points to help the customer realize they're missing out on newer technology!
              </p>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
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
