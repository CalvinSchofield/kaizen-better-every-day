import { Camera, Home, ShieldCheck } from "lucide-react";
import { UPGRADE_EQUIPMENT_LIST } from "./upgradeTypes";
import { UpgradeEquipmentCard } from "./UpgradeEquipmentCard";

interface UpgradeEquipmentConfiguratorProps {
  quantities: Record<string, number>;
  newCameraCounts: Record<string, number>;
  onQuantityChange: (itemId: string, delta: number) => void;
  onNewCameraCountChange: (itemId: string, delta: number) => void;
}

const categoryConfig = {
  'Cameras': { icon: Camera, order: 1 },
  'Smart Home': { icon: Home, order: 2 },
  'Security': { icon: ShieldCheck, order: 3 },
};

export const UpgradeEquipmentConfigurator = ({
  quantities,
  newCameraCounts,
  onQuantityChange,
  onNewCameraCountChange,
}: UpgradeEquipmentConfiguratorProps) => {
  // Group items by category
  const categories = UPGRADE_EQUIPMENT_LIST.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof UPGRADE_EQUIPMENT_LIST>);

  const sortedCategories = Object.keys(categories).sort(
    (a, b) => categoryConfig[a as keyof typeof categoryConfig].order - categoryConfig[b as keyof typeof categoryConfig].order
  );

  return (
    <div className="space-y-6">
      {sortedCategories.map(categoryName => {
        const items = categories[categoryName];
        const config = categoryConfig[categoryName as keyof typeof categoryConfig];
        const CategoryIcon = config.icon;

        return (
          <div key={categoryName}>
            <div className="flex items-center gap-2 mb-3 px-1">
              <CategoryIcon className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">
                {categoryName}
              </h3>
            </div>
            <div className="flex gap-3 overflow-x-auto py-1 pb-2 scrollbar-hide -mx-4 px-4">
              {items.map(item => (
                <UpgradeEquipmentCard
                  key={item.id}
                  item={item}
                  quantity={quantities[item.id] || 0}
                  newCameraCount={newCameraCounts[item.id] || 0}
                  onQuantityChange={(delta) => onQuantityChange(item.id, delta)}
                  onNewCameraCountChange={(delta) => onNewCameraCountChange(item.id, delta)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
