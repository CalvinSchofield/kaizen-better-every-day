import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { IntroSlide } from "@/components/intro/IntroSlide";
import { 
  Home, 
  GraduationCap, 
  Calendar, 
  Target, 
  TrendingUp, 
  Trophy, 
  Users, 
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Compass,
  Flame
} from "lucide-react";
import KaizenLogo from "@/components/KaizenLogo";

type UserType = 'pre-blitz-rookie' | 'post-blitz-rookie' | 'vet' | 'leader';

interface IntroWizardProps {
  userType: UserType;
  firstName: string;
  onComplete: () => void;
}

interface SlideConfig {
  icon: any;
  iconColor?: string;
  title: string;
  description: string;
  highlight?: string;
}

const getSlides = (userType: UserType, firstName: string): SlideConfig[] => {
  // Welcome slide for everyone
  const welcomeSlide: SlideConfig = {
    icon: Home,
    iconColor: "text-primary",
    title: `Welcome, ${firstName}!`,
    description: "Kaizen is your one-stop hub for everything you need to succeed at Vivint. Let's show you around.",
    highlight: "Let's get started"
  };

  // Navigation overview
  const navSlide: SlideConfig = {
    icon: Compass,
    iconColor: "text-primary",
    title: "Easy Navigation",
    description: "Use the bottom tabs to switch between pages. The menu icon in the top-left has more options and resources.",
  };

  // Pre-blitz rookie slides
  if (userType === 'pre-blitz-rookie') {
    return [
      welcomeSlide,
      navSlide,
      {
        icon: Home,
        iconColor: "text-primary",
        title: "Your Journey Home",
        description: "Home is your roadmap. Follow the steps to get blitz-ready. Each step unlocks as you progress.",
        highlight: "Step by step"
      },
      {
        icon: GraduationCap,
        iconColor: "text-blue-500",
        title: "Training Hub",
        description: "Study product knowledge, practice pitches, and complete required trainings. Everything you need to prepare.",
      },
      {
        icon: Calendar,
        iconColor: "text-green-500",
        title: "Pick Your Blitz",
        description: "View upcoming blitzes and commit to dates. Your calendar shows all team events and your commitments.",
      },
      {
        icon: Target,
        iconColor: "text-amber-500",
        title: "Set Your Goals",
        description: "Plan your summer earnings. Set FP+ goals and track your preseason progress toward blitz-ready.",
        highlight: "Dream big!"
      },
    ];
  }

  // Post-blitz rookie or vet slides
  if (userType === 'post-blitz-rookie' || userType === 'vet') {
    const baseSlides: SlideConfig[] = [
      welcomeSlide,
      navSlide,
      {
        icon: Flame,
        iconColor: "text-orange-500",
        title: "Track Your Day",
        description: "Log doors, pitches, transitions, and sales. Watch your numbers add up in real-time as you knock.",
        highlight: "Tap to count"
      },
      {
        icon: Calendar,
        iconColor: "text-green-500",
        title: "Calendar View",
        description: "See your daily progress over time. Review past entries and plan future work days.",
      },
      {
        icon: TrendingUp,
        iconColor: "text-blue-500",
        title: "Insights & Analytics",
        description: "Dive into your performance data. See your best times, strongest ratios, and areas to improve.",
      },
      {
        icon: Trophy,
        iconColor: "text-amber-500",
        title: "Leaderboards",
        description: "Compete with teammates. See where you rank today, this week, and for the season.",
        highlight: "Rise to the top"
      },
      {
        icon: Target,
        iconColor: "text-primary",
        title: "Goals & Pace",
        description: "Track your progress toward your FP+ goals. Stay on pace to hit your targets.",
      },
    ];

    return baseSlides;
  }

  // Leader slides (standalone)
  if (userType === 'leader') {
    return [
      welcomeSlide,
      navSlide,
      {
        icon: Flame,
        iconColor: "text-orange-500",
        title: "Track Your Day",
        description: "Log doors, pitches, transitions, and sales. Watch your numbers add up in real-time as you knock.",
        highlight: "Tap to count"
      },
      {
        icon: Calendar,
        iconColor: "text-green-500",
        title: "Calendar View",
        description: "See your daily progress over time. Review past entries and plan future work days.",
      },
      {
        icon: TrendingUp,
        iconColor: "text-blue-500",
        title: "Insights & Analytics",
        description: "Dive into your performance data. See your best times, strongest ratios, and areas to improve.",
      },
      {
        icon: Trophy,
        iconColor: "text-amber-500",
        title: "Leaderboards",
        description: "Compete with teammates. See where you rank today, this week, and for the season.",
      },
      {
        icon: BarChart3,
        iconColor: "text-purple-500",
        title: "Team Reports",
        description: "View your team's performance at a glance. Identify who needs coaching and celebrate top performers.",
      },
      {
        icon: Users,
        iconColor: "text-teal-500",
        title: "My Group",
          description: "Manage your recruiting pipeline. Track recruits, log contacts, and help them prepare for their first blitz.",
          highlight: "Build your team"
        },
      ];
    }

    return baseSlides;
  }

  // Leader-only (if not vet)
  if (userType === 'leader') {
    return [
      welcomeSlide,
      navSlide,
      {
        icon: BarChart3,
        iconColor: "text-purple-500",
        title: "Team Reports",
        description: "View your team's performance at a glance. Identify who needs coaching and celebrate top performers.",
      },
      {
        icon: Users,
        iconColor: "text-teal-500",
        title: "My Group",
        description: "Manage your recruiting pipeline. Track recruits, log contacts, and help them prepare for their first blitz.",
        highlight: "Build your team"
      },
    ];
  }

  // Fallback
  return [welcomeSlide, navSlide];
};

export const IntroWizard = ({ userType, firstName, onComplete }: IntroWizardProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = getSlides(userType, firstName);
  const totalSlides = slides.length;
  const isLastSlide = currentSlide === totalSlides - 1;

  const handleNext = useCallback(() => {
    if (isLastSlide) {
      onComplete();
    } else {
      setCurrentSlide(prev => prev + 1);
    }
  }, [isLastSlide, onComplete]);

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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background flex flex-col"
    >
      {/* Header with skip button */}
      <div className="flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="w-10" /> {/* Spacer */}
        <KaizenLogo className="w-8 h-8" />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSkip}
          className="text-muted-foreground"
        >
          Skip
        </Button>
      </div>

      {/* Slide content */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          <IntroSlide
            key={currentSlide}
            icon={slides[currentSlide].icon}
            iconColor={slides[currentSlide].iconColor}
            title={slides[currentSlide].title}
            description={slides[currentSlide].description}
            highlight={slides[currentSlide].highlight}
          />
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2 mb-6">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              vibrate();
              setCurrentSlide(index);
            }}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
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
      <div className="flex items-center justify-between p-4 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.5rem))]">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            vibrate();
            handlePrev();
          }}
          disabled={currentSlide === 0}
          className="w-12 h-12 rounded-full"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>

        <Button
          onClick={() => {
            vibrate();
            handleNext();
          }}
          className="px-8 h-12 rounded-full font-semibold"
        >
          {isLastSlide ? "Get Started" : "Next"}
          {!isLastSlide && <ChevronRight className="w-5 h-5 ml-1" />}
        </Button>

        <div className="w-12" /> {/* Spacer for alignment */}
      </div>
    </motion.div>
  );
};
