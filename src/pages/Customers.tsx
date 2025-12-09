import { useState } from 'react';
import { Search, List, Map, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CustomerCard } from '@/components/customers/CustomerCard';
import { CustomerMap } from '@/components/customers/CustomerMap';
import { useCustomerData } from '@/hooks/useCustomerData';
import { Skeleton } from '@/components/ui/skeleton';

const Customers = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'fp' | 'upgrade'>('all');
  const [activeTab, setActiveTab] = useState('list');

  const { sales, salesWithLocation, isLoading, totalCount } = useCustomerData(searchQuery, filterType);

  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 space-y-4">
        {/* Customer count */}
        <p className="text-sm text-muted-foreground">
          {totalCount} {totalCount === 1 ? 'customer' : 'customers'} logged
        </p>

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

          <TabsContent value="list" className="mt-4">
            {/* Filter Pills */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filterType === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('fp')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filterType === 'fp'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                FP
              </button>
              <button
                onClick={() => setFilterType('upgrade')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filterType === 'upgrade'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Upgrades
              </button>
            </div>

            {/* Customer List */}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-xl" />
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
                  <CustomerCard key={sale.id} sale={sale} />
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
    </div>
  );
};

export default Customers;
