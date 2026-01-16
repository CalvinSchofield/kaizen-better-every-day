import { EQUIPMENT_LIST } from "./types";
import { EquipmentCard } from "./EquipmentCard";
import type { PackageType } from "./types";

interface EquipmentConfiguratorProps {
  packageType: PackageType;
  quantities: Record<string, number>;
  onQuantityChange: (itemId: string, delta: number) => void;
}

export const EquipmentConfigurator = ({
  packageType,
  quantities,
  onQuantityChange,
}: EquipmentConfiguratorProps) => {
  // Group items by category
  const categories = EQUIPMENT_LIST.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof EQUIPMENT_LIST>);

  const categoryOrder = ['System', 'Cameras', 'Recording', 'Sensors', 'Smart Home'];

  return (
    <div className="space-y-4">
      {categoryOrder.map(categoryName => {
        const items = categories[categoryName];
        if (!items || items.length === 0) return null;

        return (
          <div key={categoryName}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              {categoryName}
            </h3>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {items.map(item => (
                <EquipmentCard
                  key={item.id}
                  item={item}
                  quantity={quantities[item.id] || 0}
                  onQuantityChange={(delta) => onQuantityChange(item.id, delta)}
                  isPanel={item.id === 'panel'}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
