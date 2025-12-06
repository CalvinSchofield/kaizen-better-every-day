import { TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface InsightsSummaryHeroProps {
  totalFp: number;
  totalEfp: number;
  totalPrmr: number;
  daysWorked: number;
  totalDoors: number;
  totalCloses: number;
  efpModeEnabled: boolean;
}

export const InsightsSummaryHero = ({
  totalFp,
  totalEfp,
  totalPrmr,
  daysWorked,
  totalDoors,
  totalCloses,
  efpModeEnabled
}: InsightsSummaryHeroProps) => {
  const fpPerDay = daysWorked > 0 ? (efpModeEnabled ? totalEfp : totalFp) / daysWorked : 0;
  
  return (
    <Card className="p-5 bg-gradient-to-br from-card to-accent/30 border-border/50">
      {/* Primary metrics row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-3xl font-bold text-primary">
            {efpModeEnabled ? totalEfp.toFixed(2) : totalFp.toFixed(1)}
          </div>
          <div className="text-sm text-muted-foreground">
            Total {efpModeEnabled ? 'EFP' : 'FP+'}
          </div>
        </div>
        <div className="text-right">
          {efpModeEnabled ? (
            <>
              <div className="text-2xl font-bold text-foreground">
                {totalFp.toFixed(1)}
              </div>
              <div className="text-sm text-muted-foreground">Total FP+</div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-foreground">
                ${totalPrmr.toFixed(0)}
              </div>
              <div className="text-sm text-muted-foreground">Total PRMR</div>
            </>
          )}
        </div>
      </div>

      {/* Secondary metrics row */}
      <div className="grid grid-cols-4 gap-3 pt-4 border-t border-border/50">
        <div className="text-center">
          <div className="text-lg font-semibold">{daysWorked}</div>
          <div className="text-xs text-muted-foreground">Days</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold">{totalDoors}</div>
          <div className="text-xs text-muted-foreground">Doors</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold">{totalCloses}</div>
          <div className="text-xs text-muted-foreground">Closes</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold flex items-center justify-center gap-1">
            <TrendingUp className="w-3 h-3 text-success" />
            {fpPerDay.toFixed(2)}
          </div>
          <div className="text-xs text-muted-foreground">/Day</div>
        </div>
      </div>
    </Card>
  );
};
