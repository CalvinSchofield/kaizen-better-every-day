import { Card, CardContent } from "@/components/ui/card";
import { Clock, ChevronRight } from "lucide-react";
import { usePendingInstalls } from "@/hooks/usePendingInstalls";
import { useEfpMode } from "@/hooks/useEfpMode";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFP } from "@/lib/formatters";

interface PendingInstallsCardProps {
  className?: string;
}

export const PendingInstallsCard = ({ className }: PendingInstallsCardProps) => {
  const { pendingSales, isLoading } = usePendingInstalls();
  const { efpModeEnabled } = useEfpMode();
  const navigate = useNavigate();

  if (isLoading) {
    return null; // Don't show skeleton, just hide until loaded
  }

  if (pendingSales.length === 0) {
    return null;
  }

  // Calculate total pending production
  const totalPendingFP = pendingSales.reduce((sum, sale) => {
    if (efpModeEnabled) {
      return sum + (Number(sale.prmr) || 0) / 85;
    }
    if (sale.type === 'fp') return sum + 1;
    if (sale.type === 'upgrade') return sum + (Number(sale.prmr) || 0) / 85;
    return sum;
  }, 0);

  const metricLabel = efpModeEnabled ? 'EFP' : 'FP+';

  return (
    <Card
      className={`border-blue-500/30 bg-blue-500/5 cursor-pointer hover:bg-blue-500/10 transition-colors ${className}`}
      onClick={() => navigate('/customers')}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Scheduled Out — Awaiting Install
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pendingSales.length} sale{pendingSales.length !== 1 ? 's' : ''} · {formatFP(totalPendingFP)} {metricLabel} pending
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
};
