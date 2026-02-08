import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { ChevronLeft, ChevronRight, Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityRingHero } from "./ActivityRingHero";
import { FinalizedStatsGrid } from "./FinalizedStatsGrid";
import { SalesRecapCard } from "./SalesRecapCard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { hapticSelection } from "@/utils/haptics";
import { Sale } from "@/hooks/useDailyEntry";

interface DayDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  onNavigateDay: (direction: 'prev' | 'next') => void;
  userId: string;
}

export const DayDetailDrawer = ({
  open,
  onOpenChange,
  selectedDate,
  onNavigateDay,
  userId,
}: DayDetailDrawerProps) => {
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const today = new Date();
  const isToday = format(today, 'yyyy-MM-dd') === dateStr;
  const isFuture = selectedDate > today;

  // Fetch entry for the selected date
  const { data: entry, isLoading } = useQuery({
    queryKey: ['daily-entry-detail', userId, dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('entry_date', dateStr)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: open && !!userId && !isFuture,
    staleTime: 30 * 1000,
  });

  const salesLog = useMemo<Sale[]>(() => {
    if (!entry?.sales_log) return [];
    return Array.isArray(entry.sales_log) ? (entry.sales_log as unknown as Sale[]) : [];
  }, [entry?.sales_log]);

  const counterTimestamps = useMemo(() => {
    if (!entry?.counter_timestamps) return {};
    return entry.counter_timestamps as Record<string, string[]>;
  }, [entry?.counter_timestamps]);

  const handlePrev = () => {
    hapticSelection();
    onNavigateDay('prev');
  };

  const handleNext = () => {
    hapticSelection();
    onNavigateDay('next');
  };

  const canGoNext = !isToday && !isFuture;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh] z-[70]">
        <DrawerHeader className="pb-2 border-b">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrev}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <DrawerTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {format(selectedDate, "EEEE, MMMM d")}
            </DrawerTitle>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              disabled={!canGoNext}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </DrawerHeader>

        <div className="px-4 py-6 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !entry ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No activity recorded</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Activity Ring */}
              <div className="flex justify-center">
                <ActivityRingHero
                  entry={entry as any}
                  counterTimestamps={counterTimestamps}
                  salesLog={salesLog}
                  showGoalRing={true}
                  size="md"
                />
              </div>

              {/* Stats Grid */}
              <FinalizedStatsGrid
                entry={entry as any}
                salesLog={salesLog}
              />

              {/* Sales Recap */}
              {salesLog.length > 0 && (
                <SalesRecapCard
                  salesLog={salesLog}
                />
              )}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
