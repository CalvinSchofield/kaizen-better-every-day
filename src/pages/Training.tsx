import { useState, useEffect } from "react";
import { FileText, Shield, Zap, DoorOpen, Presentation, Lock, ExternalLink, Download, DollarSign, Rocket, ChevronRight, MessageSquare } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
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
import { InHomePitchGuide } from "@/components/training/InHomePitchGuide";
import { PaperworkGuide } from "@/components/training/PaperworkGuide";
import { ProductGuide } from "@/components/training/ProductGuide";
import { productKnowledgeData } from "@/components/training/productKnowledgeData";

type PitchGuideType = "fresh" | "takeover" | "upgrade" | "inhome" | "paperwork";
type ProductGuideId = "vivint-app" | "doorbell-camera-pro" | "outdoor-camera-pro" | "indoor-camera-pro" | "vivint-playback" | "smart-lock" | "smart-thermostat";

interface TrainingCategory {
  title: string;
  description: string;
  icon: any;
  locked?: boolean;
  comingSoon?: boolean;
  inAppRoute?: string;
  items: Array<{
    title: string;
    href: string;
    isNew?: boolean;
    inAppGuide?: PitchGuideType;
    productGuide?: ProductGuideId;
  }>;
}

type UserType = "pre-blitz-onboarding" | "pre-blitz-ramp" | "post-blitz-rookie" | "vet-sophomore";

// Check if user has completed at least phase 1 (can be any user type)

