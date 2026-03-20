import { Skeleton } from "@/components/ui/skeleton";
import { CounterCard } from "./track/CounterCard";
import { Loader2 } from "lucide-react";

interface CounterLayoutConfig {
  order: string[];
}

interface QTallyGridProps {
  entry: {
    doors_knocked: number;
    decision_makers: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    custom_counters?: Record<string, number>;
  };
  onCounterChange: (field: string, value: number) => void;
  customCounterConfig?: Array<{ id: string; name: string; emoji: string; hidden?: boolean }>;
  counterLayoutConfig?: CounterLayoutConfig;
  isLoading?: boolean;
  isRefreshing?: boolean;
  counterTimestamps?: Record<string, string[]>;
  onRapidTapDetected?: () => void;
  smartGoals?: Record<string, number>;
}

export const QTallyGrid = ({ 
  entry, 
  onCounterChange, 
  customCounterConfig = [], 
  counterLayoutConfig, 
  isLoading = false,
  isRefreshing = false,
  counterTimestamps,
  onRapidTapDetected,
  smartGoals,
}: QTallyGridProps) => {
  
  if (isLoading) {
    return (
      <div className="w-full h-full">
        <div className="grid grid-cols-2 gap-3 w-full h-full" style={{ gridTemplateRows: 'repeat(3, 1fr)' }}>
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-full min-h-[160px] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }
  
  const allCoreCounters = [
    { label: "Doors Knocked", field: "doors_knocked", value: entry.doors_knocked },
    { label: "Decision Makers", field: "decision_makers", value: entry.decision_makers },
    { label: "Pitches", field: "pitches", value: entry.pitches },
    { label: "Transitions", field: "transitions", value: entry.transitions },
    { label: "Presentations", field: "presentations", value: entry.presentations },
    { label: "Closes", field: "closes", value: entry.closes },
  ];
  
  let coreCounters = allCoreCounters;
  if (counterLayoutConfig) {
    coreCounters = counterLayoutConfig.order
      .map(field => allCoreCounters.find(c => c.field === field))
      .filter((c): c is typeof allCoreCounters[0] => c !== undefined);
  }

  const customCounters = customCounterConfig
    .filter((config) => !config.hidden)
    .map((config) => ({
      label: `${config.emoji} ${config.name}`,
      field: `custom_${config.id}`,
      value: entry.custom_counters?.[config.id] || 0,
    }));

  const hasCustomCounters = customCounters.length > 0;

  const getLastTapTime = (field: string): string | undefined => {
    const timestamps = counterTimestamps?.[field];
    return timestamps?.length ? timestamps[timestamps.length - 1] : undefined;
  };

  return (
    <div data-tour="track-counter-grid" className={`w-full relative ${hasCustomCounters ? 'overflow-y-auto' : 'h-full'}`}>
      {isRefreshing && (
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center py-1 bg-background/80 backdrop-blur-sm rounded-t-xl">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground mr-1.5" />
          <span className="text-xs text-muted-foreground">Syncing...</span>
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-3 w-full" style={{ gridTemplateRows: 'repeat(3, 1fr)', minHeight: hasCustomCounters ? 'auto' : '100%' }}>
        {coreCounters.map((counter) => (
          <div 
            key={counter.field}
            data-tour={counter.field === 'closes' ? 'track-fp-counter' : undefined}
          >
            <CounterCard
              label={counter.label}
              value={counter.value}
              field={counter.field}
              onCounterChange={onCounterChange}
              lastTapTime={getLastTapTime(counter.field)}
              onRapidTapDetected={onRapidTapDetected}
              goal={smartGoals?.[counter.field]}
            />
          </div>
        ))}
      </div>

      {hasCustomCounters && (
        <div className="mt-4 pt-4 border-t border-border">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1">My Counters</h3>
          <div className="grid grid-cols-2 gap-3">
            {customCounters.map((counter) => (
              <CounterCard
                key={counter.field}
                label={counter.label}
                value={counter.value}
                field={counter.field}
                onCounterChange={onCounterChange}
                lastTapTime={getLastTapTime(counter.field)}
                onRapidTapDetected={onRapidTapDetected}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
