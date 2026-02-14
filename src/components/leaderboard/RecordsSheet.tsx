import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { PersonalBestsSection } from "./PersonalBestsSection";
import { ClassRecordsSection } from "./ClassRecordsSection";
import type { RecordsMetric } from "@/hooks/useRecordsTracking";

interface RecordsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
}

export const RecordsSheet = ({ open, onOpenChange, userId }: RecordsSheetProps) => {
  const [metric, setMetric] = useState<RecordsMetric>('fp');

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <div className="flex items-center justify-between">
            <DrawerTitle>Records</DrawerTitle>
            <div className="flex bg-muted rounded-full p-0.5">
              <button
                onClick={() => setMetric('fp')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  metric === 'fp'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                FP+
              </button>
              <button
                onClick={() => setMetric('prmr')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  metric === 'prmr'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                PRMR
              </button>
            </div>
          </div>
        </DrawerHeader>
        <div className="overflow-y-auto flex-1 px-4 pb-6 space-y-6">
          <PersonalBestsSection userId={userId} metric={metric} />
          <ClassRecordsSection currentUserId={userId} metric={metric} />
        </div>
      </DrawerContent>
    </Drawer>
  );
};
