import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Check, X, Clock, Loader2, Eraser, Zap, Undo2 } from 'lucide-react';
import { format } from 'date-fns';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// Helper to get the suggested end time from counter timestamps (in rep's timezone)
const getSuggestedEndTime = (issue: DataIssue): { time: string; formatted: string } | null => {
  const timestamps = issue.entryData.counter_timestamps;
  if (!timestamps) return null;

  const allTimestamps: string[] = [];
  Object.values(timestamps).forEach((arr) => {
    if (Array.isArray(arr)) allTimestamps.push(...arr);
  });

  if (allTimestamps.length === 0) return null;

  const latestTimestamp = new Date(Math.max(...allTimestamps.map(t => new Date(t).getTime())));
  
  // Get rep's timezone, default to America/Los_Angeles
  const repTimezone = issue.entryData.timezone || 'America/Los_Angeles';
  
  // Format the time in the rep's timezone
  const formatted = latestTimestamp.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: repTimezone,
  });

  return {
    time: latestTimestamp.toISOString(),
    formatted,
  };
};

// Format timestamp in rep's timezone for timeline view
const formatTimestampForTimeline = (timestamp: string, timezone: string | null): string => {
  const tz = timezone || 'America/Los_Angeles';
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: tz,
  });
};

// Calculate gap between timestamps in seconds
const getGapSeconds = (t1: string, t2: string): number => {
  return (new Date(t2).getTime() - new Date(t1).getTime()) / 1000;
};

interface IssueRowProps {
  issue: DataIssue;
  onOkay: () => void;
  onEdit: () => void;
  onFixEndTime: (issue: DataIssue) => void;
  onClearActivity: (issue: DataIssue) => void;
  onRemoveRapidTaps: (issue: DataIssue) => void;
  isFixing: boolean;
  fixingIssueId: string | null;
}

