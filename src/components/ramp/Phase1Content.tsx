import { useState, useEffect } from "react";
import { CheckCircle2, Circle, Download, Play, MessageSquare, Rocket, ChevronDown, ChevronUp, BookOpen, Target, Lightbulb, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useRepGoals } from "@/hooks/useRepGoals";
import { useNavigate } from "react-router-dom";
import type { RepData } from "@/hooks/useRepData";

interface Phase1ContentProps {
  repData: RepData | null;
  isComplete: boolean;
}

interface VideoSection {
  id: string;
  title: string;
  description: string;
  youtubeId: string;
  isRequired: boolean;
}

const VIDEOS: VideoSection[] = [
  {
    id: "what-is-blitz",
    title: "What is a Blitz?",
    description: "Learn what blitzes are and why they're the fastest path to making money",
    youtubeId: "luFAjpElCy8",
    isRequired: true,
  },
  {
    id: "how-pay-works",
    title: "How You Get Paid",
    description: "Understand the basics of how commissions and pay work",
    youtubeId: "xjgnjhD-U2A",
    isRequired: true,
  },
  {
    id: "pay-deep-dive",
    title: "Deep Dive: How Pay Works",
    description: "Optional bonus content for those who want to understand pay in detail",
    youtubeId: "vZFC5ttWWD0",
    isRequired: false,
  },
];

