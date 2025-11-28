import { useState, useRef } from "react";
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
  const [touchStart, setTouchStart] = useState<{ y: number; time: number } | null>(null);
  const touchMoveRef = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchMoveRef.current = false;
    setTouchStart({ 
      y: e.touches[0].clientY,
      time: Date.now()
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchMoveRef.current = true;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;

    const touchEnd = e.changedTouches[0].clientY;
    const deltaY = touchStart.y - touchEnd;
    const deltaTime = Date.now() - touchStart.time;

    // If significant movement and quick gesture
    if (touchMoveRef.current && Math.abs(deltaY) > 30 && deltaTime < 300) {
      e.preventDefault();
      e.stopPropagation();
      
      // Swipe down = subtract
      if (deltaY < -30) {
        onCounterChange(field, value - 1);
      }
    } else if (!touchMoveRef.current) {
      // Quick tap = add
      onCounterChange(field, value + 1);
    }

    setTouchStart(null);
    touchMoveRef.current = false;
  };

  const handleClick = (e: React.MouseEvent) => {
    // Desktop click = add
    e.preventDefault();
    onCounterChange(field, value + 1);
  };

  return (
    <Card
      className="flex flex-col items-center justify-center h-32 cursor-pointer active:scale-95 transition-all select-none touch-none bg-card hover:shadow-md"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
    >
      <div className="text-5xl font-bold text-foreground mb-2">
        {value}
      </div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider text-center font-medium">
        {label}
      </div>
    </Card>
  );
};

export const QTallyGrid = ({ entry, onCounterChange }: QTallyGridProps) => {
  const counters = [
    { label: "Doors Knocked", field: "doors_knocked", value: entry.doors_knocked },
    { label: "Decision Makers", field: "decision_makers", value: entry.decision_makers },
    { label: "Pitches", field: "pitches", value: entry.pitches },
    { label: "Transitions", field: "transitions", value: entry.transitions },
    { label: "Presentations", field: "presentations", value: entry.presentations },
    { label: "Closes", field: "closes", value: entry.closes },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 h-full">
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