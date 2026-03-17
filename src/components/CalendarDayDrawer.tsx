import { useState, useMemo } from "react";
import { format, isToday as checkIsToday } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, ArrowRight, Clock, DoorOpen, Target, Presentation, TrendingUp } from "lucide-react";
import { Sale, useDailyEntry } from "@/hooks/useDailyEntry";
import { SaleDetailSheet } from "@/components/SaleDetailSheet";
import { useSaleUpdate } from "@/hooks/useSaleUpdate";
import { useEfpMode } from "@/hooks/useEfpMode";
import { formatFP, formatPRMR, formatHoursMinutes } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface CalendarDayDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: any;
  date: Date;
  onSaleAdded?: () => void;
}

export const CalendarDayDrawer = ({
  open,
  onOpenChange,
  entry,
  date,
  onSaleAdded,
}: CalendarDayDrawerProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { efpModeEnabled, calculateEfp } = useEfpMode();
  const { updateSale } = useSaleUpdate();

  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleDetailOpen, setSaleDetailOpen] = useState(false);

  const dateStr = format(date, 'yyyy-MM-dd');
  const isToday = checkIsToday(date);
  const hasData = entry && entry.is_finalized;

  const salesLog = useMemo<Sale[]>(() => {
    if (!entry?.sales_log) return [];
    return Array.isArray(entry.sales_log) ? (entry.sales_log as unknown as Sale[]) : [];
  }, [entry?.sales_log]);

  // Calculate metrics from sales_log (source of truth)
  const metrics = useMemo(() => {
    const funded = salesLog.filter(s => s.install_status !== 'cancelled' && s.install_status !== 'never_installed');
    const fpSales = funded.filter(s => s.type === 'fp');
    const upgradeSales = funded.filter(s => s.type === 'upgrade');
    const fpPrmr = fpSales.reduce((sum, s) => sum + (s.prmr || 0), 0);
    const upgradePrmr = upgradeSales.reduce((sum, s) => sum + (s.prmr || 0), 0);
    const fpPlus = fpSales.length + (upgradePrmr / 85);
    const totalPrmr = fpPrmr + upgradePrmr;
    return { fpPlus, totalPrmr, fpCount: fpSales.length, upgradeCount: upgradeSales.length, upgradePrmr };
  }, [salesLog]);

  // Calculate work time
  const workTime = useMemo(() => {
    if (!entry?.work_start_time || !entry?.work_end_time) return null;
    const start = new Date(entry.work_start_time);
    const end = new Date(entry.work_end_time);
    let minutes = (end.getTime() - start.getTime()) / 1000 / 60;

    if (entry.break_periods && Array.isArray(entry.break_periods)) {
      minutes -= entry.break_periods.reduce((sum: number, p: any) => {
        if (p.start && p.end) {
          return sum + ((new Date(p.end).getTime() - new Date(p.start).getTime()) / 1000 / 60);
        }
        return sum;
      }, 0);
    }

    const tz = entry.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const startStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
    const endStr = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });

    return { hours: minutes / 60, startStr, endStr };
  }, [entry?.work_start_time, entry?.work_end_time, entry?.break_periods, entry?.timezone]);

  const handleAddSale = () => {
    // Navigate to log-sale page with date context via state (not query params)
    navigate('/log-sale', {
      state: {
        showDatePicker: true,
        returnPath: '/calendar',
        selectedDate: dateStr, // YYYY-MM-DD string for the selected calendar day
      },
    });
    onOpenChange(false);
  };

  const handleGoToTrack = () => {
    navigate('/track');
    onOpenChange(false);
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85svh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-center">
              {format(date, "EEEE, MMMM d")}
            </DrawerTitle>
          </DrawerHeader>

          <div className="px-4 pb-6 overflow-y-auto">
            {hasData ? (
              /* ===== STATE 1: Day WITH Data ===== */
              <div className="space-y-4">
                {/* Activity + Time Summary Card */}
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      {/* Activity Column */}
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Activity</p>
                        <div className="space-y-1">
                          {(entry.doors_knocked || 0) > 0 && (
                            <div className="flex items-center gap-2 text-sm">
                              <DoorOpen className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium">{entry.doors_knocked}</span>
                              <span className="text-muted-foreground">doors</span>
                            </div>
                          )}
                          {(entry.pitches || 0) > 0 && (
                            <div className="flex items-center gap-2 text-sm">
                              <Target className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium">{entry.pitches}</span>
                              <span className="text-muted-foreground">pitches</span>
                            </div>
                          )}
                          {(entry.closes || 0) > 0 && (
                            <div className="flex items-center gap-2 text-sm">
                              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium">{entry.closes}</span>
                              <span className="text-muted-foreground">closes</span>
                            </div>
                          )}
                          {(entry.presentations || 0) > 0 && (
                            <div className="flex items-center gap-2 text-sm">
                              <Presentation className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium">{entry.presentations}</span>
                              <span className="text-muted-foreground">presentations</span>
                            </div>
                          )}
                          {/* Fallback if no activity */}
                          {(entry.doors_knocked || 0) === 0 && (entry.pitches || 0) === 0 && (entry.closes || 0) === 0 && (entry.presentations || 0) === 0 && (
                            <p className="text-sm text-muted-foreground">No activity</p>
                          )}
                        </div>
                      </div>

                      {/* Time Column */}
                      <div className="text-right space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Time</p>
                        {workTime ? (
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium">{workTime.startStr} – {workTime.endStr}</p>
                            <p className="text-xs text-muted-foreground">({formatHoursMinutes(workTime.hours)})</p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No time</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Sales Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sales</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleAddSale}
                      className="h-7 px-2 text-xs text-primary font-semibold"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Sale
                    </Button>
                  </div>

                  {salesLog.length > 0 ? (
                    <>
                      {/* Sale Chips */}
                      <div className="flex flex-wrap gap-2">
                        {salesLog.map((sale) => {
                          const isCancelled = sale.install_status === 'cancelled' || sale.install_status === 'never_installed';
                          return (
                            <button
                              key={sale.id}
                              onClick={() => {
                                setSelectedSale(sale);
                                setSaleDetailOpen(true);
                              }}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-[0.97]",
                                isCancelled
                                  ? "bg-destructive/10 text-destructive line-through"
                                  : sale.type === 'upgrade'
                                    ? "bg-accent text-accent-foreground"
                                    : "bg-primary/10 text-primary"
                              )}
                            >
                              {sale.type === 'upgrade' ? 'UPG' : 'FP'} ${sale.prmr || 0}
                            </button>
                          );
                        })}
                      </div>

                      {/* Totals Row */}
                      <div className="flex items-center gap-4 pt-1">
                        <span className="text-sm font-semibold text-foreground">
                          {efpModeEnabled
                            ? `${formatFP(calculateEfp(metrics.totalPrmr))} EFP`
                            : `${formatFP(metrics.fpPlus)} FP+`
                          }
                        </span>
                        <span className="text-sm text-muted-foreground">
                          PRMR: ${formatPRMR(metrics.totalPrmr)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No sales logged</p>
                  )}
                </div>
              </div>
            ) : (
              /* ===== STATE 2: Day WITHOUT Data ===== */
              <div className="flex flex-col items-center text-center py-6 space-y-5">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
                <div className="space-y-2 max-w-[260px]">
                  <p className="text-sm font-medium text-foreground">
                    Track your day in real-time!
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Use the <strong>Track</strong> tab to log your activity as it happens. It's the best way to capture your work accurately.
                  </p>
                </div>

                {isToday && (
                  <Button
                    variant="default"
                    onClick={handleGoToTrack}
                    className="w-full max-w-[240px]"
                  >
                    Go to Track
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={handleAddSale}
                  className="w-full max-w-[240px]"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add a Sale or Referral
                </Button>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Sale Detail Sheet */}
      <SaleDetailSheet
        open={saleDetailOpen}
        onOpenChange={setSaleDetailOpen}
        sale={selectedSale}
        entryDate={dateStr}
        onUpdateSale={(updatedSale) => {
          if (entry?.id) {
            updateSale({
              entryId: entry.id,
              entryDate: dateStr,
              saleId: updatedSale.id,
              updates: updatedSale,
            });
          }
        }}
        crmEnabled={true}
        crmDetailedEnabled={true}
      />
    </>
  );
};
