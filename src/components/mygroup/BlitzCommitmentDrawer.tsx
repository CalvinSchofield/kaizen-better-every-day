import { useState, useEffect } from "react";
import { Check, Loader2, Calendar, MapPin, History, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle,
  DrawerFooter
} from "@/components/ui/drawer";
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
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO, isBefore, startOfDay } from "date-fns";

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
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [declinedBlitzIds, setDeclinedBlitzIds] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Fetch declined blitzes for this recruit
  useEffect(() => {
    const fetchDeclinedBlitzes = async () => {
      if (!recruitNotionPageId || !open) return;
      
      const { data, error } = await supabase
        .from('blitz_declines')
        .select('blitz_id')
        .eq('rep_notion_page_id', recruitNotionPageId);
      
      if (!error && data) {
        setDeclinedBlitzIds(data.map(d => d.blitz_id));
      }
    };
    
    fetchDeclinedBlitzes();
  }, [recruitNotionPageId, open]);

  const today = startOfDay(new Date());

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

  // Calculate what changes are being made
  const getChangeSummary = () => {
    const added = pendingCommitments.filter(id => !currentCommitments.includes(id));
    const removed = currentCommitments.filter(id => !pendingCommitments.includes(id));
    
    const addedBlitzes = added.map(id => availableBlitzes.find(b => b.id === id)?.name).filter(Boolean);
    const removedBlitzes = removed.map(id => availableBlitzes.find(b => b.id === id)?.name).filter(Boolean);
    
    // Check if any removed blitzes are past blitzes
    const removedPastBlitzes = removed.filter(id => {
      const blitz = availableBlitzes.find(b => b.id === id);
      if (!blitz) return false;
      const endDate = blitz.endDate ? parseISO(blitz.endDate) : parseISO(blitz.date);
      return isBefore(endDate, today);
    }).map(id => availableBlitzes.find(b => b.id === id)?.name).filter(Boolean);
    
    return { addedBlitzes, removedBlitzes, removedPastBlitzes };
  };

  const handleSaveClick = () => {
    if (!hasChanges) return;
    // Always show confirmation dialog for any changes
    setConfirmDialogOpen(true);
  };

  const handleConfirmSave = async () => {
    setConfirmDialogOpen(false);
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

  // Separate past and future blitzes
  const pastBlitzes = availableBlitzes.filter(b => {
    const endDate = b.endDate ? parseISO(b.endDate) : parseISO(b.date);
    return isBefore(endDate, today);
  });

  const futureBlitzes = availableBlitzes.filter(b => {
    const endDate = b.endDate ? parseISO(b.endDate) : parseISO(b.date);
    return !isBefore(endDate, today);
  });

  // Only show past blitzes that are in current commitments (attended)
  const attendedPastBlitzes = pastBlitzes.filter(b => currentCommitments.includes(b.id));

  const { addedBlitzes, removedBlitzes, removedPastBlitzes } = getChangeSummary();

  const renderBlitzCard = (blitz: BlitzEvent, isPast: boolean = false) => {
    const isCommitted = pendingCommitments.includes(blitz.id);
    const isDeclined = declinedBlitzIds.includes(blitz.id);
    const blitzDate = parseISO(blitz.date);
    const endDate = blitz.endDate ? parseISO(blitz.endDate) : null;
    
    return (
      <div
        key={blitz.id}
        className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
          isCommitted 
            ? isPast 
              ? 'border-green-500 bg-green-500/10' 
              : 'border-primary bg-primary/10' 
            : isDeclined && !isPast
              ? 'border-destructive/50 bg-destructive/5'
              : 'border-border bg-card hover:border-muted-foreground/30'
        }`}
        onClick={() => toggleBlitz(blitz.id)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`font-medium text-sm ${isDeclined && !isCommitted ? 'line-through text-muted-foreground' : ''}`}>
                {blitz.name}
              </span>
              {isPast && isCommitted && (
                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
                  <Check className="w-3 h-3 mr-1" />
                  Attended
                </Badge>
              )}
              {!isPast && isCommitted && (
                <Badge variant="default" className="text-xs">
                  <Check className="w-3 h-3 mr-1" />
                  Committed
                </Badge>
              )}
              {!isPast && !isCommitted && isDeclined && (
                <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30">
                  <X className="w-3 h-3 mr-1" />
                  Declined
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
              ? isPast
                ? 'bg-green-500 border-green-500 text-white'
                : 'bg-primary border-primary text-primary-foreground' 
              : isDeclined && !isPast
                ? 'bg-destructive/20 border-destructive/50'
                : 'border-muted-foreground/30'
          }`}>
            {isCommitted && <Check className="w-4 h-4" />}
            {!isCommitted && isDeclined && !isPast && <X className="w-3 h-3 text-destructive" />}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent className="max-h-[80dvh]">
          <DrawerHeader className="border-b">
            <DrawerTitle className="text-left">
              Blitz Commitments for {recruitName}
            </DrawerTitle>
          </DrawerHeader>

          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            {/* Past/Attended Blitzes Section */}
            {attendedPastBlitzes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <History className="w-4 h-4" />
                  <span>Attended ({attendedPastBlitzes.length})</span>
                </div>
                {attendedPastBlitzes.map((blitz) => renderBlitzCard(blitz, true))}
              </div>
            )}

            {/* Future Blitzes Section */}
            <div className="space-y-3">
              {attendedPastBlitzes.length > 0 && (
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>Upcoming ({futureBlitzes.length})</span>
                </div>
              )}
              {futureBlitzes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No upcoming blitzes available
                </p>
              ) : (
                futureBlitzes.map((blitz) => renderBlitzCard(blitz, false))
              )}
            </div>
          </div>

          <DrawerFooter className="border-t">
            <Button
              onClick={handleSaveClick}
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

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {removedPastBlitzes.length > 0 && (
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              )}
              Confirm Blitz Changes
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>You're about to update blitz commitments for <span className="font-medium text-foreground">{recruitName}</span>:</p>
                
                {addedBlitzes.length > 0 && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                    <p className="text-sm font-medium text-green-600 mb-1">Adding:</p>
                    <ul className="text-sm text-green-600">
                      {addedBlitzes.map((name, i) => (
                        <li key={i}>• {name}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {removedBlitzes.length > 0 && (
                  <div className={`border rounded-lg p-3 ${
                    removedPastBlitzes.length > 0 
                      ? 'bg-amber-500/10 border-amber-500/30' 
                      : 'bg-red-500/10 border-red-500/30'
                  }`}>
                    <p className={`text-sm font-medium mb-1 ${
                      removedPastBlitzes.length > 0 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      Removing:
                    </p>
                    <ul className={`text-sm ${
                      removedPastBlitzes.length > 0 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {removedBlitzes.map((name, i) => (
                        <li key={i}>• {name}</li>
                      ))}
                    </ul>
                    {removedPastBlitzes.length > 0 && (
                      <p className="text-xs text-amber-600 mt-2 italic">
                        ⚠️ This includes past blitzes they attended
                      </p>
                    )}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSave}>
              Confirm Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};