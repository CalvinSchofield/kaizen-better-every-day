import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ChevronRight, Crown } from "lucide-react";

interface DayOfWeekAnalysisProps {
  dayOfWeekData: {
    [key: string]: {
      avgFp: number;
      avgEfp: number;
      avgDoors: number;
      avgPitches: number;
      avgTransitions: number;
      avgPresentations: number;
      avgCloses: number;
      avgHours: number;
      daysWorked: number;
    };
  };
  bestDayOfWeek: { day: string; avgFp: number; avgEfp: number; daysWorked: number } | null;
  efpModeEnabled?: boolean;
}

export const DayOfWeekAnalysis = ({ dayOfWeekData, bestDayOfWeek, efpModeEnabled = false }: DayOfWeekAnalysisProps) => {
  const [sheetOpen, setSheetOpen] = useState(false);

  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const chartData = dayOrder
    .filter(day => dayOfWeekData[day.toLowerCase()])
    .map(day => ({
      day: day.substring(0, 3),
      fullDay: day,
      value: efpModeEnabled 
        ? dayOfWeekData[day.toLowerCase()].avgEfp 
        : dayOfWeekData[day.toLowerCase()].avgFp,
      isBest: bestDayOfWeek?.day === day,
    }));

  const chartConfig = {
    value: {
      label: efpModeEnabled ? "Avg EFP" : "Avg FP+",
      color: "hsl(var(--primary))",
    },
  };

  if (!bestDayOfWeek) return null;

  return (
    <>
      <Card 
        className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => setSheetOpen(true)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Crown className="w-5 h-5 text-primary" />
            <div>
              <div className="text-sm text-muted-foreground mb-1">Best Day of Week</div>
              <div className="text-2xl font-bold">{bestDayOfWeek.day}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Avg {efpModeEnabled 
                  ? `${bestDayOfWeek.avgEfp.toFixed(2)} EFP`
                  : `${bestDayOfWeek.avgFp.toFixed(1)} FP+`
                } · {bestDayOfWeek.daysWorked} days worked
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>
      </Card>

      {/* Breakdown Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="h-[85vh] flex flex-col">
          <SheetHeader>
            <SheetTitle>Day of Week Breakdown</SheetTitle>
          </SheetHeader>
          
          <div className="mt-6 space-y-6 flex-1 overflow-y-auto pb-6">
            {/* Chart */}
            <div>
              <h3 className="text-sm font-semibold mb-4">
                Average {efpModeEnabled ? 'EFP' : 'FP+'} by Day
              </h3>
              <ChartContainer config={chartConfig} className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="day" />
                    <YAxis />
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      formatter={(value: any, name, props) => [
                        Number(value).toFixed(efpModeEnabled ? 2 : 1),
                        `Avg ${efpModeEnabled ? 'EFP' : 'FP+'}`
                      ]}
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.isBest ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.5)'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>

            {/* Detailed Stats */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Detailed Performance</h3>
              {dayOrder
                .filter(day => dayOfWeekData[day.toLowerCase()])
                .map(day => {
                  const data = dayOfWeekData[day.toLowerCase()];
                  const isBest = bestDayOfWeek?.day === day;
                  return (
                    <Card key={day} className={`p-3 ${isBest ? 'ring-2 ring-primary' : ''}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold">{day}</div>
                          {isBest && <Crown className="w-4 h-4 text-primary" />}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {data.daysWorked} day{data.daysWorked !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div>
                          <div className="text-muted-foreground">
                            {efpModeEnabled ? 'EFP' : 'FP+'}
                          </div>
                          <div className="font-semibold text-primary">
                            {efpModeEnabled 
                              ? data.avgEfp.toFixed(2)
                              : data.avgFp.toFixed(1)
                            }
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Doors</div>
                          <div className="font-semibold">{data.avgDoors.toFixed(0)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Pitches</div>
                          <div className="font-semibold">{data.avgPitches.toFixed(0)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Closes</div>
                          <div className="font-semibold">{data.avgCloses.toFixed(1)}</div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
