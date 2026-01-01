import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { DoorOpen, Users, MessageSquare, ArrowRightLeft, Presentation, CheckCircle } from 'lucide-react';
import { RecapStats } from '@/hooks/useRecapData';
import { RecapCoverSlide } from './RecapCoverSlide';
import { RecapStatSlide } from './RecapStatSlide';
import { RecapBestDaySlide } from './RecapBestDaySlide';
import { RecapTimingSlide } from './RecapTimingSlide';
import { RecapComparisonSlide } from './RecapComparisonSlide';
import { RecapSummarySlide } from './RecapSummarySlide';
import { RecapRecordsSlide } from './RecapRecordsSlide';
import { RecapMeVsMeSlide } from './RecapMeVsMeSlide';
import { useRecapMeVsMeComparison } from '@/hooks/useRecapMeVsMeComparison';
import { useMeVsMe } from '@/hooks/useMeVsMe';
import { useEfpMode } from '@/hooks/useEfpMode';
import { format } from 'date-fns';
import confetti from 'canvas-confetti';

interface RecapStoryProps {
  stats: RecapStats;
  onClose: () => void;
  onComplete: () => void;
}

const slideVariants = {
  enter: { opacity: 0, scale: 0.95 },
  center: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 1.05 }
};

const gradients = [
  'from-background via-background to-primary/10',
  'from-background via-primary/5 to-primary/20',
  'from-background via-yellow-500/5 to-yellow-500/15',
  'from-background via-blue-500/5 to-blue-500/15',
  'from-background via-purple-500/5 to-purple-500/15',
  'from-background via-green-500/5 to-green-500/20',
];

export function RecapStory({ stats, onClose, onComplete }: RecapStoryProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [hasTriggeredConfetti, setHasTriggeredConfetti] = useState(false);
  
  // Me vs Me hooks
  const { isEnabled: meVsMeEnabled } = useMeVsMe();
  const { efpModeEnabled } = useEfpMode();
  const { data: meVsMeData } = useRecapMeVsMeComparison(stats.period);

  // Check if any personal records were set
  const hasRecords = 
    stats.records.mostDoorsInDay.isRecord ||
    stats.records.mostFpInDay.isRecord ||
    stats.records.mostHoursInDay.isRecord ||
    stats.records.earliestStart.isRecord;

  // Build slides array based on available data
  const slides: React.ReactNode[] = [
    <RecapCoverSlide key="cover" stats={stats} />,
    <RecapStatSlide 
      key="doors" 
      icon={DoorOpen} 
      label="Doors Knocked" 
      value={stats.totalDoors}
      subtitle={`${stats.daysWorked} days worked`}
      isRecord={stats.records.mostDoorsInDay.isRecord}
    />,
    <RecapStatSlide 
      key="transitions" 
      icon={ArrowRightLeft} 
      label="Transitions" 
      value={stats.totalTransitions}
    />,
    <RecapStatSlide 
      key="presentations" 
      icon={Presentation} 
      label="Presentations" 
      value={stats.totalPresentations}
    />,
  ];

  if (stats.bestDay) {
    slides.push(
      <RecapBestDaySlide 
        key="bestday"
        date={stats.bestDay.date}
        doors={stats.bestDay.doors}
        fpPlus={stats.bestDay.fpPlus}
      />
    );
  }

  slides.push(
    <RecapTimingSlide 
      key="timing"
      avgStartTime={stats.avgStartTime}
      avgEndTime={stats.avgEndTime}
      totalHours={stats.totalHoursWorked}
      peakHour={stats.peakHour}
    />
  );

  // Add personal records slide if any records were set
  if (hasRecords) {
    slides.push(
      <RecapRecordsSlide key="records" records={stats.records} />
    );
  }

  slides.push(
    <RecapComparisonSlide 
      key="comparison"
      period={stats.period}
      comparison={stats.comparison}
    />
  );

  // Get the reviewed month name from the stats date range
  const reviewedMonthName = stats.period === 'month' 
    ? format(stats.dateRange.start, 'MMMM') 
    : undefined;

  // Add Me vs Me slide if enabled and has historical data
  if (meVsMeEnabled && meVsMeData?.hasHistoricalData) {
    slides.push(
      <RecapMeVsMeSlide
        key="mevsme"
        period={stats.period}
        comparisonYear={meVsMeData.comparisonYear}
        comparison={meVsMeData.comparison}
        hasHistoricalData={meVsMeData.hasHistoricalData}
        efpModeEnabled={efpModeEnabled}
        reviewedMonthName={reviewedMonthName}
      />
    );
  }

  slides.push(
    <RecapSummarySlide key="summary" stats={stats} />
  );

  const totalSlides = slides.length;

  // Trigger confetti on summary slide if they have good results
  useEffect(() => {
    if (currentSlide === totalSlides - 1 && !hasTriggeredConfetti && stats.totalFpPlus > 0) {
      setHasTriggeredConfetti(true);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [currentSlide, totalSlides, hasTriggeredConfetti, stats.totalFpPlus]);

  const handleNext = () => {
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide(prev => prev + 1);
    } else {
      onComplete();
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  const gradientIndex = currentSlide % gradients.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background"
    >
      {/* Gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-b ${gradients[gradientIndex]} transition-all duration-500`} />

      {/* Progress dots */}
      <div className="absolute top-4 left-0 right-0 flex justify-center gap-1.5 px-4 z-10">
        {slides.map((_, idx) => (
          <div
            key={idx}
            className={`h-1 rounded-full transition-all duration-300 ${
              idx === currentSlide 
                ? 'bg-primary w-6' 
                : idx < currentSlide 
                  ? 'bg-primary/50 w-4'
                  : 'bg-muted w-4'
            }`}
          />
        ))}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-muted/50 hover:bg-muted transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Slide content */}
      <div className="relative h-full pt-12 pb-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {slides[currentSlide]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Touch areas */}
      <div 
        className="absolute left-0 top-0 w-1/3 h-full z-5"
        onClick={handlePrev}
      />
      <div 
        className="absolute right-0 top-0 w-2/3 h-full z-5"
        onClick={handleNext}
      />
    </motion.div>
  );
}
