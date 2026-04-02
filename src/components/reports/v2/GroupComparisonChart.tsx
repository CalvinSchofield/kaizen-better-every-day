import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AccessLevel, hasMinAccess } from "@/utils/roleHierarchy";

interface GroupData {
  name: string;
  fp: number;
  prmr: number;
  doors: number;
  presentations: number;
  repCount: number;
}

interface GroupComparisonChartProps {
  groupedByTeam?: Array<{
    teamName: string;
    mgmtGroupName: string;
    totals: { fp: number; prmr: number; doors: number; presentations: number; closes: number };
    members: Array<{ userId: string; name: string; fp: number }>;
  }>;
  groupedByMgmt?: Array<{
    mgmtGroupName: string;
    totals: { fp: number; prmr: number; doors: number; presentations: number; closes: number };
    members: Array<{ userId: string; name: string; fp: number }>;
  }>;
  accessLevel: AccessLevel;
  isLoading?: boolean;
}

const ChartTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as GroupData;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-xs space-y-0.5">
      <p className="font-semibold">{d.name}</p>
      <p>FP+: <span className="font-bold">{d.fp.toFixed(1)}</span> · PRMR: <span className="font-bold text-green-600 dark:text-green-400">${d.prmr.toLocaleString()}</span></p>
      <p className="text-muted-foreground">{d.repCount} reps · {d.doors} doors · {d.presentations} pres</p>
    </div>
  );
};

export const GroupComparisonChart = ({ groupedByTeam, groupedByMgmt, accessLevel, isLoading }: GroupComparisonChartProps) => {
  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="h-5 w-40 bg-muted animate-pulse rounded mb-3" />
        <div className="h-[180px] bg-muted animate-pulse rounded" />
      </Card>
    );
  }

  // Use mgmt groups for Sr Manager+, teams otherwise
  const useMgmt = hasMinAccess(accessLevel, 'mgmt_group_lead') || accessLevel === 'area_director' || accessLevel === 'manager';
  
  let data: GroupData[] = [];
  let chartTitle = "Team Comparison";

  if (useMgmt && groupedByMgmt && groupedByMgmt.length > 1) {
    chartTitle = "MGMT Group Comparison";
    data = groupedByMgmt.map(g => ({
      name: g.mgmtGroupName,
      fp: g.totals.fp,
      prmr: g.totals.prmr,
      doors: g.totals.doors,
      presentations: g.totals.presentations,
      repCount: g.members.length,
    }));
  } else if (groupedByTeam && groupedByTeam.length > 1) {
    chartTitle = "Team Comparison";
    data = groupedByTeam.map(g => ({
      name: g.teamName,
      fp: g.totals.fp,
      prmr: g.totals.prmr,
      doors: g.totals.doors,
      presentations: g.totals.presentations,
      repCount: g.members.length,
    }));
  }

  if (data.length < 2) return null;

  const sorted = [...data].sort((a, b) => b.fp - a.fp);
  const barHeight = Math.max(sorted.length * 44, 120);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-primary" />
        <h3 className="font-semibold">{chartTitle}</h3>
      </div>

      <ResponsiveContainer width="100%" height={barHeight}>
        <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            dataKey="name"
            type="category"
            width={90}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={false} />
          <Bar dataKey="fp" radius={[0, 6, 6, 0]} barSize={26}>
            {sorted.map((_, i) => (
              <Cell
                key={i}
                fill={i === 0 ? 'hsl(var(--primary))' : i === 1 ? 'hsl(var(--primary) / 0.6)' : 'hsl(var(--muted-foreground) / 0.2)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend row */}
      <div className="mt-3 space-y-1">
        {sorted.map((g, i) => (
          <div key={g.name} className="flex items-center justify-between text-xs px-1">
            <div className="flex items-center gap-2">
              <div className={cn("w-2.5 h-2.5 rounded-sm", i === 0 ? "bg-primary" : i === 1 ? "bg-primary/60" : "bg-muted-foreground/20")} />
              <span className="font-medium">{g.name}</span>
              <span className="text-muted-foreground">{g.repCount} reps</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold">{g.fp.toFixed(1)} FP+</span>
              <span className="text-green-600 dark:text-green-400">${g.prmr.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
