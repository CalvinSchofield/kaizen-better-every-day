import { useState, useCallback, ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { IntroSlide } from "@/components/intro/IntroSlide";
import { ChevronLeft, ChevronRight, Home, Menu, Map, BookOpen, Target, BarChart3, Calendar, TrendingUp, Users, Trophy, ClipboardList } from "lucide-react";

type UserType = 'pre-blitz-rookie' | 'post-blitz-rookie' | 'vet' | 'leader';

interface IntroWizardProps {
  userType: UserType;
  firstName: string;
  onComplete: () => void;
}

interface SlideConfig {
  icon: ReactNode;
  title: string;
  description: string;
  highlight?: string;
}

// Helper to strip emojis from text
const stripEmojis = (text: string): string => {
  if (!text) return '';
  // Remove emojis using a simpler, more reliable pattern
  return text.replace(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu, '').trim();
};

const getSlides = (userType: UserType, firstName: string): SlideConfig[] => {
  const cleanName = stripEmojis(firstName);
  
  // Welcome slide for everyone
  const welcomeSlide: SlideConfig = {
    icon: <Home className="w-16 h-16 text-primary" />,
    title: `Welcome, ${cleanName}!`,
    description: "Kaizen is your one-stop hub for everything you need to succeed at Vivint. Let's show you around.",
    highlight: "Let's get started"
  };

  // Navigation overview
  const navSlide: SlideConfig = {
    icon: <Menu className="w-16 h-16 text-primary" />,
    title: "Easy Navigation",
    description: "Use the bottom tabs to switch between pages. The menu icon in the top-left has more options and resources.",
  };

  // Pre-blitz rookie slides
  if (userType === 'pre-blitz-rookie') {
    return [
      welcomeSlide,
      navSlide,
      {
        icon: <Map className="w-16 h-16 text-primary" />,
        title: "Your Journey Home",
        description: "Home is your roadmap. Follow the steps to get blitz-ready. Each step unlocks as you progress.",
        highlight: "Step by step"
      },
      {
        icon: <BookOpen className="w-16 h-16 text-primary" />,
        title: "Training Hub",
        description: "Study product knowledge, practice pitches, and complete required trainings. Everything you need to prepare.",
      },
      {
        icon: <Calendar className="w-16 h-16 text-primary" />,
        title: "Pick Your Blitz",
        description: "View upcoming blitzes and commit to dates. Your calendar shows all team events and your commitments.",
      },
      {
        icon: <Target className="w-16 h-16 text-primary" />,
        title: "Set Your Goals",
        description: "Plan your summer earnings. Set FP+ goals and track your preseason progress toward blitz-ready.",
        highlight: "Dream big!"
      },
    ];
  }

  // Post-blitz rookie, vet, or leader slides (all get knocking features)
  const baseSlides: SlideConfig[] = [
    welcomeSlide,
    navSlide,
    {
      icon: <ClipboardList className="w-16 h-16 text-primary" />,
      title: "Track Your Day",
      description: "Log doors, pitches, transitions, and sales. Watch your numbers add up in real-time as you knock.",
      highlight: "Tap to count"
    },
    {
      icon: <Calendar className="w-16 h-16 text-primary" />,
      title: "Calendar View",
      description: "See your daily progress over time. Review past entries and plan future work days.",
    },
    {
      icon: <TrendingUp className="w-16 h-16 text-primary" />,
      title: "Insights & Analytics",
      description: "Dive into your performance data. See your best times, strongest ratios, and areas to improve.",
    },
    {
      icon: <Trophy className="w-16 h-16 text-primary" />,
      title: "Leaderboards",
      description: "Compete with teammates. See where you rank today, this week, and for the season.",
      highlight: "Rise to the top"
    },
    {
      icon: <Target className="w-16 h-16 text-primary" />,
      title: "Goals & Pace",
      description: "Track your progress toward your FP+ goals. Stay on pace to hit your targets.",
    },
  ];

  // Add leader-specific slides
  if (userType === 'leader') {
    return [
      ...baseSlides,
      {
        icon: <BarChart3 className="w-16 h-16 text-primary" />,
        title: "Team Reports",
        description: "View your team's performance at a glance. Identify who needs coaching and celebrate top performers.",
      },
      {
        icon: <Users className="w-16 h-16 text-primary" />,
        title: "My Group",
        description: "Manage your recruiting pipeline. Track recruits, log contacts, and help them prepare for their first blitz.",
        highlight: "Build your team"
      },
    ];
  }

  // Post-blitz rookie or vet (no leader features)
  return baseSlides;
};

export const IntroWizard = ({ userType, firstName, onComplete }: IntroWizardProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = getSlides(userType, firstName);
  const totalSlides = slides.length;
  const isLastSlide = currentSlide === totalSlides - 1;

  const handleNext = useCallback(() => {
    console.log('handleNext called, isLastSlide:', isLastSlide, 'currentSlide:', currentSlide);
    if (isLastSlide) {
      onComplete();
    } else {
      setCurrentSlide(prev => prev + 1);
    }
  }, [isLastSlide, onComplete, currentSlide]);

  const handlePrev = useCallback(() => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  }, [currentSlide]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // Haptic feedback
  const vibrate = () => {
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      {/* Header with skip button */}
      <div className="flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))] pointer-events-auto relative z-10">
        <div className="w-16" /> {/* Spacer */}
        <span className="text-xl font-bold text-primary">Kaizen</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            console.log('Skip clicked');
            vibrate();
            handleSkip();
          }}
          className="text-muted-foreground pointer-events-auto"
        >
          Skip
        </Button>
      </div>

      {/* Slide content */}
      <div className="flex-1 flex items-center justify-center overflow-hidden px-6 pointer-events-none">
        <AnimatePresence mode="wait">
          <IntroSlide
            key={currentSlide}
            icon={slides[currentSlide].icon}
            title={slides[currentSlide].title}
            description={slides[currentSlide].description}
            highlight={slides[currentSlide].highlight}
          />
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2 mb-6 pointer-events-auto relative z-10">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              console.log('Dot clicked:', index);
              vibrate();
              setCurrentSlide(index);
            }}
            className={`w-2 h-2 rounded-full transition-all duration-300 pointer-events-auto ${
              index === currentSlide 
                ? 'w-6 bg-primary' 
                : index < currentSlide 
                  ? 'bg-primary/50' 
                  : 'bg-muted-foreground/30'
            }`}
          />
        ))}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between p-4 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.5rem))] pointer-events-auto relative z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            console.log('Prev button clicked');
            vibrate();
            handlePrev();
          }}
          disabled={currentSlide === 0}
          className="w-12 h-12 rounded-full pointer-events-auto"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>

        <Button
          onClick={(e) => {
            e.stopPropagation();
            console.log('Next button clicked');
            vibrate();
            handleNext();
          }}
          className="px-8 h-12 rounded-full font-semibold pointer-events-auto"
        >
          {isLastSlide ? "Get Started" : "Next"}
          {!isLastSlide && <ChevronRight className="w-5 h-5 ml-1" />}
        </Button>

        <div className="w-12" /> {/* Spacer for alignment */}
      </div>
    </div>
  );
};