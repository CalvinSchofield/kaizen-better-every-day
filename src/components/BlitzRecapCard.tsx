import { MapPin, CalendarDays, Footprints, Flame, DollarSign, ChevronRight } from "lucide-react";
import { formatBlitzDateRange } from "@/utils/blitzDateUtils";
import { formatFP, formatPRMR } from "@/lib/formatters";
import type { BlitzRecapStat } from "@/hooks/useBlitzRecapStats";

interface BlitzRecapCardProps {
  recap: BlitzRecapStat;
  attended?: boolean;
  onOpenDetails?: () => void;
}

export function BlitzRecapCard({ recap, attended = true, onOpenDetails }: BlitzRecapCardProps) {
  const hasStats = recap.daysWorked > 0 || recap.doors > 0 || recap.fpPlus > 0;

  return (
    <button
      onClick={onOpenDetails}
      disabled={!onOpenDetails}
      className="w-full text-left rounded-xl border border-primary/20 bg-primary/5 border-l-4 border-l-primary p-4 transition-colors hover:bg-primary/8 active:bg-primary/10 disabled:hover:bg-primary/5"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground truncate">
            {recap.name}
          </h3>
          {recap.location && (
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground truncate">
                {recap.location}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatBlitzDateRange(recap.startDate, recap.endDate)}
          </span>
          {onOpenDetails && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Stats */}
      {hasStats ? (
        <div className="grid grid-cols-4 gap-2 mt-3">
          <StatPill icon={<CalendarDays className="w-3.5 h-3.5" />} value={`${recap.daysWorked}`} label="Days" />
          <StatPill icon={<Footprints className="w-3.5 h-3.5" />} value={`${recap.doors}`} label="Doors" />
          <StatPill icon={<Flame className="w-3.5 h-3.5" />} value={formatFP(recap.fpPlus)} label="FP+" />
          <StatPill icon={<DollarSign className="w-3.5 h-3.5" />} value={formatPRMR(recap.prmr)} label="PRMR" />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mt-2 italic">No tracked stats for this blitz</p>
      )}
    </button>
  );
}

function StatPill({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg bg-primary/10">
      <div className="text-primary">{icon}</div>
      <span className="text-sm font-bold text-foreground">{value}</span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}
