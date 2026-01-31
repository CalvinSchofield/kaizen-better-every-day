export type PackageType = 'premium' | 'non-premium' | 'pay-in-four' | 'home-protect' | 'upgrade';

export interface EquipmentItem {
  id: string;
  label: string;
  price: number;
  image?: string;
  icon?: string;
  category: 'Cameras' | 'Smart Home' | 'Security';
  maxQuantity?: number;
  defaultQuantity?: number;
}

export interface PackageConfig {
  panelPrice: number;
  serviceMin: number;
  serviceMax: number;
  serviceDefault: number;
  warrantyPrice: number;
}

export const PACKAGE_CONFIGS: Record<'premium' | 'non-premium', PackageConfig> = {
  premium: {
    panelPrice: 1799,
    serviceMin: 24.99,
    serviceMax: 59.99,
    serviceDefault: 59.99,
    warrantyPrice: 7.99,
  },
  'non-premium': {
    panelPrice: 599,
    serviceMin: 44.99,
    serviceMax: 59.99,
    serviceDefault: 59.99,
    warrantyPrice: 7.99,
  },
};

// Generate service rate options (.99 increments)
export const getServiceRateOptions = (min: number, max: number): number[] => {
  const options: number[] = [];
  for (let rate = max; rate >= min; rate -= 1) {
    options.push(parseFloat(rate.toFixed(2)));
  }
  return options;
};

export const INSTALL_OPTIONS = [
  { value: 399, label: '$399' },
  { value: 199, label: '$199' },
  { value: 0, label: '$0' },
];

export const EQUIPMENT_LIST: EquipmentItem[] = [
  // Cameras
  { 
    id: 'doorbell-pro', 
    label: 'Doorbell Pro', 
    price: 249.99, 
    image: '/images/products/doorbell-camera-pro.jpeg',
    category: 'Cameras',
    defaultQuantity: 1,
    maxQuantity: 2,
  },
  { 
    id: 'outdoor-pro', 
    label: 'Outdoor Pro', 
    price: 399.99, 
    image: '/images/products/outdoor-camera-pro.jpeg',
    category: 'Cameras',
    defaultQuantity: 2,
  },
  { 
    id: 'spotlight-pro', 
    label: 'Spotlight Pro', 
    price: 249.99, 
    image: '/images/products/spotlight-pro.webp',
    category: 'Cameras',
    defaultQuantity: 2,
  },
  { 
    id: 'indoor-pro', 
    label: 'Indoor Pro', 
    price: 249.99, 
    image: '/images/products/indoor-camera-pro.jpeg',
    category: 'Cameras',
    defaultQuantity: 0,
  },
  { 
    id: 'dvr', 
    label: '24/7 Playback', 
    price: 299.99, 
    image: '/images/products/vivint-playback.jpeg',
    category: 'Cameras',
    defaultQuantity: 1,
  },
  // Smart Home
  { 
    id: 'smart-lock', 
    label: 'Smart Lock', 
    price: 179.99, 
    image: '/images/products/smart-lock.jpeg',
    category: 'Smart Home',
    defaultQuantity: 0,
  },
  { 
    id: 'thermostat', 
    label: 'Thermostat', 
    price: 199.99, 
    image: '/images/products/smart-thermostat.jpeg',
    category: 'Smart Home',
    defaultQuantity: 0,
  },
  { 
    id: 'garage', 
    label: 'Garage', 
    price: 50, 
    icon: 'Warehouse',
    category: 'Smart Home',
    defaultQuantity: 0,
  },
  // Security
  { 
    id: 'door-window-sensor', 
    label: 'Door/Window', 
    price: 50, 
    icon: 'DoorOpen',
    category: 'Security',
    defaultQuantity: 3,
  },
  { 
    id: 'motion-sensor', 
    label: 'Motion Sensor', 
    price: 100, 
    icon: 'Move',
    category: 'Security',
    defaultQuantity: 0,
  },
  { 
    id: 'glass-break', 
    label: 'Glass Break', 
    price: 100, 
    icon: 'Volume2',
    category: 'Security',
    defaultQuantity: 0,
  },
];

export const getDefaultQuantities = (): Record<string, number> => {
  const defaults: Record<string, number> = {};
  EQUIPMENT_LIST.forEach(item => {
    if (item.defaultQuantity && item.defaultQuantity > 0) {
      defaults[item.id] = item.defaultQuantity;
    }
  });
  return defaults;
};
