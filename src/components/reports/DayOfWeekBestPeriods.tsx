import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

interface DailyTrendItem {
  date: string;
  fp: number;
  prmr: number;
  doors: number;
  dms?: number;
  pitches?: number;
  transitions?: number;
  presentations?: number;
  closes?: number;
  repsWorked?: number;
}

interface DayOfWeekBestPeriodsProps {
  dailyTrend: DailyTrendItem[];
}

export const DayOfWeekBestPeriods = ({ dailyTrend }: DayOfWeekBestPeriodsProps) => {
  if (!dailyTrend || dailyTrend.length === 0) return null;

  // Group data by day of week
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayData: Record<string, { count: number; fp: number; prmr: number; doors: number; presentations: number; transitions: number }> = {};

  dailyTrend.forEach(day => {
    const date = new Date(day.date + 'T12:00:00');
    const dayName = dayNames[date.getDay()];
    
    if (!dayData[dayName]) {
      dayData[dayName] = { count: 0, fp: 0, prmr: 0, doors: 0, presentations: 0, transitions: 0 };
    }
    
    dayData[dayName].count++;
    dayData[dayName].fp += day.fp;
    dayData[dayName].prmr += day.prmr;
    dayData[dayName].doors += day.doors;
    dayData[dayName].presentations += day.presentations || 0;
    dayData[dayName].transitions += day.transitions || 0;
  });

  // Calculate averages per day of week
  const chartData = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => {
    const data = dayData[day];
    if (!data || data.count === 0) {
      return { day, avgFp: 0, avgPrmr: 0, avgDoors: 0, avgPres: 0, avgTrans: 0, count: 0 };
    }
    return {
      day,
      avgFp: data.fp / data.count,
      avgPrmr: data.prmr / data.count,
      avgDoors: data.doors / data.count,
      avgPres: data.presentations / data.count,
      avgTrans: data.transitions / data.count,
      count: data.count,
    };
  });

  const maxFp = Math.max(...chartData.map(d => d.avgFp));

  return (
    <div className="space-y-4">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Day of Week Performance
      </div>
      
      {/* FP+ by Day */}
      <Card className="p-3">
        <div className="text-sm font-medium text-muted-foreground mb-2">Avg FP+ by Day</div>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <XAxis 
                dataKey="day" 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip 
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="bg-popover border border-border rounded-lg px-3 py-2 text-xs shadow-md">
                      <div className="font-semibold">{data.day}</div>
                      <div className="text-primary">{data.avgFp.toFixed(1)} FP+ avg</div>
                      <div className="text-muted-foreground">{data.count} day{data.count !== 1 ? 's' : ''}</div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="avgFp" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell 
                    key={index}
                    fill={entry.avgFp === maxFp && maxFp > 0 
                      ? 'hsl(var(--primary))' 
                      : 'hsl(var(--muted-foreground) / 0.3)'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {chartData
          .filter(d => d.count > 0)
          .sort((a, b) => b.avgFp - a.avgFp || b.avgPrmr - a.avgPrmr)
          .slice(0, 3)
          .map((day, idx) => (
            <Card key={day.day} className="p-2">
              <div className="text-xs text-muted-foreground">
                {idx === 0 ? 'Best Day' : idx === 1 ? '2nd Best' : '3rd Best'}
              </div>
              <div className="text-lg font-bold">{day.day}</div>
              <div className="text-xs text-primary">{day.avgFp.toFixed(1)} FP+</div>
            </Card>
          ))}
      </div>
    </div>
  );
};
