import { useState } from 'react';
import { format, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ArrowLeft, Calendar, Sparkles, Eye, Check, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWeeklyReportData } from '@/hooks/useWeeklyReportData';
import { useWeeklyReports, useSaveReport, WeeklyReport, WeeklyReportData } from '@/hooks/useWeeklyReports';
import { TeamRecapStory } from '@/components/team-recap/TeamRecapStory';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type ReportType = 'weekly' | 'monthly' | 'blitz';

export default function WeeklyRecapBuilder() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [reportType, setReportType] = useState<ReportType>('weekly');
  const [showPreview, setShowPreview] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<WeeklyReport | null>(null);
  
  // Calculate period based on type
  const now = new Date();
  const getPeriod = () => {
    if (reportType === 'weekly') {
      const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      return { start: format(lastWeekStart, 'yyyy-MM-dd'), end: format(lastWeekEnd, 'yyyy-MM-dd') };
    } else if (reportType === 'monthly') {
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = endOfMonth(subMonths(now, 1));
      return { start: format(lastMonthStart, 'yyyy-MM-dd'), end: format(lastMonthEnd, 'yyyy-MM-dd') };
    }
    // For blitz, use last week as placeholder
    const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    return { start: format(lastWeekStart, 'yyyy-MM-dd'), end: format(lastWeekEnd, 'yyyy-MM-dd') };
  };

  const period = getPeriod();
  
  const { data: reportData, isLoading, refetch } = useWeeklyReportData({
    reportType,
    periodStart: period.start,
    periodEnd: period.end,
    enabled: false,
  });

  const { mutate: saveReport, isPending: isSaving } = useSaveReport();

  const handleGenerate = async () => {
    const result = await refetch();
    if (result.data) {
      const report: WeeklyReport = {
        id: '',
        report_type: reportType,
        period_start: period.start,
        period_end: period.end,
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
            <h1 className="text-lg font-bold">Weekly Recap Builder</h1>
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
          <CardContent>
            <div className="flex gap-2">
              {(['weekly', 'monthly', 'blitz'] as ReportType[]).map((type) => (
                <Button
                  key={type}
                  variant={reportType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setReportType(type)}
                  className="flex-1 capitalize"
                >
                  {type}
                </Button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {reportType === 'weekly' && `Week of ${format(new Date(period.start), 'MMM d')} - ${format(new Date(period.end), 'MMM d')}`}
              {reportType === 'monthly' && format(new Date(period.start), 'MMMM yyyy')}
              {reportType === 'blitz' && `${format(new Date(period.start), 'MMM d')} - ${format(new Date(period.end), 'MMM d')}`}
            </p>
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
