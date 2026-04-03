import { cn } from "@/lib/utils";

interface MicroSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  /** Optional average/benchmark value to render as a faint horizontal "gold line" */
  goldLine?: number;
  /** Show the numeric value label on the gold line */
  showGoldLabel?: boolean;
  /** Format function for gold label */
  formatGoldLabel?: (v: number) => string;
  /** Custom prefix for the gold label (default: "avg") */
  goldLabelText?: string;
  /** Color of the sparkline stroke */
  color?: string;
}

export const MicroSparkline = ({
  data,
  width = 60,
  height = 20,
  className,
  goldLine,
  showGoldLabel,
  formatGoldLabel,
  goldLabelText = "avg",
  color,
}: MicroSparklineProps) => {
  if (!data || data.length < 2) return null;

  const max = Math.max(...data, goldLine ?? 0);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const padding = 1;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  const goldY = goldLine !== undefined
    ? height - padding - ((goldLine - min) / range) * (height - padding * 2)
    : null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
    >
      {/* Gold benchmark line */}
      {goldY !== null && (
        <>
          <line
            x1={padding}
            y1={goldY}
            x2={width - padding}
            y2={goldY}
            stroke="hsl(var(--primary))"
            strokeWidth={0.5}
            strokeDasharray="2 2"
            opacity={0.3}
          />
          {showGoldLabel && goldLine !== undefined && (
            <text
              x={width - padding}
              y={goldY - 3}
              textAnchor="end"
              fill="hsl(var(--primary))"
              opacity={0.5}
              fontSize={Math.min(10, height * 0.18)}
              fontWeight={600}
            >
              {goldLabelText} {formatGoldLabel ? formatGoldLabel(goldLine) : Math.round(goldLine).toLocaleString()}
            </text>
          )}
        </>
      )}
      {/* Sparkline */}
      <polyline
        points={points}
        fill="none"
        stroke={color || "hsl(var(--primary))"}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      {data.length > 0 && (() => {
        const lastX = padding + ((data.length - 1) / (data.length - 1)) * (width - padding * 2);
        const lastY = height - padding - ((data[data.length - 1] - min) / range) * (height - padding * 2);
        return (
          <circle
            cx={lastX}
            cy={lastY}
            r={1.5}
            fill={color || "hsl(var(--primary))"}
          />
        );
      })()}
    </svg>
  );
};

/** Converts a date preset to a human-readable avg label for sparkline gold lines */
export const getSparklineAvgLabel = (preset?: string): string => {
  if (!preset) return "avg";
  switch (preset) {
    case 'today': {
      const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date());
      return `avg ${dayName}`;
    }
    case 'yesterday': {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(yesterday);
      return `avg ${dayName}`;
    }
    case 'week':
    case 'lastWeek':
      return "avg weekly";
    case 'month':
    case 'lastMonth':
      return "avg monthly";
    case 'preseason':
    case 'ytd':
      return "avg";
    default:
      return "avg";
  }
};
