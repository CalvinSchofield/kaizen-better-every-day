import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sale } from './useDailyEntry';
import { toast } from 'sonner';
import { hapticSuccess, hapticWarning } from '@/utils/haptics';
import { invalidateAllSalesQueries, clearSalesLocalStorageCaches } from '@/utils/invalidateSalesQueries';

interface UpdateSaleParams {
  entryId: string;
  entryDate: string;
  saleId: string;
  updates: Partial<Sale>;
}

interface DeleteSaleParams {
  entryId: string;
  entryDate: string;
  saleId: string;
}

// Helper to recalculate totals from sales log
const recalculateTotals = (salesLog: Sale[]) => {
  const fundedSales = salesLog.filter(s =>
    s.install_status !== 'cancelled' && s.install_status !== 'never_installed'
  );
  const fpSales = fundedSales.filter(s => s.type === 'fp');
  const upgradeSales = fundedSales.filter(s => s.type === 'upgrade');

  const fpCount = fpSales.length;
  const fpPrmrTotal = fpSales.reduce((sum, s) => sum + (s.prmr || 0), 0);
  const upgradePrmrTotal = upgradeSales.reduce((sum, s) => sum + (s.prmr || 0), 0);
  const totalPrmr = fpPrmrTotal + upgradePrmrTotal;
  const calculatedFpPlus = fpCount + (upgradePrmrTotal / 85);

  return {
    closes: fundedSales.length,
    fp_plus: Math.round(calculatedFpPlus * 100) / 100,
    prmr: Math.round(totalPrmr * 100) / 100,
    upgrade_prmr: Math.round(upgradePrmrTotal * 100) / 100,
  };
};

export const useSaleUpdate = () => {
  const queryClient = useQueryClient();

  const updateSaleMutation = useMutation({
    mutationFn: async ({ entryId, entryDate, saleId, updates }: UpdateSaleParams) => {
      // PERF FIX: Use getSession() (local cache) instead of getUser() (network call)
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Not authenticated');

      // Fetch current entry
      const { data: entry, error: fetchError } = await supabase
        .from('daily_entries')
        .select('sales_log, closes, fp_plus, prmr, upgrade_prmr')
        .eq('id', entryId)
        .single();

      if (fetchError) throw fetchError;
      if (!entry) throw new Error('Entry not found');

      const salesLog = (entry.sales_log as unknown as Sale[]) || [];
      const saleIndex = salesLog.findIndex(s => s.id === saleId);

      if (saleIndex === -1) throw new Error('Sale not found');

      // Update the sale
      const updatedSale = { ...salesLog[saleIndex], ...updates };
      const updatedSalesLog = [...salesLog];
      updatedSalesLog[saleIndex] = updatedSale;

      const totals = recalculateTotals(updatedSalesLog);

      // Update entry with new sales_log and recalculated totals
      const { error: updateError } = await supabase
        .from('daily_entries')
        .update({
          sales_log: updatedSalesLog as any,
          ...totals,
        })
        .eq('id', entryId);

      if (updateError) throw updateError;

      return { entryDate, updatedSale };
    },
    // OPTIMISTIC UPDATE - Instant UI feedback
    onMutate: async ({ entryDate, saleId, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['daily-entry', entryDate] });
      const previousEntry = queryClient.getQueryData(['daily-entry', entryDate]);

      queryClient.setQueryData(['daily-entry', entryDate], (old: any) => {
        if (!old) return old;
        const salesLog = (old.sales_log || []) as Sale[];
        const updatedSalesLog = salesLog.map(s => 
          s.id === saleId ? { ...s, ...updates } : s
        );
        const totals = recalculateTotals(updatedSalesLog);
        return { ...old, sales_log: updatedSalesLog, ...totals };
      });

      return { previousEntry, entryDate };
    },
    onError: (error, variables, context) => {
      console.error('Error updating sale:', error);
      if (context?.previousEntry) {
        queryClient.setQueryData(['daily-entry', context.entryDate], context.previousEntry);
      }
      hapticWarning();
      toast.error('Failed to update sale', {
        action: {
          label: 'Retry',
          onClick: () => updateSaleMutation.mutate(variables),
        },
      });
    },
    onSuccess: ({ entryDate }) => {
      hapticSuccess();
      toast.success('Sale updated');
      clearSalesLocalStorageCaches();
      invalidateAllSalesQueries(queryClient, entryDate);
    },
  });

  // Delete sale mutation - removes sale entirely from sales_log
  const deleteSaleMutation = useMutation({
    mutationFn: async ({ entryId, entryDate, saleId }: DeleteSaleParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: entry, error: fetchError } = await supabase
        .from('daily_entries')
        .select('sales_log, closes, fp_plus, prmr, upgrade_prmr')
        .eq('id', entryId)
        .single();

      if (fetchError) throw fetchError;
      if (!entry) throw new Error('Entry not found');

      const salesLog = (entry.sales_log as unknown as Sale[]) || [];
      const saleToDelete = salesLog.find(s => s.id === saleId);
      if (!saleToDelete) throw new Error('Sale not found');

      const updatedSalesLog = salesLog.filter(s => s.id !== saleId);
      const totals = recalculateTotals(updatedSalesLog);

      const { error: updateError } = await supabase
        .from('daily_entries')
        .update({
          sales_log: updatedSalesLog as any,
          ...totals,
        })
        .eq('id', entryId);

      if (updateError) throw updateError;

      return { entryDate, deletedSale: saleToDelete };
    },
    onMutate: async ({ entryDate, saleId }) => {
      await queryClient.cancelQueries({ queryKey: ['daily-entry', entryDate] });
      const previousEntry = queryClient.getQueryData(['daily-entry', entryDate]);

      queryClient.setQueryData(['daily-entry', entryDate], (old: any) => {
        if (!old) return old;
        const salesLog = (old.sales_log || []) as Sale[];
        const updatedSalesLog = salesLog.filter(s => s.id !== saleId);
        const totals = recalculateTotals(updatedSalesLog);
        return { ...old, sales_log: updatedSalesLog, ...totals };
      });

      return { previousEntry, entryDate };
    },
    onError: (error, variables, context) => {
      console.error('Error deleting sale:', error);
      if (context?.previousEntry) {
        queryClient.setQueryData(['daily-entry', context.entryDate], context.previousEntry);
      }
      hapticWarning();
      toast.error('Failed to remove sale', {
        action: {
          label: 'Retry',
          onClick: () => deleteSaleMutation.mutate(variables),
        },
      });
    },
    onSuccess: ({ entryDate }) => {
      hapticSuccess();
      toast.success('Sale removed');
      clearSalesLocalStorageCaches();
      invalidateAllSalesQueries(queryClient, entryDate);
    },
  });

  return {
    updateSale: updateSaleMutation.mutate,
    updateSaleAsync: updateSaleMutation.mutateAsync,
    isUpdating: updateSaleMutation.isPending,
    deleteSale: deleteSaleMutation.mutate,
    deleteSaleAsync: deleteSaleMutation.mutateAsync,
    isDeleting: deleteSaleMutation.isPending,
  };
};
