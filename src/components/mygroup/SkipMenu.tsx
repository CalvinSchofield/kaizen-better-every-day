import { useState } from "react";
import { SkipForward, Clock, CalendarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

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
  const [open, setOpen] = useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button 
          variant={variant} 
          size={size} 
          className={className}
          onClick={(e) => e.stopPropagation()}
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </DrawerTrigger>
      <DrawerContent onClick={(e) => e.stopPropagation()}>
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-center">Skip Recruit</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6 space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-14 text-base"
            onClick={(e) => {
              e.stopPropagation();
              onSkipForNow();
              setOpen(false);
            }}
          >
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div className="text-left">
              <div>Skip for now</div>
              <div className="text-xs text-muted-foreground font-normal">Will reappear after refreshing</div>
            </div>
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-14 text-base"
            onClick={(e) => {
              e.stopPropagation();
              onSkipToday();
              setOpen(false);
            }}
          >
            <CalendarOff className="h-5 w-5 text-muted-foreground" />
            <div className="text-left">
              <div>Skip today</div>
              <div className="text-xs text-muted-foreground font-normal">Will reappear tomorrow</div>
            </div>
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
