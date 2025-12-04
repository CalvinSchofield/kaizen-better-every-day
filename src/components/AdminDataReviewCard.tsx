import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Check, X, Clock, Loader2 } from 'lucide-react';
import { useAdminDataReview, DataIssue } from '@/hooks/useAdminDataReview';
import { RepDetailDrawer } from '@/components/reports/RepDetailDrawer';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// Helper to get the suggested end time from counter timestamps
const getSuggestedEndTime = (issue: DataIssue): { time: string; formatted: string } | null => {
  const timestamps = issue.entryData.counter_timestamps;
  if (!timestamps) return null;

  const allTimestamps: string[] = [];
  Object.values(timestamps).forEach((arr) => {
    if (Array.isArray(arr)) allTimestamps.push(...arr);
  });

  if (allTimestamps.length === 0) return null;

  const latestTimestamp = new Date(Math.max(...allTimestamps.map(t => new Date(t).getTime())));
  
  // Format the time
  const formatted = latestTimestamp.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return {
    time: latestTimestamp.toISOString(),
    formatted,
  };
};

interface IssueRowProps {
  issue: DataIssue;
  onOkay: () => void;
  onEdit: () => void;
}

const IssueRow = ({ issue, onOkay, onEdit }: IssueRowProps) => {
  const getSeverityColor = () => {
    return issue.severity === 'error' 
      ? 'border-l-destructive' 
      : 'border-l-amber-500';
  };

  const getIssueIcon = () => {
    switch (issue.issueType) {
      case 'unsaved':
        return <X className="w-4 h-4 text-destructive" />;
      case 'late_end_time':
      case 'late_save':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'abnormal_metric':
      case 'impossible_ratio':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  return (
    <div
      className={cn(
        "bg-muted/50 border-l-4 p-3 rounded-lg cursor-pointer active:bg-muted/70 transition-colors",
        getSeverityColor()
      )}
      onClick={onEdit}
    >
      <div className="flex items-center gap-3">
        {getIssueIcon()}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{issue.repName}</p>
          <p className="text-xs text-muted-foreground truncate">{issue.description}</p>
        </div>
        <button
          className="p-2 rounded-full text-green-600 hover:bg-green-100 active:bg-green-200 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onOkay();
          }}
        >
          <Check className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export const AdminDataReviewCard = () => {
  const { issues, shouldShowCard, dismissIssue, refetch } = useAdminDataReview();
  const [selectedIssue, setSelectedIssue] = useState<DataIssue | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmIssue, setConfirmIssue] = useState<DataIssue | null>(null);
  const [confirmDrawerOpen, setConfirmDrawerOpen] = useState(false);
  const [isFixingEndTime, setIsFixingEndTime] = useState(false);

  if (!shouldShowCard || issues.length === 0) {
    return null;
  }

  const handleEditIssue = (issue: DataIssue) => {
    setSelectedIssue(issue);
    setDrawerOpen(true);
  };

  const handleOkayClick = (issue: DataIssue) => {
    setConfirmIssue(issue);
    setConfirmDrawerOpen(true);
  };

  const handleConfirmDismiss = () => {
    if (confirmIssue) {
      dismissIssue(confirmIssue.id);
      setConfirmDrawerOpen(false);
      setConfirmIssue(null);
    }
  };

  const handleFixEndTime = async () => {
    if (!confirmIssue) return;
    
    const suggested = getSuggestedEndTime(confirmIssue);
    if (!suggested) return;

    setIsFixingEndTime(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.functions.invoke('update-rep-entry', {
        body: {
          entryId: confirmIssue.entryId,
          adminEmail: user.email,
          updates: {
            work_end_time: suggested.time,
            is_finalized: true,
          },
        },
      });

      if (error) throw error;

      toast({
        title: 'End time fixed',
        description: `Updated ${confirmIssue.repName}'s end time to ${suggested.formatted}`,
      });

      dismissIssue(confirmIssue.id);
      setConfirmDrawerOpen(false);
      setConfirmIssue(null);
      refetch();
    } catch (error) {
      console.error('Error fixing end time:', error);
      toast({
        title: 'Error',
        description: 'Failed to update end time',
        variant: 'destructive',
      });
    } finally {
      setIsFixingEndTime(false);
    }
  };

  const handleDrawerClose = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) {
      setSelectedIssue(null);
      // Refetch to see if issue was resolved
      refetch();
    }
  };

  // Convert DataIssue to RepDetailData format
  const getRepDetailData = (issue: DataIssue) => {
    const entry = issue.entryData;
    const fp = entry.fp_plus + (entry.upgrade_prmr / 85);
    const prmr = entry.prmr;
    
    let hoursWorked = 0;
    if (entry.work_start_time && entry.work_end_time) {
      const start = new Date(entry.work_start_time);
      const end = new Date(entry.work_end_time);
      hoursWorked = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    }

    return {
      id: issue.entryId,
      userId: issue.repId,
      name: issue.repName,
      year: '',
      teamName: '',
      mgmtGroupName: '',
      doors: entry.doors_knocked,
      dms: entry.decision_makers,
      pitches: entry.pitches,
      transitions: entry.transitions,
      presentations: entry.presentations,
      closes: entry.closes,
      fp: entry.fp_plus,
      upgradeFP: entry.upgrade_prmr / 85,
      prmr: entry.prmr,
      upgradePRMR: entry.upgrade_prmr,
      doorsToFpRatio: fp > 0 ? entry.doors_knocked / fp : 0,
      hoursWorked,
      workStartTime: entry.work_start_time || undefined,
      workEndTime: entry.work_end_time || undefined,
      entryDate: issue.entryDate,
    };
  };

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  return (
    <>
      <Card className="border-amber-500/50 bg-gradient-to-br from-amber-500/10 to-orange-500/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-full bg-amber-500/20">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm">Data Review</h3>
              <p className="text-xs text-muted-foreground">
                {errorCount > 0 && `${errorCount} error${errorCount !== 1 ? 's' : ''}`}
                {errorCount > 0 && warningCount > 0 && ' · '}
                {warningCount > 0 && `${warningCount} warning${warningCount !== 1 ? 's' : ''}`}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">Tap to edit</span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {issues.map(issue => (
              <IssueRow
                key={issue.id}
                issue={issue}
                onOkay={() => handleOkayClick(issue)}
                onEdit={() => handleEditIssue(issue)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit Drawer */}
      {selectedIssue && (
        <RepDetailDrawer
          open={drawerOpen}
          onOpenChange={handleDrawerClose}
          rep={getRepDetailData(selectedIssue)}
          entryDate={selectedIssue.entryDate}
        />
      )}

      {/* Confirm Dismiss Drawer */}
      <Drawer open={confirmDrawerOpen} onOpenChange={setConfirmDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Mark as OK?</DrawerTitle>
            <DrawerDescription>
              Confirm that this data is correct and doesn't need review.
            </DrawerDescription>
          </DrawerHeader>
          
          {confirmIssue && (
            <div className="px-4 pb-4">
              <div className={cn(
                "bg-muted/50 border-l-4 p-4 rounded-lg",
                confirmIssue.severity === 'error' ? 'border-l-destructive' : 'border-l-amber-500'
              )}>
                <p className="font-semibold">{confirmIssue.repName}</p>
                <p className="text-sm text-muted-foreground mt-1">{confirmIssue.description}</p>
                
                {/* Suggested end time for late_end_time or unsaved issues */}
                {(confirmIssue.issueType === 'late_end_time' || confirmIssue.issueType === 'unsaved') && (() => {
                  const suggested = getSuggestedEndTime(confirmIssue);
                  if (suggested) {
                    return (
                      <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 text-blue-600">
                              <Clock className="w-4 h-4" />
                              <span className="text-sm font-medium">Suggested end time</span>
                            </div>
                            <p className="text-lg font-semibold text-blue-600 mt-1">{suggested.formatted}</p>
                            <p className="text-xs text-muted-foreground mt-1">Based on last tracked activity</p>
                          </div>
                          <Button
                            size="sm"
                            onClick={handleFixEndTime}
                            disabled={isFixingEndTime}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            {isFixingEndTime ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              'Fix End Time'
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
                
                {/* Show key data points */}
                <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Doors:</span>{' '}
                    <span className="font-medium">{confirmIssue.entryData.doors_knocked}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pitches:</span>{' '}
                    <span className="font-medium">{confirmIssue.entryData.pitches}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Presentations:</span>{' '}
                    <span className="font-medium">{confirmIssue.entryData.presentations}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Closes:</span>{' '}
                    <span className="font-medium">{confirmIssue.entryData.closes}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">FP+:</span>{' '}
                    <span className="font-medium">
                      {(confirmIssue.entryData.fp_plus + (confirmIssue.entryData.upgrade_prmr / 85)).toFixed(1)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">PRMR:</span>{' '}
                    <span className="font-medium">${confirmIssue.entryData.prmr}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DrawerFooter>
            <Button onClick={handleConfirmDismiss} className="bg-green-600 hover:bg-green-700">
              <Check className="w-4 h-4 mr-2" />
              Yes, Data is OK
            </Button>
            <Button variant="outline" onClick={() => setConfirmDrawerOpen(false)}>
              Cancel
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
};
