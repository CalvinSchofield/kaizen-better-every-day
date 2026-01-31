export interface UpgradeEquipmentItem {
  id: string;
  label: string;
  price: number;
  image?: string;
  icon?: string;
  category: 'Cameras' | 'Smart Home' | 'Security';
  incursVideoFee?: boolean; // Whether this item can have a $5/mo video fee
  alwaysNewCamera?: boolean; // If true, always counts as new (no toggle) - e.g., indoor cameras
}

export interface UpgradeCameraSelection {
  quantity: number;
  newCameraCount: number; // Number that get $5/mo video fee
}

// Equipment available for upgrades (same as PRMR calculator)
export const UPGRADE_EQUIPMENT_LIST: UpgradeEquipmentItem[] = [
  // Cameras with video fee
  { 
    id: 'doorbell-pro', 
    label: 'Doorbell Pro', 
    price: 249.99, 
    image: '/images/products/doorbell-camera-pro.jpeg',
    category: 'Cameras',
    incursVideoFee: true,
  },
  { 
    id: 'outdoor-pro', 
    label: 'Outdoor Pro', 
    price: 399.99, 
    image: '/images/products/outdoor-camera-pro.jpeg',
    category: 'Cameras',
    incursVideoFee: true,
  },
  { 
    id: 'spotlight-pro', 
    label: 'Spotlight Pro', 
    price: 249.99, 
    image: '/images/products/spotlight-pro.webp',
    category: 'Cameras',
    incursVideoFee: false, // No video fee for spotlights
  },
  { 
    id: 'indoor-pro', 
    label: 'Indoor Pro', 
    price: 249.99, 
    image: '/images/products/indoor-camera-pro.jpeg',
    category: 'Cameras',
    incursVideoFee: true,
    alwaysNewCamera: true, // Indoor cameras always incur $5/mo video fee
  },
  { 
    id: 'dvr', 
    label: '24/7 Playback', 
    price: 299.99, 
    image: '/images/products/vivint-playback.jpeg',
    category: 'Cameras',
    incursVideoFee: false, // No video fee for DVR
  },
  // Smart Home
  { 
    id: 'smart-lock', 
    label: 'Smart Lock', 
    price: 179.99, 
    image: '/images/products/smart-lock.jpeg',
    category: 'Smart Home',
  },
  { 
    id: 'thermostat', 
    label: 'Thermostat', 
    price: 199.99, 
    image: '/images/products/smart-thermostat.jpeg',
    category: 'Smart Home',
  },
  { 
    id: 'garage', 
    label: 'Garage', 
    price: 50, 
    image: '/images/products/garage-controller.png',
    category: 'Smart Home',
  },
  // Security
  { 
    id: 'door-window-sensor', 
    label: 'Door/Window', 
    price: 50, 
    image: '/images/products/door-window-sensor.webp',
    category: 'Security',
  },
  { 
    id: 'motion-sensor', 
    label: 'Motion Sensor', 
    price: 100, 
    image: '/images/products/motion-sensor.webp',
    category: 'Security',
  },
  { 
    id: 'glass-break', 
    label: 'Glass Break', 
    price: 100, 
    image: '/images/products/glass-break-sensor.png',
    category: 'Security',
  },
];

export const UPGRADE_CONFIG = {
  panelPrice: 500,
  installFee: 99,
  videoFeePerCamera: 5,
  financingThreshold: 1000, // Below this, 36 months; above, 60 months
  shortFinancingMonths: 36,
  longFinancingMonths: 60,
  estimatedTaxRate: 0.08, // 8% tax estimate
};

export const getUpgradeDefaultQuantities = (): Record<string, number> => {
  return {};
};

export const getUpgradeDefaultNewCameraCounts = (): Record<string, number> => {
  return {};
};
