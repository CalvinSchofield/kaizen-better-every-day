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
}

export const SalesFunnelChart = ({ funnelData }: SalesFunnelChartProps) => {
  // Calculate widths based on actual conversion rates
  const calculateWidths = () => {
    const baseData = [
      { label: 'Doors', value: funnelData.doors.total, conversion: funnelData.doors.conversionToNext },
      { label: 'Decision Makers', value: funnelData.decisionMakers.total, conversion: funnelData.decisionMakers.conversionToNext },
      { label: 'Pitches', value: funnelData.pitches.total, conversion: funnelData.pitches.conversionToNext },
      { label: 'Transitions', value: funnelData.transitions.total, conversion: funnelData.transitions.conversionToNext },
      { label: 'Presentations', value: funnelData.presentations.total, conversion: funnelData.presentations.conversionToNext },
      { label: 'Closes', value: funnelData.closes.total, conversion: 0 },
    ];

    let currentWidth = 100;
    return baseData.map((stage, index) => {
      const stageWidth = currentWidth;
      // Calculate next stage's width based on conversion rate
      if (index < baseData.length - 1) {
        currentWidth = currentWidth * (stage.conversion / 100);
      }
      return { ...stage, width: stageWidth };
    });
  };

  const stages = calculateWidths();

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
