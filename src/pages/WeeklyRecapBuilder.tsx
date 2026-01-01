import { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ArrowLeft, Calendar, Sparkles, Eye, Check, Loader2, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWeeklyReportData } from '@/hooks/useWeeklyReportData';
import { useSaveReport, WeeklyReport } from '@/hooks/useWeeklyReports';
import { usePastBlitzes } from '@/hooks/usePastBlitzes';
import { TeamRecapStory } from '@/components/team-recap/TeamRecapStory';
import { EditValueDrawer } from '@/components/team-recap/EditValueDrawer';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

type ReportType = 'weekly' | 'monthly' | 'blitz';

interface PeriodOption {
  label: string;
  start: string;
  end: string;
}

export default function WeeklyRecapBuilder() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [reportType, setReportType] = useState<ReportType>('weekly');
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<WeeklyReport | null>(null);
  
  // Edit drawer state
  const [editField, setEditField] = useState<{ field: string; label: string; value: number | string; type: 'number' | 'text' } | null>(null);
  
  const { data: pastBlitzes } = usePastBlitzes();
  const now = new Date();

  // Generate period options based on report type
  const periodOptions = useMemo((): PeriodOption[] => {
    if (reportType === 'weekly') {
      // Last 6 weeks
      return Array.from({ length: 6 }, (_, i) => {
        const weekStart = startOfWeek(subWeeks(now, i + 1), { weekStartsOn: 0 });
        const weekEnd = endOfWeek(subWeeks(now, i + 1), { weekStartsOn: 0 });
        return {
          label: `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`,
          start: format(weekStart, 'yyyy-MM-dd'),
          end: format(weekEnd, 'yyyy-MM-dd'),
        };
      });
    } else if (reportType === 'monthly') {
      // Last 6 months
      return Array.from({ length: 6 }, (_, i) => {
        const monthStart = startOfMonth(subMonths(now, i + 1));
        const monthEnd = endOfMonth(subMonths(now, i + 1));
        return {
          label: format(monthStart, 'MMMM yyyy'),
          start: format(monthStart, 'yyyy-MM-dd'),
          end: format(monthEnd, 'yyyy-MM-dd'),
        };
      });
    }
    // For blitz - use real committed blitzes
    if (pastBlitzes && pastBlitzes.length > 0) {
      return pastBlitzes.map(blitz => ({
        label: blitz.name + (blitz.location ? ` (${blitz.location})` : ''),
        start: blitz.startDate,
        end: blitz.endDate,
      }));
    }
    // Fallback if no blitzes found
    return [];
  }, [reportType, pastBlitzes]);

  // Reset selection when report type changes
  const handleReportTypeChange = (type: ReportType) => {
    setReportType(type);
    setSelectedPeriodIndex(0);
    setGeneratedReport(null);
  };

  const selectedPeriod = periodOptions[selectedPeriodIndex] || periodOptions[0];
  
  const { data: reportData, isLoading, refetch } = useWeeklyReportData({
    reportType,
    periodStart: selectedPeriod?.start || '',
    periodEnd: selectedPeriod?.end || '',
    enabled: false,
  });

  const { mutate: saveReport, isPending: isSaving } = useSaveReport();

  const handleGenerate = async () => {
    const result = await refetch();
    if (result.data) {
      const report: WeeklyReport = {
        id: '',
        report_type: reportType,
        period_start: selectedPeriod.start,
        period_end: selectedPeriod.end,
        scope: 'office',
        generated_by: '',
        generated_at: new Date().toISOString(),
        status: 'draft',
        data: result.data,
        edits: {},
        created_at: new Date().toISOString(),
      };
      setGeneratedReport(report);
      toast({ title: 'Report generated', description: 'Tap any stat to edit, then publish when ready' });
    }
  };

  const handleEditValue = (field: string, label: string, currentValue: number | string, type: 'number' | 'text' = 'number') => {
    setEditField({ field, label, value: currentValue, type });
  };

  const handleSaveEdit = (value: number | string) => {
    if (!generatedReport || !editField) return;
    
    setGeneratedReport(prev => {
      if (!prev) return null;
      
      const fieldPath = editField.field.split('.');
      
      // Handle nested paths like "top10Rookies.reps.0.fp" or "teamRankings.rankings.0.fp"
      if (fieldPath.length > 2 && (fieldPath[1] === 'reps' || fieldPath[1] === 'rankings')) {
        const arrayKey = fieldPath[0]; // e.g., "top10Rookies" or "teamRankings"
        const itemIndex = parseInt(fieldPath[2], 10);
        const propKey = fieldPath[3]; // e.g., "fp" or "efp"
        
        // Clone the array from data or existing edits
        const existingArray = prev.edits?.[arrayKey] || prev.data?.[arrayKey] || [];
        const newArray = existingArray.map((item: any, idx: number) => {
          if (idx === itemIndex) {
            return { ...item, [propKey]: value };
          }
          return item;
        });
        
        return {
          ...prev,
          edits: {
            ...prev.edits,
            [arrayKey]: newArray,
          }
        };
      }
      
      // Simple field like "officeTotals.fp"
      return {
        ...prev,
        edits: {
          ...prev.edits,
          [editField.field]: value,
        }
      };
    });
    
    toast({ title: 'Value updated', description: `${editField.label} changed to ${value}` });
  };

  const handlePublish = () => {
    if (!generatedReport) return;
    
    saveReport({
      ...generatedReport,
      status: 'published',
      published_at: new Date().toISOString(),
    }, {
      onSuccess: () => {
        toast({ title: 'Report published!', description: 'Your team can now view the recap' });
        setGeneratedReport(null);
      },
      onError: (error) => {
        toast({ title: 'Failed to publish', description: error.message, variant: 'destructive' });
      },
    });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div 
        className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3"
        style={{ paddingTop: 'calc(var(--effective-safe-area-top) + 0.75rem)' }}
      >
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">Recap Builder</h1>
            <p className="text-xs text-muted-foreground">Generate team recognition</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Report Type Selector */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Report Type
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              {(['weekly', 'monthly', 'blitz'] as ReportType[]).map((type) => (
                <Button
                  key={type}
                  variant={reportType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleReportTypeChange(type)}
                  className="flex-1 capitalize"
                >
                  {type}
                </Button>
              ))}
            </div>

            {/* Period Selector */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">Select period:</p>
              {reportType === 'blitz' && periodOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-2">No past blitzes found</p>
              ) : (
                <ScrollArea className="w-full whitespace-nowrap">
                  <div className="flex gap-2 pb-2">
                    {periodOptions.map((option, idx) => (
                      <Button
                        key={option.start}
                        variant={selectedPeriodIndex === idx ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => {
                          setSelectedPeriodIndex(idx);
                          setGeneratedReport(null);
                        }}
                        className={cn(
                          "shrink-0 text-xs",
                          selectedPeriodIndex === idx && "ring-2 ring-primary"
                        )}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Generate Button */}
        <Button
          className="w-full py-6 text-lg font-semibold gap-2"
          onClick={handleGenerate}
          disabled={isLoading || periodOptions.length === 0}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Generate Report
            </>
          )}
        </Button>

        {/* Generated Report Preview */}
        {generatedReport && (
          <Card className="border-primary/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Report Ready
                <span className="text-xs font-normal text-muted-foreground ml-auto flex items-center gap-1">
                  <Pencil className="w-3 h-3" /> Tap to edit
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <button 
                  className="bg-muted/50 rounded-lg p-3 text-left hover:bg-muted/70 transition-colors active:scale-95"
                  onClick={() => handleEditValue('officeTotals.fp', 'Total FP+', generatedReport.edits['officeTotals.fp'] ?? generatedReport.data.officeTotals?.fp ?? 0)}
                >
                  <p className="text-2xl font-bold">{(generatedReport.edits['officeTotals.fp'] ?? generatedReport.data.officeTotals?.fp)?.toFixed(1) || 0}</p>
                  <p className="text-xs text-muted-foreground">Total FP+</p>
                </button>
                <button 
                  className="bg-muted/50 rounded-lg p-3 text-left hover:bg-muted/70 transition-colors active:scale-95"
                  onClick={() => handleEditValue('officeTotals.uniqueReps', 'Reps Working', generatedReport.edits['officeTotals.uniqueReps'] ?? generatedReport.data.officeTotals?.uniqueReps ?? 0)}
                >
                  <p className="text-2xl font-bold">{generatedReport.edits['officeTotals.uniqueReps'] ?? generatedReport.data.officeTotals?.uniqueReps ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Reps Working</p>
                </button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => setShowPreview(true)}
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={handlePublish}
                  disabled={isSaving}
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Publish
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Preview Story */}
      {showPreview && generatedReport && (
        <TeamRecapStory
          report={generatedReport}
          onClose={() => setShowPreview(false)}
          onEditValue={handleEditValue}
        />
      )}

      {/* Edit Value Drawer */}
      <EditValueDrawer
        open={!!editField}
        onOpenChange={(open) => !open && setEditField(null)}
        field={editField?.field || ''}
        label={editField?.label || ''}
        currentValue={editField?.value ?? 0}
        onSave={handleSaveEdit}
        type={editField?.type || 'number'}
      />
    </div>
  );
}
