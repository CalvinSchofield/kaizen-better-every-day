import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sale } from '@/hooks/useDailyEntry';
import { toast } from 'sonner';

interface AddSaleParams {
  entryDate: string;  // YYYY-MM-DD
  sale: Omit<Sale, 'id' | 'timestamp'>;
  saleTimestamp?: string; // Optional custom timestamp (defaults to now)
}

/**
 * Hook for adding sales to any date's entry, including finalized entries.
 * Handles:
 * - Finding or creating the entry for the date
 * - Appending the sale to sales_log
 * - Recalculating totals (fp_plus, prmr, upgrade_prmr, closes)
 * - Invalidating all relevant caches
 */
export const useAddSaleToEntry = () => {
  const queryClient = useQueryClient();

  const addSaleMutation = useMutation({
    mutationFn: async ({ entryDate, sale, saleTimestamp }: AddSaleParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create the new sale with ID and timestamp
      const newSale: Sale = {
        id: crypto.randomUUID(),
        ...sale,
        timestamp: saleTimestamp || new Date().toISOString(),
      };

      // Use the safe upsert function that MERGES sales instead of overwriting
      // This prevents multi-device conflicts where iPad/phone sync issues cause data loss
      const { data, error } = await supabase.rpc('upsert_daily_entry_safe', {
        p_user_id: user.id,
        p_entry_date: entryDate,
        p_sales_log: JSON.parse(JSON.stringify([newSale])), // Only send the NEW sale, server will merge
        // Don't send other fields - let server preserve existing values
        p_doors_knocked: null,
        p_decision_makers: null,
        p_pitches: null,
        p_transitions: null,
        p_presentations: null,
        p_closes: null,
        p_fp_plus: null,
        p_prmr: null,
        p_upgrade_prmr: null,
        p_work_start_time: null,
        p_work_end_time: null,
        p_break_periods: null,
        p_counter_timestamps: null,
        p_custom_counters: null,
        p_timezone: null,
        p_is_finalized: null,
      });

      if (error) throw error;

      // Recalculate totals from the returned merged sales_log
      const returnedData = data as { sales_log?: unknown } | null;
      const mergedSalesLog = (returnedData?.sales_log as Sale[]) || [newSale];
      const fundedSales = mergedSalesLog.filter(s =>
        s.install_status !== 'cancelled' && s.install_status !== 'never_installed'
      );
      const fpSales = fundedSales.filter(s => s.type === 'fp');
      const upgradeSales = fundedSales.filter(s => s.type === 'upgrade');

      const fpCount = fpSales.length;
      const fpPrmrTotal = fpSales.reduce((sum, s) => sum + (s.prmr || 0), 0);
      const upgradePrmrTotal = upgradeSales.reduce((sum, s) => sum + (s.prmr || 0), 0);
      const totalPrmr = fpPrmrTotal + upgradePrmrTotal;
      const calculatedFpPlus = fpCount + (upgradePrmrTotal / 85);

      // Update the entry with recalculated totals
      await supabase
        .from('daily_entries')
        .update({
          closes: fundedSales.length,
          fp_plus: Math.round(calculatedFpPlus * 100) / 100,
          prmr: Math.round(totalPrmr * 100) / 100,
          upgrade_prmr: Math.round(upgradePrmrTotal * 100) / 100,
        })
        .eq('user_id', user.id)
        .eq('entry_date', entryDate);

      return { entryDate, sale: newSale };
    },
    onSuccess: ({ entryDate }) => {
      // Invalidate all relevant caches with broad invalidation
      queryClient.invalidateQueries({ queryKey: ['daily-entry', entryDate], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['daily-entry'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['customer-sales'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['all-daily-entries'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['pending-installs'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['activity-summary'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['today-leaderboard'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['yesterday-leaderboard'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['cumulative-fp'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['expanded-leaderboard'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['preseason-fp-total'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['insights-data'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['my-active-incentives'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['incentive-progress'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['challenge-progress'], refetchType: 'all' });
      
      toast.success('Sale added successfully! 🎉');
    },
    onError: (error) => {
      console.error('Failed to add sale:', error);
      toast.error('Failed to add sale');
    },
  });

  return {
    addSale: addSaleMutation.mutate,
    addSaleAsync: addSaleMutation.mutateAsync,
    isAddingSale: addSaleMutation.isPending,
  };
};
