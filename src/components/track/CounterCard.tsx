import { useState, useRef, useEffect } from "react";
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
}

export const CounterCard = ({ 
  label, 
  value, 
  field, 
  onCounterChange, 
  lastTapTime,
  onRapidTapDetected 
}: CounterCardProps) => {
  const [touchStart, setTouchStart] = useState<{ y: number; time: number } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isRapidMode, setIsRapidMode] = useState(false);
  const touchMoveRef = useRef(false);
  const recentTapsRef = useRef<number[]>([]);

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

  // Calculate stale status for timestamp chip
  const getTimestampInfo = () => {
    if (!lastTapTime) return null;
    
    const lastTap = new Date(lastTapTime);
    const now = new Date();
    const minutesSince = Math.floor((now.getTime() - lastTap.getTime()) / 60000);
    const isStale = minutesSince > 30;
    const formattedTime = format(lastTap, 'h:mm a');
    
    return { formattedTime, isStale, minutesSince };
  };

  const timestampInfo = getTimestampInfo();

  const detectRapidTapping = (): boolean => {
    const now = Date.now();
    // Keep only taps from the last 3 seconds
    recentTapsRef.current = recentTapsRef.current.filter(t => now - t < 3000);
    recentTapsRef.current.push(now);
    
    return recentTapsRef.current.length >= 5;
  };

  const handleTap = (isSubtract: boolean = false) => {
    const isRapid = detectRapidTapping();
    
    if (isRapid) {
      hapticLight(); // Softer feedback
      setIsRapidMode(true);
      onRapidTapDetected?.();
    } else {
      hapticMedium(); // Normal feedback
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

    // If significant swipe movement and quick gesture
    if (touchMoveRef.current && Math.abs(deltaY) > 40 && deltaTime < 500) {
      e.preventDefault();
      
      // Swipe down (positive deltaY because we're dragging down) = subtract
      if (deltaY < -40) {
        handleTap(true);
      }
      // Swipe up = add
      else if (deltaY > 40) {
        handleTap(false);
      }
    } else if (!touchMoveRef.current && deltaTime < 300) {
      // Quick tap without movement = add
      e.preventDefault();
      handleTap(false);
    }

    setTouchStart(null);
    touchMoveRef.current = false;
  };

  const handleClick = (e: React.MouseEvent) => {
    // Desktop click = add
    e.preventDefault();
    handleTap(false);
  };

  return (
    <Card
      className={`flex flex-col items-center justify-center h-full min-h-[160px] cursor-pointer select-none touch-none bg-card transition-all ${
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
      <div className={`text-5xl md:text-6xl font-bold text-foreground mb-2 transition-all ${
        isRapidMode ? 'scale-100' : isAnimating ? 'scale-110' : 'scale-100'
      }`}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider text-center font-medium px-2">
        {label}
      </div>
      
      {/* Timestamp chip */}
      {timestampInfo && (
        <div className={`mt-2 text-[10px] font-medium ${
          timestampInfo.isStale 
            ? 'text-amber-500' 
            : 'text-muted-foreground/60'
        }`}>
          Last: {timestampInfo.formattedTime}
          {timestampInfo.isStale && ' ⚠️'}
        </div>
      )}
    </Card>
  );
};
