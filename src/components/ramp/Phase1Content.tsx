import { useState } from "react";
import { CheckCircle2, Circle, Download, Play, Calendar, Rocket, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
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
  const [watchedVideos, setWatchedVideos] = useState<Set<string>>(new Set());
  const [expandedVideo, setExpandedVideo] = useState<string | null>("what-is-blitz");
  const [isDownloading, setIsDownloading] = useState(false);

  const hasCommittedBlitz = repData?.committed_blitzes && 
    Array.isArray(repData.committed_blitzes) && 
    repData.committed_blitzes.length > 0;

  const handleVideoWatched = (videoId: string) => {
    setWatchedVideos(prev => new Set([...prev, videoId]));
    const video = VIDEOS.find(v => v.id === videoId);
    if (video?.isRequired) {
      toast({
        title: "Video completed!",
        description: `You've watched "${video.title}"`,
      });
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

  const handleScheduleGoalsCall = () => {
    // This could open a calendly link or similar
    toast({
      title: "Coming soon",
      description: "Goals call scheduling will be available soon. Contact your leader directly for now.",
    });
  };

  const requiredVideosWatched = VIDEOS
    .filter(v => v.isRequired)
    .every(v => watchedVideos.has(v.id));

  const completedSteps = [
    requiredVideosWatched,
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

      {/* Action Items */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Take Action
        </h4>

        {/* Schedule Goals Call */}
        <Card className={cn(
          "transition-all duration-200",
        )}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <Circle className="w-5 h-5 text-muted-foreground/50" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-primary" />
                  <h4 className="font-medium text-sm">Schedule Goals Call</h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  Set up a call with your leader to set your season goals
                </p>
                <Badge variant="outline" className="mt-2 text-xs">
                  Requires leader
                </Badge>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="shrink-0"
                onClick={handleScheduleGoalsCall}
              >
                Schedule
              </Button>
            </div>
          </CardContent>
        </Card>

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
                    // Navigate to home page blitz selection
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
                onLoad={() => {
                  // Mark as watched after video loads (user can interact)
                  // In a real app, you'd track actual video completion
                }}
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
