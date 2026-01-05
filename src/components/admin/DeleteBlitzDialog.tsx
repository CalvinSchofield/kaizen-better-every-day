import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface DeleteBlitzDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blitzName: string;
  onConfirm: () => void;
}

export default function DeleteBlitzDialog({
  open,
  onOpenChange,
  blitzName,
  onConfirm,
}: DeleteBlitzDialogProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Delete Blitz</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>"{blitzName}"</strong>? This will also delete
            all associated accommodations and attendance records. This action cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={onConfirm}
            >
              Delete
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
