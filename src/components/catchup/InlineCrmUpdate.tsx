import { useState, useMemo } from "react";
import { Search, CheckCircle2, Clock, XCircle, AlertTriangle, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCustomerData, CustomerSale } from "@/hooks/useCustomerData";
import { format } from "date-fns";
import { SaleDetailSheet } from "@/components/SaleDetailSheet";
import { Sale } from "@/hooks/useDailyEntry";
import { useRepData } from "@/hooks/useRepData";

type InstallStatus = 'installed' | 'pending' | 'cancelled' | 'never_installed';

const STATUS_CONFIG: Record<InstallStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  installed: { label: 'Funded', icon: CheckCircle2, className: 'text-success' },
  pending: { label: 'Pending', icon: Clock, className: 'text-warning' },
  cancelled: { label: 'Cancelled', icon: XCircle, className: 'text-destructive' },
  never_installed: { label: 'Never Installed', icon: AlertTriangle, className: 'text-muted-foreground' },
};

const STATUS_OPTIONS: InstallStatus[] = ['installed', 'pending', 'cancelled', 'never_installed'];

export const InlineCrmUpdate = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { sales, isLoading, updateFunding, updateSaleDetails, deleteSale, isUpdatingFunding } = useCustomerData();
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<CustomerSale | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const { repData } = useRepData();

  // Search filtering (same logic as customers page)
  const filteredSales = useMemo(() => {
    if (!searchQuery.trim()) return sales.slice(0, 20); // Show recent 20 by default
    const query = searchQuery.toLowerCase().trim();
    return sales.filter(sale => {
      const name = (sale.customer_name || '').toLowerCase();
      const phone = (sale.customer_phone || '').toLowerCase();
      const account = (sale.customer_account_number || '').toLowerCase();
      const accountWithPrefix = `a-${account}`;
      return name.includes(query) || phone.includes(query) || account.includes(query) || accountWithPrefix.includes(query);
    });
  }, [sales, searchQuery]);

  const handleStatusChange = (sale: CustomerSale, newStatus: InstallStatus) => {
    updateFunding(sale.id, sale.entry_date, newStatus);
    setExpandedSaleId(null);
  };

  const handleOpenDetail = (sale: CustomerSale) => {
    setSelectedSale(sale);
    setDetailSheetOpen(true);
    setExpandedSaleId(null);
  };

  const handleUpdateSale = (updatedSale: Sale) => {
    if (!selectedSale) return;
    updateSaleDetails(selectedSale.id, selectedSale.entry_date, updatedSale);
  };

  const handleDeleteSale = (saleId: string) => {
    if (!selectedSale) return;
    deleteSale(saleId, selectedSale.entry_date);
    setDetailSheetOpen(false);
  };

  return (
    <>
      <div className="space-y-4">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, phone, or account #"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 rounded-2xl"
            autoFocus
          />
        </div>

        {/* Customer list */}
        <div className="space-y-2 max-h-[45svh] overflow-y-auto pb-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-6">Loading customers...</p>
          ) : filteredSales.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {searchQuery ? 'No customers found' : 'No customers logged yet'}
            </p>
          ) : (
            filteredSales.map(sale => {
              const status = (sale.install_status || 'installed') as InstallStatus;
              const config = STATUS_CONFIG[status];
              const Icon = config.icon;
              const isExpanded = expandedSaleId === sale.id;

              return (
                <div key={`${sale.id}-${sale.entry_date}`} className="rounded-xl border bg-card overflow-hidden">
                  <button
                    onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                    className="w-full p-3 flex items-center justify-between text-left active:scale-[0.98] transition-transform"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">
                        {sale.customer_name || 'Unknown Customer'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {sale.customer_account_number && (
                          <span>#{sale.customer_account_number}</span>
                        )}
                        <span>{format(new Date(sale.entry_date), 'MMM d')}</span>
                        <span>${sale.prmr}</span>
                      </div>
                    </div>
                    <div className={cn("flex items-center gap-1 text-xs font-medium flex-shrink-0", config.className)}>
                      <Icon className="h-3.5 w-3.5" />
                      {config.label}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 border-t pt-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {STATUS_OPTIONS.map(opt => {
                          const optConfig = STATUS_CONFIG[opt];
                          const OptIcon = optConfig.icon;
                          const isActive = status === opt;
                          return (
                            <button
                              key={opt}
                              onClick={() => !isActive && handleStatusChange(sale, opt)}
                              disabled={isUpdatingFunding}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-[0.97]",
                                isActive
                                  ? "bg-primary/10 border-2 border-primary text-primary"
                                  : "bg-muted/50 border-2 border-transparent"
                              )}
                            >
                              <OptIcon className="h-3.5 w-3.5" />
                              {optConfig.label}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => handleOpenDetail(sale)}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-muted/50 text-foreground hover:bg-muted transition-colors active:scale-[0.97]"
                      >
                        View Full Details
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {!searchQuery && sales.length > 20 && (
          <p className="text-xs text-muted-foreground text-center">
            Showing 20 most recent · Search to find more
          </p>
        )}
      </div>

      <SaleDetailSheet
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        sale={selectedSale as Sale | null}
        entryDate={selectedSale?.entry_date || ''}
        onUpdateSale={handleUpdateSale}
        onDeleteSale={handleDeleteSale}
        crmEnabled={repData?.crm_enabled}
        crmDetailedEnabled={repData?.crm_detailed_enabled}
      />
    </>
  );
};
