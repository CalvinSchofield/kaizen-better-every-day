import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Sun, Flame } from "lucide-react";

interface CompetitorNudge {
  name: string;
  metric: 'presentations' | 'fp_plus' | 'prmr' | 'doors_knocked';
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
    case 'fp_plus':
      return `${gap.toFixed(1)} FP+`;
    case 'prmr':
      return `$${Math.round(gap)} in PRMR`;
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
      return `${value}`;
    case 'fp_plus':
      return value.toFixed(1);
    case 'prmr':
      return `$${Math.round(value)}`;
    case 'doors_knocked':
      return `${value}`;
    default:
      return `${value}`;
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
                <span className="font-semibold">{formatValue(competitor.metric, competitor.competitorValue)} {competitor.metric === 'presentations' ? 'presentations' : competitor.metric === 'doors_knocked' ? 'doors' : ''}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>You</span>
                <span>{formatValue(competitor.metric, competitor.userValue)} {competitor.metric === 'presentations' ? 'presentations' : competitor.metric === 'doors_knocked' ? 'doors' : ''}</span>
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
