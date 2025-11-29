import { useState, useRef, useEffect } from "react";
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
  const [isAnimating, setIsAnimating] = useState(false);
  const touchMoveRef = useRef(false);

  useEffect(() => {
    if (isAnimating) {
      const timer = setTimeout(() => setIsAnimating(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isAnimating]);

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    touchMoveRef.current = false;
    setTouchStart({ 
      y: e.touches[0].clientY,
      time: Date.now()
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const deltaY = touchStart.y - e.touches[0].clientY;
    if (Math.abs(deltaY) > 10) {
      touchMoveRef.current = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;

    const touchEnd = e.changedTouches[0].clientY;
    const deltaY = touchStart.y - touchEnd;
    const deltaTime = Date.now() - touchStart.time;

    // If significant swipe movement and quick gesture
    if (touchMoveRef.current && Math.abs(deltaY) > 40 && deltaTime < 500) {
      e.preventDefault();
      
      // Swipe down (positive deltaY because we're dragging down) = subtract
      if (deltaY < -40) {
        setIsAnimating(true);
        onCounterChange(field, Math.max(0, value - 1));
      }
      // Swipe up = add (optional, but natural)
      else if (deltaY > 40) {
        setIsAnimating(true);
        onCounterChange(field, value + 1);
      }
    } else if (!touchMoveRef.current && deltaTime < 300) {
      // Quick tap without movement = add
      e.preventDefault();
      setIsAnimating(true);
      onCounterChange(field, value + 1);
    }

    setTouchStart(null);
    touchMoveRef.current = false;
  };

  const handleClick = (e: React.MouseEvent) => {
    // Desktop click = add
    e.preventDefault();
    setIsAnimating(true);
    onCounterChange(field, value + 1);
  };

  return (
    <Card
      className={`flex flex-col items-center justify-center h-full min-h-0 cursor-pointer select-none touch-none bg-card hover:shadow-md transition-all ${
        isAnimating ? 'scale-105 shadow-lg' : 'scale-100'
      }`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
    >
      <div className={`text-5xl md:text-6xl font-bold text-foreground mb-2 transition-all ${
        isAnimating ? 'scale-110' : 'scale-100'
      }`}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider text-center font-medium px-2">
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
    <div className="grid grid-cols-2 auto-rows-fr gap-3 h-full w-full">
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