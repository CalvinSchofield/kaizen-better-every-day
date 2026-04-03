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
  /** Color of the sparkline stroke */
  color?: string;
}

export const MicroSparkline = ({
  data,
  width = 60,
  height = 20,
  className,
  goldLine,
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