const Training = () => {
  const { repData } = useRepData();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [animateRecommended, setAnimateRecommended] = useState(false);
  const [previousStage, setPreviousStage] = useState<string | null>(null);
  const [activeGuide, setActiveGuide] = useState<PitchGuideType | null>(null);
  const [activeProductGuide, setActiveProductGuide] = useState<ProductGuideId | null>(null);
  // Auto-open guide from URL query param
  useEffect(() => {
    const guideParam = searchParams.get('guide');
    const productParam = searchParams.get('product');
    
    if (guideParam && ['fresh', 'takeover', 'upgrade', 'inhome', 'paperwork'].includes(guideParam)) {
      setActiveGuide(guideParam as PitchGuideType);
      setSearchParams({}, { replace: true });
    } else if (productParam) {
      const validProductIds = productKnowledgeData.map(p => p.id);
      if (validProductIds.includes(productParam)) {
        setActiveProductGuide(productParam as ProductGuideId);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, setSearchParams]);
  
  // Determine user type for dynamic content ordering
  const getUserType = (): UserType => {
    if (!repData) return "pre-blitz-onboarding";
    
    const isVetOrSoph = repData.year === "Vet" || repData.year === "Sophomore";
    if (isVetOrSoph) return "vet-sophomore";
    
    const isPostBlitz = repData.ramp_phase_4_complete;
    if (isPostBlitz) return "post-blitz-rookie";
    
    // Check if past basic onboarding (in ramp phases)
    const phase = repData.ramp_to_blitz_phase?.toLowerCase() || "";
    const inRampPhases = phase.includes("phase") || phase.includes("trainings ✅") || phase.includes("slack ✅");
    if (inRampPhases) return "pre-blitz-ramp";
    
    return "pre-blitz-onboarding";
  };

  const userType = getUserType();
  const isVetOrSophomore = userType === "vet-sophomore";
  const isPreBlitz = userType === "pre-blitz-onboarding" || userType === "pre-blitz-ramp";
  const showObjections = userType !== "pre-blitz-onboarding"; // Show for ramp phases, post-blitz, and vets
  
  // Show books for vets/sophomores OR any rookie who has completed at least phase 1
  const hasCompletedPhase1 = repData?.ramp_phase_1_complete || 
    (repData?.ramp_to_blitz_phase?.toLowerCase() || "").includes("phase") ||
    (repData?.ramp_to_blitz_phase?.toLowerCase() || "").includes("trainings ✅") ||
    (repData?.ramp_to_blitz_phase?.toLowerCase() || "").includes("slack ✅");
  const showBooks = isVetOrSophomore || hasCompletedPhase1;

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

  // Base categories
  const doorApproaches: TrainingCategory = {
    title: "Door Approaches",
    description: "Master the three core approaches",
    icon: DoorOpen,
    items: [
      { title: "Takeover Pitch", href: "#", inAppGuide: "takeover" },
      { title: "Fresh Pitch", href: "#", inAppGuide: "fresh" },
      { title: "Upgrade Pitch", href: "#", inAppGuide: "upgrade" },
    ],
  };

  const pitchPresentation: TrainingCategory = {
    title: "The Pitch & Presentation",
    description: "From door to paperwork",
    icon: Presentation,
    comingSoon: true,
    items: [
      { title: "In-Home Presentation", href: "#", inAppGuide: "inhome" },
      { title: "Smooth Paperwork Process", href: "#", inAppGuide: "paperwork" },
    ],
  };

  const productKnowledge: TrainingCategory = {
    title: "Product Knowledge",
    description: "Deep dive into Vivint systems",
    icon: Shield,
    items: [
      { title: "Vivint App", href: "#", productGuide: "vivint-app" },
      { title: "Doorbell Camera Pro", href: "#", productGuide: "doorbell-camera-pro" },
      { title: "Outdoor Camera Pro", href: "#", productGuide: "outdoor-camera-pro" },
      { title: "Indoor Camera Pro", href: "#", productGuide: "indoor-camera-pro" },
      { title: "24/7 Playback", href: "#", productGuide: "vivint-playback" },
      { title: "Smart Lock", href: "#", productGuide: "smart-lock" },
      { title: "Smart Thermostat", href: "#", productGuide: "smart-thermostat" },
    ],
  };

  const rampToBlitz: TrainingCategory = {
    title: "Ramp to Blitz",
    description: "What to do before your first door",
    icon: Rocket,
    inAppRoute: "/ramp-to-blitz",
    items: [],
  };

  const objections: TrainingCategory = {
    title: "Common Objections",
    description: "Quick responses to what you'll hear at doors",
    icon: MessageSquare,
    inAppRoute: "/tools/objections",
    items: [],
  };

  // Get categories based on user type
  const getOrderedCategories = (): TrainingCategory[] => {
    switch (userType) {
      case "pre-blitz-onboarding":
        // Motivational videos shown above, then Ramp to Blitz hero, Door Approaches, Product Knowledge
        return [doorApproaches, productKnowledge];
      case "pre-blitz-ramp":
        // Ramp to Blitz hero shown above, then Door Approaches, Pitch, Product, Objections
        return [doorApproaches, pitchPresentation, productKnowledge, objections];
      case "post-blitz-rookie":
        // Door Approaches, Pitch, Product, Objections
        return [doorApproaches, pitchPresentation, productKnowledge, objections];
      case "vet-sophomore":
        // Payscales shown above, then Door Approaches, Pitch, Product, Objections
        return [doorApproaches, pitchPresentation, productKnowledge, objections];
      default:
        return [doorApproaches, pitchPresentation, productKnowledge];
    }
  };

  const categories = getOrderedCategories();

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
          { title: "Common Objections", href: "/tools/objections" },
          { title: "Competitor Cheat Sheet", href: "https://calvinschofield.notion.site/Competitor-Cheat-Sheet-19e070fe3bc2801eb801fbfea8622be0" },
        ];
      case "blitz-ready":
        return [
          { title: "Review Door Approaches", href: "#door-approaches" },
          { title: "Common Objections", href: "/tools/objections" },
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
  if (activeGuide === "inhome") {
    return <InHomePitchGuide onBack={() => setActiveGuide(null)} />;
  }
  if (activeGuide === "paperwork") {
    return <PaperworkGuide onBack={() => setActiveGuide(null)} />;
  }
  
  // If a product guide is active, show it
  if (activeProductGuide) {
    const productData = productKnowledgeData.find(p => p.id === activeProductGuide);
    if (productData) {
      return (
        <ProductGuide 
          product={productData} 
          onBack={() => setActiveProductGuide(null)}
        />
      );
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Pay Scales - Only for Vets/Sophomores */}
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

        {/* Ramp to Blitz Hero Card - Only for Pre-Blitz Rookies */}
        {isPreBlitz && (
          <Card 
            className="cursor-pointer border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 hover:border-primary/50 transition-all"
            onClick={() => navigate("/ramp-to-blitz")}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <Rocket className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Ramp to Blitz</h3>
                    <p className="text-sm text-muted-foreground">What to do before your first door</p>
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 text-primary" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Motivational Content - Only for Pre-Blitz Onboarding Rookies */}
        {userType === "pre-blitz-onboarding" && (
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
                    Stay Motivated
                  </span>
                </CardTitle>
              </div>
              <CardDescription className="transition-all duration-500 ease-out">
                <span className={`inline-block transition-all duration-500 ${animateRecommended ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
                  Watch these while you complete your onboarding steps
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="transition-all duration-500 ease-out">
                <div className={`transition-all duration-500 ${animateRecommended ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                  <MotivationalVideoCarousel />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recommended For You - Only for Pre-Blitz Ramp or Post-Blitz Rookies */}
        {(userType === "pre-blitz-ramp" || userType === "post-blitz-rookie") && (
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
                    Recommended for You
                  </span>
                </CardTitle>
              </div>
              <CardDescription className="transition-all duration-500 ease-out">
                <span className={`inline-block transition-all duration-500 ${animateRecommended ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
                  Based on your current step in the journey
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className={`space-y-2 transition-all duration-500 ${animateRecommended ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                {recommendedContent.map((item, idx) => (
                  <a
                    key={item.title}
                    href={item.href}
                    onClick={(e) => {
                      if (item.href.startsWith("/")) {
                        e.preventDefault();
                        navigate(item.href);
                      }
                    }}
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
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Training Categories */}
        {categories.map((category) => {
          const Icon = category.icon;
          const isLocked = category.locked;
          const isComingSoon = category.comingSoon;
          const isDisabledCategory = isLocked || isComingSoon;
          
          // Handle categories with in-app routes (like Objections)
          if (category.inAppRoute) {
            return (
              <Card 
                key={category.title}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => navigate(category.inAppRoute!)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{category.title}</h3>
                        <p className="text-sm text-muted-foreground">{category.description}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          }
          
          return (
            <Card 
              key={category.title} 
              id={category.title.toLowerCase().replace(/\s+/g, '-')}
              className={isDisabledCategory ? "opacity-50" : ""}
            >
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-5 h-5 ${isDisabledCategory ? "text-muted-foreground" : "text-primary"}`} />
                  <CardTitle className="text-lg">{category.title}</CardTitle>
                  {isComingSoon && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      Coming Soon
                    </Badge>
                  )}
                  {isLocked && !isComingSoon && (
                    <Badge variant="outline" className="ml-auto">
                      <Lock className="w-3 h-3 mr-1" />
                      Locked
                    </Badge>
                  )}
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
                  const isDisabled = isDisabledCategory;
                  const hasInAppGuide = !!item.inAppGuide;
                  const hasProductGuide = !!item.productGuide;
                  
                  const handleClick = (e: React.MouseEvent) => {
                    if (isDisabled) {
                      e.preventDefault();
                      return;
                    }
                    if (hasInAppGuide) {
                      e.preventDefault();
                      setActiveGuide(item.inAppGuide!);
                    } else if (hasProductGuide) {
                      e.preventDefault();
                      setActiveProductGuide(item.productGuide!);
                    }
                  };
                  
                  return (
                    <a
                      key={item.title}
                      href={isDisabled ? "#" : item.href}
                      target={!isDisabled && !hasInAppGuide && !hasProductGuide && item.href.startsWith("http") ? "_blank" : undefined}
                      rel={!isDisabled && !hasInAppGuide && !hasProductGuide && item.href.startsWith("http") ? "noopener noreferrer" : undefined}
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
                      {(hasInAppGuide || hasProductGuide) && !isDisabled ? (
                        <Shield className="w-4 h-4 text-primary" />
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

        {/* Sales Books Section with Checkboxes - Only for vets or phase 1+ rookies */}
        {showBooks && <BooksSection />}
      </div>
    </div>
  );
};

export default Training;
