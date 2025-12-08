import { useState } from "react";
import { Check, X, Loader2, Calendar, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle,
  DrawerFooter
} from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

interface BlitzEvent {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
  location?: string;
}

interface BlitzCommitmentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recruitName: string;
  recruitNotionPageId: string;
  currentCommitments: string[];
  availableBlitzes: BlitzEvent[];
}

export const BlitzCommitmentDrawer = ({
  open,
  onOpenChange,
  recruitName,
  recruitNotionPageId,
  currentCommitments,
  availableBlitzes,
}: BlitzCommitmentDrawerProps) => {
  const [pendingCommitments, setPendingCommitments] = useState<string[]>(currentCommitments);
  const [isUpdating, setIsUpdating] = useState(false);
  const queryClient = useQueryClient();

  // Reset pending state when drawer opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setPendingCommitments(currentCommitments);
    }
    onOpenChange(newOpen);
  };

  const toggleBlitz = (blitzId: string) => {
    setPendingCommitments(prev => 
      prev.includes(blitzId)
        ? prev.filter(id => id !== blitzId)
        : [...prev, blitzId]
    );
  };

  const hasChanges = JSON.stringify(pendingCommitments.sort()) !== JSON.stringify(currentCommitments.sort());

  const handleSave = async () => {
    if (!hasChanges) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase.functions.invoke('update-blitz-commitment', {
        body: {
          repNotionPageId: recruitNotionPageId,
          blitzPageIds: pendingCommitments,
        },
      });

      if (error) throw error;

      // Optimistic update - invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['rep-data'] });
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });

      toast.success('Blitz commitments updated');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update blitz commitments:', error);
      toast.error('Failed to update commitments');
    } finally {
      setIsUpdating(false);
    }
  };

  // Get future blitzes only
  const futureBlitzes = availableBlitzes.filter(b => {
    const blitzDate = parseISO(b.date);
    return blitzDate >= new Date();
  });

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-h-[80vh]">
        <DrawerHeader className="border-b">
          <DrawerTitle className="text-left">
            Blitz Commitments for {recruitName}
          </DrawerTitle>
        </DrawerHeader>

        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {futureBlitzes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No upcoming blitzes available
            </p>
          ) : (
            futureBlitzes.map((blitz) => {
              const isCommitted = pendingCommitments.includes(blitz.id);
              const blitzDate = parseISO(blitz.date);
              const endDate = blitz.endDate ? parseISO(blitz.endDate) : null;
              
              return (
                <div
                  key={blitz.id}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    isCommitted 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border bg-card hover:border-muted-foreground/30'
                  }`}
                  onClick={() => toggleBlitz(blitz.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{blitz.name}</span>
                        {isCommitted && (
                          <Badge variant="default" className="text-xs">
                            <Check className="w-3 h-3 mr-1" />
                            Committed
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {format(blitzDate, 'MMM d')}
                          {endDate && ` - ${format(endDate, 'MMM d, yyyy')}`}
                        </span>
                      </div>
                      
                      {blitz.location && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <MapPin className="w-3 h-3" />
                          <span>{blitz.location}</span>
                        </div>
                      )}
                    </div>

                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      isCommitted 
                        ? 'bg-primary border-primary text-primary-foreground' 
                        : 'border-muted-foreground/30'
                    }`}>
                      {isCommitted && <Check className="w-4 h-4" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DrawerFooter className="border-t">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isUpdating}
            className="w-full"
          >
            {isUpdating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpdating}
            className="w-full"
          >
            Cancel
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
