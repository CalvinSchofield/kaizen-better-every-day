import { useState, useEffect } from "react";
import { BookOpen, FileText, Users, TrendingUp, Shield, Zap, DoorOpen, Presentation, MessageSquare, Target, Lock, BookMarked, ExternalLink, Download, DollarSign } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useRepData } from "@/hooks/useRepData";
import { MotivationalVideoCarousel } from "@/components/MotivationalVideoCarousel";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface TrainingCategory {
  title: string;
  description: string;
  icon: any;
  locked?: boolean;
  items: Array<{
    title: string;
    href: string;
    isNew?: boolean;
  }>;
}

interface Book {
  title: string;
  author: string;
  summary: string;
}

const Training = () => {
  const { repData, loading } = useRepData();
  const { toast } = useToast();
  const phase4Complete = repData?.ramp_phase_4_complete || false;
  const [animateRecommended, setAnimateRecommended] = useState(false);
  const [previousStage, setPreviousStage] = useState<string | null>(null);
  
  // Check if user is a vet or sophomore
  const isVetOrSophomore = repData?.year === "Vet" || repData?.year === "Sophomore";

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
    
    if (phase === "phase 4 ✅" || phase4Complete) return "blitz-ready";
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

  const books: Book[] = [
    {
      title: "The Compound Effect",
      author: "Darren Hardy",
      summary: "Small, consistent daily actions create massive results over time. Shows how tiny improvements in your pitch, attitude, and work ethic compound into huge commission checks by summer's end."
    },
    {
      title: "Atomic Habits",
      author: "James Clear",
      summary: "Build systems that make success automatic. Learn to stack habits that turn you into a closing machine—one small improvement at a time."
    },
    {
      title: "Go for No!",
      author: "Richard Fenton & Andrea Waltz",
      summary: "Reframe rejection as progress toward yes. The more doors that close in your face, the closer you are to your next sale. This mindset shift is a game-changer for D2D."
    },
    {
      title: "The Miracle Morning",
      author: "Hal Elrod",
      summary: "Start every day with intention before you hit the doors. A powerful morning routine gives you the energy and focus to outwork everyone else."
    },
    {
      title: "The 10X Rule",
      author: "Grant Cardone",
      summary: "Whatever effort you think is required, multiply it by 10. Massive action = massive results. Perfect for crushing sales goals."
    },
    {
      title: "Door to Door Millionaire",
      author: "Lenny Gray",
      summary: "Written specifically for D2D sales. Real strategies from someone who built an empire knocking doors—exactly what you're doing this summer."
    },
    {
      title: "The Happiness Advantage",
      author: "Shawn Achor",
      summary: "Positivity isn't just feel-good—it's a competitive edge. Happy salespeople outsell negative ones by 37%. Learn to stay energized through the grind."
    },
    {
      title: "The Magic of Thinking Big",
      author: "David Schwartz",
      summary: "Your results are limited only by your thinking. Expand what you believe is possible and watch your sales follow."
    },
    {
      title: "Never Split the Difference",
      author: "Chris Voss",
      summary: "FBI hostage negotiator tactics for sales. Master tactical empathy and get customers to say yes without feeling pressured."
    },
    {
      title: "Extreme Ownership",
      author: "Jocko Willink & Leif Babin",
      summary: "Take 100% responsibility for your results. No excuses, no blame—just solutions. The mindset that separates top performers."
    },
    {
      title: "The Power of One More",
      author: "Ed Mylett",
      summary: "One more door, one more attempt, one more day of effort. The philosophy that turns good summers into legendary ones."
    },
    {
      title: "ABC'$ of Closing",
      author: "Sam Taggart",
      summary: "The D2D bible. Proven closing techniques from the founder of D2D Experts—mandatory reading for any serious rep."
    },
    {
      title: "As a Man Thinketh",
      author: "James Allen",
      summary: "Your thoughts shape your reality. A short, powerful read on mastering your mindset to achieve any goal."
    },
    {
      title: "The Psychology of Selling",
      author: "Brian Tracy",
      summary: "Understand why people buy. When you know the psychology, objections become opportunities."
    },
    {
      title: "Above the Line",
      author: "Urban Meyer",
      summary: "Championship-level discipline and accountability. Build the mental toughness to perform when it matters most."
    },
    {
      title: "How to Win Friends and Influence People",
      author: "Dale Carnegie",
      summary: "The classic guide to connecting with anyone. Build instant rapport at the door and turn strangers into customers."
    },
    {
      title: "Millionaire Success Habits",
      author: "Dean Graziosi",
      summary: "Daily habits that separate the wealthy from everyone else. Apply these to your sales career starting day one."
    },
    {
      title: "The One Thing",
      author: "Gary Keller",
      summary: "Focus beats multitasking every time. Identify the ONE thing that moves the needle most and dominate it."
    },
    {
      title: "Can't Hurt Me",
      author: "David Goggins",
      summary: "Push past every mental barrier. When you're tired, hot, and want to quit—this book teaches you to keep going."
    }
  ];

  const categories: TrainingCategory[] = [
    {
      title: "Door Approaches",
      description: "Master the three core approaches",
      icon: DoorOpen,
      items: [
        { title: "Takeover Pitch", href: "https://calvinschofield.notion.site/Takeover-Door-Approach-18c070fe3bc2800bad33c0818f0f0489" },
        { title: "Fresh Pitch", href: "https://calvinschofield.notion.site/Fresh-Door-Approach-18c070fe3bc2803fbffdd0642363096c" },
        { title: "Upgrade Pitch", href: "https://calvinschofield.notion.site/Upgrade-Door-Approach-18c070fe3bc28077a280ee0783b4881b" },
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
      title: "Objections & Competitors",
      description: "Handle any pushback with confidence",
      icon: MessageSquare,
      items: [
        { title: "Common Objections & Responses", href: "https://calvinschofield.notion.site/common-objections" },
        { title: "Competitor Cheat Sheet", href: "https://calvinschofield.notion.site/Competitor-Cheat-Sheet-19e070fe3bc2801eb801fbfea8622be0" },
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
        {!loading && !isVetOrSophomore && (
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
                  
                  return (
                    <a
                      key={item.title}
                      href={isDisabled ? "#" : item.href}
                      target={!isDisabled && item.href.startsWith("http") ? "_blank" : undefined}
                      rel={!isDisabled && item.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      onClick={isDisabled ? (e) => e.preventDefault() : undefined}
                      className={`flex items-center justify-between p-3 rounded-lg transition-colors group ${
                        isDisabled 
                          ? "cursor-not-allowed" 
                          : "hover:bg-accent"
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
                      {item.href.startsWith("http") && !isDisabled ? (
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

        {/* Recommended Sales Books */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <BookMarked className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Recommended Sales Books</CardTitle>
            </div>
            <CardDescription>
              Build the mindset and skills to have your best summer yet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {books.map((book, index) => (
                <AccordionItem key={index} value={`book-${index}`}>
                  <AccordionTrigger className="text-left hover:no-underline">
                    <div>
                      <div className="font-medium">{book.title}</div>
                      <div className="text-xs text-muted-foreground">{book.author}</div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {book.summary}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Training;
