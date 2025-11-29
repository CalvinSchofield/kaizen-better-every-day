import { Card, CardContent } from "@/components/ui/card";
import { useInsightsData } from "@/hooks/useInsightsData";
import { Loader2 } from "lucide-react";

interface QuickStatsBarProps {
  repData: any;
}

export const QuickStatsBar = ({ repData }: QuickStatsBarProps) => {
  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 1);
  
  const { data, isLoading } = useInsightsData({
    start: startOfYear,
    end: today,
  });

  if (isLoading || !data) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const stats = [
    {
      label: "Doors/FP+",
      value: data.doorsToFp > 0 ? data.doorsToFp.toFixed(0) : "-",
    },
    {
      label: "Pitch/Close",
      value: data.pitchesToFp > 0 ? `${data.pitchesToFp.toFixed(1)}:1` : "-",
    },
    {
      label: "Avg Hours/Day",
      value: data.avgHoursWorked > 0 ? data.avgHoursWorked.toFixed(1) : "-",
    },
  ];

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
      {stats.map((stat, index) => (
        <Card key={index} className="flex-shrink-0 min-w-[140px]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
