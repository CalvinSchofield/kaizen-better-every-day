import { useState } from 'react';
import { MapPin, AlertCircle } from 'lucide-react';
import { CustomerSale } from '@/hooks/useCustomerData';

interface CustomerMapProps {
  sales: CustomerSale[];
  filterType: 'all' | 'fp' | 'upgrade';
  onFilterChange: (filter: 'all' | 'fp' | 'upgrade') => void;
}

export const CustomerMap = ({ sales, filterType, onFilterChange }: CustomerMapProps) => {
  // For now, show a placeholder since Mapbox requires a token
  const hasLocationData = sales.length > 0;

  return (
    <div className="space-y-4">
      {/* Filter Pills */}
      <div className="flex gap-2">
        <button
          onClick={() => onFilterChange('all')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            filterType === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          All
        </button>
        <button
          onClick={() => onFilterChange('fp')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1 ${
            filterType === 'fp'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          FP
        </button>
        <button
          onClick={() => onFilterChange('upgrade')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1 ${
            filterType === 'upgrade'
              ? 'bg-emerald-600 text-white'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          Upgrades
        </button>
      </div>

      {/* Map Placeholder */}
      <div className="relative h-[60vh] bg-muted rounded-xl overflow-hidden border border-border">
        {!hasLocationData ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <MapPin className="w-12 h-12 text-muted-foreground/50 mb-3" />
            <h3 className="font-semibold text-foreground mb-1">No location data</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Location data is captured when you log sales with CRM enabled. Future sales will appear on the map.
            </p>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <AlertCircle className="w-12 h-12 text-amber-500/70 mb-3" />
            <h3 className="font-semibold text-foreground mb-1">Map coming soon</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              You have {sales.length} {sales.length === 1 ? 'customer' : 'customers'} with location data. 
              The interactive map feature is being set up.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
