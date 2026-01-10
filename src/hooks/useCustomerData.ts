import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sale, normalizeSale } from '@/hooks/useDailyEntry';
import { toast } from 'sonner';

export interface CustomerSale extends Sale {
  entry_date: string;
}

export type SortOption = 
  | 'recent' 
  | 'oldest' 
  | 'prmr_high' 
  | 'prmr_low' 
  | 'time_to_sell' 
  | 'money_spent'
  | 'funded_first'
  | 'unfunded_first';

export const useCustomerData = (
  searchQuery?: string, 
  filterType?: 'all' | 'fp' | 'upgrade',
  sortBy?: SortOption
) => {
  const queryClient = useQueryClient();

  const { data: allSales = [], isLoading } = useQuery({
    queryKey: ['customer-sales'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('daily_entries')
        .select('entry_date, sales_log')
        .eq('user_id', user.id)
        .not('sales_log', 'is', null)
        .order('entry_date', { ascending: false });

      if (error) throw error;

      // Flatten sales from all entries
      const sales: CustomerSale[] = [];
      for (const entry of data || []) {
        const salesLog = entry.sales_log as unknown as Sale[] | null;
        if (salesLog && Array.isArray(salesLog)) {
          for (const rawSale of salesLog) {
            // Normalize legacy field names
            const sale = normalizeSale(rawSale);
            // Only include sales with CRM data
            if (sale.customer_name || sale.customer_account_number || sale.customer_phone) {
              sales.push({
                ...sale,
                entry_date: entry.entry_date,
              });
            }
          }
        }
      }

      return sales;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Mutation to update a sale's funding status
  const updateFundingMutation = useMutation({
    mutationFn: async ({ 
      saleId, 
      entryDate, 
      newStatus,
      scheduledInstallDate,
    }: { 
      saleId: string; 
      entryDate: string; 
      newStatus: 'installed' | 'pending' | 'cancelled' | 'never_installed';
      scheduledInstallDate?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch the entry
      const { data: entry, error: fetchError } = await supabase
        .from('daily_entries')
        .select('sales_log')
        .eq('user_id', user.id)
        .eq('entry_date', entryDate)
        .single();

      if (fetchError) throw fetchError;

      const salesLog = (entry.sales_log as unknown as Sale[]) || [];
      const updatedSalesLog = salesLog.map(sale =>
        sale.id === saleId
          ? { 
              ...sale, 
              install_status: newStatus,
              // Set scheduled_install_date when marking as pending, clear when installed
              scheduled_install_date: newStatus === 'pending' ? (scheduledInstallDate || sale.scheduled_install_date) : undefined,
              // Set install_confirmed_at when marking as installed
              install_confirmed_at: newStatus === 'installed' ? new Date().toISOString() : undefined,
            }
          : sale
      );

      // Recalculate totals from sales_log (exclude cancelled AND never_installed)
      const fundedSales = updatedSalesLog.filter(s =>
        s.install_status !== 'cancelled' && s.install_status !== 'never_installed'
      );
      const fpSales = fundedSales.filter(s => s.type === 'fp');
      const upgradeSales = fundedSales.filter(s => s.type === 'upgrade');

      const fpCount = fpSales.length;
      const fpPrmrTotal = fpSales.reduce((sum, s) => sum + (s.prmr || 0), 0);
      const upgradePrmrTotal = upgradeSales.reduce((sum, s) => sum + (s.prmr || 0), 0);
      const totalPrmr = fpPrmrTotal + upgradePrmrTotal;
      const calculatedFpPlus = fpCount + (upgradePrmrTotal / 85);

      const { error: updateError } = await supabase
        .from('daily_entries')
        .update({
          sales_log: updatedSalesLog as unknown as null,
          closes: fundedSales.length,
          fp_plus: Math.round(calculatedFpPlus * 100) / 100,
          prmr: Math.round(totalPrmr * 100) / 100,
          upgrade_prmr: Math.round(upgradePrmrTotal * 100) / 100,
        })
        .eq('user_id', user.id)
        .eq('entry_date', entryDate);

      if (updateError) throw updateError;

      return { saleId, newStatus };
    },
    onSuccess: ({ newStatus }) => {
      queryClient.invalidateQueries({ queryKey: ['customer-sales'] });
      queryClient.invalidateQueries({ queryKey: ['daily-entry'] });
      queryClient.invalidateQueries({ queryKey: ['all-daily-entries'] });
      queryClient.invalidateQueries({ queryKey: ['pending-installs'] });
      queryClient.invalidateQueries({ queryKey: ['activity-summary'] });
      queryClient.invalidateQueries({ queryKey: ['today-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['yesterday-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['cumulative-fp'] });
      queryClient.invalidateQueries({ queryKey: ['expanded-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['preseason-fp-total'] });
      queryClient.invalidateQueries({ queryKey: ['insights-data'] });
      const statusLabel = newStatus === 'installed' ? 'Funded' 
        : newStatus === 'pending' ? 'Pending' 
        : newStatus === 'never_installed' ? 'Never Installed'
        : 'Cancelled';
      toast.success(`Marked as ${statusLabel}`);
    },
    onError: () => {
      toast.error('Failed to update status');
    },
  });

  // Mutation to update full sale details
  const updateSaleDetailsMutation = useMutation({
    mutationFn: async ({ 
      saleId, 
      entryDate, 
      updates 
    }: { 
      saleId: string; 
      entryDate: string; 
      updates: Partial<Sale>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch the entry
      const { data: entry, error: fetchError } = await supabase
        .from('daily_entries')
        .select('sales_log, fp_plus, prmr, upgrade_prmr')
        .eq('user_id', user.id)
        .eq('entry_date', entryDate)
        .single();

      if (fetchError) throw fetchError;

      const salesLog = (entry.sales_log as unknown as Sale[]) || [];
      const updatedSalesLog = salesLog.map(sale => 
        sale.id === saleId 
          ? { ...sale, ...updates }
          : sale
      );

      // Recalculate FP+ and PRMR from funded sales only (exclude cancelled and never_installed)
      const fundedSales = updatedSalesLog.filter(s => s.install_status !== 'cancelled' && s.install_status !== 'never_installed');
      const fpSales = fundedSales.filter(s => s.type === 'fp');
      const upgradeSales = fundedSales.filter(s => s.type === 'upgrade');
      
      const fpCount = fpSales.length;
      const fpPrmrTotal = fpSales.reduce((sum, s) => sum + (s.prmr || 0), 0);
      const upgradePrmrTotal = upgradeSales.reduce((sum, s) => sum + (s.prmr || 0), 0);
      const totalPrmr = fpPrmrTotal + upgradePrmrTotal;
      const calculatedFpPlus = fpCount + (upgradePrmrTotal / 85);

      const { error: updateError } = await supabase
        .from('daily_entries')
        .update({ 
          sales_log: updatedSalesLog as unknown as null,
          fp_plus: Math.round(calculatedFpPlus * 100) / 100,
          prmr: Math.round(totalPrmr * 100) / 100,
          upgrade_prmr: Math.round(upgradePrmrTotal * 100) / 100,
        })
        .eq('user_id', user.id)
        .eq('entry_date', entryDate);

      if (updateError) throw updateError;

      return { saleId };
    },
    onSuccess: () => {
      // Invalidate all queries that could be affected by sale updates (especially money_spent)
      queryClient.invalidateQueries({ queryKey: ['customer-sales'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['daily-entry'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['all-daily-entries'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['preseason-fp-total'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['cumulative-fp'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['expanded-leaderboard'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['today-leaderboard'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['yesterday-leaderboard'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['weekly-leaderboard'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['monthly-leaderboard'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['season-leaderboard'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['ytd-leaderboard'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['activity-summary'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['insights-data'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['rep-goals'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['pending-installs'], refetchType: 'all' });
      // Invalidate competition/incentive progress
      queryClient.invalidateQueries({ queryKey: ['my-active-incentives'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['incentive-progress'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['my-active-challenges'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['challenge-progress'], refetchType: 'all' });
      toast.success('Sale updated');
    },
    onError: () => {
      toast.error('Failed to update sale');
    },
  });

  // Filter and search
  const filteredSales = useMemo(() => {
    let result = allSales;

    // Apply type filter
    if (filterType && filterType !== 'all') {
      result = result.filter(sale => sale.type === filterType);
    }

    // Apply search
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(sale => {
        const name = (sale.customer_name || '').toLowerCase();
        const phone = (sale.customer_phone || '').toLowerCase();
        const account = (sale.customer_account_number || '').toLowerCase();
        // Also search without A- prefix
        const accountWithPrefix = `a-${account}`;
        
        return name.includes(query) || 
               phone.includes(query) || 
               account.includes(query) ||
               accountWithPrefix.includes(query);
      });
    }

    // Apply sorting
    if (sortBy) {
      result = [...result].sort((a, b) => {
        switch (sortBy) {
          case 'recent':
            return new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime();
          case 'oldest':
            return new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime();
          case 'prmr_high':
            return b.prmr - a.prmr;
          case 'prmr_low':
            return a.prmr - b.prmr;
          case 'time_to_sell':
            return (b.time_to_sell_minutes || 0) - (a.time_to_sell_minutes || 0);
          case 'money_spent':
            return (b.money_spent || 0) - (a.money_spent || 0);
          case 'funded_first':
            const fundedOrder: Record<string, number> = { installed: 0, pending: 1, cancelled: 2, never_installed: 3 };
            return (fundedOrder[a.install_status || 'pending'] ?? 1) - (fundedOrder[b.install_status || 'pending'] ?? 1);
          case 'unfunded_first':
            const unfundedOrder: Record<string, number> = { never_installed: 0, cancelled: 1, pending: 2, installed: 3 };
            return (unfundedOrder[a.install_status || 'pending'] ?? 2) - (unfundedOrder[b.install_status || 'pending'] ?? 2);
          default:
            return 0;
        }
      });
    }

    return result;
  }, [allSales, searchQuery, filterType, sortBy]);

  // Get sales with location data for map
  const salesWithLocation = useMemo(() => {
    return filteredSales.filter(sale => sale.customer_address);
  }, [filteredSales]);

  const updateFunding = (saleId: string, entryDate: string, newStatus: 'installed' | 'pending' | 'cancelled' | 'never_installed', scheduledInstallDate?: string) => {
    updateFundingMutation.mutate({ saleId, entryDate, newStatus, scheduledInstallDate });
  };

  const updateSaleDetails = (saleId: string, entryDate: string, updates: Partial<Sale>) => {
    updateSaleDetailsMutation.mutate({ saleId, entryDate, updates });
  };

  return {
    sales: filteredSales,
    salesWithLocation,
    isLoading,
    totalCount: allSales.length,
    updateFunding,
    updateSaleDetails,
    isUpdatingFunding: updateFundingMutation.isPending,
    isUpdatingSaleDetails: updateSaleDetailsMutation.isPending,
  };
};
