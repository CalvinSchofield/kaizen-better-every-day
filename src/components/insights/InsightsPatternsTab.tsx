import { useState } from 'react';
import { TrendingUp as TrendingUpIcon, Clock, Award } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { InsightsData } from '@/hooks/useInsightsData';
import { InsightsSectionHeader } from './InsightsSectionHeader';
import { InsightCollapsible } from './InsightCollapsible';
import { ActivityTrendChart } from './ActivityTrendChart';
import { HourlyActivityHeatmap } from './HourlyActivityHeatmap';
import { DayOfWeekAnalysis } from './DayOfWeekAnalysis';

type DatePreset = 'yesterday' | 'week' | 'lastWeek' | 'month' | 'lastMonth' | 'preseason' | 'custom';
type ExpandedSection = 'trends' | 'hourly' | 'timing' | 'bestPeriods' | null;

interface InsightsPatternsTabProps {
  insights: InsightsData;
  dateRange: { start: Date; end: Date };
  datePreset: DatePreset;
  efpModeEnabled: boolean;
}

export const InsightsPatternsTab = ({
  insights,
  dateRange,
  datePreset,
  efpModeEnabled,
}: InsightsPatternsTabProps) => {
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);

  const handleSectionToggle = (section: ExpandedSection) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const daysInRange = differenceInDays(dateRange.end, dateRange.start) + 1;
  const showBestDay = daysInRange > 1;
  const showBestWeek = daysInRange > 7;
  const showBestMonth = daysInRange > 30;

  return (
    <div className="space-y-4">
      <InsightsSectionHeader 
        icon={TrendingUpIcon} 
        title="Patterns" 
        description="When & how you perform best"
      />

      {/* Activity Trends */}
      <InsightCollapsible
        icon={TrendingUpIcon}
        title="Activity Trends"
        isOpen={expandedSection === 'trends'}
        onToggle={() => handleSectionToggle('trends')}
        preview={
          <span>
            {(() => {
              const transitionsData = insights.dailyTrend;
              if (transitionsData.length < 2) return `${insights.totalTransitions} transitions tracked`;
              
              const firstHalf = transitionsData.slice(0, Math.floor(transitionsData.length / 2));
              const secondHalf = transitionsData.slice(Math.floor(transitionsData.length / 2));
              const firstAvg = firstHalf.reduce((sum, d) => sum + d.transitions, 0) / firstHalf.length;
              const secondAvg = secondHalf.reduce((sum, d) => sum + d.transitions, 0) / secondHalf.length;
              const growth = ((secondAvg - firstAvg) / firstAvg) * 100;
              
              if (Math.abs(growth) < 5) {
                return `${insights.totalTransitions} transitions · Steady pattern`;
              } else if (growth > 0) {
                return <>{insights.totalTransitions} transitions · <span className="text-success font-medium">↑ {growth.toFixed(0)}%</span></>;
              } else {
                return <>{insights.totalTransitions} transitions · <span className="text-destructive font-medium">↓ {Math.abs(growth).toFixed(0)}%</span></>;
              }
            })()}
          </span>
        }
      >
        <ActivityTrendChart dailyTrend={insights.dailyTrend} efpModeEnabled={efpModeEnabled} highlightDateRange={dateRange} />
      </InsightCollapsible>

      {/* Hourly Patterns */}
      <InsightCollapsible
        icon={Clock}
        title="Hourly Patterns"
        isOpen={expandedSection === 'hourly'}
        onToggle={() => handleSectionToggle('hourly')}
        preview={
          insights.peakHours.doors !== null ? (
            <span>
              Peak hour: <span className="text-primary font-medium">
                {insights.peakHours.doors === 0 ? '12' : insights.peakHours.doors > 12 ? insights.peakHours.doors - 12 : insights.peakHours.doors}
                {insights.peakHours.doors >= 12 ? 'PM' : 'AM'}
              </span>
            </span>
          ) : 'View your peak productivity hours'
        }
      >
        <HourlyActivityHeatmap 
          hourlyActivity={insights.hourlyActivity} 
          peakHours={insights.peakHours}
          hourRange={insights.hourRange}
        />
      </InsightCollapsible>

      {/* Work Schedule */}
      <InsightCollapsible
        icon={Clock}
        title="Work Schedule"
        isOpen={expandedSection === 'timing'}
        onToggle={() => handleSectionToggle('timing')}
        preview={
          <span>
            {insights.avgStartTime} — {insights.avgEndTime} · <span className="text-primary font-medium">{insights.avgHoursWorked.toFixed(1)} hrs</span> avg
          </span>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-muted/30">
            <div className="text-sm text-muted-foreground">Avg Start Time</div>
            <div className="text-xl font-bold">{insights.avgStartTime}</div>
          </div>
          <div className="p-3 rounded-xl bg-muted/30">
            <div className="text-sm text-muted-foreground">Avg End Time</div>
            <div className="text-xl font-bold">{insights.avgEndTime}</div>
          </div>
          <div className="p-3 rounded-xl bg-muted/30">
            <div className="text-sm text-muted-foreground">Avg Hours Worked</div>
            <div className="text-xl font-bold">{insights.avgHoursWorked.toFixed(1)}h</div>
          </div>
          {insights.mostProductiveHour !== null && (
            <div className="p-3 rounded-xl bg-primary/10">
              <div className="text-sm text-muted-foreground">Most Productive</div>
              <div className="text-xl font-bold text-primary">
                {insights.mostProductiveHour === 0 ? '12' : insights.mostProductiveHour > 12 ? insights.mostProductiveHour - 12 : insights.mostProductiveHour}
                {insights.mostProductiveHour >= 12 ? 'PM' : 'AM'}
              </div>
            </div>
          )}
        </div>
      </InsightCollapsible>

      {/* Best Periods / Day Summary */}
      {daysInRange === 1 ? (
        <InsightCollapsible
          icon={Award}
          title="Day Summary"
          isOpen={expandedSection === 'bestPeriods'}
          onToggle={() => handleSectionToggle('bestPeriods')}
          preview={
            <span>
              <span className="text-primary font-medium">
                {efpModeEnabled ? insights.totalEfp.toFixed(2) : insights.totalFp.toFixed(1)} {efpModeEnabled ? "EFP" : "FP+"}
              </span> · {insights.totalDoors} doors · {insights.totalCloses} closes
            </span>
          }
        >
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <div className="text-sm text-muted-foreground mb-1">Results</div>
              <div className="text-xl font-bold text-primary">
                {efpModeEnabled ? insights.totalEfp.toFixed(2) : insights.totalFp.toFixed(1)} {efpModeEnabled ? "EFP" : "FP+"}
              </div>
              <div className="text-sm text-muted-foreground">${insights.totalPrmr.toLocaleString()} PRMR</div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-muted/30">
                <div className="text-sm text-muted-foreground">Doors</div>
                <div className="text-xl font-bold">{insights.totalDoors}</div>
              </div>
              <div className="p-3 rounded-xl bg-muted/30">
                <div className="text-sm text-muted-foreground">Closes</div>
                <div className="text-xl font-bold">{insights.totalCloses}</div>
              </div>
            </div>

            {insights.bestDayOfWeek && (
              <DayOfWeekAnalysis 
                dayOfWeekData={insights.dayOfWeekData}
                bestDayOfWeek={insights.bestDayOfWeek}
                efpModeEnabled={efpModeEnabled}
              />
            )}
          </div>
        </InsightCollapsible>
      ) : (
        <InsightCollapsible
          icon={Award}
          title="Best Periods"
          isOpen={expandedSection === 'bestPeriods'}
          onToggle={() => handleSectionToggle('bestPeriods')}
          preview={
            insights.bestDay ? (
              <span>
                Best day: <span className="text-primary font-medium">
                  {efpModeEnabled ? insights.bestDay.efp.toFixed(2) : insights.bestDay.fpPlus.toFixed(1)} {efpModeEnabled ? "EFP" : "FP+"}
                </span> on {insights.bestDay.date}
              </span>
            ) : 'Your personal records'
          }
        >
          <div className="space-y-3">
            {showBestDay && insights.bestDay && (
              <div className="p-3 rounded-xl bg-muted/30">
                <div className="text-sm text-muted-foreground mb-1">Best Day</div>
                <div className="text-xl font-bold text-primary">
                  {efpModeEnabled ? insights.bestDay.efp.toFixed(2) : insights.bestDay.fpPlus.toFixed(1)} {efpModeEnabled ? "EFP" : "FP+"}
                </div>
                <div className="text-sm text-muted-foreground">{insights.bestDay.date}</div>
                <div className="text-xs text-muted-foreground mt-1">{insights.bestDay.stats}</div>
              </div>
            )}
            
            {showBestWeek && insights.bestWeek && (
              <div className="p-3 rounded-xl bg-muted/30">
                <div className="text-sm text-muted-foreground mb-1">Best Week</div>
                <div className="text-xl font-bold text-primary">
                  {efpModeEnabled ? insights.bestWeek.efp.toFixed(2) : insights.bestWeek.fpPlus.toFixed(1)} {efpModeEnabled ? "EFP" : "FP+"}
                </div>
                <div className="text-sm text-muted-foreground">{insights.bestWeek.weekStart} — {insights.bestWeek.weekEnd}</div>
                <div className="text-xs text-muted-foreground mt-1">{insights.bestWeek.stats}</div>
              </div>
            )}
            
            {showBestMonth && insights.bestMonth && (
              <div className="p-3 rounded-xl bg-muted/30">
                <div className="text-sm text-muted-foreground mb-1">Best Month</div>
                <div className="text-xl font-bold text-primary">
                  {efpModeEnabled ? insights.bestMonth.efp.toFixed(2) : insights.bestMonth.fpPlus.toFixed(1)} {efpModeEnabled ? "EFP" : "FP+"}
                </div>
                <div className="text-sm text-muted-foreground">{insights.bestMonth.month}</div>
                <div className="text-xs text-muted-foreground mt-1">{insights.bestMonth.stats}</div>
              </div>
            )}
            
            {showBestDay && insights.bestTransitionsDay && (
              <div className="p-3 rounded-xl bg-muted/30">
                <div className="text-sm text-muted-foreground mb-1">Most Transitions Day</div>
                <div className="text-xl font-bold text-primary">{insights.bestTransitionsDay.transitions} transitions</div>
                <div className="text-sm text-muted-foreground">{insights.bestTransitionsDay.date}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {efpModeEnabled ? `${insights.bestTransitionsDay.efp.toFixed(2)} EFP` : `${insights.bestTransitionsDay.fpPlus.toFixed(1)} FP+`} sold
                </div>
              </div>
            )}

            {insights.bestDayOfWeek && (
              <DayOfWeekAnalysis 
                dayOfWeekData={insights.dayOfWeekData}
                bestDayOfWeek={insights.bestDayOfWeek}
                efpModeEnabled={efpModeEnabled}
              />
            )}
          </div>
        </InsightCollapsible>
      )}
    </div>
  );
};
