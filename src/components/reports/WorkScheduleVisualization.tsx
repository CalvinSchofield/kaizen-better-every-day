import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Clock, Sun, Moon, Timer, TrendingUp, ChevronRight } from "lucide-react";
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

interface RepScheduleData {
  userId: string;
  name: string;
  startMinutes: number; // minutes from midnight in local time
  endMinutes: number;
  durationMinutes: number;
  fp: number;
  prmr: number;
  date?: string;
  timezone?: string;
}

interface WorkScheduleVisualizationProps {
  data: RepScheduleData[];
  periodLabel?: string;
}

const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHour}:${mins.toString().padStart(2, '0')} ${period}`;
};

const minutesToDecimalHours = (minutes: number): string => {
  return (minutes / 60).toFixed(1);
};

export const WorkScheduleVisualization = ({ data, periodLabel }: WorkScheduleVisualizationProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedView, setSelectedView] = useState<'start' | 'end' | 'duration'>('start');

  if (!data || data.length === 0) return null;

  // Calculate averages and outliers
  const avgStart = data.reduce((sum, d) => sum + d.startMinutes, 0) / data.length;
  const avgEnd = data.reduce((sum, d) => sum + d.endMinutes, 0) / data.length;
  const avgDuration = data.reduce((sum, d) => sum + d.durationMinutes, 0) / data.length;

  // Find outliers (early starters, late workers, longest shifts)
  const sortedByStart = [...data].sort((a, b) => a.startMinutes - b.startMinutes);
  const sortedByEnd = [...data].sort((a, b) => b.endMinutes - a.endMinutes);
  const sortedByDuration = [...data].sort((a, b) => b.durationMinutes - a.durationMinutes);

  const earliestStarters = sortedByStart.slice(0, 3);
  const latestWorkers = sortedByEnd.slice(0, 3);
  const longestShifts = sortedByDuration.slice(0, 3);

  // Prepare scatter data
  const scatterData = data.map(d => ({
    ...d,
    x: selectedView === 'start' ? d.startMinutes : selectedView === 'end' ? d.endMinutes : d.durationMinutes,
    y: d.fp,
  }));

  // Color coding based on performance
  const getColor = (fp: number) => {
    if (fp >= 3) return 'hsl(var(--primary))';
    if (fp >= 1) return 'hsl(142, 76%, 36%)';
    return 'hsl(var(--muted-foreground))';
  };

  const renderSummaryCards = () => (
    <div className="grid grid-cols-3 gap-2">
      <button 
        onClick={() => { setSelectedView('start'); setDrawerOpen(true); }}
        className="text-left"
      >
        <Card className="p-3 hover:bg-muted/50 transition-colors cursor-pointer">
          <div className="flex items-center gap-1.5 mb-1">
            <Sun className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-xs text-muted-foreground">Avg Start</span>
          </div>
          <div className="text-lg font-bold">{minutesToTime(avgStart)}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <span>See all</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </Card>
      </button>

      <button 
        onClick={() => { setSelectedView('end'); setDrawerOpen(true); }}
        className="text-left"
      >
        <Card className="p-3 hover:bg-muted/50 transition-colors cursor-pointer">
          <div className="flex items-center gap-1.5 mb-1">
            <Moon className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs text-muted-foreground">Avg End</span>
          </div>
          <div className="text-lg font-bold">{minutesToTime(avgEnd)}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <span>See all</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </Card>
      </button>

      <button 
        onClick={() => { setSelectedView('duration'); setDrawerOpen(true); }}
        className="text-left"
      >
        <Card className="p-3 hover:bg-muted/50 transition-colors cursor-pointer">
          <div className="flex items-center gap-1.5 mb-1">
            <Timer className="w-3.5 h-3.5 text-purple-500" />
            <span className="text-xs text-muted-foreground">Avg Shift</span>
          </div>
          <div className="text-lg font-bold">{minutesToDecimalHours(avgDuration)}h</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <span>See all</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </Card>
      </button>
    </div>
  );

  const renderOutlierSection = (title: string, icon: React.ReactNode, reps: RepScheduleData[], valueFormatter: (d: RepScheduleData) => string) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        <span>{title}</span>
      </div>
      {reps.map((rep, idx) => (
        <div key={rep.userId + idx} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
          <div>
            <div className="font-medium text-sm">{rep.name}</div>
            {rep.date && <div className="text-xs text-muted-foreground">{rep.date}</div>}
          </div>
          <div className="text-right">
            <div className="font-bold">{valueFormatter(rep)}</div>
            <div className="text-xs text-muted-foreground">{rep.fp.toFixed(1)} FP+</div>
          </div>
        </div>
      ))}
    </div>
  );

  const getXAxisLabel = () => {
    switch (selectedView) {
      case 'start': return 'Start Time';
      case 'end': return 'End Time';
      case 'duration': return 'Hours Worked';
    }
  };

  const formatXTick = (value: number) => {
    if (selectedView === 'duration') {
      return `${(value / 60).toFixed(0)}h`;
    }
    return minutesToTime(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload as RepScheduleData & { x: number; y: number };
      return (
        <div className="bg-popover border border-border rounded-lg p-2 shadow-lg">
          <div className="font-medium">{d.name}</div>
          <div className="text-xs text-muted-foreground">
            {selectedView === 'start' && `Started: ${minutesToTime(d.startMinutes)}`}
            {selectedView === 'end' && `Ended: ${minutesToTime(d.endMinutes)}`}
            {selectedView === 'duration' && `Worked: ${minutesToDecimalHours(d.durationMinutes)}h`}
          </div>
          <div className="text-xs font-medium text-primary">{d.fp.toFixed(1)} FP+</div>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Work Schedule Overview</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Tap to see who started earliest, worked latest, or logged the most hours
        </p>
        {renderSummaryCards()}
      </Card>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[90dvh]">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              {selectedView === 'start' && <><Sun className="w-5 h-5 text-yellow-500" /> Start Times</>}
              {selectedView === 'end' && <><Moon className="w-5 h-5 text-blue-500" /> End Times</>}
              {selectedView === 'duration' && <><Timer className="w-5 h-5 text-purple-500" /> Shift Durations</>}
            </DrawerTitle>
          </DrawerHeader>
          
          <div className="px-4 pb-6 space-y-6 overflow-y-auto">
            {/* View Toggle */}
            <div className="flex gap-2">
              {(['start', 'end', 'duration'] as const).map(view => (
                <button
                  key={view}
                  onClick={() => setSelectedView(view)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    selectedView === view 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {view === 'start' ? 'Start' : view === 'end' ? 'End' : 'Duration'}
                </button>
              ))}
            </div>

            {/* Scatter Chart */}
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: 30, left: 10 }}>
                  <XAxis 
                    dataKey="x" 
                    type="number" 
                    domain={selectedView === 'duration' ? [0, 'dataMax + 60'] : ['dataMin - 30', 'dataMax + 30']}
                    tickFormatter={formatXTick}
                    tick={{ fontSize: 10 }}
                    label={{ value: getXAxisLabel(), position: 'bottom', fontSize: 11 }}
                  />
                  <YAxis 
                    dataKey="y" 
                    type="number" 
                    domain={[0, 'dataMax + 1']}
                    tick={{ fontSize: 10 }}
                    label={{ value: 'FP+', angle: -90, position: 'insideLeft', fontSize: 11 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine 
                    x={selectedView === 'start' ? avgStart : selectedView === 'end' ? avgEnd : avgDuration} 
                    stroke="hsl(var(--muted-foreground))" 
                    strokeDasharray="3 3" 
                  />
                  <Scatter data={scatterData}>
                    {scatterData.map((entry, idx) => (
                      <Cell key={idx} fill={getColor(entry.fp)} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div className="text-xs text-center text-muted-foreground">
              Dashed line = team average • Dot color = FP+ output
            </div>

            {/* Outliers / Leaders */}
            <div className="space-y-4">
              {selectedView === 'start' && renderOutlierSection(
                "Earliest Starters 🌅",
                <Sun className="w-4 h-4 text-yellow-500" />,
                earliestStarters,
                (d) => minutesToTime(d.startMinutes)
              )}
              {selectedView === 'end' && renderOutlierSection(
                "Latest Workers 🌙",
                <Moon className="w-4 h-4 text-blue-500" />,
                latestWorkers,
                (d) => minutesToTime(d.endMinutes)
              )}
              {selectedView === 'duration' && renderOutlierSection(
                "Longest Shifts 💪",
                <Timer className="w-4 h-4 text-purple-500" />,
                longestShifts,
                (d) => `${minutesToDecimalHours(d.durationMinutes)}h`
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};