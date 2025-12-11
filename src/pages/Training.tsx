import { useState, useEffect } from "react";
import { FileText, TrendingUp, Shield, Zap, DoorOpen, Presentation, MessageSquare, Lock, ExternalLink, Download, DollarSign, ChevronLeft } from "lucide-react";
import { BooksSection } from "@/components/BooksSection";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRepData } from "@/hooks/useRepData";
import { MotivationalVideoCarousel } from "@/components/MotivationalVideoCarousel";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FreshDoorPitchGuide } from "@/components/training/FreshDoorPitchGuide";
import { TakeoverPitchGuide } from "@/components/training/TakeoverPitchGuide";
import { UpgradePitchGuide } from "@/components/training/UpgradePitchGuide";

type PitchGuideType = "fresh" | "takeover" | "upgrade";

interface TrainingCategory {
  title: string;
  description: string;
  icon: any;
  locked?: boolean;
  items: Array<{
    title: string;
    href: string;
    isNew?: boolean;
    inAppGuide?: PitchGuideType;
  }>;
}

const Training = () => {
  const { repData } = useRepData();
  const { toast } = useToast();
  const [animateRecommended, setAnimateRecommended] = useState(false);
  const [previousStage, setPreviousStage] = useState<string | null>(null);
  const [activeGuide, setActiveGuide] = useState<PitchGuideType | null>(null);
  
  // Check if user is a vet or sophomore
  const isVetOrSophomore = repData?.year === "Vet" || repData?.year === "Sophomore";
  
  // Check phase 4 completion
  const phase4Complete = repData?.ramp_phase_4_complete || false;

  // Determine journey stage for dynamic recommendations
  const getJourneyStage = () => {
    if (!repData) return "early";
    const phase = repData.ramp_to_blitz_phase || "not started";
    const phaseLower = phase.toLowerCase();
    
    // Check if basic steps are complete
    const onboardingComplete = phaseLower.includes("onboarding") || phaseLower.includes("training") || phaseLower.includes("slack") || phaseLower.includes("phase");
    const trainingsComplete = phaseLower.includes("training") || phaseLower.includes("slack") || phaseLower.includes("phase");
    const slackComplete = phaseLower.includes("slack") || phaseLower.includes("phase");
    
    // If they haven't completed the basics, show motivation videos
    if (!onboardingComplete || !trainingsComplete || !slackComplete) {
      return "motivation";
    }
    
    const isPhase4Complete = repData?.ramp_phase_4_complete || false;
    if (phase === "phase 4 ✅" || isPhase4Complete) return "blitz-ready";
    if (phase === "phase 3 ✅" || phase === "phase 2 ✅") return "ramp-mid";
    if (phase === "phase 1 ✅" || phase === "trainings ✅") return "ramp-early";
    return "early";
  };

  const journeyStage = getJourneyStage();

  // Trigger animation when journey stage changes
  useEffect(() => {
    if (previousStage !== null && previousStage !== journeyStage) {
      setAnimateRecommended(true);
      setTimeout(() => setAnimateRecommended(false), 1000);
    }
    setPreviousStage(journeyStage);
  }, [journeyStage, previousStage]);

  const categories: TrainingCategory[] = [
    {
      title: "Door Approaches",
      description: "Master the three core approaches",
      icon: DoorOpen,
      items: [
        { title: "Takeover Pitch", href: "#", inAppGuide: "takeover" },
        { title: "Fresh Pitch", href: "#", inAppGuide: "fresh" },
        { title: "Upgrade Pitch", href: "#", inAppGuide: "upgrade" },
      ],
    },
    {
      title: "The Pitch & Presentation",
      description: "From door to paperwork",
      icon: Presentation,
      items: [
        { title: "In-Home Presentation", href: "https://calvinschofield.notion.site/In-Home-Presentation-18c070fe3bc280648438c57ea4c5d0b7" },
        { title: "Smooth Paperwork Process", href: "https://calvinschofield.notion.site/Smooth-paperwork-process-18c070fe3bc280a59a4fdc241ebbb2c6" },
      ],
    },
    {
      title: "Product Knowledge",
      description: "Deep dive into Vivint systems",
      icon: Shield,
      items: [
        { title: "Vivint App", href: "https://thehub.nrg.com/esc?id=microsite&topic_id=4db5a381976b269050e0b0121153afbc&in_context=true" },
        { title: "Doorbell Camera", href: "https://thehub.nrg.com/esc?id=microsite&topic_id=fd976b45976b269050e0b0121153afce&&in_context=true" },
        { title: "Outdoor Camera Pro", href: "https://thehub.nrg.com/esc?id=microsite&topic_id=d2f7c8a897b8b6104599b09ad053afff&&in_context=true" },
        { title: "Indoor Camera Pro", href: "https://thehub.nrg.com/esc?id=microsite&topic_id=bed76385976b269050e0b0121153afe4&in_context=true" },
        { title: "24/7 Playback", href: "https://thehub.nrg.com/esc?id=microsite&topic_id=fde76385976b269050e0b0121153afc0&&in_context=true" },
        { title: "Smart Lock", href: "https://thehub.nrg.com/esc?id=microsite&topic_id=e6362bc1976b269050e0b0121153afb6&in_context=true" },
        { title: "Smart Thermostat", href: "https://thehub.nrg.com/esc?id=microsite&topic_id=9e466fc1976b269050e0b0121153afe2&&in_context=true" },
      ],
    },
    {
      title: "Path to Pro",
      description: "Advanced modules for post-blitz mastery",
      icon: TrendingUp,
      locked: !phase4Complete,
      items: [
        { title: "Advanced Closing Techniques", href: "#" },
        { title: "Territory Management", href: "#" },
        { title: "Customer Relationship Building", href: "#" },
        { title: "Upselling Strategies", href: "#" },
      ],
    },
  ];

  // Dynamic recommended content based on journey stage
  const getRecommendedContent = () => {
    switch (journeyStage) {
      case "early":
        return [
          { title: "Door Approaches", href: "#door-approaches" },
          { title: "Product Knowledge Basics", href: "#product-knowledge" },
        ];
      case "ramp-early":
        return [
          { title: "Product Knowledge", href: "#product-knowledge" },
          { title: "In-Home Presentation", href: "https://calvinschofield.notion.site/In-Home-Presentation-18c070fe3bc280648438c57ea4c5d0b7" },
        ];
      case "ramp-mid":
        return [
          { title: "Common Objections", href: "https://calvinschofield.notion.site/common-objections" },
          { title: "Competitor Cheat Sheet", href: "https://calvinschofield.notion.site/Competitor-Cheat-Sheet-19e070fe3bc2801eb801fbfea8622be0" },
        ];
      case "blitz-ready":
        return [
          { title: "Path to Pro Modules", href: "#path-to-pro" },
          { title: "Advanced Techniques", href: "#path-to-pro" },
        ];
      default:
        return [
          { title: "Getting Started Guide", href: "#" },
          { title: "First Week Checklist", href: "#" },
        ];
    }
  };

  const recommendedContent = getRecommendedContent();

  // Pay scale documents
  const PAY_SCALES = [
    { label: "Leader Pay Scale", file: "/documents/2025_Leader_Payscale.pdf" },
    { label: "Recruiter Pay Scale", file: "/documents/2025_Recruiter_Pay_Scale.pdf" },
    { label: "Sales Rep Pay Scale", file: "/documents/2025_Sales_Rep_Payscale.pdf" },
    { label: "Sales Rules", file: "/documents/2025_Sales_Rules.pdf" },
  ];

  const downloadFile = async (filePath: string, fileName: string) => {
    try {
      const response = await fetch(filePath);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Download started",
        description: `${fileName} is downloading`,
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Unable to download file",
        variant: "destructive",
      });
    }
  };

  // If an in-app guide is active, show it as content
  if (activeGuide === "fresh") {
    return <FreshDoorPitchGuide onBack={() => setActiveGuide(null)} />;
  }
  if (activeGuide === "takeover") {
    return <TakeoverPitchGuide onBack={() => setActiveGuide(null)} />;
  }
  if (activeGuide === "upgrade") {
    return <UpgradePitchGuide onBack={() => setActiveGuide(null)} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Pay Scales - Hidden for Rookies */}
        {isVetOrSophomore && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-5 w-5 text-accent" />
                Payscales
              </CardTitle>
              <CardDescription className="text-sm">
                Download pay scales and sales rules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PAY_SCALES.map((doc) => (
                  <Button
                    key={doc.label}
                    variant="outline"
                    className="justify-between"
                    onClick={() => downloadFile(doc.file, doc.label + '.pdf')}
                  >
                    <span className="truncate">{doc.label}</span>
                    <Download className="h-4 w-4 ml-2 flex-shrink-0" />
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Just-in-Time Training / Motivational Content - Hidden for Vets/Sophomores */}
        {!isVetOrSophomore && (
          <Card 
            className={`border-primary/50 bg-gradient-to-br from-primary/5 to-primary/10 transition-all duration-700 ease-out ${
              animateRecommended ? 'scale-105 shadow-lg' : 'scale-100'
            }`}
          >
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Zap className={`w-5 h-5 text-primary transition-all duration-500 ${animateRecommended ? 'scale-110' : 'scale-100'}`} />
                <CardTitle className="text-lg transition-all duration-500 ease-out">
                  <span className={`inline-block transition-all duration-500 ${animateRecommended ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
                    {journeyStage === "motivation" ? "Stay Motivated" : "Recommended for You"}
                  </span>
                </CardTitle>
              </div>
              <CardDescription className="transition-all duration-500 ease-out">
                <span className={`inline-block transition-all duration-500 ${animateRecommended ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
                  {journeyStage === "motivation" 
                    ? "Watch these while you complete your onboarding steps"
                    : "Based on your current step in the journey"
                  }
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="transition-all duration-500 ease-out">
                {journeyStage === "motivation" ? (
                  <div className={`transition-all duration-500 ${animateRecommended ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                    <MotivationalVideoCarousel />
                  </div>
                ) : (
                  <div className={`space-y-2 transition-all duration-500 ${animateRecommended ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                    {recommendedContent.map((item, idx) => (
                      <a
                        key={item.title}
                        href={item.href}
                        target={item.href.startsWith("http") ? "_blank" : undefined}
                        rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
                        className="flex items-center justify-between p-3 rounded-lg bg-card hover:bg-accent transition-all duration-300 group"
                        style={{ 
                          transitionDelay: animateRecommended ? '0ms' : `${idx * 80}ms`,
                          transform: animateRecommended ? 'translateX(-10px)' : 'translateX(0)'
                        }}
                      >
                        <span className="font-medium group-hover:text-primary transition-colors duration-200">{item.title}</span>
                        {item.href.startsWith("http") ? (
                          <ExternalLink className="w-4 h-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1" />
                        ) : (
                          <FileText className="w-4 h-4 text-muted-foreground" />
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Training Categories */}
        {categories.map((category) => {
          const Icon = category.icon;
          const isLocked = category.locked;
          return (
            <Card 
              key={category.title} 
              id={category.title.toLowerCase().replace(/\s+/g, '-')}
              className={isLocked || category.title === "Path to Pro" ? "opacity-50" : ""}
            >
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">{category.title}</CardTitle>
                  {isLocked ? (
                    <Badge variant="outline" className="ml-auto">
                      <Lock className="w-3 h-3 mr-1" />
                      Locked
                    </Badge>
                  ) : category.title === "Path to Pro" ? (
                    <Badge variant="outline" className="ml-auto text-xs">
                      Coming soon
                    </Badge>
                  ) : null}
                </div>
                <CardDescription>
                  {isLocked 
                    ? "Complete Ramp to Blitz (Phase 4) to unlock" 
                    : category.description
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {category.items.map((item) => {
                  const isDisabled = isLocked || category.title === "Path to Pro";
                  const hasInAppGuide = !!item.inAppGuide;
                  
                  const handleClick = (e: React.MouseEvent) => {
                    if (isDisabled) {
                      e.preventDefault();
                      return;
                    }
                    if (hasInAppGuide) {
                      e.preventDefault();
                      setActiveGuide(item.inAppGuide!);
                    }
                  };
                  
                  return (
                    <a
                      key={item.title}
                      href={isDisabled ? "#" : item.href}
                      target={!isDisabled && !hasInAppGuide && item.href.startsWith("http") ? "_blank" : undefined}
                      rel={!isDisabled && !hasInAppGuide && item.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      onClick={handleClick}
                      className={`flex items-center justify-between p-3 rounded-lg transition-colors group ${
                        isDisabled 
                          ? "cursor-not-allowed" 
                          : "hover:bg-accent cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`font-medium transition-colors ${
                          isDisabled ? "text-muted-foreground" : "group-hover:text-primary"
                        }`}>
                          {item.title}
                        </span>
                        {item.isNew && !isDisabled && (
                          <Badge variant="outline" className="text-xs">
                            New
                          </Badge>
                        )}
                      </div>
                      {hasInAppGuide && !isDisabled ? (
                        <DoorOpen className="w-4 h-4 text-primary" />
                      ) : item.href.startsWith("http") && !isDisabled ? (
                        <ExternalLink className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <FileText className="w-4 h-4 text-muted-foreground" />
                      )}
                    </a>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}

        {/* Sales Books Section with Checkboxes */}
        <BooksSection />
      </div>
    </div>
  );
};

export default Training;
