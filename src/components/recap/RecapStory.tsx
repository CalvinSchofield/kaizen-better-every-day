import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { RecapStats } from '@/hooks/useRecapData';
import { RecapCoverSlide } from './RecapCoverSlide';
import { RecapInputsSlide } from './RecapInputsSlide';
import { RecapBestDaySlide } from './RecapBestDaySlide';
import { RecapTimingSlide } from './RecapTimingSlide';
import { RecapComparisonSlide } from './RecapComparisonSlide';
import { RecapSummarySlide } from './RecapSummarySlide';
import { RecapRecordsSlide } from './RecapRecordsSlide';
import { RecapMeVsMeSlide } from './RecapMeVsMeSlide';
import { RecapDealBreakdownSlide } from './RecapDealBreakdownSlide';
import { RecapGoalsPaceSlide } from './RecapGoalsPaceSlide';
import { useRecapMeVsMeComparison } from '@/hooks/useRecapMeVsMeComparison';
import { useMeVsMe } from '@/hooks/useMeVsMe';
import { useEfpMode } from '@/hooks/useEfpMode';
import { format } from 'date-fns';
import confetti from 'canvas-confetti';
import { usePastRecaps } from '@/hooks/usePastRecaps';

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
  const [hasSavedRecap, setHasSavedRecap] = useState(false);
  
  const { isEnabled: meVsMeEnabled } = useMeVsMe();
  const { efpModeEnabled } = useEfpMode();
  const { data: meVsMeData } = useRecapMeVsMeComparison(stats.period);
  const { saveRecap } = usePastRecaps();

  // Check if any personal records were set
  const hasRecords = Object.values(stats.records).some(r => r.isRecord);

  // Build slides array based on available data
  const slides: React.ReactNode[] = [
    <RecapCoverSlide key="cover" stats={stats} />,
    <RecapInputsSlide 
      key="inputs"
      doors={stats.totalDoors}
      pitches={stats.totalPitches}
      transitions={stats.totalTransitions}
      presentations={stats.totalPresentations}
      closes={stats.totalCloses}
      daysWorked={stats.daysWorked}
      comparison={stats.inputComparison}
    />,
    <RecapTimingSlide 
      key="timing"
      avgStartTime={stats.avgStartTime}
      avgEndTime={stats.avgEndTime}
      totalHours={stats.totalHoursWorked}
      peakHour={stats.peakHour}
      daysWorked={stats.daysWorked}
      timeComparison={stats.timeComparison}
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

  // Add personal records slide if any records were set
  if (hasRecords) {
    slides.push(
      <RecapRecordsSlide key="records" records={stats.records} />
    );
  }

  // Deal breakdown slide (if CRM enabled and has data)
  if (stats.dealBreakdown && stats.dealBreakdown.totalDeals > 0) {
    slides.push(
      <RecapDealBreakdownSlide key="deals" dealBreakdown={stats.dealBreakdown} />
    );
  }

  slides.push(
    <RecapComparisonSlide 
      key="comparison"
      period={stats.period}
      comparison={stats.comparison}
    />
  );

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

  // Add Goals Pace slide before summary
  slides.push(
    <RecapGoalsPaceSlide key="goals-pace" stats={stats} />
  );

  slides.push(
    <RecapSummarySlide key="summary" stats={stats} />
  );

  const totalSlides = slides.length;

  // Save recap to database when reaching the last slide
  useEffect(() => {
    const saveRecapToDb = async () => {
      if (currentSlide === totalSlides - 1 && !hasSavedRecap) {
        setHasSavedRecap(true);
        try {
          await saveRecap({
            period_type: stats.period,
            period_start: format(stats.dateRange.start, 'yyyy-MM-dd'),
            period_end: format(stats.dateRange.end, 'yyyy-MM-dd'),
            period_label: stats.periodLabel || format(stats.dateRange.start, stats.period === 'week' ? "'Week of' MMM d" : 'MMMM yyyy'),
            days_worked: stats.daysWorked,
            total_fp: stats.totalFpPlus,
            total_prmr: stats.totalPrmr,
            stats_json: stats,
          });
        } catch (error) {
          console.error('Failed to save recap:', error);
        }
      }
    };
    saveRecapToDb();
  }, [currentSlide, totalSlides, hasSavedRecap, saveRecap, stats]);

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
      className="fixed inset-0 z-[60] bg-background"
    >
      <div className={`absolute inset-0 bg-gradient-to-b ${gradients[gradientIndex]} transition-all duration-500`} />

      <div 
        className="absolute left-0 right-0 flex justify-center gap-1.5 px-4 z-10"
        style={{ top: 'calc(var(--effective-safe-area-top, 0px) + 16px)' }}
      >
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

      <button
        onClick={onClose}
        className="absolute right-4 z-10 p-2 rounded-full bg-muted/50 hover:bg-muted transition-colors"
        style={{ top: 'calc(var(--effective-safe-area-top, 0px) + 16px)' }}
      >
        <X className="w-5 h-5" />
      </button>

      <div className="relative h-full pt-12 pb-8 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="min-h-full"
          >
            {slides[currentSlide]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Touch areas for navigation - only at bottom to not block scrolling */}
      <div 
        className="absolute left-0 bottom-0 w-1/3 h-24 z-5"
        onClick={handlePrev}
      />
      <div 
        className="absolute right-0 bottom-0 w-2/3 h-24 z-5"
        onClick={handleNext}
      />
    </motion.div>
  );
}
