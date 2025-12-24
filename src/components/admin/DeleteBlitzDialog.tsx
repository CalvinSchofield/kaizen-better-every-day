import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Blitz</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>"{blitzName}"</strong>? This will also delete
            all associated accommodations and attendance records. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
