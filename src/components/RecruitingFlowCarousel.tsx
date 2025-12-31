import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  UserPlus, 
  MessageSquare, 
  FileCheck, 
  Rocket, 
  Trophy, 
  Copy,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { useToast } from "@/hooks/use-toast";

interface FlowLink {
  label: string;
  url: string;
  type: 'video' | 'notion';
  subtext?: string;
  comingSoon?: boolean;
}

interface FlowStep {
  step: number;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  links: FlowLink[];
  description?: string;
  comingSoon?: boolean;
  guideText?: string;
}

const FLOW_STEPS: FlowStep[] = [
  {
    step: 1,
    title: "Find People",
    icon: Search,
    links: [
      { label: "Cold Contact Recruiting", url: "https://www.youtube.com/watch?v=example1", type: "video", comingSoon: true },
      { label: "What Makes Vivint Special", url: "https://www.youtube.com/watch?v=example2", type: "video", comingSoon: true }
    ]
  },
  {
    step: 2,
    title: "New Recruit",
    icon: UserPlus,
    links: [
      { label: "SmartHomePros", url: "https://www.smarthomepros.com/?inviteId=fdb85236-b069-46ec-9db6-797d24dfbe10#culture", type: "notion" },
      { label: "Recruiting Content Flow", url: "https://calvinschofield.notion.site/recruiting-content-flow?source=copy_link", type: "notion", subtext: "Send videos from time to time from here to continually recruit them/stay top of mind." }
    ]
  },
  {
    step: 3,
    title: "Group Chat w/ Leader",
    icon: MessageSquare,
    links: [],
    description: "Add them to a group chat with your leader and introduce them. Do most of your Vivint communication there to all be on the same page."
  },
  {
    step: 4,
    title: "Sign Them",
    icon: FileCheck,
    links: [
      { label: "Welcome Page", url: "https://calvinschofield.notion.site/Welcome-f1ba376d8a1644e29aa8c57566620675", type: "notion" },
      { label: "Kaizen App", url: "https://kaizen-preseason-hub.lovable.app/auth", type: "notion", subtext: "Share the Kaizen App link with your rookies and help them add it as an app on their phone. Everything they need from Preseason to Summer in one place." }
    ]
  },
  {
    step: 5,
    title: "Start Ramp to Blitz",
    icon: Rocket,
    links: [
      { label: "Goals & Gameplan", url: "https://calvinschofield.notion.site/goals-and-gameplan?source=copy_link", type: "notion" },
      { label: "Kaizen App", url: "https://kaizen-preseason-hub.lovable.app/auth", type: "notion", subtext: "The Kaizen App has Ramp to Blitz step by step. Help your recruits get logged in and working through the progression! Update your Notion as they complete each phase." }
    ]
  },
  {
    step: 6,
    title: "Blitz & Make Money",
    icon: Trophy,
    links: [
      { label: "Preseason Trips", url: "https://calvinschofield.notion.site/preseason-trips?v=a85a815c7d1a42fd84d87b9b632582bc&source=copy_link", type: "notion" }
    ]
  }
];

export const RecruitingFlowCarousel = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [api, setApi] = React.useState<any>();
  const [current, setCurrent] = React.useState(0);
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    if (!api) return;

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  const copyToClipboard = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied!",
      description: `${label} link copied to clipboard`,
    });
  };

  return (
    <div className="relative">
      {/* Scroll hint */}
      <div className="text-center mb-3">
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
          <span className="animate-pulse">←</span> Swipe to see all steps <span className="animate-pulse">→</span>
        </p>
      </div>
      
      <div className="relative px-8">
        <Carousel
          setApi={setApi}
          opts={{
            align: "start",
            loop: false,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-2 md:-ml-4">
          {FLOW_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <CarouselItem key={step.step} className="pl-2 md:pl-4 basis-[85%] md:basis-[80%]">
                <Card className={`h-full border-2 ${step.comingSoon ? 'opacity-60 border-muted' : ''}`}>
                  <CardContent className="p-6 space-y-4">
                    {/* Step Badge */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-12 h-12 rounded-full ${step.comingSoon ? 'bg-muted' : 'bg-primary/10'}`}>
                          <Icon className={`h-6 w-6 ${step.comingSoon ? 'text-muted-foreground' : 'text-primary'}`} />
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground font-medium">Step {step.step}</div>
                          <h3 className={`font-bold text-lg ${step.comingSoon ? 'text-muted-foreground' : ''}`}>{step.title}</h3>
                          {step.comingSoon && (
                            <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground rounded">
                              Coming soon
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold border-2 ${step.comingSoon ? 'border-muted text-muted-foreground' : 'border-primary text-primary'}`}>
                        {step.step}
                      </div>
                    </div>

                    {/* Description for action steps */}
                    {step.description && (
                      <p className="text-sm text-muted-foreground italic">
                        {step.description}
                      </p>
                    )}

                    {/* Guide text for coming soon */}
                    {step.guideText && (
                      <p className="text-sm text-muted-foreground">
                        {step.guideText}
                      </p>
                    )}

                    {/* Links */}
                    {step.links.length > 0 && (
                      <div className="space-y-2">
                        {step.links.map((link, idx) => {
                          const isRecruitingFlow = link.label === "Recruiting Content Flow";
                          const isExternal = link.type === 'video';
                          const handleClick = () => {
                            if (link.comingSoon) return;
                            if (isRecruitingFlow) {
                              navigate('/recruiting-content');
                            } else if (isExternal) {
                              window.open(link.url, '_blank', 'noopener,noreferrer');
                            } else {
                              copyToClipboard(link.url, link.label);
                            }
                          };
                          
                          return (
                            <div key={idx} className="space-y-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className={`w-full justify-start ${link.comingSoon ? 'opacity-50 cursor-not-allowed' : ''}`}
                                onClick={handleClick}
                                disabled={link.comingSoon}
                              >
                                {isRecruitingFlow ? (
                                  <ChevronRight className="h-4 w-4 mr-2 flex-shrink-0" />
                                ) : isExternal ? (
                                  <ExternalLink className="h-4 w-4 mr-2 flex-shrink-0" />
                                ) : (
                                  <Copy className="h-4 w-4 mr-2 flex-shrink-0" />
                                )}
                                <span className="truncate">{link.label}</span>
                                {link.comingSoon && (
                                  <span className="ml-auto text-xs">(Coming soon)</span>
                                )}
                              </Button>
                              {link.subtext && (
                                <p className="text-xs text-muted-foreground italic ml-1">
                                  {link.subtext}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Connecting arrow indicator */}
                    {step.step < FLOW_STEPS.length && (
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 hidden md:block">
                        <div className="w-8 h-0.5 bg-gradient-to-r from-primary/50 to-transparent" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </CarouselItem>
            );
          })}
        </CarouselContent>
        <CarouselPrevious className="hidden md:flex" />
        <CarouselNext className="hidden md:flex" />
      </Carousel>
      </div>

      {/* Scroll indicator dots */}
      <div className="flex justify-center gap-2 mt-4">
        {Array.from({ length: count }).map((_, index) => (
          <button
            key={index}
            className={`h-2 rounded-full transition-all ${
              index === current
                ? "w-8 bg-primary"
                : "w-2 bg-muted-foreground/30"
            }`}
            onClick={() => api?.scrollTo(index)}
            aria-label={`Go to step ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};
