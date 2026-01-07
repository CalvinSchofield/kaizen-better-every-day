import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Bell, Check, CalendarDays, Ban, Trash2, AlertTriangle } from 'lucide-react';
import { usePendingInstalls } from '@/hooks/usePendingInstalls';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

export const PendingInstallAlertCard = () => {
  const { pendingSales, isLoading, confirmInstall, rescheduleSale, markUnfunded, removeSale, isUpdating } = usePendingInstalls();
  const [rescheduleOpenFor, setRescheduleOpenFor] = useState<string | null>(null);
  const [confirmRemoveFor, setConfirmRemoveFor] = useState<string | null>(null);

  // Only show after 7 PM local time
  const localHour = new Date().getHours();
  if (localHour < 19) return null;

  // Don't show if no pending sales or still loading
  if (isLoading || pendingSales.length === 0) return null;

  const handleReschedule = async (entryId: string, saleId: string, date: Date | undefined) => {
    if (!date) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    await rescheduleSale(entryId, saleId, dateStr);
    setRescheduleOpenFor(null);
  };

  const handleMarkNeverInstalled = async (entryId: string, saleId: string) => {
    // Use the existing mutation but with never_installed status instead of removing
    await removeSale(entryId, saleId);
    setConfirmRemoveFor(null);
  };

  return (
    <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="font-medium text-amber-800 dark:text-amber-200">
            Pending Install Check
          </span>
          <Badge variant="secondary" className="ml-auto bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200">
            {pendingSales.length}
          </Badge>
        </div>

        <div className="space-y-3">
          {pendingSales.map((sale) => {
            const isOverdue = sale.scheduled_install_date && sale.scheduled_install_date < format(new Date(), 'yyyy-MM-dd');
            const showRemoveConfirm = confirmRemoveFor === sale.id;
            
            return (
              <div
                key={sale.id}
                className="flex flex-col gap-2 p-3 bg-background rounded-lg border"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={sale.type === 'fp' ? 'default' : 'secondary'}>
                      {sale.type === 'fp' ? 'FP' : 'UP'}
                    </Badge>
                    <span className="font-medium">${Math.round(sale.prmr)}</span>
                    {isOverdue && (
                      <Badge variant="destructive" className="text-xs">Overdue</Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Sold {format(parseISO(sale.entryDate), 'MMM d')}
                  </span>
                </div>

                <div className="text-xs text-muted-foreground">
                  Scheduled: {format(parseISO(sale.scheduled_install_date!), 'MMM d, yyyy')}
                </div>

                {showRemoveConfirm ? (
                  <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">
                        This deal never installed. Remove it completely from your numbers?
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-7 text-xs"
                        onClick={() => setConfirmRemoveFor(null)}
                        disabled={isUpdating}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 h-7 text-xs"
                        onClick={() => handleMarkNeverInstalled(sale.entryId, sale.id)}
                        disabled={isUpdating}
                      >
                        Yes, Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2 mt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-8 text-xs bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-950/50"
                        onClick={() => confirmInstall(sale.entryId, sale.id)}
                        disabled={isUpdating}
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Installed
                      </Button>

                      <Popover 
                        open={rescheduleOpenFor === sale.id} 
                        onOpenChange={(open) => setRescheduleOpenFor(open ? sale.id : null)}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-8 text-xs"
                            disabled={isUpdating}
                          >
                            <CalendarDays className="h-3.5 w-3.5 mr-1" />
                            Reschedule
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="center">
                          <Calendar
                            mode="single"
                            selected={sale.scheduled_install_date ? parseISO(sale.scheduled_install_date) : undefined}
                            onSelect={(date) => handleReschedule(sale.entryId, sale.id, date)}
                            disabled={(date) => date < new Date()}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1 h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                        onClick={() => markUnfunded(sale.entryId, sale.id)}
                        disabled={isUpdating}
                      >
                        <Ban className="h-3 w-3 mr-1" />
                        Installed but Cancelled
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1 h-7 text-xs text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirmRemoveFor(sale.id)}
                        disabled={isUpdating}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Never Installed
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};