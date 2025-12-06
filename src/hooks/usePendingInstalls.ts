import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sale } from './useDailyEntry';
import { toast } from 'sonner';

interface PendingSale extends Sale {
  entryId: string;
  entryDate: string;
  salesLog: Sale[];
}

const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const usePendingInstalls = () => {
  const queryClient = useQueryClient();

  const { data: pendingSales = [], isLoading } = useQuery({
    queryKey: ['pending-installs'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const todayDate = getTodayDate();

      // Fetch entries from last 30 days that might have pending installs
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('daily_entries')
        .select('id, entry_date, sales_log')
        .eq('user_id', user.id)
        .gte('entry_date', thirtyDaysAgoStr)
        .not('sales_log', 'is', null);

      if (error) throw error;

      const pending: PendingSale[] = [];

      data?.forEach(entry => {
        const salesLog = (entry.sales_log as unknown as Sale[]) || [];
        salesLog.forEach(sale => {
          // Check if sale is pending and scheduled for today or earlier
          if (
            sale.install_status === 'pending' &&
            sale.scheduled_install_date &&
            sale.scheduled_install_date <= todayDate
          ) {
            pending.push({
              ...sale,
              entryId: entry.id,
              entryDate: entry.entry_date,
              salesLog,
            });
          }
        });
      });

      return pending;
    },
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update a sale's install status
  const updateSaleMutation = useMutation({
    mutationFn: async ({
      entryId,
      saleId,
      updates,
    }: {
      entryId: string;
      saleId: string;
      updates: Partial<Sale>;
    }) => {
      // First fetch the current entry
      const { data: entry, error: fetchError } = await supabase
        .from('daily_entries')
        .select('sales_log')
        .eq('id', entryId)
        .single();

      if (fetchError) throw fetchError;

      const salesLog = (entry.sales_log as unknown as Sale[]) || [];
      const updatedSalesLog = salesLog.map(sale => {
        if (sale.id === saleId) {
          return { ...sale, ...updates };
        }
        return sale;
      });

      const { error: updateError } = await supabase
        .from('daily_entries')
        .update({ sales_log: updatedSalesLog as any })
        .eq('id', entryId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-installs'] });
      queryClient.invalidateQueries({ queryKey: ['daily-entry'] });
      queryClient.invalidateQueries({ queryKey: ['all-daily-entries'] });
    },
    onError: (error) => {
      console.error('Error updating sale:', error);
      toast.error('Failed to update install status');
    },
  });

  const confirmInstall = async (entryId: string, saleId: string) => {
    await updateSaleMutation.mutateAsync({
      entryId,
      saleId,
      updates: {
        install_status: 'installed',
        install_confirmed_at: new Date().toISOString(),
      },
    });
    toast.success('Install confirmed!');
  };

  const rescheduleSale = async (entryId: string, saleId: string, newDate: string) => {
    await updateSaleMutation.mutateAsync({
      entryId,
      saleId,
      updates: {
        scheduled_install_date: newDate,
      },
    });
    toast.success('Install rescheduled');
  };

  const cancelSale = async (entryId: string, saleId: string) => {
    await updateSaleMutation.mutateAsync({
      entryId,
      saleId,
      updates: {
        install_status: 'cancelled',
      },
    });
    toast.success('Sale marked as cancelled');
  };

  return {
    pendingSales,
    isLoading,
    confirmInstall,
    rescheduleSale,
    cancelSale,
    isUpdating: updateSaleMutation.isPending,
  };
};
