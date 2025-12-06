import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronLeft, ChevronRight, Sun, CalendarOff, Users, AlertCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameMonth, getDay, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useTeamSummerConfig, isRepOffOnDate } from "@/hooks/useTeamSummerConfig";
import { Skeleton } from "@/components/ui/skeleton";

// Default summer dates
const DEFAULT_SUMMER_START = '2026-04-12';
const DEFAULT_SUMMER_END = '2026-09-27';

// Parse date string as local date
const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const TeamSummerAvailabilityCard = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => parseLocalDate(DEFAULT_SUMMER_START));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDaySheet, setShowDaySheet] = useState(false);
  
  const { data: teamConfigs, isLoading } = useTeamSummerConfig();

  // Summary stats
  const summaryStats = useMemo(() => {
    if (!teamConfigs?.length) return null;

    const totalReps = teamConfigs.length;
    
    // Count reps with early starts (before default summer start)
    const earlyStarters = teamConfigs.filter(c => 
      c.personalSummerStart && c.personalSummerStart < DEFAULT_SUMMER_START
    ).length;
    
    // Count reps with late ends (after default summer end)
    const lateEnders = teamConfigs.filter(c => 
      c.personalSummerEnd && c.personalSummerEnd > DEFAULT_SUMMER_END
    ).length;
    
    // Total off days across all reps
    const totalOffDays = teamConfigs.reduce((sum, c) => 
      sum + c.excludedSummerDays.length, 0
    );

    return { totalReps, earlyStarters, lateEnders, totalOffDays };
  }, [teamConfigs]);

  // Calculate days in current month view
  const monthDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // First day offset for grid alignment
  const firstDayOffset = getDay(startOfMonth(currentMonth));

  // Get coverage data for each day
  const dayCoverageMap = useMemo(() => {
    if (!teamConfigs?.length) return new Map<string, { working: number; off: number }>();

    const map = new Map<string, { working: number; off: number }>();
    
    for (const day of monthDays) {
      const dayOfWeek = getDay(day);
      // Skip Sundays
      if (dayOfWeek === 0) continue;
      
      const dateStr = format(day, 'yyyy-MM-dd');
      let working = 0;
      let off = 0;
      
      for (const config of teamConfigs) {
        if (isRepOffOnDate(dateStr, config)) {
          off++;
        } else {
          working++;
        }
      }
      
      map.set(dateStr, { working, off });
    }
    
    return map;
  }, [monthDays, teamConfigs]);

  // Get reps off/working for selected date
  const selectedDateReps = useMemo(() => {
    if (!selectedDate || !teamConfigs?.length) return { off: [], working: [] };
    
    const off: typeof teamConfigs = [];
    const working: typeof teamConfigs = [];
    
    for (const config of teamConfigs) {
      if (isRepOffOnDate(selectedDate, config)) {
        off.push(config);
      } else {
        working.push(config);
      }
    }
    
    return { off, working };
  }, [selectedDate, teamConfigs]);

  // Get coverage color based on percentage
  const getCoverageColor = (working: number, total: number) => {
    if (total === 0) return "bg-muted/30";
    const percentage = working / total;
    if (percentage >= 0.9) return "bg-success/30 text-success";
    if (percentage >= 0.7) return "bg-success/20 text-success";
    if (percentage >= 0.5) return "bg-warning/30 text-warning";
    if (percentage >= 0.3) return "bg-warning/50 text-warning-foreground";
    return "bg-destructive/30 text-destructive";
  };

  const handleDayClick = (date: Date) => {
    const dayOfWeek = getDay(date);
    if (dayOfWeek === 0) return; // Skip Sundays
    
    const dateStr = format(date, 'yyyy-MM-dd');
    setSelectedDate(dateStr);
    setShowDaySheet(true);
  };

  const handleMonthClick = () => {
    setCurrentMonth(parseLocalDate(DEFAULT_SUMMER_START));
  };

  if (isLoading) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (!teamConfigs?.length) return null;

  const totalReps = summaryStats?.totalReps || 0;

  return (
    <>
      <Card className="border-border/60">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CardHeader className="pb-2">
            <CollapsibleTrigger className="flex items-center justify-between w-full group">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Sun className="h-4 w-4 text-warning" />
                Summer Availability
              </CardTitle>
              <ChevronDown className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                isOpen && "rotate-180"
              )} />
            </CollapsibleTrigger>
          </CardHeader>
          
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              {/* Summary Stats Row */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-muted/30 rounded-lg p-2">
                  <div className="text-lg font-bold text-foreground">{summaryStats?.totalReps}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">Total Reps</div>
                </div>
                <div className="bg-success/10 rounded-lg p-2">
                  <div className="text-lg font-bold text-success">{summaryStats?.earlyStarters}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">Early Start</div>
                </div>
                <div className="bg-primary/10 rounded-lg p-2">
                  <div className="text-lg font-bold text-primary">{summaryStats?.lateEnders}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">Late End</div>
                </div>
                <div className="bg-warning/10 rounded-lg p-2">
                  <div className="text-lg font-bold text-warning">{summaryStats?.totalOffDays}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">Off Days</div>
                </div>
              </div>

              {/* Calendar Heat Map */}
              <div className="bg-muted/20 rounded-xl p-3">
                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <button
                    onClick={handleMonthClick}
                    className="text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
                  >
                    {format(currentMonth, 'MMMM yyyy')}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                    <div key={i} className={cn(
                      "text-center text-[10px] font-medium py-1",
                      i === 0 ? "text-muted-foreground/50" : "text-muted-foreground"
                    )}>
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Empty cells for offset */}
                  {Array.from({ length: firstDayOffset }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}
                  
                  {/* Day cells */}
                  {monthDays.map((day) => {
                    const dayOfWeek = getDay(day);
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const coverage = dayCoverageMap.get(dateStr);
                    const isSunday = dayOfWeek === 0;
                    const isInSummerRange = dateStr >= DEFAULT_SUMMER_START && dateStr <= DEFAULT_SUMMER_END;
                    
                    // Get working count and color
                    const workingCount = coverage?.working || 0;
                    const offCount = coverage?.off || 0;
                    const coverageColor = !isSunday && isInSummerRange
                      ? getCoverageColor(workingCount, totalReps)
                      : "bg-muted/10";

                    return (
                      <button
                        key={dateStr}
                        onClick={() => !isSunday && isInSummerRange && handleDayClick(day)}
                        disabled={isSunday || !isInSummerRange}
                        className={cn(
                          "aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all relative",
                          isSunday && "opacity-30 cursor-not-allowed",
                          !isInSummerRange && "opacity-20 cursor-not-allowed",
                          !isSunday && isInSummerRange && "cursor-pointer hover:ring-2 hover:ring-primary/30",
                          coverageColor
                        )}
                      >
                        <span className="font-medium">{format(day, 'd')}</span>
                        {!isSunday && isInSummerRange && offCount > 0 && (
                          <span className="text-[8px] font-bold">{offCount} off</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-3 mt-3 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-success/30" />
                    <span>Full</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-warning/30" />
                    <span>Some Off</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-destructive/30" />
                    <span>Low</span>
                  </div>
                </div>
              </div>

              {/* Rep Timeline List */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Summer Schedules
                </h4>
                <ScrollArea className="max-h-[200px]">
                  <div className="space-y-1.5">
                    {teamConfigs
                      .sort((a, b) => (a.personalSummerStart || '').localeCompare(b.personalSummerStart || ''))
                      .map((config) => {
                        const startDate = config.personalSummerStart || DEFAULT_SUMMER_START;
                        const endDate = config.personalSummerEnd || DEFAULT_SUMMER_END;
                        const offDaysCount = config.excludedSummerDays.length;
                        
                        // Calculate timeline position (relative to default summer range)
                        const defaultStart = parseLocalDate(DEFAULT_SUMMER_START);
                        const defaultEnd = parseLocalDate(DEFAULT_SUMMER_END);
                        const totalDays = Math.ceil((defaultEnd.getTime() - defaultStart.getTime()) / (1000 * 60 * 60 * 24));
                        
                        const repStart = parseLocalDate(startDate);
                        const repEnd = parseLocalDate(endDate);
                        
                        const leftOffset = Math.max(0, Math.ceil((repStart.getTime() - defaultStart.getTime()) / (1000 * 60 * 60 * 24)) / totalDays * 100);
                        const width = Math.min(100 - leftOffset, Math.ceil((repEnd.getTime() - repStart.getTime()) / (1000 * 60 * 60 * 24)) / totalDays * 100);

                        return (
                          <div key={config.userId} className="bg-card rounded-lg p-2 border border-border/40">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-medium truncate max-w-[120px]">
                                {config.name.split(' ')[0]}
                              </span>
                              <div className="flex items-center gap-1.5 text-[10px]">
                                <span className="text-muted-foreground">
                                  {format(parseLocalDate(startDate), 'M/d')} – {format(parseLocalDate(endDate), 'M/d')}
                                </span>
                                {offDaysCount > 0 && (
                                  <span className="bg-warning/20 text-warning px-1.5 py-0.5 rounded-full font-medium">
                                    {offDaysCount} off
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Timeline bar */}
                            <div className="h-2 bg-muted/30 rounded-full overflow-hidden relative">
                              <div
                                className="absolute h-full bg-primary/60 rounded-full"
                                style={{
                                  left: `${leftOffset}%`,
                                  width: `${width}%`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Day Detail Sheet */}
      <Sheet open={showDaySheet} onOpenChange={setShowDaySheet}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2">
              <CalendarOff className="h-5 w-5 text-primary" />
              {selectedDate && format(parseLocalDate(selectedDate), 'EEEE, MMMM d, yyyy')}
            </SheetTitle>
            <SheetDescription>
              {selectedDateReps.working.length} working · {selectedDateReps.off.length} off
            </SheetDescription>
          </SheetHeader>
          
          <ScrollArea className="h-[calc(100%-80px)]">
            <div className="space-y-4">
              {/* Off Section */}
              {selectedDateReps.off.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    Off ({selectedDateReps.off.length})
                  </h4>
                  <div className="space-y-1">
                    {selectedDateReps.off.map((rep) => {
                      // Determine reason for being off
                      const isBeforeStart = selectedDate! < (rep.personalSummerStart || DEFAULT_SUMMER_START);
                      const isAfterEnd = selectedDate! > (rep.personalSummerEnd || DEFAULT_SUMMER_END);
                      const isExcluded = rep.excludedSummerDays.includes(selectedDate!);
                      
                      let reason = "Off day";
                      if (isBeforeStart) reason = `Starts ${format(parseLocalDate(rep.personalSummerStart || DEFAULT_SUMMER_START), 'M/d')}`;
                      else if (isAfterEnd) reason = `Ended ${format(parseLocalDate(rep.personalSummerEnd || DEFAULT_SUMMER_END), 'M/d')}`;
                      else if (isExcluded) reason = "Scheduled off";

                      return (
                        <div
                          key={rep.userId}
                          className="flex items-center justify-between p-3 bg-destructive/10 rounded-xl border border-destructive/20"
                        >
                          <span className="font-medium text-sm">{rep.name}</span>
                          <span className="text-xs text-muted-foreground">{reason}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Working Section */}
              {selectedDateReps.working.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4 text-success" />
                    Working ({selectedDateReps.working.length})
                  </h4>
                  <div className="space-y-1">
                    {selectedDateReps.working.map((rep) => (
                      <div
                        key={rep.userId}
                        className="flex items-center justify-between p-3 bg-success/10 rounded-xl border border-success/20"
                      >
                        <span className="font-medium text-sm">{rep.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(parseLocalDate(rep.personalSummerStart || DEFAULT_SUMMER_START), 'M/d')} – {format(parseLocalDate(rep.personalSummerEnd || DEFAULT_SUMMER_END), 'M/d')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
};
