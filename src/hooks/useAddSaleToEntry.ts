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

      // Fetch existing entry for this date (if any)
      const { data: existingEntry, error: fetchError } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('entry_date', entryDate)
        .maybeSingle();

      if (fetchError) throw fetchError;

      // Create the new sale with ID and timestamp
      const newSale: Sale = {
        id: crypto.randomUUID(),
        ...sale,
        timestamp: saleTimestamp || new Date().toISOString(),
      };

      // Get existing sales_log or start fresh
      const existingSalesLog = existingEntry?.sales_log as unknown as Sale[] || [];
      const updatedSalesLog = [...existingSalesLog, newSale];

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

      if (existingEntry) {
        // Update existing entry
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
      } else {
        // Create new entry with the sale
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const now = new Date().toISOString();
        
        const { error: insertError } = await supabase
          .from('daily_entries')
          .insert({
            user_id: user.id,
            entry_date: entryDate,
            sales_log: updatedSalesLog as unknown as null,
            closes: fundedSales.length,
            fp_plus: Math.round(calculatedFpPlus * 100) / 100,
            prmr: Math.round(totalPrmr * 100) / 100,
            upgrade_prmr: Math.round(upgradePrmrTotal * 100) / 100,
            doors_knocked: 0,
            decision_makers: 0,
            pitches: 0,
            transitions: 0,
            presentations: 0,
            work_start_time: now,
            timezone,
            is_finalized: true, // Mark as finalized since we're adding retroactively
          });

        if (insertError) throw insertError;
      }

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
