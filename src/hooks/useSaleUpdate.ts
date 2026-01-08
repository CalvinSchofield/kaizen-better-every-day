import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sale } from './useDailyEntry';
import { toast } from 'sonner';

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

export const useSaleUpdate = () => {
  const queryClient = useQueryClient();

  const updateSaleMutation = useMutation({
    mutationFn: async ({ entryId, entryDate, saleId, updates }: UpdateSaleParams) => {
      const { data: { user } } = await supabase.auth.getUser();
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

      // Recalculate FP+ and PRMR from funded sales only (exclude cancelled AND never_installed)
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

      // Update entry with new sales_log and recalculated totals
      const { error: updateError } = await supabase
        .from('daily_entries')
        .update({
          sales_log: updatedSalesLog as any,
          closes: fundedSales.length,
          fp_plus: Math.round(calculatedFpPlus * 100) / 100,
          prmr: Math.round(totalPrmr * 100) / 100,
          upgrade_prmr: Math.round(upgradePrmrTotal * 100) / 100,
        })
        .eq('id', entryId);

      if (updateError) throw updateError;

      return { entryDate, updatedSale };
    },
    onSuccess: ({ entryDate }) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['daily-entry', entryDate] });
      queryClient.invalidateQueries({ queryKey: ['all-daily-entries'] });
      queryClient.invalidateQueries({ queryKey: ['preseason-fp-total'] });
      queryClient.invalidateQueries({ queryKey: ['canceled-stats'] });
      queryClient.invalidateQueries({ queryKey: ['activity-summary'] });
      queryClient.invalidateQueries({ queryKey: ['insights-data'] });
      queryClient.invalidateQueries({ queryKey: ['yesterday-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['season-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['ytd-leaderboard'] });
      toast.success('Sale updated');
    },
    onError: (error) => {
      console.error('Error updating sale:', error);
      toast.error('Failed to update sale');
    },
  });

  // Delete sale mutation - removes sale entirely from sales_log
  const deleteSaleMutation = useMutation({
    mutationFn: async ({ entryId, entryDate, saleId }: DeleteSaleParams) => {
      const { data: { user } } = await supabase.auth.getUser();
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
      const saleToDelete = salesLog.find(s => s.id === saleId);
      
      if (!saleToDelete) throw new Error('Sale not found');

      // Remove the sale from sales_log
      const updatedSalesLog = salesLog.filter(s => s.id !== saleId);

      // Recalculate FP+ and PRMR from remaining funded sales only (exclude cancelled AND never_installed)
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

      // Recalculate totals from remaining funded sales only (exclude cancelled AND never_installed)
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

      // Update entry with new sales_log and recalculated totals
      const { error: updateError } = await supabase
        .from('daily_entries')
        .update({
          sales_log: updatedSalesLog as any,
          closes: fundedSales.length,
          fp_plus: Math.round(calculatedFpPlus * 100) / 100,
          prmr: Math.round(totalPrmr * 100) / 100,
          upgrade_prmr: Math.round(upgradePrmrTotal * 100) / 100,
        })
        .eq('id', entryId);

      if (updateError) throw updateError;

      return { entryDate, deletedSale: saleToDelete };
    },
    onSuccess: ({ entryDate }) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['daily-entry', entryDate] });
      queryClient.invalidateQueries({ queryKey: ['all-daily-entries'] });
      queryClient.invalidateQueries({ queryKey: ['preseason-fp-total'] });
      queryClient.invalidateQueries({ queryKey: ['canceled-stats'] });
      queryClient.invalidateQueries({ queryKey: ['activity-summary'] });
      queryClient.invalidateQueries({ queryKey: ['insights-data'] });
      queryClient.invalidateQueries({ queryKey: ['pending-installs'] });
      queryClient.invalidateQueries({ queryKey: ['yesterday-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['season-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['ytd-leaderboard'] });
      toast.success('Sale removed');
    },
    onError: (error) => {
      console.error('Error deleting sale:', error);
      toast.error('Failed to remove sale');
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
