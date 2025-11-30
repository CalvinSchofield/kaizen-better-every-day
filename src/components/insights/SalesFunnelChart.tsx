import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface SalesFunnelChartProps {
  funnelData: {
    doors: { total: number; conversionToNext: number };
    decisionMakers: { total: number; conversionToNext: number };
    pitches: { total: number; conversionToNext: number };
    transitions: { total: number; conversionToNext: number };
    presentations: { total: number; conversionToNext: number };
    closes: { total: number };
  };
}

export const SalesFunnelChart = ({ funnelData }: SalesFunnelChartProps) => {
  const data = [
    { stage: 'Doors', value: funnelData.doors.total, conversion: funnelData.doors.conversionToNext },
    { stage: 'DMs', value: funnelData.decisionMakers.total, conversion: funnelData.decisionMakers.conversionToNext },
    { stage: 'Pitches', value: funnelData.pitches.total, conversion: funnelData.pitches.conversionToNext },
    { stage: 'Transitions', value: funnelData.transitions.total, conversion: funnelData.transitions.conversionToNext },
    { stage: 'Presentations', value: funnelData.presentations.total, conversion: funnelData.presentations.conversionToNext },
    { stage: 'Closes', value: funnelData.closes.total, conversion: 0 },
  ];

  // Color gradient from muted to primary
  const colors = [
    'hsl(var(--muted))',
    'hsl(var(--muted-foreground) / 0.4)',
    'hsl(var(--primary) / 0.4)',
    'hsl(var(--primary) / 0.6)',
    'hsl(var(--primary) / 0.8)',
    'hsl(var(--primary))',
  ];

  const chartConfig = {
    value: {
      label: "Count",
      color: "hsl(var(--primary))",
    },
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Sales Funnel</h3>
          <p className="text-sm text-muted-foreground">Track your conversion at each stage</p>
        </div>

        <ChartContainer config={chartConfig} className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
            >
              <XAxis type="number" />
              <YAxis dataKey="stage" type="category" width={80} />
              <ChartTooltip
                content={<ChartTooltipContent />}
                formatter={(value, name, props) => {
                  const conversion = props.payload.conversion;
                  return [
                    <div key="content">
                      <div>{value} total</div>
                      {conversion > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {conversion.toFixed(1)}% convert to next
                        </div>
                      )}
                    </div>,
                    props.payload.stage
                  ];
                }}
              />
              <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Conversion percentages */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {data.slice(0, -1).map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-accent/30">
              <span className="text-muted-foreground">{item.stage} → {data[idx + 1].stage}</span>
              <span className="font-semibold text-primary">{item.conversion.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
