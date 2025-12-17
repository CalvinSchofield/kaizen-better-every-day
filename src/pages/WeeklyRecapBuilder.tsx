import { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ArrowLeft, Calendar, Sparkles, Eye, Check, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWeeklyReportData } from '@/hooks/useWeeklyReportData';
import { useSaveReport, WeeklyReport } from '@/hooks/useWeeklyReports';
import { TeamRecapStory } from '@/components/team-recap/TeamRecapStory';
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
  
  const now = new Date();

  // Generate period options based on report type
  const periodOptions = useMemo((): PeriodOption[] => {
    if (reportType === 'weekly') {
      // Last 6 weeks
      return Array.from({ length: 6 }, (_, i) => {
        const weekStart = startOfWeek(subWeeks(now, i + 1), { weekStartsOn: 1 });
        const weekEnd = endOfWeek(subWeeks(now, i + 1), { weekStartsOn: 1 });
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
    // For blitz - placeholder for now, would fetch from committed blitzes
    return Array.from({ length: 4 }, (_, i) => {
      const weekStart = startOfWeek(subWeeks(now, i + 1), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(subWeeks(now, i + 1), { weekStartsOn: 1 });
      return {
        label: `Blitz ${i + 1}`,
        start: format(weekStart, 'yyyy-MM-dd'),
        end: format(weekEnd, 'yyyy-MM-dd'),
      };
    });
  }, [reportType]);

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
      toast({ title: 'Report generated', description: 'Review the data and publish when ready' });
    }
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
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
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
            </div>
          </CardContent>
        </Card>

        {/* Generate Button */}
        <Button
          className="w-full py-6 text-lg font-semibold gap-2"
          onClick={handleGenerate}
          disabled={isLoading}
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
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-2xl font-bold">{generatedReport.data.officeTotals?.fp?.toFixed(1) || 0}</p>
                  <p className="text-xs text-muted-foreground">Total FP+</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-2xl font-bold">{generatedReport.data.officeTotals?.uniqueReps || 0}</p>
                  <p className="text-xs text-muted-foreground">Reps Working</p>
                </div>
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
        />
      )}
    </div>
  );
}
