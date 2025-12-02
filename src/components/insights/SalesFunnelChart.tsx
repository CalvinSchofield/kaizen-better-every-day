import { TrendingDown } from "lucide-react";

interface SalesFunnelChartProps {
  funnelData: {
    doors: { total: number; conversionToNext: number };
    decisionMakers: { total: number; conversionToNext: number };
    pitches: { total: number; conversionToNext: number };
    transitions: { total: number; conversionToNext: number };
    presentations: { total: number; conversionToNext: number };
    closes: { total: number };
  };
  groupViewMode?: "all" | "mgmt" | "team" | "individual";
  teamInsightsData?: any;
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export const SalesFunnelChart = ({ funnelData, groupViewMode = "all", teamInsightsData }: SalesFunnelChartProps) => {
  const isGrouped = groupViewMode !== "all" && teamInsightsData;
  const sourceData = isGrouped
    ? (groupViewMode === "mgmt" ? teamInsightsData.byMgmtGroup : teamInsightsData.byTeam)
    : null;

  const calculateWidths = () => {
    const minWidth = 30; // Minimum width to ensure text fits
    let currentWidth = 100;
    
    const widths = [currentWidth]; // Doors at 100%
    
    // Decision Makers: heavily dampened (keep it looking like a funnel, not a T)
    // Use 75% base + 20% of actual conversion to dampen the dramatic drop
    const dmConversion = funnelData.doors.conversionToNext;
    currentWidth = Math.max(minWidth, 75 + (dmConversion / 100) * 20);
    widths.push(currentWidth);
    
    // Pitches: moderately dampened
    // Use 60% of previous width + 40% based on conversion
    const pitchConversion = funnelData.decisionMakers.conversionToNext;
    currentWidth = Math.max(minWidth, currentWidth * 0.6 + (currentWidth * pitchConversion / 100) * 0.4);
    widths.push(currentWidth);
    
    // Transitions: more accurate reflection
    const transConversion = funnelData.pitches.conversionToNext;
    currentWidth = Math.max(minWidth, currentWidth * (transConversion / 100));
    widths.push(currentWidth);
    
    // Presentations: accurate reflection
    const presConversion = funnelData.transitions.conversionToNext;
    currentWidth = Math.max(minWidth, currentWidth * (presConversion / 100));
    widths.push(currentWidth);
    
    // Closes: accurate reflection
    const closeConversion = funnelData.presentations.conversionToNext;
    currentWidth = Math.max(minWidth, currentWidth * (closeConversion / 100));
    widths.push(currentWidth);
    
    return widths;
  };
  
  const widths = calculateWidths();
  
  const stages = [
    { label: 'Doors', value: funnelData.doors.total, conversion: funnelData.doors.conversionToNext, width: widths[0] },
    { label: 'Decision Makers', value: funnelData.decisionMakers.total, conversion: funnelData.decisionMakers.conversionToNext, width: widths[1] },
    { label: 'Pitches', value: funnelData.pitches.total, conversion: funnelData.pitches.conversionToNext, width: widths[2] },
    { label: 'Transitions', value: funnelData.transitions.total, conversion: funnelData.transitions.conversionToNext, width: widths[3] },
    { label: 'Presentations', value: funnelData.presentations.total, conversion: funnelData.presentations.conversionToNext, width: widths[4] },
    { label: 'Closes', value: funnelData.closes.total, conversion: 0, width: widths[5] },
  ];

  return (
    <div className="space-y-6 py-2">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Track your conversion at each stage</p>
      </div>

      {/* Funnel Visualization */}
      <div className="space-y-3 px-4">
        {stages.map((stage, index) => (
          <div key={stage.label} className="flex flex-col items-center">
            {/* Funnel Bar */}
            <div
              className="relative rounded-lg bg-gradient-to-r from-primary/20 to-primary transition-all hover:scale-105"
              style={{
                width: `${stage.width}%`,
                height: '60px',
                opacity: 0.4 + (index * 0.1),
              }}
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
                <div className="text-xs font-medium text-foreground/90 truncate w-full">{stage.label}</div>
                <div className="text-lg font-bold text-foreground">{stage.value}</div>
              </div>
            </div>

            {/* Conversion Arrow */}
            {index < stages.length - 1 && (
              <div className="flex items-center gap-1 py-1">
                <TrendingDown className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs font-semibold text-primary">
                  {stage.conversion.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-2 text-xs px-4">
        {stages.slice(0, -1).map((stage, idx) => (
          <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-accent/30">
            <span className="text-muted-foreground truncate">
              {stage.label.split(' ')[0]} → {stages[idx + 1].label.split(' ')[0]}
            </span>
            <span className="font-semibold text-primary ml-1">{stage.conversion.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};
