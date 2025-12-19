import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sale } from '@/components/LogSaleSheet';
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
          for (const sale of salesLog) {
            // Only include sales with CRM data
            if (sale.customer_name || sale.account_number || sale.customer_phone) {
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
      newStatus 
    }: { 
      saleId: string; 
      entryDate: string; 
      newStatus: 'installed' | 'pending' | 'cancelled';
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
          ? { ...sale, install_status: newStatus }
          : sale
      );

      const { error: updateError } = await supabase
        .from('daily_entries')
        .update({ sales_log: updatedSalesLog as unknown as null })
        .eq('user_id', user.id)
        .eq('entry_date', entryDate);

      if (updateError) throw updateError;

      return { saleId, newStatus };
    },
    onSuccess: ({ newStatus }) => {
      queryClient.invalidateQueries({ queryKey: ['customer-sales'] });
      queryClient.invalidateQueries({ queryKey: ['daily-entry'] });
      const statusLabel = newStatus === 'installed' ? 'Funded' : newStatus === 'pending' ? 'Pending' : 'Unfunded';
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

      // Recalculate FP+ and PRMR from funded sales only
      const fundedSales = updatedSalesLog.filter(s => s.install_status !== 'cancelled');
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
      queryClient.invalidateQueries({ queryKey: ['customer-sales'] });
      queryClient.invalidateQueries({ queryKey: ['daily-entry'] });
      queryClient.invalidateQueries({ queryKey: ['all-daily-entries'] });
      queryClient.invalidateQueries({ queryKey: ['preseason-fp-total'] });
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
        const account = (sale.account_number || '').toLowerCase();
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
            const fundedOrder = { installed: 0, pending: 1, cancelled: 2 };
            return (fundedOrder[a.install_status || 'pending'] || 1) - (fundedOrder[b.install_status || 'pending'] || 1);
          case 'unfunded_first':
            const unfundedOrder = { cancelled: 0, pending: 1, installed: 2 };
            return (unfundedOrder[a.install_status || 'pending'] || 1) - (unfundedOrder[b.install_status || 'pending'] || 1);
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

  const updateFunding = (saleId: string, entryDate: string, newStatus: 'installed' | 'pending' | 'cancelled') => {
    updateFundingMutation.mutate({ saleId, entryDate, newStatus });
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
