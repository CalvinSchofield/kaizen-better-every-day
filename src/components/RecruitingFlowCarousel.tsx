import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  UserPlus, 
  MessageSquare, 
  FileCheck, 
  Rocket, 
  Trophy, 
  GraduationCap,
  Play,
  Copy,
  ExternalLink
} from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { useToast } from "@/hooks/use-toast";

interface FlowLink {
  label: string;
  url: string;
  type: 'video' | 'notion';
}

interface FlowStep {
  step: number;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  links: FlowLink[];
  description?: string;
}

const FLOW_STEPS: FlowStep[] = [
  {
    step: 1,
    title: "Find People",
    icon: Search,
    links: [
      { label: "Cold Contact Recruiting", url: "https://www.youtube.com/watch?v=example1", type: "video" },
      { label: "What Makes Vivint Special", url: "https://www.youtube.com/watch?v=example2", type: "video" }
    ]
  },
  {
    step: 2,
    title: "New Recruit",
    icon: UserPlus,
    links: [
      { label: "SmartHomePros", url: "https://www.smarthomepros.com/?inviteId=fdb85236-b069-46ec-9db6-797d24dfbe10#culture", type: "notion" },
      { label: "Recruiting Content Flow", url: "https://calvinschofield.notion.site/recruiting-content-flow?source=copy_link", type: "notion" }
    ]
  },
  {
    step: 3,
    title: "Group Chat w/ Leader",
    icon: MessageSquare,
    links: [],
    description: "Add them to the group chat and introduce them to the team"
  },
  {
    step: 4,
    title: "Sign Them",
    icon: FileCheck,
    links: [
      { label: "Welcome Page", url: "https://calvinschofield.notion.site/welcome?source=copy_link", type: "notion" }
    ]
  },
  {
    step: 5,
    title: "Start Ramp to Blitz",
    icon: Rocket,
    links: [
      { label: "Ramp to Blitz Program", url: "https://calvinschofield.notion.site/ramp-to-blitz-program?source=copy_link", type: "notion" },
      { label: "Goals & Gameplan", url: "https://calvinschofield.notion.site/goals-and-gameplan?source=copy_link", type: "notion" }
    ]
  },
  {
    step: 6,
    title: "Blitz & Make Money",
    icon: Trophy,
    links: [
      { label: "Preseason Trips", url: "https://calvinschofield.notion.site/preseason-trips?v=a85a815c7d1a42fd84d87b9b632582bc&source=copy_link", type: "notion" }
    ]
  },
  {
    step: 7,
    title: "Path to Pro",
    icon: GraduationCap,
    links: [
      { label: "Path to Pro", url: "https://calvinschofield.notion.site/path-to-pro?source=copy_link", type: "notion" }
    ]
  }
];

export const RecruitingFlowCarousel = () => {
  const { toast } = useToast();
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

  const openLink = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
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
        {/* Left gradient fade */}
        <div className="absolute left-0 top-0 bottom-12 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        
        {/* Right gradient fade */}
        <div className="absolute right-0 top-0 bottom-12 w-12 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
        
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
                <Card className="h-full border-2 hover:border-primary/50 transition-colors">
                  <CardContent className="p-6 space-y-4">
                    {/* Step Badge */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground font-medium">Step {step.step}</div>
                          <h3 className="font-bold text-lg">{step.title}</h3>
                        </div>
                      </div>
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                        {step.step}
                      </div>
                    </div>

                    {/* Description for action steps */}
                    {step.description && (
                      <p className="text-sm text-muted-foreground italic">
                        {step.description}
                      </p>
                    )}

                    {/* Links */}
                    {step.links.length > 0 && (
                      <div className="space-y-2">
                        {step.links.map((link, idx) => (
                          <div key={idx} className="flex gap-2">
                            {link.type === 'video' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 justify-start"
                                onClick={() => openLink(link.url)}
                              >
                                <Play className="h-4 w-4 mr-2" />
                                {link.label}
                              </Button>
                            ) : (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 justify-start"
                                  onClick={() => copyToClipboard(link.url, link.label)}
                                >
                                  <Copy className="h-4 w-4 mr-2 flex-shrink-0" />
                                  <span className="truncate">{link.label}</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openLink(link.url)}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        ))}
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
