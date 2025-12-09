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
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

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

  // Filter by type
  const filteredSales = salesWithLocation.filter(sale => {
    if (filterType === 'all') return true;
    if (filterType === 'fp') return sale.type === 'fp';
    if (filterType === 'upgrade') return sale.type === 'upgrade';
    return true;
  });

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
      setMapReady(true);
    });

    return () => {
      map.current?.remove();
      setMapReady(false);
    };
  }, [mapboxToken, salesWithLocation.length > 0]);

  // Update clusters when filter changes
  useEffect(() => {
    if (!map.current || !mapReady) return;

    const sourceId = 'customers';
    const clusterId = 'clusters';
    const clusterCountId = 'cluster-count';
    const unclusteredId = 'unclustered-point';

    // Remove existing layers and source
    if (map.current.getLayer(unclusteredId)) map.current.removeLayer(unclusteredId);
    if (map.current.getLayer(clusterCountId)) map.current.removeLayer(clusterCountId);
    if (map.current.getLayer(clusterId)) map.current.removeLayer(clusterId);
    if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);

    // Create GeoJSON from filtered sales
    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: filteredSales.map(sale => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [sale.customer_lng!, sale.customer_lat!]
        },
        properties: {
          id: sale.id,
          name: sale.customer_name || 'Customer',
          phone: sale.customer_phone || '',
          account: sale.account_number || '',
          prmr: sale.prmr || 0,
          type: sale.type,
          isUpgrade: sale.type === 'upgrade'
        }
      }))
    };

    // Add source with clustering
    map.current.addSource(sourceId, {
      type: 'geojson',
      data: geojson,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50
    });

    // Cluster circles
    map.current.addLayer({
      id: clusterId,
      type: 'circle',
      source: sourceId,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#3b82f6', // blue for small clusters
          10,
          '#8b5cf6', // purple for medium clusters
          30,
          '#ec4899'  // pink for large clusters
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          20,
          10,
          25,
          30,
          30
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });

    // Cluster count labels
    map.current.addLayer({
      id: clusterCountId,
      type: 'symbol',
      source: sourceId,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 12
      },
      paint: {
        'text-color': '#ffffff'
      }
    });

    // Individual points
    map.current.addLayer({
      id: unclusteredId,
      type: 'circle',
      source: sourceId,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': [
          'case',
          ['get', 'isUpgrade'],
          '#10b981', // emerald for upgrades
          '#3b82f6'  // blue for FP
        ],
        'circle-radius': 10,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });

    // Click on cluster to zoom in
    map.current.on('click', clusterId, (e) => {
      const features = map.current!.queryRenderedFeatures(e.point, { layers: [clusterId] });
      const clusterId2 = features[0].properties?.cluster_id;
      const source = map.current!.getSource(sourceId) as mapboxgl.GeoJSONSource;
      source.getClusterExpansionZoom(clusterId2, (err, zoom) => {
        if (err) return;
        map.current!.easeTo({
          center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number],
          zoom: zoom!
        });
      });
    });

    // Click on individual point to show popup
    map.current.on('click', unclusteredId, (e) => {
      const features = e.features;
      if (!features || features.length === 0) return;
      
      const props = features[0].properties!;
      const coords = (features[0].geometry as GeoJSON.Point).coordinates.slice() as [number, number];
      const isUpgrade = props.isUpgrade;
      
      const popupContent = `
        <div style="padding: 8px; font-family: system-ui, sans-serif;">
          <div style="font-weight: 600; margin-bottom: 4px;">${props.name}</div>
          <div style="font-size: 12px; color: #666;">
            ${props.account ? `Account: ${props.account}` : ''}
          </div>
          <div style="font-size: 12px; color: #666;">
            ${props.phone}
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
            <span style="font-weight: 600; color: #059669;">$${Number(props.prmr).toFixed(2)}</span>
          </div>
        </div>
      `;

      new mapboxgl.Popup({ offset: 15 })
        .setLngLat(coords)
        .setHTML(popupContent)
        .addTo(map.current!);
    });

    // Change cursor on hover
    map.current.on('mouseenter', clusterId, () => {
      map.current!.getCanvas().style.cursor = 'pointer';
    });
    map.current.on('mouseleave', clusterId, () => {
      map.current!.getCanvas().style.cursor = '';
    });
    map.current.on('mouseenter', unclusteredId, () => {
      map.current!.getCanvas().style.cursor = 'pointer';
    });
    map.current.on('mouseleave', unclusteredId, () => {
      map.current!.getCanvas().style.cursor = '';
    });

  }, [filteredSales, mapReady, filterType]);

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
