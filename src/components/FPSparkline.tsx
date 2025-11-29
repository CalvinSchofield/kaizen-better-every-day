import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface FPSparklineProps {
  data: Array<{ date: string; fp: number }>;
}

export const FPSparkline = ({ data }: FPSparklineProps) => {
  if (!data || data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={60}>
      <AreaChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="fpGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="fp"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fill="url(#fpGradient)"
          dot={{ r: 3, fill: "hsl(var(--primary))", strokeWidth: 0 }}
          animationDuration={800}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};