export const Phase1Content = ({ repData, isComplete }: Phase1ContentProps) => {
  const navigate = useNavigate();
  const { goals } = useRepGoals();
  const [watchedVideos, setWatchedVideos] = useState<Set<string>>(new Set());
  const [expandedVideo, setExpandedVideo] = useState<string | null>("what-is-blitz");
  const [isDownloading, setIsDownloading] = useState(false);
  const [goalsReviewed, setGoalsReviewed] = useState(false);
  const [expandedGoalsSection, setExpandedGoalsSection] = useState<string | null>("why");

  const goalsSetupComplete = goals?.setup_complete === true;

  // Load watched videos from database on mount
  useEffect(() => {
    if (repData?.watched_videos && Array.isArray(repData.watched_videos)) {
      setWatchedVideos(new Set(repData.watched_videos as string[]));
    }
  }, [repData?.watched_videos]);

  const hasCommittedBlitz = repData?.committed_blitzes && 
    Array.isArray(repData.committed_blitzes) && 
    repData.committed_blitzes.length > 0;

  const handleVideoWatched = async (videoId: string) => {
    const newWatchedVideos = new Set([...watchedVideos, videoId]);
    setWatchedVideos(newWatchedVideos);
    
    const video = VIDEOS.find(v => v.id === videoId);
    if (video?.isRequired) {
      toast({
        title: "Video completed!",
        description: `You've watched "${video.title}"`,
      });
    }

    // Persist to database
    if (repData?.user_id) {
      const { error } = await supabase
        .from('reps')
        .update({ watched_videos: Array.from(newWatchedVideos) })
        .eq('user_id', repData.user_id);
      
      if (error) {
        console.error('Failed to save video progress:', error);
      }
    }
  };

  const handleDownloadPayscale = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch('/documents/2025_Sales_Rep_Payscale-3.pdf');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '2025_Sales_Rep_Payscale.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Downloaded!",
        description: "Payscale saved to your device",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleTextLeader = () => {
    if (!repData?.team_leader_phone) {
      toast({
        title: "No leader phone found",
        description: "Contact your recruiter to get connected with your leader",
        variant: "destructive",
      });
      return;
    }

    // Clean the phone number
    const cleanPhone = repData.team_leader_phone.replace(/\D/g, '');
    const message = encodeURIComponent(
      "Hey! I've been thinking about my goals and I'm ready to go over them with you. When can we jump on a call?"
    );
    
    // Open SMS with prefilled message
    window.location.href = `sms:${cleanPhone}?body=${message}`;
  };

  const requiredVideosWatched = VIDEOS
    .filter(v => v.isRequired)
    .every(v => watchedVideos.has(v.id));

  const completedSteps = [
    requiredVideosWatched,
    goalsReviewed || goalsSetupComplete,
    hasCommittedBlitz,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6 pb-20">
      {/* Phase Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">Set Goals</h3>
          <p className="text-sm text-muted-foreground">
            Learn what blitzes are and how you get paid
          </p>
        </div>
        {isComplete ? (
          <Badge className="bg-primary/10 text-primary border-primary/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Complete
          </Badge>
        ) : (
          <Badge variant="outline">
            {completedSteps}/3 done
          </Badge>
        )}
      </div>

      {/* Video Section */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Watch & Learn
        </h4>
        
        {VIDEOS.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            isWatched={watchedVideos.has(video.id)}
            isExpanded={expandedVideo === video.id}
            onToggle={() => setExpandedVideo(expandedVideo === video.id ? null : video.id)}
            onWatched={() => handleVideoWatched(video.id)}
          />
        ))}
      </div>

      {/* Payscale Download */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm">2025 Sales Rep Payscale</h4>
              <p className="text-xs text-muted-foreground">
                Download to see exactly how much you can earn
              </p>
            </div>
            <Button 
              size="sm" 
              onClick={handleDownloadPayscale}
              disabled={isDownloading}
            >
              {isDownloading ? "..." : "Download"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Goals Review Section */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Review Your Goals
        </h4>
        <p className="text-xs text-muted-foreground">
          Think about these questions before your goals call with your leader
        </p>

        {/* WHY Section */}
        <GoalsSection
          id="why"
          title="Why"
          icon={<Lightbulb className="w-4 h-4" />}
          isExpanded={expandedGoalsSection === "why"}
          onToggle={() => setExpandedGoalsSection(expandedGoalsSection === "why" ? null : "why")}
        >
          <div className="space-y-3 text-sm text-muted-foreground">
            <p className="italic">Why do you want to work here? What is it that drives you?</p>
            <ul className="space-y-2 list-disc list-inside">
              <li>Why do you want to sell?</li>
              <li>What lifestyle do you unlock by making good money in a summer? What about your life will change if you hit your goals?</li>
              <li>How does success this summer affect you in the long run? Where do you see yourself in the next 5 years?</li>
              <li>Who do you want to impact as part of your success?</li>
              <li>What motivates you on a deeper level beyond financial gain?</li>
              <li>What sort of lifestyle goals do you want to achieve in the future because of your hard work now?</li>
            </ul>
          </div>
        </GoalsSection>

        {/* WHAT Section */}
        <GoalsSection
          id="what"
          title="What"
          icon={<Target className="w-4 h-4" />}
          isExpanded={expandedGoalsSection === "what"}
          onToggle={() => setExpandedGoalsSection(expandedGoalsSection === "what" ? null : "what")}
        >
          <div className="space-y-3 text-sm text-muted-foreground">
            <p className="italic">What do you hope to get from the experience, both financially and not?</p>
            
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">Must-do goal</span>
                <span>What <em>has to</em> happen. Minimum to cover your expenses.</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Will-do goal</span>
                <span>The goal you want to tackle. Average rookie makes $38k.</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Could-do goal</span>
                <span>Top rookies earn $85k+. Full commitment required.</span>
              </div>
            </div>

            <p className="text-xs">
              Think about your monthly expenses × months off. That's your starting point for must-do.
            </p>
          </div>
        </GoalsSection>

        {/* HOW Section */}
        <GoalsSection
          id="how"
          title="How"
          icon={<BookOpen className="w-4 h-4" />}
          isExpanded={expandedGoalsSection === "how"}
          onToggle={() => setExpandedGoalsSection(expandedGoalsSection === "how" ? null : "how")}
        >
          <div className="space-y-3 text-sm text-muted-foreground">
            <p className="italic">How do we make it happen together?</p>
            
            <p>You'll set these commitments with your leader:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Hours per week training on your own time</li>
              <li>Books to read before summer starts</li>
              <li>Monday Night Lights trainings to attend</li>
              <li>Role plays with a vet before summer</li>
              <li>Blitzes to attend</li>
              <li>Pre-summer sales target</li>
            </ul>

            <div className="bg-muted/30 rounded-lg p-3 border-l-2 border-primary/50">
              <p className="text-xs italic">
                "You don't rise to the level of your goals, you fall to the level of your systems" — James Clear
              </p>
            </div>
          </div>
        </GoalsSection>

        {/* Mark as Reviewed Button */}
        {!goalsReviewed && (
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              setGoalsReviewed(true);
              toast({
                title: "Goals reviewed!",
                description: "Now text your leader to schedule your goals call",
              });
            }}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            I've Thought About My Goals
          </Button>
        )}
      </div>

      {/* Action Items */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Take Action
        </h4>

        {/* Goals Call / View Goals */}
        <Card className={cn(
          "transition-all duration-200",
          goalsSetupComplete && "bg-primary/5 border-primary/20",
          !goalsReviewed && !goalsSetupComplete && "opacity-60"
        )}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {goalsSetupComplete ? (
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground/50" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {goalsSetupComplete ? (
                    <Target className="w-4 h-4 text-primary" />
                  ) : (
                    <MessageSquare className="w-4 h-4 text-primary" />
                  )}
                  <h4 className={cn(
                    "font-medium text-sm",
                    goalsSetupComplete && "text-muted-foreground"
                  )}>
                    {goalsSetupComplete ? "Goals Set" : "Schedule Goals Call"}
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  {goalsSetupComplete 
                    ? "Your goals are set! Track your progress on the Goals page."
                    : goalsReviewed 
                      ? `Text ${repData?.team_leader?.split(' ')[0] || 'your leader'} to set up your goals call`
                      : "Review the goals sections above first"
                  }
                </p>
                {!goalsSetupComplete && (
                  <Badge variant="outline" className="mt-2 text-xs">
                    Requires leader
                  </Badge>
                )}
              </div>
              {goalsSetupComplete ? (
                <Button 
                  variant="default"
                  size="sm" 
                  className="shrink-0"
                  onClick={() => navigate('/goals')}
                >
                  <ExternalLink className="w-3 h-3 mr-1.5" />
                  View Goals
                </Button>
              ) : (
                <Button 
                  variant={goalsReviewed ? "default" : "outline"}
                  size="sm" 
                  className="shrink-0"
                  onClick={handleTextLeader}
                  disabled={!goalsReviewed}
                >
                  Text Leader
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Goals Preview - Show when goals are set */}
        {goalsSetupComplete && goals && (
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-primary" />
                <h4 className="font-medium text-sm">Your FP+ Goals</h4>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-lg bg-background/50">
                  <p className="text-xs text-muted-foreground mb-1">Must Do</p>
                  <p className="text-lg font-bold text-foreground">{goals.must_do_fp_goal || 0}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-background/50 ring-2 ring-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">Will Do</p>
                  <p className="text-lg font-bold text-primary">{goals.will_do_fp_goal || 0}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-background/50">
                  <p className="text-xs text-muted-foreground mb-1">Could Do</p>
                  <p className="text-lg font-bold text-foreground">{goals.could_do_fp_goal || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Commit to Blitz */}
        <Card className={cn(
          "transition-all duration-200",
          hasCommittedBlitz && "bg-primary/5 border-primary/20"
        )}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {hasCommittedBlitz ? (
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground/50" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Rocket className="w-4 h-4 text-primary" />
                  <h4 className={cn(
                    "font-medium text-sm",
                    hasCommittedBlitz && "text-muted-foreground"
                  )}>
                    Commit to a Blitz
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  {hasCommittedBlitz 
                    ? "You've committed to your first blitz!" 
                    : "Choose your first blitz trip to get on the doors"
                  }
                </p>
              </div>
              {!hasCommittedBlitz && (
                <Button 
                  variant="default" 
                  size="sm" 
                  className="shrink-0"
                  onClick={() => {
                    window.location.href = '/';
                  }}
                >
                  Pick Blitz
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

interface VideoCardProps {
  video: VideoSection;
  isWatched: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onWatched: () => void;
}

const VideoCard = ({ video, isWatched, isExpanded, onToggle, onWatched }: VideoCardProps) => {
  return (
    <Card className={cn(
      "transition-all duration-200 overflow-hidden",
      isWatched && "bg-primary/5 border-primary/20"
    )}>
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 cursor-pointer">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {isWatched ? (
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                ) : (
                  <Play className="w-5 h-5 text-muted-foreground/50" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className={cn(
                    "font-medium text-sm",
                    isWatched && "text-muted-foreground"
                  )}>
                    {video.title}
                  </h4>
                  {!video.isRequired && (
                    <Badge variant="secondary" className="text-xs">
                      Bonus
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {video.description}
                </p>
              </div>
              <div className="shrink-0">
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-4 pb-4">
            {/* YouTube Embed */}
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${video.youtubeId}?rel=0&modestbranding=1`}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              />
            </div>
            
            {!isWatched && (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-3"
                onClick={(e) => {
                  e.stopPropagation();
                  onWatched();
                }}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Mark as Watched
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

interface GoalsSectionProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const GoalsSection = ({ id, title, icon, isExpanded, onToggle, children }: GoalsSectionProps) => {
  return (
    <Card className="transition-all duration-200 overflow-hidden">
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                {icon}
              </div>
              <h4 className="font-medium text-sm flex-1">{title}</h4>
              <div className="shrink-0">
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-4 pb-4">
            {children}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
