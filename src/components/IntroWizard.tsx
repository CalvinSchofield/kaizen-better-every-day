import { useState, useCallback, ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { IntroSlide } from "@/components/intro/IntroSlide";
import { StatSlide } from "@/components/intro/StatSlide";
import { VideoSlide } from "@/components/intro/VideoSlide";
import { ImageSlide } from "@/components/intro/ImageSlide";
import { CarouselSlide } from "@/components/intro/CarouselSlide";
import { GridSlide } from "@/components/intro/GridSlide";
import { AccoladesSlide } from "@/components/intro/AccoladesSlide";
import { PhotoUploadSlide } from "@/components/intro/PhotoUploadSlide";
import { CTASlide } from "@/components/intro/CTASlide";
import { ChevronLeft, ChevronRight, Home, Map, BookOpen, Target, Calendar, Camera, Sparkles, Users } from "lucide-react";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { hapticLight, hapticSelection } from "@/utils/haptics";
import { prefetchAboutTeamImages } from "@/hooks/useAboutTeamPrefetch";
import { 
  getPreBlitzRookieSlides, 
  getKnockingUserSlides, 
  IntroSlideConfig,
  IconName 
} from "@/data/introSlides";

// Preload all leader and slide images on mount
const preloadImages = (slides: IntroSlideConfig[]) => {
  const imagesToPreload: string[] = [];
  
  slides.forEach(slide => {
    if (slide.imageSrc) imagesToPreload.push(slide.imageSrc);
    if (slide.videoThumbnail) imagesToPreload.push(slide.videoThumbnail);
    if (slide.gridItems) {
      slide.gridItems.forEach(item => imagesToPreload.push(item.photo));
    }
    if (slide.carouselItems) {
      slide.carouselItems.forEach(item => imagesToPreload.push(item.photo));
    }
  });
  
  imagesToPreload.forEach(src => {
    const img = new Image();
    img.src = src;
  });
};

type UserType = 'pre-blitz-rookie' | 'post-blitz-rookie' | 'vet' | 'leader';

interface IntroWizardProps {
  userType: UserType;
  firstName: string;
  onComplete: () => void;
}

// Icon mapping
const getIcon = (iconName: IconName | undefined): ReactNode => {
  if (!iconName) return null;
  
  const iconClass = "w-16 h-16 text-primary";
  const icons: Record<IconName, ReactNode> = {
    'home': <Home className={iconClass} />,
    'map': <Map className={iconClass} />,
    'book-open': <BookOpen className={iconClass} />,
    'target': <Target className={iconClass} />,
    'calendar': <Calendar className={iconClass} />,
    'camera': <Camera className={iconClass} />,
    'sparkles': <Sparkles className={iconClass} />,
    'users': <Users className={iconClass} />,
  };
  
  return icons[iconName];
};

const getSlides = (userType: UserType, firstName: string): IntroSlideConfig[] => {
  if (userType === 'pre-blitz-rookie') {
    return getPreBlitzRookieSlides(firstName);
  }
  
  const isLeader = userType === 'leader';
  return getKnockingUserSlides(firstName, isLeader);
};

export const IntroWizard = ({ userType, firstName, onComplete }: IntroWizardProps) => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = getSlides(userType, firstName);
  const totalSlides = slides.length;
  const isLastSlide = currentSlide === totalSlides - 1;
  const currentSlideData = slides[currentSlide];

  // Preload all images when wizard mounts
  useEffect(() => {
    preloadImages(slides);
    
    // Pre-blitz rookies will navigate to About Team, so prefetch those images early
    if (userType === 'pre-blitz-rookie') {
      prefetchAboutTeamImages();
    }
  }, [userType]);

  const handleNext = useCallback(() => {
    if (isLastSlide) {
      // Pre-blitz rookies go to About Team to learn more about the opportunity
      if (userType === 'pre-blitz-rookie') {
        onComplete();
        navigate('/about-team');
      } else {
        onComplete();
      }
    } else {
      setCurrentSlide(prev => prev + 1);
    }
  }, [isLastSlide, onComplete, userType, navigate]);

  const handlePrev = useCallback(() => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  }, [currentSlide]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // Swipe navigation
  const { onTouchStart, onTouchMove, onTouchEnd } = useSwipeNavigation({
    onSwipeLeft: () => {
      hapticSelection();
      handleNext();
    },
    onSwipeRight: () => {
      hapticSelection();
      handlePrev();
    },
    threshold: 50,
  });

  // Render the appropriate slide type
  const renderSlide = () => {
    const slide = currentSlideData;
    
    switch (slide.type) {
      case 'stat':
        return (
          <StatSlide
            key={slide.id}
            title={slide.title}
            description={slide.description}
            statValue={slide.statValue || 0}
            statPrefix={slide.statPrefix}
            statSuffix={slide.statSuffix}
            statLabel={slide.statLabel}
          />
        );
      
      case 'video':
        return (
          <VideoSlide
            key={slide.id}
            title={slide.title}
            description={slide.description}
            videoThumbnail={slide.videoThumbnail}
            videoUrl={slide.videoUrl}
          />
        );
      
      case 'image':
        return (
          <ImageSlide
            key={slide.id}
            title={slide.title}
            description={slide.description}
            imageSrc={slide.imageSrc || ''}
            imageAlt={slide.imageAlt}
            highlight={slide.highlight}
            overlayPosition={slide.overlayPosition}
          />
        );
      
      case 'carousel':
        return (
          <CarouselSlide
            key={slide.id}
            title={slide.title}
            description={slide.description}
            carouselItems={slide.carouselItems || []}
          />
        );
      
      case 'grid':
        return (
          <GridSlide
            key={slide.id}
            title={slide.title}
            description={slide.description}
            gridItems={slide.gridItems || []}
          />
        );
      
      case 'accolades':
        return (
          <AccoladesSlide
            key={slide.id}
            title={slide.title}
            description={slide.description}
          />
        );
      
      case 'photo-upload':
        return (
          <PhotoUploadSlide
            key={slide.id}
            title={slide.title}
            description={slide.description}
          />
        );
      
      case 'cta':
        return (
          <CTASlide
            key={slide.id}
            icon={getIcon(slide.iconName)}
            title={slide.title}
            description={slide.description}
            showConfetti={slide.showConfetti}
          />
        );
      
      default:
        return (
          <IntroSlide
            key={slide.id}
            icon={getIcon(slide.iconName)}
            title={slide.title}
            description={slide.description}
            highlight={slide.highlight}
          />
        );
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
            hapticLight();
            handleSkip();
          }}
          className="text-muted-foreground pointer-events-auto"
        >
          Skip
        </Button>
      </div>

      {/* Slide content - swipeable area */}
      <div 
        className="flex-1 flex items-center justify-center overflow-hidden px-6 touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <AnimatePresence mode="wait">
          {renderSlide()}
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2 mb-6 pointer-events-auto relative z-10">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              hapticLight();
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
      <div className="flex items-center justify-end gap-4 p-4 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.5rem))] pointer-events-auto relative z-10">
        {currentSlide > 0 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              hapticLight();
              handlePrev();
            }}
            className="w-12 h-12 rounded-full pointer-events-auto absolute left-4"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
        )}

        <Button
          onClick={(e) => {
            e.stopPropagation();
            hapticLight();
            handleNext();
          }}
          className="px-8 h-12 rounded-full font-semibold pointer-events-auto"
        >
          {isLastSlide ? (userType === 'pre-blitz-rookie' ? "Meet the Team" : "Get Started") : "Next"}
          {!isLastSlide && <ChevronRight className="w-5 h-5 ml-1" />}
        </Button>
      </div>
    </div>
  );
};
