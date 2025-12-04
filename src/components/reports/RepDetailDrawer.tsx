import { useState, useEffect } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEfpMode } from "@/hooks/useEfpMode";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Target, TrendingUp, Pencil } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const ADMIN_EMAIL = 'calvinjschofield@gmail.com';

interface RepDetailData {
  id?: string; // Entry ID for admin edits
  userId: string;
  name: string;
  year: string;
  teamName: string;
  mgmtGroupName: string;
  doors: number;
  dms: number;
  pitches: number;
  transitions: number;
  presentations: number;
  closes: number;
  fp: number;
  upgradeFP: number;
  prmr: number;
  upgradePRMR: number;
  doorsToFpRatio: number;
  hoursWorked: number;
  daysWorked?: number;
  workStartTime?: string;
  workEndTime?: string;
}

interface RepDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rep: RepDetailData | null;
  daysInRange?: number;
}

const formatTime = (timestamp: string | undefined) => {
  if (!timestamp) return null;
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return null;
  }
};

const formatTimeForInput = (timestamp: string | undefined) => {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    return date.toTimeString().slice(0, 5); // HH:MM format
  } catch {
    return '';
  }
};

export const RepDetailDrawer = ({ open, onOpenChange, rep, daysInRange = 1 }: RepDetailDrawerProps) => {
  const { efpModeEnabled } = useEfpMode();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [confirmSheetOpen, setConfirmSheetOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Editable fields state
  const [editedValues, setEditedValues] = useState({
    doors_knocked: 0,
    decision_makers: 0,
    pitches: 0,
    transitions: 0,
    presentations: 0,
    closes: 0,
    fp_plus: 0,
    prmr: 0,
    work_start_time: '',
    work_end_time: '',
  });

  // Check if current user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAdmin(user?.email === ADMIN_EMAIL);
    };
    checkAdmin();
  }, []);

  // Initialize edited values when rep changes
  useEffect(() => {
    if (rep) {
      setEditedValues({
        doors_knocked: rep.doors,
        decision_makers: rep.dms,
        pitches: rep.pitches,
        transitions: rep.transitions,
        presentations: rep.presentations,
        closes: rep.closes,
        fp_plus: rep.fp,
        prmr: rep.prmr,
        work_start_time: formatTimeForInput(rep.workStartTime),
        work_end_time: formatTimeForInput(rep.workEndTime),
      });
    }
  }, [rep]);

  // Reset edit mode when drawer closes
  useEffect(() => {
    if (!open) {
      setIsEditMode(false);
    }
  }, [open]);

  if (!rep) return null;

  const daysWorked = rep.daysWorked || Math.max(1, Math.ceil(rep.hoursWorked / 8));
  const showDailyAverages = daysWorked > 1;
  const avgHoursPerDay = daysWorked > 0 ? rep.hoursWorked / daysWorked : 0;
  const avgFpPerDay = daysWorked > 0 ? rep.fp / daysWorked : 0;
  const avgDoorsPerDay = daysWorked > 0 ? rep.doors / daysWorked : 0;
  const avgDmsPerDay = daysWorked > 0 ? rep.dms / daysWorked : 0;
  const avgPitchesPerDay = daysWorked > 0 ? rep.pitches / daysWorked : 0;
  const avgTransitionsPerDay = daysWorked > 0 ? rep.transitions / daysWorked : 0;
  const avgPresentationsPerDay = daysWorked > 0 ? rep.presentations / daysWorked : 0;
  const avgClosesPerDay = daysWorked > 0 ? rep.closes / daysWorked : 0;
  const efp = rep.prmr / 85;
  const avgEfpPerDay = daysWorked > 0 ? efp / daysWorked : 0;
  const avgPrmrPerDay = daysWorked > 0 ? rep.prmr / daysWorked : 0;

  // Get changes for confirmation
  const getChanges = () => {
    const changes: { field: string; from: string; to: string }[] = [];
    
    if (editedValues.doors_knocked !== rep.doors) {
      changes.push({ field: 'Doors', from: rep.doors.toString(), to: editedValues.doors_knocked.toString() });
    }
    if (editedValues.decision_makers !== rep.dms) {
      changes.push({ field: 'Decision Makers', from: rep.dms.toString(), to: editedValues.decision_makers.toString() });
    }
    if (editedValues.pitches !== rep.pitches) {
      changes.push({ field: 'Pitches', from: rep.pitches.toString(), to: editedValues.pitches.toString() });
    }
    if (editedValues.transitions !== rep.transitions) {
      changes.push({ field: 'Transitions', from: rep.transitions.toString(), to: editedValues.transitions.toString() });
    }
    if (editedValues.presentations !== rep.presentations) {
      changes.push({ field: 'Presentations', from: rep.presentations.toString(), to: editedValues.presentations.toString() });
    }
    if (editedValues.closes !== rep.closes) {
      changes.push({ field: 'Closes', from: rep.closes.toString(), to: editedValues.closes.toString() });
    }
    if (editedValues.fp_plus !== rep.fp) {
      changes.push({ field: 'FP+', from: rep.fp.toFixed(1), to: editedValues.fp_plus.toFixed(1) });
    }
    if (editedValues.prmr !== rep.prmr) {
      changes.push({ field: 'PRMR', from: `$${rep.prmr.toFixed(0)}`, to: `$${editedValues.prmr.toFixed(0)}` });
    }
    if (editedValues.work_start_time !== formatTimeForInput(rep.workStartTime)) {
      changes.push({ field: 'Start Time', from: formatTime(rep.workStartTime) || '-', to: editedValues.work_start_time || '-' });
    }
    if (editedValues.work_end_time !== formatTimeForInput(rep.workEndTime)) {
      changes.push({ field: 'End Time', from: formatTime(rep.workEndTime) || '-', to: editedValues.work_end_time || '-' });
    }
    
    return changes;
  };

  const handleSaveClick = () => {
    const changes = getChanges();
    if (changes.length === 0) {
      toast({ title: "No changes", description: "No changes were made" });
      return;
    }
    setConfirmSheetOpen(true);
  };

  const handleConfirmSave = async () => {
    if (!rep.id) {
      toast({ title: "Error", description: "Entry ID not available", variant: "destructive" });
      return;
    }

    setIsSaving(true);

    try {
      // Build updates object
      const updates: Record<string, any> = {};
      
      if (editedValues.doors_knocked !== rep.doors) updates.doors_knocked = editedValues.doors_knocked;
      if (editedValues.decision_makers !== rep.dms) updates.decision_makers = editedValues.decision_makers;
      if (editedValues.pitches !== rep.pitches) updates.pitches = editedValues.pitches;
      if (editedValues.transitions !== rep.transitions) updates.transitions = editedValues.transitions;
      if (editedValues.presentations !== rep.presentations) updates.presentations = editedValues.presentations;
      if (editedValues.closes !== rep.closes) updates.closes = editedValues.closes;
      if (editedValues.fp_plus !== rep.fp) updates.fp_plus = editedValues.fp_plus;
      if (editedValues.prmr !== rep.prmr) updates.prmr = editedValues.prmr;
      
      // Handle time fields - need to convert to full timestamp
      if (editedValues.work_start_time !== formatTimeForInput(rep.workStartTime)) {
        if (editedValues.work_start_time) {
          const today = new Date().toISOString().split('T')[0];
          updates.work_start_time = `${today}T${editedValues.work_start_time}:00`;
        } else {
          updates.work_start_time = null;
        }
      }
      if (editedValues.work_end_time !== formatTimeForInput(rep.workEndTime)) {
        if (editedValues.work_end_time) {
          const today = new Date().toISOString().split('T')[0];
          updates.work_end_time = `${today}T${editedValues.work_end_time}:00`;
        } else {
          updates.work_end_time = null;
        }
      }

      const { data, error } = await supabase.functions.invoke('update-rep-entry', {
        body: { entryId: rep.id, updates }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({ title: "Success", description: `${rep.name}'s entry has been updated` });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['team-live-data'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['daily-entry'] });

      setConfirmSheetOpen(false);
      setIsEditMode(false);
      onOpenChange(false);

    } catch (error: any) {
      console.error('Error updating entry:', error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update entry", 
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const StatRow = ({ label, value, avgValue, field, type = 'number' }: { 
    label: string; 
    value: string; 
    avgValue?: string;
    field?: keyof typeof editedValues;
    type?: 'number' | 'time' | 'currency';
  }) => (
    <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <div className="text-right">
        {isEditMode && field ? (
          <Input
            type={type === 'time' ? 'time' : 'number'}
            step={type === 'currency' ? '0.01' : type === 'number' ? '1' : undefined}
            value={editedValues[field]}
            onChange={(e) => setEditedValues(prev => ({
              ...prev,
              [field]: type === 'number' || type === 'currency' 
                ? parseFloat(e.target.value) || 0 
                : e.target.value
            }))}
            className="w-24 h-8 text-right text-sm"
          />
        ) : (
          <>
            <span className="font-bold text-lg">{value}</span>
            {avgValue && showDailyAverages && (
              <span className="text-xs text-muted-foreground block">{avgValue}/day</span>
            )}
          </>
        )}
      </div>
    </div>
  );

  const changes = getChanges();

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-left pb-2">
            <div className="flex items-center justify-between">
              <div>
                <DrawerTitle className="text-xl">{rep.name}</DrawerTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {rep.year && rep.year !== 'Unknown' && rep.year !== 'unknown' && (
                    <span className="capitalize">{rep.year}</span>
                  )}
                  {rep.teamName && rep.teamName !== 'No Team' && (
                    <>
                      {rep.year && rep.year !== 'Unknown' && rep.year !== 'unknown' && <span>·</span>}
                      <span>{rep.teamName}</span>
                    </>
                  )}
                </div>
              </div>
              {isAdmin && rep.id && !isEditMode && (
                <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)}>
                  <Pencil className="h-4 w-4 mr-1.5" />
                  Edit
                </Button>
              )}
              {isAdmin && isEditMode && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsEditMode(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveClick}>
                    Save
                  </Button>
                </div>
              )}
            </div>
          </DrawerHeader>

          <div className="px-4 pb-6 space-y-4 overflow-y-auto">
            {/* Results Section - FP+ and PRMR at top */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                <Target className="w-4 h-4" />
                <span>Results</span>
                {showDailyAverages && (
                  <span className="text-xs">({daysWorked} day{daysWorked !== 1 ? 's' : ''} worked)</span>
                )}
              </div>
              <div className="bg-muted/30 rounded-xl p-3">
                <StatRow 
                  label={efpModeEnabled ? "EFP" : "FP+"} 
                  value={efpModeEnabled ? efp.toFixed(2) : rep.fp.toFixed(1)} 
                  avgValue={efpModeEnabled ? avgEfpPerDay.toFixed(2) : avgFpPerDay.toFixed(1)}
                  field={efpModeEnabled ? undefined : "fp_plus"}
                  type="currency"
                />
                <StatRow 
                  label={efpModeEnabled ? "FP+" : "PRMR"} 
                  value={efpModeEnabled ? rep.fp.toFixed(1) : `$${rep.prmr.toFixed(0)}`} 
                  avgValue={efpModeEnabled ? avgFpPerDay.toFixed(1) : `$${avgPrmrPerDay.toFixed(0)}`}
                  field={efpModeEnabled ? "fp_plus" : "prmr"}
                  type="currency"
                />
              </div>
            </div>

            {/* Time Section */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                <Clock className="w-4 h-4" />
                <span>Time</span>
              </div>
              <div className="bg-muted/30 rounded-xl p-3">
                <StatRow 
                  label="Start Time" 
                  value={formatTime(rep.workStartTime) || '-'}
                  field="work_start_time"
                  type="time"
                />
                <StatRow 
                  label="End Time" 
                  value={formatTime(rep.workEndTime) || '-'}
                  field="work_end_time"
                  type="time"
                />
                <StatRow 
                  label="Hours Worked" 
                  value={`${Math.floor(rep.hoursWorked)}h ${Math.round((rep.hoursWorked % 1) * 60)}m`} 
                  avgValue={showDailyAverages ? `${avgHoursPerDay.toFixed(1)}h` : undefined}
                />
              </div>
            </div>

            {/* Activity Section */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                <TrendingUp className="w-4 h-4" />
                <span>Activity</span>
              </div>
              <div className="bg-muted/30 rounded-xl p-3">
                <StatRow 
                  label="Doors Knocked" 
                  value={rep.doors.toString()} 
                  avgValue={avgDoorsPerDay.toFixed(0)}
                  field="doors_knocked"
                />
                <StatRow 
                  label="Decision Makers" 
                  value={rep.dms.toString()} 
                  avgValue={avgDmsPerDay.toFixed(1)}
                  field="decision_makers"
                />
                <StatRow 
                  label="Pitches" 
                  value={rep.pitches.toString()} 
                  avgValue={avgPitchesPerDay.toFixed(1)}
                  field="pitches"
                />
                <StatRow 
                  label="Transitions" 
                  value={rep.transitions.toString()} 
                  avgValue={avgTransitionsPerDay.toFixed(1)}
                  field="transitions"
                />
                <StatRow 
                  label="Presentations" 
                  value={rep.presentations.toString()} 
                  avgValue={avgPresentationsPerDay.toFixed(1)}
                  field="presentations"
                />
                <StatRow 
                  label="Closes" 
                  value={rep.closes.toString()} 
                  avgValue={avgClosesPerDay.toFixed(1)}
                  field="closes"
                />
                {rep.doorsToFpRatio > 0 && (
                  <StatRow 
                    label="Doors per FP+" 
                    value={rep.doorsToFpRatio.toFixed(0)} 
                  />
                )}
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Confirmation Sheet */}
      <Sheet open={confirmSheetOpen} onOpenChange={setConfirmSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Confirm Changes</SheetTitle>
            <SheetDescription>
              You're about to update {rep.name}'s entry
            </SheetDescription>
          </SheetHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-3">Changes to be made:</p>
            <div className="space-y-2">
              {changes.map((change, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm bg-muted/30 rounded-lg px-3 py-2">
                  <span className="font-medium">{change.field}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground line-through">{change.from}</span>
                    <span>→</span>
                    <span className="font-semibold text-primary">{change.to}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3 mt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setConfirmSheetOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleConfirmSave}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Confirm Changes"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};