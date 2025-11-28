import { useState } from "react";
import { Card } from "@/components/ui/card";

interface QTallyGridProps {
  entry: {
    doors_knocked: number;
    decision_makers: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
  };
  onCounterChange: (field: string, value: number) => void;
}

interface CounterCardProps {
  label: string;
  value: number;
  field: string;
  onCounterChange: (field: string, value: number) => void;
}

const CounterCard = ({ label, value, field, onCounterChange }: CounterCardProps) => {
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;

    const touchEnd = e.changedTouches[0].clientY;
    const delta = touchStart - touchEnd;

    // Swipe down = subtract
    if (delta < -50) {
      onCounterChange(field, value - 1);
    } else {
      // Tap or small swipe = add
      onCounterChange(field, value + 1);
    }

    setTouchStart(null);
  };

  const handleClick = () => {
    // Desktop click = add
    onCounterChange(field, value + 1);
  };

  return (
    <Card
      className="flex flex-col items-center justify-center p-6 cursor-pointer active:scale-95 transition-transform select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
    >
      <div className="text-4xl font-bold text-foreground mb-2">
        {value}
      </div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide text-center">
        {label}
      </div>
    </Card>
  );
};

export const QTallyGrid = ({ entry, onCounterChange }: QTallyGridProps) => {
  const counters = [
    { label: "Doors", field: "doors_knocked", value: entry.doors_knocked },
    { label: "DMs", field: "decision_makers", value: entry.decision_makers },
    { label: "Pitches", field: "pitches", value: entry.pitches },
    { label: "Transitions", field: "transitions", value: entry.transitions },
    { label: "Presentations", field: "presentations", value: entry.presentations },
    { label: "Closes", field: "closes", value: entry.closes },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {counters.map((counter) => (
        <CounterCard
          key={counter.field}
          label={counter.label}
          value={counter.value}
          field={counter.field}
          onCounterChange={onCounterChange}
        />
      ))}
    </div>
  );
};