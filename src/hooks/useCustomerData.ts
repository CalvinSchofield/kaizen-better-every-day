import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sale } from '@/components/LogSaleSheet';

export interface CustomerSale extends Sale {
  entry_date: string;
}

export const useCustomerData = (searchQuery?: string, filterType?: 'all' | 'fp' | 'upgrade') => {
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

    return result;
  }, [allSales, searchQuery, filterType]);

  // Get sales with location data for map
  const salesWithLocation = useMemo(() => {
    return filteredSales.filter(sale => sale.customer_address);
  }, [filteredSales]);

  return {
    sales: filteredSales,
    salesWithLocation,
    isLoading,
    totalCount: allSales.length,
  };
};
