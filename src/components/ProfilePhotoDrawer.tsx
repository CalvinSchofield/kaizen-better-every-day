import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ProfilePhotoUpload } from "./ProfilePhotoUpload";
import { useQueryClient } from "@tanstack/react-query";

interface ProfilePhotoDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPhotoUrl?: string | null;
  name?: string;
  userId?: string;
}

export const ProfilePhotoDrawer = ({
  open,
  onOpenChange,
  currentPhotoUrl,
  name,
  userId
}: ProfilePhotoDrawerProps) => {
  const queryClient = useQueryClient();

  const handlePhotoUpdated = (url: string | null) => {
    // Invalidate rep data to refresh the photo URL
    if (userId) {
      queryClient.invalidateQueries({ queryKey: ['rep-data', userId] });
    }
    queryClient.invalidateQueries({ queryKey: ['preseason-prep-leaderboard'] });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh]">
        <DrawerHeader className="text-center">
          <DrawerTitle>Profile Photo</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-8 flex flex-col items-center">
          <ProfilePhotoUpload
            currentPhotoUrl={currentPhotoUrl}
            onPhotoUpdated={handlePhotoUpdated}
            name={name}
            size="lg"
            showRemoveButton={true}
          />
          <p className="text-sm text-muted-foreground mt-4 text-center max-w-xs">
            Your photo will appear on leaderboards and help teammates recognize you.
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
