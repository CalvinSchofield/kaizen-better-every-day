import { useState } from 'react';
import { Search, List, Map, Users, ArrowUpDown, ChevronDown, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CustomerCard } from '@/components/customers/CustomerCard';
import { CustomerMap } from '@/components/customers/CustomerMap';
import { useCustomerData, SortOption, CustomerSale } from '@/hooks/useCustomerData';
import { Skeleton } from '@/components/ui/skeleton';
import { useEfpMode } from '@/hooks/useEfpMode';
import { SaleDetailSheet } from '@/components/SaleDetailSheet';
import { LogSaleSheet } from '@/components/LogSaleSheet';
import { useRepData } from '@/hooks/useRepData';
import { useAddSaleToEntry } from '@/hooks/useAddSaleToEntry';
import { Sale } from '@/hooks/useDailyEntry';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'prmr_high', label: 'Highest PRMR' },
  { value: 'prmr_low', label: 'Lowest PRMR' },
  { value: 'time_to_sell', label: 'Longest Time to Sell' },
  { value: 'money_spent', label: 'Most Money Spent' },
  { value: 'funded_first', label: 'Funded First' },
  { value: 'unfunded_first', label: 'Unfunded First' },
];

const Customers = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'fp' | 'upgrade'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [activeTab, setActiveTab] = useState('list');
  
  // Detail sheet state
  const [selectedSale, setSelectedSale] = useState<CustomerSale | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  
  // Add sale sheet state
  const [addSaleSheetOpen, setAddSaleSheetOpen] = useState(false);

  const { sales, salesWithLocation, isLoading, totalCount, updateFunding, updateSaleDetails } = useCustomerData(
    searchQuery, 
    filterType,
    sortBy
  );
  const { efpModeEnabled } = useEfpMode();
  const { repData } = useRepData();
  const { addSale, isAddingSale } = useAddSaleToEntry();

  const handleCardClick = (sale: CustomerSale) => {
    setSelectedSale(sale);
    setDetailSheetOpen(true);
  };

  const handleFundingToggle = (sale: CustomerSale, newStatus: 'installed' | 'pending' | 'cancelled' | 'never_installed', scheduledInstallDate?: string) => {
    updateFunding(sale.id, sale.entry_date, newStatus, scheduledInstallDate);
  };

  const handleUpdateSale = (updatedSale: Sale) => {
    if (!selectedSale) return;
    updateSaleDetails(selectedSale.id, selectedSale.entry_date, updatedSale);
  };

  const handleDeleteSale = (_saleId: string) => {
    setDetailSheetOpen(false);
  };

  const handleAddSaleWithDate = (saleData: Omit<Sale, 'id' | 'timestamp'>, date: string, timestamp: string) => {
    addSale({
      entryDate: date,
      sale: saleData,
      saleTimestamp: timestamp,
    });
    setAddSaleSheetOpen(false);
  };

  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Sort';

  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, or account #"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="list" className="gap-2">
              <List className="w-4 h-4" />
              List
            </TabsTrigger>
            <TabsTrigger value="map" className="gap-2">
              <Map className="w-4 h-4" />
              Map
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-4 space-y-4">
            {/* Type Filter Pills + Add Sale Button */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterType('all')}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                    filterType === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterType('fp')}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                    filterType === 'fp'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  FP
                </button>
                <button
                  onClick={() => setFilterType('upgrade')}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                    filterType === 'upgrade'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  Upgrades
                </button>
              </div>
              
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setAddSaleSheetOpen(true)}
                disabled={isAddingSale}
                className="shrink-0"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {sales.length} of {totalCount} customers
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium transition-colors">
                  <ArrowUpDown className="w-4 h-4" />
                  {currentSortLabel}
                  <ChevronDown className="w-3 h-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {SORT_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => setSortBy(option.value)}
                      className={cn(sortBy === option.value && "bg-accent")}
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Customer List */}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-36 w-full rounded-xl" />
                ))}
              </div>
            ) : sales.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <h3 className="font-semibold text-foreground mb-1">No customers yet</h3>
                <p className="text-sm text-muted-foreground">
                  {searchQuery 
                    ? 'No customers match your search' 
                    : 'Log sales with CRM enabled to see your customers here'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sales.map((sale) => (
                  <CustomerCard 
                    key={sale.id} 
                    sale={sale} 
                    efpModeEnabled={efpModeEnabled}
                    onCardClick={() => handleCardClick(sale)}
                    onFundingToggle={(status, scheduledDate) => handleFundingToggle(sale, status, scheduledDate)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="map" className="mt-4">
            <CustomerMap 
              sales={salesWithLocation} 
              filterType={filterType}
              onFilterChange={setFilterType}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Sale Detail Sheet */}
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

      {/* Add Sale Sheet */}
      <LogSaleSheet
        open={addSaleSheetOpen}
        onOpenChange={setAddSaleSheetOpen}
        onLogSale={() => {}}
        crmEnabled={repData?.crm_enabled}
        crmDetailedEnabled={repData?.crm_detailed_enabled}
        showDatePicker={true}
        onLogSaleWithDate={handleAddSaleWithDate}
      />
    </div>
  );
};

export default Customers;
