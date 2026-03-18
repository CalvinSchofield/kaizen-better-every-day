import { cn } from "@/lib/utils";
import { Trophy, DollarSign, Footprints, Target } from "lucide-react";
import { motion } from "framer-motion";
import { RepWithEffort } from "@/hooks/useReportsV2Data";

interface TopPerformersProps {
  reps: RepWithEffort[];
  isLoading?: boolean;
  onRepClick?: (userId: string) => void;
}

const getFirstName = (name: string) => {
  const stripped = name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim();
  return stripped.split(' ')[0] || stripped;
};

interface LeaderCardProps {
  icon: React.ReactNode;
  title: string;
  bgColor: string;
  entries: { name: string; value: string; userId: string }[];
  onRepClick?: (userId: string) => void;
  delay: number;
}

const LeaderCard = ({ icon, title, bgColor, entries, onRepClick, delay }: LeaderCardProps) => {
  if (entries.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: delay * 0.08, duration: 0.3 }}
      className={cn(
        "flex-shrink-0 w-40 rounded-xl border border-border/50 overflow-hidden",
        "bg-card"
      )}
    >
      <div className={cn("px-3 py-2 flex items-center gap-1.5", bgColor)}>
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{title}</span>
      </div>
      <div className="p-2.5 space-y-2">
        {entries.map((entry, i) => (
          <button
            key={entry.userId}
            onClick={() => onRepClick?.(entry.userId)}
            className="w-full flex items-center justify-between text-left hover:bg-muted/30 rounded-md px-1.5 py-1 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <span className={cn(
                "text-[10px] font-bold w-4 text-center",
                i === 0 ? "text-primary" : "text-muted-foreground"
              )}>
                {i + 1}
              </span>
              <span className="text-xs font-medium truncate max-w-[70px]">
                {getFirstName(entry.name)}
              </span>
            </div>
            <span className={cn(
              "text-xs font-bold",
              i === 0 ? "text-primary" : "text-foreground"
            )}>
              {entry.value}
            </span>
          </button>
        ))}
      </div>
    </motion.div>
  );
};

export const TopPerformers = ({ reps, isLoading, onRepClick }: TopPerformersProps) => {
  if (isLoading || reps.length === 0) return null;

  // Sort reps into categories
  const byFP = [...reps].filter(r => r.fp > 0).sort((a, b) => b.fp - a.fp).slice(0, 3);
  const byPRMR = [...reps].filter(r => r.prmr > 0).sort((a, b) => b.prmr - a.prmr).slice(0, 3);
  const byDoors = [...reps].filter(r => r.doors > 0).sort((a, b) => b.doors - a.doors).slice(0, 3);
  
  // Best conversion: pitch → close (need at least 3 pitches)
  const byConversion = [...reps]
    .filter(r => r.pitches >= 3 && r.closes > 0)
    .map(r => ({ ...r, convRate: r.closes / r.pitches }))
    .sort((a, b) => b.convRate - a.convRate)
    .slice(0, 3);

  const hasData = byFP.length > 0 || byDoors.length > 0;
  if (!hasData) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground px-1">Top Performers</h3>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {byFP.length > 0 && (
          <LeaderCard
            icon={<Trophy className="w-3 h-3 text-amber-600" />}
            title="Most FP+"
            bgColor="bg-amber-500/10"
            entries={byFP.map(r => ({ name: r.name, value: r.fp.toFixed(1), userId: r.userId }))}
            onRepClick={onRepClick}
            delay={0}
          />
        )}
        {byPRMR.length > 0 && (
          <LeaderCard
            icon={<DollarSign className="w-3 h-3 text-green-600" />}
            title="Revenue"
            bgColor="bg-green-500/10"
            entries={byPRMR.map(r => ({ name: r.name, value: `$${r.prmr.toLocaleString()}`, userId: r.userId }))}
            onRepClick={onRepClick}
            delay={1}
          />
        )}
        {byDoors.length > 0 && (
          <LeaderCard
            icon={<Footprints className="w-3 h-3 text-blue-600" />}
            title="Hustle"
            bgColor="bg-blue-500/10"
            entries={byDoors.map(r => ({ name: r.name, value: `${r.doors}`, userId: r.userId }))}
            onRepClick={onRepClick}
            delay={2}
          />
        )}
        {byConversion.length > 0 && (
          <LeaderCard
            icon={<Target className="w-3 h-3 text-purple-600" />}
            title="Conversion"
            bgColor="bg-purple-500/10"
            entries={byConversion.map(r => ({ name: r.name, value: `${(r.convRate * 100).toFixed(0)}%`, userId: r.userId }))}
            onRepClick={onRepClick}
            delay={3}
          />
        )}
      </div>
    </div>
  );
};
