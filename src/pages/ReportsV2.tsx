import { useState } from "react";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useReportsV2Data, RepWithEffort } from "@/hooks/useReportsV2Data";
import { 
  ReportsExecutiveSnapshot, 
  ReportsEffortSection, 
  ReportsSkillSection,
  RepDrillDownDrawer,
} from "@/components/reports/v2";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, subWeeks } from "date-fns";

type DatePreset = 'today' | 'week' | 'month' | 'custom';

export const ReportsV2Page = () => {
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [selectedRepId, setSelectedRepId] = useState<string | null>(null);
  
  // Get team access
  const { data: teamAccess, isLoading: accessLoading } = useTeamAccess();
  
  // Calculate date range
  const getDateRange = () => {
    const today = new Date();
    switch (datePreset) {
      case 'today':
        return {
          start: format(today, 'yyyy-MM-dd'),
          end: format(today, 'yyyy-MM-dd'),
        };
      case 'week':
        return {
          start: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
          end: format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        };
      case 'month':
        return {
          start: format(startOfMonth(today), 'yyyy-MM-dd'),
          end: format(endOfMonth(today), 'yyyy-MM-dd'),
        };
      default:
        return {
          start: format(today, 'yyyy-MM-dd'),
          end: format(today, 'yyyy-MM-dd'),
        };
    }
  };

  const dateRange = getDateRange();
  const userIds = teamAccess?.accessibleUserIds || [];

  // Get V2 data
  const {
    isLoading,
    totalFP,
    totalPRMR,
    activeReps,
    workingCount,
    constraint,
    actions,
    effortSummary,
    skillBottleneck,
    impactPotential,
    repsWithEffort,
    funnelData,
    getRepById,
  } = useReportsV2Data({
    userIds,
    dateRange,
    isLiveView: datePreset === 'today',
  });

  // Get period label
  const getPeriodLabel = () => {
    switch (datePreset) {
      case 'today':
        return 'Today';
      case 'week':
        return 'This Week';
      case 'month':
        return 'This Month';
      default:
        return `${format(new Date(dateRange.start), 'MMM d')} - ${format(new Date(dateRange.end), 'MMM d')}`;
    }
  };

  // Handle rep click
  const handleRepClick = (userId: string) => {
    setSelectedRepId(userId);
  };

  // Handle SMS
  const handleSendSms = (phone: string, message: string) => {
    const smsUrl = `sms:${phone}?body=${encodeURIComponent(message)}`;
    window.open(smsUrl);
  };

  // Loading state
  if (accessLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-40 bg-muted animate-pulse rounded" />
        <div className="h-60 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  // No access
  if (!teamAccess || teamAccess.accessLevel === 'none') {
    return (
      <div className="p-4">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            You don't have access to team reports.
          </p>
        </Card>
      </div>
    );
  }

  const selectedRep = selectedRepId ? getRepById(selectedRepId) : null;

  return (
    <div className="p-4 space-y-4 pb-20">
      {/* Header with date presets */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports</h1>
        
        <div className="flex gap-1">
          <Button
            variant={datePreset === 'today' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setDatePreset('today')}
          >
            Today
          </Button>
          <Button
            variant={datePreset === 'week' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setDatePreset('week')}
          >
            Week
          </Button>
          <Button
            variant={datePreset === 'month' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setDatePreset('month')}
          >
            Month
          </Button>
        </div>
      </div>

      {/* Section 1: Executive Snapshot */}
      <ReportsExecutiveSnapshot
        totalFP={totalFP}
        totalPRMR={totalPRMR}
        activeReps={activeReps}
        periodLabel={getPeriodLabel()}
        constraint={constraint}
        actions={actions}
        isLoading={isLoading}
      />

      {/* Section 2: Effort */}
      <ReportsEffortSection
        reps={repsWithEffort}
        summary={effortSummary}
        onRepClick={handleRepClick}
        isLoading={isLoading}
      />

      {/* Section 3: Skill */}
      <ReportsSkillSection
        bottleneck={skillBottleneck}
        impactPotential={impactPotential}
        funnelData={funnelData}
        isLoading={isLoading}
      />

      {/* Rep Drill-Down Drawer */}
      <RepDrillDownDrawer
        rep={selectedRep ? {
          ...selectedRep,
          effort: selectedRep.effort,
        } : null}
        isOpen={!!selectedRepId}
        onClose={() => setSelectedRepId(null)}
        onSendSms={handleSendSms}
      />
    </div>
  );
};

export default ReportsV2Page;
