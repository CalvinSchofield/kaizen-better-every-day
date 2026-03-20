import { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { hapticMedium, hapticLight } from "@/utils/haptics";
import { format } from "date-fns";

interface CounterCardProps {
  label: string;
  value: number;
  field: string;
  onCounterChange: (field: string, value: number) => void;
  lastTapTime?: string;
  onRapidTapDetected?: () => void;
  goal?: number;
}

export const CounterCard = ({ 
  label, 
  value, 
  field, 
  onCounterChange, 
  lastTapTime,
  onRapidTapDetected,
  goal,
}: CounterCardProps) => {
  const [touchStart, setTouchStart] = useState<{ y: number; time: number } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isRapidMode, setIsRapidMode] = useState(false);
  const touchMoveRef = useRef(false);
  const recentTapsRef = useRef<number[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (isAnimating) {
      const timer = setTimeout(() => setIsAnimating(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isAnimating]);

  useEffect(() => {
    if (isRapidMode) {
      const timer = setTimeout(() => setIsRapidMode(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [isRapidMode]);

  // Measure card for SVG ring
  useEffect(() => {
    if (!cardRef.current || !goal) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setCardSize({ width, height });
    });
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [goal]);

  const formattedLastTap = lastTapTime 
    ? format(new Date(lastTapTime), 'h:mm a') 
    : null;

  const detectRapidTapping = (): boolean => {
    const now = Date.now();
    recentTapsRef.current = recentTapsRef.current.filter(t => now - t < 3000);
    recentTapsRef.current.push(now);
    return recentTapsRef.current.length >= 5;
  };

  const handleTap = (isSubtract: boolean = false) => {
    const isRapid = detectRapidTapping();
    
    if (isRapid) {
      hapticLight();
      setIsRapidMode(true);
      onRapidTapDetected?.();
    } else {
      hapticMedium();
      setIsAnimating(true);
    }
    
    if (isSubtract) {
      onCounterChange(field, Math.max(0, value - 1));
    } else {
      onCounterChange(field, value + 1);
    }
  };

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

    if (touchMoveRef.current && Math.abs(deltaY) > 40 && deltaTime < 500) {
      e.preventDefault();
      if (deltaY < -40) {
        handleTap(true);
      } else if (deltaY > 40) {
        handleTap(false);
      }
    } else if (!touchMoveRef.current && deltaTime < 300) {
      e.preventDefault();
      handleTap(false);
    }

    setTouchStart(null);
    touchMoveRef.current = false;
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    handleTap(false);
  };

  // SVG ring calculations
  const hasGoal = goal != null && goal > 0;
  const progress = hasGoal ? Math.min(1, value / goal) : 0;
  const isComplete = hasGoal && value >= goal;

  const renderProgressRing = useCallback(() => {
    if (!hasGoal || cardSize.width === 0) return null;

    const { width, height } = cardSize;
    const strokeWidth = 2.5;
    const r = 10; // border-radius matching rounded-lg
    const offset = strokeWidth / 2;
    
    // SVG rect dimensions (inset by half stroke width)
    const rx = r;
    const ry = r;
    const rectX = offset;
    const rectY = offset;
    const rectW = width - strokeWidth;
    const rectH = height - strokeWidth;

    // Perimeter of rounded rect
    const straightH = rectH - 2 * ry;
    const straightW = rectW - 2 * rx;
    const perimeter = 2 * (straightW + straightH) + 2 * Math.PI * r;

    const dashoffset = perimeter * (1 - progress);

    return (
      <svg
        className="absolute inset-0 pointer-events-none z-10"
        width={width}
        height={height}
        style={{ overflow: 'visible' }}
      >
        <rect
          x={rectX}
          y={rectY}
          width={rectW}
          height={rectH}
          rx={rx}
          ry={ry}
          fill="none"
          stroke={isComplete ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.25)'}
          strokeWidth={strokeWidth}
          strokeDasharray={perimeter}
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
          style={{
            opacity: isComplete ? 0.6 : 0.4,
          }}
        />
      </svg>
    );
  }, [hasGoal, cardSize, progress, isComplete]);

  return (
    <Card
      ref={cardRef}
      className={`relative flex flex-col items-center justify-center h-full min-h-[160px] cursor-pointer select-none touch-none bg-card transition-all ${
        isRapidMode 
          ? 'opacity-70 ring-2 ring-amber-500/50 animate-pulse' 
          : isAnimating 
            ? 'scale-105 shadow-lg' 
            : 'scale-100'
      }`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
    >
      {renderProgressRing()}
      
      <div className={`text-5xl md:text-6xl font-bold text-foreground mb-2 transition-all ${
        isRapidMode ? 'scale-100' : isAnimating ? 'scale-110' : 'scale-100'
      }`}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider text-center font-medium px-2">
        {label}
      </div>
      
      {/* Smart goal label */}
      {hasGoal && (
        <div className={`mt-1 text-[10px] font-medium ${
          isComplete ? 'text-primary/60' : 'text-muted-foreground/40'
        }`}>
          {value}/{goal}
        </div>
      )}
      
      {/* Timestamp chip */}
      {formattedLastTap && !hasGoal && (
        <div className="mt-2 text-[10px] font-medium text-muted-foreground/60">
          Last: {formattedLastTap}
        </div>
      )}
    </Card>
  );
};
