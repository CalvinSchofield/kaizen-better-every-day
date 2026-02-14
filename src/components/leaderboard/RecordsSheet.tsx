import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { PersonalBestsSection } from "./PersonalBestsSection";
import { ClassRecordsSection } from "./ClassRecordsSection";

interface RecordsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
}

export const RecordsSheet = ({ open, onOpenChange, userId }: RecordsSheetProps) => {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle>Records</DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto flex-1 px-4 pb-6 space-y-6">
          <PersonalBestsSection userId={userId} />
          <ClassRecordsSection currentUserId={userId} />
        </div>
      </DrawerContent>
    </Drawer>
  );
};
