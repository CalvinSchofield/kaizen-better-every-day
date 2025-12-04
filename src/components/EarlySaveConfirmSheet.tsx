import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Sun, Flame } from "lucide-react";

interface CompetitorNudge {
  name: string;
  metric: 'presentations' | 'pitches' | 'fp_plus' | 'prmr' | 'decision_makers' | 'doors_knocked';
  metricLabel: string;
  timeframe: 'today' | 'this week';
  gap: number;
  userValue: number;
  competitorValue: number;
}

interface EarlySaveConfirmSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onKeepWorking: () => void;
  currentTime: string;
  competitor?: CompetitorNudge | null;
  loading?: boolean;
}

// Format gap for display
const formatGap = (metric: CompetitorNudge['metric'], gap: number): string => {
  switch (metric) {
    case 'presentations':
      return gap === 1 ? '1 presentation' : `${gap} presentations`;
    case 'pitches':
      return gap === 1 ? '1 pitch' : `${gap} pitches`;
    case 'fp_plus':
      return `${gap.toFixed(1)} FP+`;
    case 'prmr':
      return `$${Math.round(gap)} in PRMR`;
    case 'decision_makers':
      return gap === 1 ? '1 decision maker' : `${gap} decision makers`;
    case 'doors_knocked':
      return gap === 1 ? '1 door' : `${gap} doors`;
    default:
      return `${gap}`;
  }
};

// Format metric value for comparison display
const formatValue = (metric: CompetitorNudge['metric'], value: number): string => {
  switch (metric) {
    case 'presentations':
    case 'pitches':
    case 'decision_makers':
    case 'doors_knocked':
      return `${value}`;
    case 'fp_plus':
      return value.toFixed(1);
    case 'prmr':
      return `$${Math.round(value)}`;
    default:
      return `${value}`;
  }
};

// Get metric display label
const getMetricLabel = (metric: CompetitorNudge['metric']): string => {
  switch (metric) {
    case 'presentations':
      return 'presentations';
    case 'pitches':
      return 'pitches';
    case 'decision_makers':
      return 'DMs';
    case 'doors_knocked':
      return 'doors';
    case 'fp_plus':
      return 'FP+';
    case 'prmr':
      return 'PRMR';
    default:
      return '';
  }
};

export const EarlySaveConfirmSheet = ({ 
  open, 
  onOpenChange, 
  onConfirm, 
  onKeepWorking,
  currentTime,
  competitor,
  loading,
}: EarlySaveConfirmSheetProps) => {
  const hasCompetitor = competitor && !loading;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-safe">
        <DrawerHeader className="mb-4">
          <div className="flex items-center gap-2 justify-center mb-2">
            {hasCompetitor ? (
              <Flame className="h-6 w-6 text-orange-500" />
            ) : (
              <Sun className="h-6 w-6 text-amber-500" />
            )}
          </div>
          {hasCompetitor ? (
            <>
              <DrawerTitle>{competitor.name} is still working!</DrawerTitle>
              <DrawerDescription>
                They've got you beat by just {formatGap(competitor.metric, competitor.gap)} on the day.
              </DrawerDescription>
            </>
          ) : (
            <>
              <DrawerTitle>Still daylight out there!</DrawerTitle>
              <DrawerDescription>
                It's only {currentTime} — are you sure you're done knocking for the day?
              </DrawerDescription>
            </>
          )}
        </DrawerHeader>
        
        {hasCompetitor ? (
          <div className="px-4 mb-6">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <span className="font-medium">{competitor.name}</span>
                </div>
                <span className="font-semibold">{formatValue(competitor.metric, competitor.competitorValue)} {getMetricLabel(competitor.metric)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>You</span>
                <span>{formatValue(competitor.metric, competitor.userValue)} {getMetricLabel(competitor.metric)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4 text-sm text-muted-foreground mb-6 text-center">
            Once you save, your counters will reset to 0 for the next day.
          </div>
        )}
        
        <div className="flex flex-col gap-3 px-4">
          <Button
            onClick={() => {
              onKeepWorking();
              onOpenChange(false);
            }}
            variant="default"
            className="w-full py-6 text-lg font-semibold"
            size="lg"
          >
            Keep Working
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            variant="outline"
            className="w-full py-6 text-lg font-semibold"
            size="lg"
          >
            Yes, I'm Done
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
