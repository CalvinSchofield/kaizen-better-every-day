import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { Area, AreaChart } from "recharts";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface GroupBreakdown {
  name: string;
  fp: number;
  prmr: number;
  repCount: number;
  doors: number;
  presentations: number;
}

interface DailyPoint {
  date: string;
  fp: number;
  prmr: number;
}

interface HeroDrillDownDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  groups: GroupBreakdown[];
  dailyTrend?: DailyPoint[];
  periodLabel: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-muted-foreground mb-1">
        {label ? format(parseISO(label), 'EEE, MMM d') : ''}
      </p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-bold">{entry.dataKey === 'prmr' ? `$${entry.value.toLocaleString()}` : entry.value.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
};

const BarTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as GroupBreakdown;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-xs space-y-0.5">
      <p className="font-semibold">{d.name}</p>
      <p><span className="text-muted-foreground">FP+:</span> <span className="font-bold">{d.fp.toFixed(1)}</span></p>
      <p><span className="text-muted-foreground">PRMR:</span> <span className="font-bold">${d.prmr.toLocaleString()}</span></p>
      <p><span className="text-muted-foreground">Reps:</span> {d.repCount} · <span className="text-muted-foreground">Doors:</span> {d.doors}</p>
    </div>
  );
};

export const HeroDrillDownDrawer = ({
  open, onOpenChange, title, groups, dailyTrend, periodLabel,
}: HeroDrillDownDrawerProps) => {
  const sorted = [...groups].sort((a, b) => b.fp - a.fp);
  const maxFp = sorted[0]?.fp || 1;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-base">{title}</SheetTitle>
          <p className="text-xs text-muted-foreground">{periodLabel} · FP+ Breakdown</p>
        </SheetHeader>

        {/* Horizontal bar chart */}
        <div className="mt-4">
          <ResponsiveContainer width="100%" height={Math.max(sorted.length * 44, 120)}>
            <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                width={100} 
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<BarTooltip />} cursor={false} />
              <Bar dataKey="fp" radius={[0, 6, 6, 0]} barSize={28}>
                {sorted.map((entry, i) => (
                  <Cell
                    key={entry.name}
                    fill={i === 0 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.25)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary table */}
        <div className="mt-4 space-y-1">
          {sorted.map((g, i) => (
            <div key={g.name} className={cn(
              "flex items-center justify-between px-3 py-2 rounded-lg text-sm",
              i === 0 ? "bg-primary/5" : "bg-muted/20"
            )}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium truncate">{g.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{g.repCount} reps</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-bold">{g.fp.toFixed(1)}</span>
                <span className="text-xs text-green-600 dark:text-green-400">${g.prmr.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Daily trend sparkline */}
        {dailyTrend && dailyTrend.length >= 2 && (
          <div className="mt-6">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">Daily FP+ Trend</h4>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={dailyTrend} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="heroFpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(d) => { try { return format(parseISO(d), 'M/d'); } catch { return d; } }}
                  className="text-[10px] fill-muted-foreground"
                  axisLine={false} tickLine={false}
                />
                <YAxis className="text-[10px] fill-muted-foreground" axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="fp" name="FP+" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#heroFpGrad)" dot={{ r: 2.5, fill: "hsl(var(--primary))", strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
