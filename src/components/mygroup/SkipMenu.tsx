import { SkipForward, Clock, CalendarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface SkipMenuProps {
  onSkipForNow: () => void;
  onSkipToday: () => void;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export const SkipMenu = ({
  onSkipForNow,
  onSkipToday,
  variant = 'ghost',
  size = 'icon',
  className,
}: SkipMenuProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant={variant} 
          size={size} 
          className={className}
          onClick={(e) => e.stopPropagation()}
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-48 p-1" 
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 h-10"
          onClick={(e) => {
            e.stopPropagation();
            onSkipForNow();
          }}
        >
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span>Skip for now</span>
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 h-10"
          onClick={(e) => {
            e.stopPropagation();
            onSkipToday();
          }}
        >
          <CalendarOff className="h-4 w-4 text-muted-foreground" />
          <span>Skip today</span>
        </Button>
      </PopoverContent>
    </Popover>
  );
};
