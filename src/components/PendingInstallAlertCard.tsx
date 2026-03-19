import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Bell, Check, CalendarDays, Trash2, AlertTriangle, Phone, MessageSquare, ChevronRight, Sparkles } from 'lucide-react';
import { usePendingInstalls } from '@/hooks/usePendingInstalls';
import { Sale } from '@/hooks/useDailyEntry';
import { SaleDetailSheet } from '@/components/SaleDetailSheet';
import { useSaleUpdate } from '@/hooks/useSaleUpdate';
import { useRepData } from '@/hooks/useRepData';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';

interface PendingInstallAlertCardProps {
  alwaysShow?: boolean;
}

const getTodayStr = () => format(new Date(), 'yyyy-MM-dd');

export const PendingInstallAlertCard = ({ alwaysShow = false }: PendingInstallAlertCardProps) => {
  const { pendingSales, isLoading, confirmInstall, rescheduleSale, removeSale, isUpdating } = usePendingInstalls();
  const { updateSale } = useSaleUpdate();
  const { repData } = useRepData();
  const [rescheduleOpenFor, setRescheduleOpenFor] = useState<string | null>(null);
  const [confirmRemoveFor, setConfirmRemoveFor] = useState<string | null>(null);
  const [detailSale, setDetailSale] = useState<Sale | null>(null);
  const [detailEntryDate, setDetailEntryDate] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);

  // Only show after 7 PM local time unless alwaysShow
  const localHour = new Date().getHours();
  if (!alwaysShow && localHour < 19) return null;

  // Don't show if no pending sales or still loading
  if (isLoading || pendingSales.length === 0) return null;

  const todayStr = getTodayStr();

  // Separate today's installs (for morning confirmation) vs overdue/action-needed
  const todaysInstalls = pendingSales.filter(s => s.scheduled_install_date === todayStr);
  const actionInstalls = pendingSales.filter(s => s.scheduled_install_date !== todayStr);

  // Morning of install day (before 5 PM) = show confirmation encouragement
  const isMorningMode = localHour < 17;

  const handleReschedule = async (entryId: string, saleId: string, date: Date | undefined) => {
    if (!date) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    await rescheduleSale(entryId, saleId, dateStr);
    setRescheduleOpenFor(null);
  };

  const handleMarkNeverInstalled = async (entryId: string, saleId: string) => {
    await removeSale(entryId, saleId);
    setConfirmRemoveFor(null);
  };

  const handleCall = (e: React.MouseEvent, phone?: string) => {
    e.stopPropagation();
    hapticLight();
    if (!phone) return;
    const clean = phone.replace(/\D/g, '');
    window.open(`tel:${clean}`, '_self');
  };

  const handleText = (e: React.MouseEvent, phone?: string) => {
    e.stopPropagation();
    hapticLight();
    if (!phone) return;
    const clean = phone.replace(/\D/g, '');
    window.open(`sms:${clean}`, '_self');
  };

  const openDetail = (sale: any) => {
    hapticLight();
    setDetailSale(sale as Sale);
    setDetailEntryDate(sale.entryDate);
    setDetailOpen(true);
  };

  const handleUpdateSale = (updatedSale: Sale) => {
    if (!detailEntryDate) return;
    // Find the pending sale to get entryId
    const pending = pendingSales.find(s => s.id === updatedSale.id);
    if (!pending) return;
    updateSale({
      entryId: pending.entryId,
      entryDate: detailEntryDate,
      saleId: updatedSale.id,
      updates: updatedSale,
    });
    setDetailOpen(false);
  };

  const crmEnabled = repData?.crm_enabled ?? false;
  const crmDetailedEnabled = repData?.crm_detailed_enabled ?? false;

  const renderSaleRow = (sale: any, showActions: boolean) => {
    const isOverdue = sale.scheduled_install_date && sale.scheduled_install_date < todayStr;
    const showRemoveConfirm = confirmRemoveFor === sale.id;
    const customerName = sale.customer_name;
    const customerPhone = sale.customer_phone;

    return (
      <div
        key={sale.id}
        className="flex flex-col gap-2 p-3 bg-background rounded-lg border cursor-pointer active:bg-accent/50 transition-colors"
        onClick={() => openDetail(sale)}
      >
        {/* Top row: badge, name/prmr, contact icons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Badge variant={sale.type === 'fp' ? 'default' : 'secondary'} className="shrink-0">
              {sale.type === 'fp' ? 'FP' : 'UP'}
            </Badge>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-sm">${Math.round(sale.prmr)}</span>
                {isOverdue && (
                  <Badge variant="destructive" className="text-[10px] px-1 py-0">Overdue</Badge>
                )}
              </div>
              {customerName && (
                <p className="text-xs text-muted-foreground truncate">{customerName}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {customerPhone && (
              <>
                <button
                  onClick={(e) => handleCall(e, customerPhone)}
                  className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-accent active:scale-90 transition-transform"
                >
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button
                  onClick={(e) => handleText(e, customerPhone)}
                  className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-accent active:scale-90 transition-transform"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </>
            )}
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-1" />
          </div>
        </div>

        {/* Schedule + sold date */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Scheduled: {format(parseISO(sale.scheduled_install_date!), 'MMM d, yyyy')}</span>
          <span>Sold {format(parseISO(sale.entryDate), 'MMM d')}</span>
        </div>

        {/* Action buttons (only when showActions is true) */}
        {showActions && (
          <div onClick={(e) => e.stopPropagation()}>
            {showRemoveConfirm ? (
              <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    This deal never installed. Mark it as "Never Installed" and remove it from your numbers?
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
                    Never Installed
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
        )}
      </div>
    );
  };

  return (
    <>
      {/* Morning confirmation card for today's installs */}
      {todaysInstalls.length > 0 && isMorningMode && (
        <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-blue-800 dark:text-blue-200">
                Install{todaysInstalls.length > 1 ? 's' : ''} Today
              </span>
              <Badge variant="secondary" className="ml-auto bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200">
                {todaysInstalls.length}
              </Badge>
            </div>
            <p className="text-xs text-blue-700/80 dark:text-blue-300/80 mb-3">
              Reach out and confirm with your customer{todaysInstalls.length > 1 ? 's' : ''} — a quick call or text goes a long way!
            </p>
            <div className="space-y-3">
              {todaysInstalls.map(sale => renderSaleRow(sale, false))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Evening / next-day action card for today's installs (after 5 PM) */}
      {todaysInstalls.length > 0 && !isMorningMode && (
        <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="font-medium text-amber-800 dark:text-amber-200">
                Pending Install Check
              </span>
              <Badge variant="secondary" className="ml-auto bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200">
                {todaysInstalls.length}
              </Badge>
            </div>
            <div className="space-y-3">
              {todaysInstalls.map(sale => renderSaleRow(sale, true))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overdue / future pending installs - always show with actions */}
      {actionInstalls.length > 0 && (
        <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="font-medium text-amber-800 dark:text-amber-200">
                Pending Install Check
              </span>
              <Badge variant="secondary" className="ml-auto bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200">
                {actionInstalls.length}
              </Badge>
            </div>
            <div className="space-y-3">
              {actionInstalls.map(sale => renderSaleRow(sale, true))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sale Detail Drawer */}
      <SaleDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        sale={detailSale}
        entryDate={detailEntryDate}
        onUpdateSale={handleUpdateSale}
        crmEnabled={crmEnabled}
        crmDetailedEnabled={crmDetailedEnabled}
      />
    </>
  );
};
