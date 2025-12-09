import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin, AlertCircle } from 'lucide-react';
import { CustomerSale } from '@/hooks/useCustomerData';
import { Skeleton } from '@/components/ui/skeleton';

interface CustomerMapProps {
  sales: CustomerSale[];
  filterType: 'all' | 'fp' | 'upgrade';
  onFilterChange: (filter: 'all' | 'fp' | 'upgrade') => void;
}

export const CustomerMap = ({ sales, filterType, onFilterChange }: CustomerMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true);

  // Fetch Mapbox token from edge function
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-mapbox-token`);
        if (response.ok) {
          const data = await response.json();
          setMapboxToken(data.token);
        } else {
          setTokenError(true);
        }
      } catch (error) {
        console.error('Failed to fetch Mapbox token:', error);
        setTokenError(true);
      }
    };
    fetchToken();
  }, []);

  // Filter sales with valid coordinates
  const salesWithLocation = sales.filter(
    sale => sale.customer_lat && sale.customer_lng
  );

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || salesWithLocation.length === 0) return;

    mapboxgl.accessToken = mapboxToken;

    // Calculate center from all points
    const avgLat = salesWithLocation.reduce((sum, s) => sum + (s.customer_lat || 0), 0) / salesWithLocation.length;
    const avgLng = salesWithLocation.reduce((sum, s) => sum + (s.customer_lng || 0), 0) / salesWithLocation.length;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [avgLng, avgLat],
      zoom: 10,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      setIsMapLoading(false);
    });

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken, salesWithLocation.length > 0]);

  // Update markers when filter changes
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add new markers
    salesWithLocation.forEach(sale => {
      if (!sale.customer_lat || !sale.customer_lng) return;

      const isUpgrade = sale.type === 'upgrade';
      const color = isUpgrade ? '#10b981' : '#3b82f6'; // emerald-500 / blue-500

      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'customer-marker';
      el.style.cssText = `
        width: 32px;
        height: 32px;
        background: ${color};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: pointer;
      `;

      // Create popup content
      const popupContent = `
        <div style="padding: 8px; font-family: system-ui, sans-serif;">
          <div style="font-weight: 600; margin-bottom: 4px;">${sale.customer_name || 'Customer'}</div>
          <div style="font-size: 12px; color: #666;">
            ${sale.account_number ? `Account: ${sale.account_number}` : ''}
          </div>
          <div style="font-size: 12px; color: #666;">
            ${sale.customer_phone || ''}
          </div>
          <div style="margin-top: 6px; display: flex; gap: 6px; align-items: center;">
            <span style="
              background: ${isUpgrade ? '#d1fae5' : '#dbeafe'};
              color: ${isUpgrade ? '#065f46' : '#1e40af'};
              padding: 2px 8px;
              border-radius: 9999px;
              font-size: 11px;
              font-weight: 500;
            ">${isUpgrade ? 'Upgrade' : 'FP'}</span>
            <span style="font-weight: 600; color: #059669;">$${sale.prmr?.toFixed(2) || '0'}</span>
          </div>
        </div>
      `;

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(popupContent);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([sale.customer_lng, sale.customer_lat])
        .setPopup(popup)
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [salesWithLocation, filterType]);

  // No location data state
  if (salesWithLocation.length === 0) {
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

        <div className="relative h-[60vh] bg-muted rounded-xl overflow-hidden border border-border">
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <MapPin className="w-12 h-12 text-muted-foreground/50 mb-3" />
            <h3 className="font-semibold text-foreground mb-1">No location data</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Location data is captured when you log sales with CRM enabled. Future sales will appear on the map.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Token error state
  if (tokenError) {
    return (
      <div className="space-y-4">
        <div className="relative h-[60vh] bg-muted rounded-xl overflow-hidden border border-border">
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <AlertCircle className="w-12 h-12 text-amber-500/70 mb-3" />
            <h3 className="font-semibold text-foreground mb-1">Map unavailable</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Unable to load map. Please check the Mapbox configuration.
            </p>
          </div>
        </div>
      </div>
    );
  }

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
          All ({sales.length})
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
          FP ({sales.filter(s => s.type === 'fp').length})
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
          Upgrades ({sales.filter(s => s.type === 'upgrade').length})
        </button>
      </div>

      {/* Map Container */}
      <div className="relative h-[60vh] rounded-xl overflow-hidden border border-border">
        {isMapLoading && (
          <div className="absolute inset-0 z-10 bg-muted flex flex-col items-center justify-center gap-4">
            <Skeleton className="w-full h-full absolute inset-0" />
            <div className="z-10 flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">Loading map...</span>
            </div>
          </div>
        )}
        <div ref={mapContainer} className="absolute inset-0" />
      </div>
    </div>
  );
};