const IssueRow = ({ issue, onOkay, onEdit, onFixEndTime, onClearActivity, onRemoveRapidTaps, isFixing, fixingIssueId }: IssueRowProps) => {
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  
  const getSeverityColor = () => {
    if (issue.issueType === 'rapid_tapping') return 'border-l-purple-500';
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
      case 'rapid_tapping':
        return <Zap className="w-4 h-4 text-purple-500" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const showFixButton = issue.issueType === 'late_end_time' || issue.issueType === 'unsaved';
  const suggested = showFixButton ? getSuggestedEndTime(issue) : null;
  const isThisFixing = isFixing && fixingIssueId === issue.id;
  
  // Show clear activity button if entry has FP+ or PRMR but also has activity data
  const hasResults = (issue.entryData.fp_plus || 0) > 0 || (issue.entryData.prmr || 0) > 0;
  const hasActivity = issue.entryData.doors_knocked > 0 || issue.entryData.pitches > 0;
  const showClearActivity = hasResults && hasActivity;
  
  // For rapid tapping, show timeline toggle
  const isRapidTapping = issue.issueType === 'rapid_tapping' && issue.rapidTapInfo;

  return (
    <Collapsible open={isTimelineOpen} onOpenChange={setIsTimelineOpen}>
      <div
        className={cn(
          "bg-muted/50 border-l-4 p-3 rounded-lg transition-colors",
          getSeverityColor()
        )}
      >
        <div 
          className="flex items-start gap-3 cursor-pointer active:bg-muted/70"
          onClick={onEdit}
        >
          <div className="mt-0.5">{getIssueIcon()}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm truncate">{issue.repName}</p>
              <span className="text-xs text-muted-foreground shrink-0">
                {format(new Date(issue.entryDate + 'T12:00:00'), 'MMM d')}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{issue.description}</p>
            {suggested && (
              <div className="flex items-center gap-1.5 mt-1">
                <Clock className="w-3 h-3 text-blue-500" />
                <span className="text-xs text-blue-600 font-medium">
                  Suggest {suggested.formatted}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isRapidTapping && (
              <>
                <CollapsibleTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isTimelineOpen ? 'Hide' : 'Times'}
                  </Button>
                </CollapsibleTrigger>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveRapidTaps(issue);
                  }}
                  disabled={isThisFixing}
                  title={`Remove ${issue.rapidTapInfo?.count} rapid taps and their timestamps`}
                >
                  {isThisFixing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    `-${issue.rapidTapInfo?.count} ${issue.rapidTapInfo?.field?.toLowerCase()}`
                  )}
                </Button>
              </>
            )}
            {showClearActivity && !isRapidTapping && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearActivity(issue);
                }}
                disabled={isThisFixing}
                title="Clear activity, keep FP+ & PRMR"
              >
                <Eraser className="w-3 h-3" />
              </Button>
            )}
            {showFixButton && suggested && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onFixEndTime(issue);
                }}
                disabled={isThisFixing}
              >
                {isThisFixing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  'Fix'
                )}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-100"
              onClick={(e) => {
                e.stopPropagation();
                onOkay();
              }}
            >
              {isRapidTapping ? 'OK' : <Check className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        
        {/* Rapid tapping timeline */}
        {isRapidTapping && (
          <CollapsibleContent>
            <div className="mt-3 pt-3 border-t border-border/50">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Tap Timeline ({issue.rapidTapInfo?.field}):
              </p>
              <div className="space-y-1">
                {issue.rapidTapInfo?.timestamps.map((ts, idx) => {
                  const prevTs = idx > 0 ? issue.rapidTapInfo?.timestamps[idx - 1] : null;
                  const gap = prevTs ? getGapSeconds(prevTs, ts) : null;
                  return (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-muted-foreground">
                        {formatTimestampForTimeline(ts, issue.entryData.timezone)}
                      </span>
                      {gap !== null && gap < 5 && (
                        <span className="text-amber-600 font-medium">
                          ⚠️ {gap.toFixed(1)}s gap
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  );
};

export const AdminDataReviewCard = () => {
  const { issues, shouldShowCard, dismissIssue, undoLastDismiss, lastDismissed, refetch } = useAdminDataReview();
  const [selectedIssue, setSelectedIssue] = useState<DataIssue | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmIssue, setConfirmIssue] = useState<DataIssue | null>(null);
  const [confirmDrawerOpen, setConfirmDrawerOpen] = useState(false);
  const [isFixingEndTime, setIsFixingEndTime] = useState(false);
  const [fixingIssueId, setFixingIssueId] = useState<string | null>(null);

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
      dismissIssue(confirmIssue.id, confirmIssue.entryId);
      setConfirmDrawerOpen(false);
      setConfirmIssue(null);
    }
  };

  const handleFixEndTime = async (issue: DataIssue) => {
    const suggested = getSuggestedEndTime(issue);
    if (!suggested) return;

    setIsFixingEndTime(true);
    setFixingIssueId(issue.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.functions.invoke('update-rep-entry', {
        body: {
          entryId: issue.entryId,
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
        description: `Updated ${issue.repName}'s end time to ${suggested.formatted}`,
      });

      dismissIssue(issue.id, issue.entryId);
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
      setFixingIssueId(null);
    }
  };

  const handleClearActivity = async (issue: DataIssue) => {
    setIsFixingEndTime(true);
    setFixingIssueId(issue.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.functions.invoke('update-rep-entry', {
        body: {
          entryId: issue.entryId,
          adminEmail: user.email,
          updates: {
            doors_knocked: 0,
            decision_makers: 0,
            pitches: 0,
            transitions: 0,
            presentations: 0,
            closes: 0,
            counter_timestamps: {},
            work_start_time: null,
            work_end_time: null,
            break_periods: [],
            is_finalized: true,
            // FP+ and PRMR are preserved (not included in updates)
          },
        },
      });

      if (error) throw error;

      toast({
        title: 'Activity cleared',
        description: `Cleared ${issue.repName}'s activity inputs, kept FP+ & PRMR`,
      });

      dismissIssue(issue.id, issue.entryId);
      refetch();
    } catch (error) {
      console.error('Error clearing activity:', error);
      toast({
        title: 'Error',
        description: 'Failed to clear activity',
        variant: 'destructive',
      });
    } finally {
      setIsFixingEndTime(false);
      setFixingIssueId(null);
    }
  };

  // Map display field names back to database field names
  const fieldNameToDbField: Record<string, string> = {
    'Doors': 'doors_knocked',
    'DMs': 'decision_makers',
    'Pitches': 'pitches',
    'Transitions': 'transitions',
    'Presentations': 'presentations',
    'Closes': 'closes',
  };

  const handleRemoveRapidTaps = async (issue: DataIssue) => {
    if (!issue.rapidTapInfo) return;

    setIsFixingEndTime(true);
    setFixingIssueId(issue.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { field, count, timestamps: rapidTimestamps } = issue.rapidTapInfo;
      const dbField = fieldNameToDbField[field];
      if (!dbField) throw new Error(`Unknown field: ${field}`);

      // Calculate new counter value
      const entryDataAny = issue.entryData as unknown as Record<string, number | string | boolean | null | Record<string, string[]>>;
      const currentValue = (typeof entryDataAny[dbField] === 'number' ? entryDataAny[dbField] : 0) as number;
      const newValue = Math.max(0, currentValue - count);

      // Remove rapid tap timestamps from the counter_timestamps
      const currentTimestamps = issue.entryData.counter_timestamps || {};
      const fieldTimestamps = currentTimestamps[dbField] || [];
      
      // Filter out the rapid tap timestamps
      const rapidTimestampSet = new Set(rapidTimestamps);
      const newTimestamps = fieldTimestamps.filter((ts: string) => !rapidTimestampSet.has(ts));

      const updatedCounterTimestamps = {
        ...currentTimestamps,
        [dbField]: newTimestamps,
      };

      const { error } = await supabase.functions.invoke('update-rep-entry', {
        body: {
          entryId: issue.entryId,
          adminEmail: user.email,
          updates: {
            [dbField]: newValue,
            counter_timestamps: updatedCounterTimestamps,
          },
        },
      });

      if (error) throw error;

      toast({
        title: 'Rapid taps removed',
        description: `Removed ${count} ${field.toLowerCase()} from ${issue.repName} (${currentValue} → ${newValue}) + cleaned timestamps`,
      });

      dismissIssue(issue.id, issue.entryId);
      refetch();
    } catch (error) {
      console.error('Error removing rapid taps:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove rapid taps',
        variant: 'destructive',
      });
    } finally {
      setIsFixingEndTime(false);
      setFixingIssueId(null);
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

  // Separate rapid tap issues from other issues
  const rapidTapIssues = issues.filter(i => i.issueType === 'rapid_tapping');
  const otherIssues = issues.filter(i => i.issueType !== 'rapid_tapping');
  
  // Group rapid tap issues by rep
  const rapidTapByRep = rapidTapIssues.reduce((acc, issue) => {
    const key = issue.repName;
    if (!acc[key]) acc[key] = [];
    acc[key].push(issue);
    return acc;
  }, {} as Record<string, DataIssue[]>);
  
  // Sort reps by number of rapid tap incidents (most first)
  const sortedRapidTapReps = Object.entries(rapidTapByRep).sort((a, b) => b[1].length - a[1].length);

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
            {lastDismissed && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                onClick={undoLastDismiss}
              >
                <Undo2 className="w-3.5 h-3.5 mr-1" />
                Undo
              </Button>
            )}
            <span className="text-xs text-muted-foreground">Tap to edit</span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {/* Other issues first */}
            {otherIssues.map(issue => (
              <IssueRow
                key={issue.id}
                issue={issue}
                onOkay={() => handleOkayClick(issue)}
                onEdit={() => handleEditIssue(issue)}
                onFixEndTime={handleFixEndTime}
                onClearActivity={handleClearActivity}
                onRemoveRapidTaps={handleRemoveRapidTaps}
                isFixing={isFixingEndTime}
                fixingIssueId={fixingIssueId}
              />
            ))}
            
            {/* Rapid tap issues grouped by rep */}
            {sortedRapidTapReps.length > 0 && (
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs font-medium text-purple-600 mb-2 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  Rapid Tapping ({rapidTapIssues.length})
                </p>
                {sortedRapidTapReps.map(([repName, repIssues]) => (
                  <div key={repName} className="mb-2 last:mb-0">
                    {repIssues.length > 1 && (
                      <p className="text-xs text-muted-foreground mb-1 font-medium">
                        {repName} ({repIssues.length} incidents)
                      </p>
                    )}
                    <div className="space-y-1">
                      {repIssues.map(issue => (
                        <IssueRow
                          key={issue.id}
                          issue={issue}
                          onOkay={() => handleOkayClick(issue)}
                          onEdit={() => handleEditIssue(issue)}
                          onFixEndTime={handleFixEndTime}
                          onClearActivity={handleClearActivity}
                          onRemoveRapidTaps={handleRemoveRapidTaps}
                          isFixing={isFixingEndTime}
                          fixingIssueId={fixingIssueId}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
            <DrawerTitle>Review & Approve</DrawerTitle>
            <DrawerDescription>
              Confirm you've reviewed this entry and the data is accurate.
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
                
                {/* Show key data points for review */}
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Entry Summary:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
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
            </div>
          )}

          <DrawerFooter>
            <Button onClick={handleConfirmDismiss} className="bg-green-600 hover:bg-green-700">
              <Check className="w-4 h-4 mr-2" />
              Approve Data
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
