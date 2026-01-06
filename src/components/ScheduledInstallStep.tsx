import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import { Sale } from '@/hooks/useDailyEntry';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface ScheduledInstallStepProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salesLog: Sale[];
  onConfirm: (updatedSales: Sale[]) => void;
}

export const ScheduledInstallStep = ({
  open,
  onOpenChange,
  salesLog,
  onConfirm,
}: ScheduledInstallStepProps) => {
  const [selectedSaleIds, setSelectedSaleIds] = useState<Set<string>>(new Set());
  const [scheduledDates, setScheduledDates] = useState<Record<string, Date>>({});
  const [datePickerOpen, setDatePickerOpen] = useState<string | null>(null);

  const toggleSale = (saleId: string) => {
    setSelectedSaleIds(prev => {
      const next = new Set(prev);
      if (next.has(saleId)) {
        next.delete(saleId);
        // Also remove scheduled date
        setScheduledDates(d => {
          const newDates = { ...d };
          delete newDates[saleId];
          return newDates;
        });
      } else {
        next.add(saleId);
        // Default to tomorrow
        setScheduledDates(d => ({
          ...d,
          [saleId]: addDays(new Date(), 1),
        }));
      }
      return next;
    });
  };

  const handleDateSelect = (saleId: string, date: Date | undefined) => {
    if (!date) return;
    // Update the date first, then close popover after a brief delay to ensure state updates
    setScheduledDates(prev => {
      const updated = { ...prev, [saleId]: date };
      console.log('Date selected for sale', saleId, ':', format(date, 'MMM d, yyyy'));
      return updated;
    });
    // Small delay to ensure the date state is updated before closing
    setTimeout(() => {
      setDatePickerOpen(null);
    }, 50);
  };

  const handleConfirm = () => {
    // Update sales with install tracking
    const updatedSales = salesLog.map(sale => {
      if (selectedSaleIds.has(sale.id)) {
        const schedDate = scheduledDates[sale.id];
        return {
          ...sale,
          installed_same_day: false,
          install_status: 'pending' as const,
          scheduled_install_date: schedDate ? format(schedDate, 'yyyy-MM-dd') : undefined,
        };
      }
      // Default: installed same day
      return {
        ...sale,
        installed_same_day: true,
        install_status: 'installed' as const,
      };
    });

    onConfirm(updatedSales);
    onOpenChange(false);
  };

  const handleAllInstalled = () => {
    // Mark all as installed same day
    const updatedSales = salesLog.map(sale => ({
      ...sale,
      installed_same_day: true,
      install_status: 'installed' as const,
    }));
    onConfirm(updatedSales);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-safe">
        <DrawerHeader>
          <DrawerTitle>Install Confirmation</DrawerTitle>
          <DrawerDescription>
            Did all your deals install today?
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-4">
          {/* Quick actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 h-12 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-950/50"
              onClick={handleAllInstalled}
            >
              <Check className="h-4 w-4 mr-2" />
              All Installed Today
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-12"
              onClick={() => {
                // Show sale picker if not already selected
                if (selectedSaleIds.size === 0 && salesLog.length > 0) {
                  toggleSale(salesLog[0].id);
                }
              }}
            >
              <CalendarDays className="h-4 w-4 mr-2" />
              Some Scheduled Out
            </Button>
          </div>

          {/* Sale picker (shown when selecting scheduled sales) */}
          {selectedSaleIds.size > 0 || salesLog.length > 1 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Select deals that were scheduled for a later date:
              </p>

              {salesLog.map(sale => {
                const isSelected = selectedSaleIds.has(sale.id);
                const schedDate = scheduledDates[sale.id];

                return (
                  <div
                    key={sale.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer",
                      isSelected
                        ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                        : "bg-muted/30 hover:bg-muted/50"
                    )}
                    onClick={() => toggleSale(sale.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                          isSelected
                            ? "bg-amber-500 border-amber-500"
                            : "border-muted-foreground/30"
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={sale.type === 'fp' ? 'default' : 'secondary'}>
                          {sale.type === 'fp' ? 'FP' : 'UP'}
                        </Badge>
                        <span className="font-medium">${Math.round(sale.prmr)}</span>
                      </div>
                    </div>

                    {isSelected && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <Popover
                          open={datePickerOpen === sale.id}
                          onOpenChange={(open) => setDatePickerOpen(open ? sale.id : null)}
                        >
                          <PopoverTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className={cn(
                                "h-8 text-xs transition-all",
                                schedDate && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                              )}
                            >
                              {schedDate ? (
                                <>
                                  <Check className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                                  {format(schedDate, 'MMM d')}
                                </>
                              ) : (
                                <>
                                  <CalendarDays className="h-3.5 w-3.5 mr-1" />
                                  Set Date
                                  <ChevronDown className="h-3 w-3 ml-1" />
                                </>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent 
                            className="w-auto p-0" 
                            align="end"
                            onInteractOutside={(e) => e.preventDefault()}
                          >
                            <Calendar
                              mode="single"
                              selected={schedDate}
                              onSelect={(date) => handleDateSelect(sale.id, date)}
                              disabled={(date) => {
                                // Allow today (for same-day scheduled installs) but not past dates
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                return date < today;
                              }}
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Helper text when button is disabled */}
              {selectedSaleIds.size > 0 && [...selectedSaleIds].some(id => !scheduledDates[id]) && (
                <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
                  Select install dates for all scheduled sales
                </p>
              )}

              <Button
                className="w-full mt-4"
                onClick={handleConfirm}
                disabled={
                  selectedSaleIds.size > 0 &&
                  [...selectedSaleIds].some(id => !scheduledDates[id])
                }
              >
                Confirm & Save
              </Button>
            </div>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
