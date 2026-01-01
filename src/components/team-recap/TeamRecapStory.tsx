import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { WeeklyReport } from '@/hooks/useWeeklyReports';
import { TeamRecapCoverSlide } from './TeamRecapCoverSlide';
import { OfficeStatsSlide } from './OfficeStatsSlide';
import { Top10Slide } from './Top10Slide';
import { TeamRankingsSlide } from './TeamRankingsSlide';
import { SuperlativesSlide } from './SuperlativesSlide';
import { TeamRecordsSlide } from './TeamRecordsSlide';
import { TeamRecapSummarySlide } from './TeamRecapSummarySlide';

interface TeamRecapStoryProps {
  report: WeeklyReport;
  onClose: () => void;
  onEditValue?: (field: string, label: string, currentValue: number | string, type?: 'number' | 'text') => void;
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
  'from-background via-orange-500/5 to-orange-500/15',
];

export function TeamRecapStory({ report, onClose, onEditValue }: TeamRecapStoryProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [hasTriggeredConfetti, setHasTriggeredConfetti] = useState(false);

  const data = { ...report.data, ...report.edits };

  // Build slides array
  const slides: React.ReactNode[] = [
    <TeamRecapCoverSlide 
      key="cover" 
      reportType={report.report_type}
      periodStart={report.period_start}
      periodEnd={report.period_end}
    />,
    <OfficeStatsSlide 
      key="office-stats" 
      totals={data.officeTotals}
      growth={data.growth}
      onEditValue={onEditValue}
    />,
  ];

  // Add Top 10 slides for each class that has data
  if (data.top10Rookies?.length > 0) {
    slides.push(
      <Top10Slide 
        key="top10-rookies" 
        title="TOP ROOKIES" 
        reps={data.top10Rookies}
        accentColor="text-green-500"
        slideKey="top10Rookies"
        onEditValue={onEditValue}
      />
    );
  }

  if (data.top10Sophomores?.length > 0) {
    slides.push(
      <Top10Slide 
        key="top10-sophomores" 
        title="TOP SOPHOMORES" 
        reps={data.top10Sophomores}
        accentColor="text-blue-500"
        slideKey="top10Sophomores"
        onEditValue={onEditValue}
      />
    );
  }

  if (data.top10Vets?.length > 0) {
    slides.push(
      <Top10Slide 
        key="top10-vets" 
        title="TOP VETS" 
        reps={data.top10Vets}
        accentColor="text-purple-500"
        slideKey="top10Vets"
        onEditValue={onEditValue}
      />
    );
  }

  // Team rankings
  if (data.teamRankings?.length > 0) {
    slides.push(
      <TeamRankingsSlide 
        key="team-rankings" 
        title="TEAM STANDINGS"
        rankings={data.teamRankings}
        slideKey="teamRankings"
        onEditValue={onEditValue}
      />
    );
  }

  // MGMT rankings
  if (data.mgmtRankings?.length > 1) {
    slides.push(
      <TeamRankingsSlide 
        key="mgmt-rankings" 
        title="MGMT GROUP STANDINGS"
        rankings={data.mgmtRankings.map(m => ({
          teamName: m.mgmtGroupName,
          leadName: m.leadName,
          leadPhoto: m.leadPhoto,
          fp: m.fp,
          efp: m.efp,
          growth: m.growth,
        }))}
        slideKey="mgmtRankings"
        onEditValue={onEditValue}
      />
    );
  }

  // Superlatives
  const superlativesList = Object.entries(data.superlatives || {})
    .filter(([_, value]) => value)
    .map(([key, value]) => ({ key, ...value }));

  if (superlativesList.length > 0) {
    // Group superlatives into slides of 2-3 each
    const superlativeChunks: typeof superlativesList[] = [];
    for (let i = 0; i < superlativesList.length; i += 3) {
      superlativeChunks.push(superlativesList.slice(i, i + 3));
    }
    superlativeChunks.forEach((chunk, idx) => {
      slides.push(
        <SuperlativesSlide 
          key={`superlatives-${idx}`}
          superlatives={chunk}
        />
      );
    });
  }

  // Records slide
  if (data.records?.length > 0) {
    slides.push(
      <TeamRecordsSlide 
        key="records"
        records={data.records}
      />
    );
  }

  // Summary slide
  slides.push(
    <TeamRecapSummarySlide 
      key="summary"
      reportType={report.report_type}
      totals={data.officeTotals}
    />
  );

  const totalSlides = slides.length;

  // Trigger confetti on summary slide
  useEffect(() => {
    if (currentSlide === totalSlides - 1 && !hasTriggeredConfetti && data.officeTotals?.fp > 0) {
      setHasTriggeredConfetti(true);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [currentSlide, totalSlides, hasTriggeredConfetti, data.officeTotals?.fp]);

  const handleNext = () => {
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide(prev => prev + 1);
    } else {
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
      {/* Gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-b ${gradients[gradientIndex]} transition-all duration-500`} />

      {/* Progress dots */}
      <div 
        className="absolute left-0 right-0 flex justify-center gap-1 px-4 z-10"
        style={{ top: 'calc(var(--effective-safe-area-top, 0px) + 16px)' }}
      >
        {slides.map((_, idx) => (
          <div
            key={idx}
            className={`h-1 rounded-full transition-all duration-300 ${
              idx === currentSlide 
                ? 'bg-primary w-6' 
                : idx < currentSlide 
                  ? 'bg-primary/50 w-3'
                  : 'bg-muted w-3'
            }`}
          />
        ))}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-4 z-10 p-2 rounded-full bg-muted/50 hover:bg-muted transition-colors"
        style={{ top: 'calc(var(--effective-safe-area-top, 0px) + 16px)' }}
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
