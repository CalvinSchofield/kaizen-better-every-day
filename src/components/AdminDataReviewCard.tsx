import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ChevronRight, Check, X } from 'lucide-react';
import { useAdminDataReview, DataIssue } from '@/hooks/useAdminDataReview';
import { RepDetailDrawer } from '@/components/reports/RepDetailDrawer';
import { cn } from '@/lib/utils';

interface SwipeableIssueRowProps {
  issue: DataIssue;
  onDismiss: () => void;
  onEdit: () => void;
}

const SwipeableIssueRow = ({ issue, onDismiss, onEdit }: SwipeableIssueRowProps) => {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const threshold = -80;

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const diff = e.touches[0].clientX - startX.current;
    // Only allow left swipe
    if (diff < 0) {
      setTranslateX(Math.max(diff, -100));
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (translateX < threshold) {
      // Dismiss the issue
      setTranslateX(-100);
      setTimeout(onDismiss, 200);
    } else {
      setTranslateX(0);
    }
  };

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
    <div className="relative overflow-hidden rounded-lg">
      {/* Dismiss background */}
      <div className="absolute inset-y-0 right-0 w-24 bg-green-600 flex items-center justify-center">
        <Check className="w-5 h-5 text-white" />
        <span className="text-white text-xs ml-1">OK</span>
      </div>
      
      {/* Issue row */}
      <div
        className={cn(
          "relative bg-muted/50 border-l-4 p-3 transition-transform",
          getSeverityColor(),
          isDragging ? '' : 'duration-200'
        )}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => translateX === 0 && onEdit()}
      >
        <div className="flex items-center gap-3">
          {getIssueIcon()}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{issue.repName}</p>
            <p className="text-xs text-muted-foreground truncate">{issue.description}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </div>
      </div>
    </div>
  );
};

export const AdminDataReviewCard = () => {
  const { issues, shouldShowCard, dismissIssue, refetch } = useAdminDataReview();
  const [selectedIssue, setSelectedIssue] = useState<DataIssue | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!shouldShowCard || issues.length === 0) {
    return null;
  }

  const handleEditIssue = (issue: DataIssue) => {
    setSelectedIssue(issue);
    setDrawerOpen(true);
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
            <span className="text-xs text-muted-foreground">Swipe to dismiss</span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {issues.map(issue => (
              <SwipeableIssueRow
                key={issue.id}
                issue={issue}
                onDismiss={() => dismissIssue(issue.id)}
                onEdit={() => handleEditIssue(issue)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedIssue && (
        <RepDetailDrawer
          open={drawerOpen}
          onOpenChange={handleDrawerClose}
          rep={getRepDetailData(selectedIssue)}
          entryDate={selectedIssue.entryDate}
        />
      )}
    </>
  );
};
