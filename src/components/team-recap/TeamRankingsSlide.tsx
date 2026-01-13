import { motion } from 'framer-motion';
import { Users, TrendingUp, TrendingDown, Trophy, Pencil } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/utils/nameUtils';

interface TeamRanking {
  teamName: string;
  leadName: string;
  leadPhoto?: string;
  fp: number;
  efp: number;
  growth: number;
  isRecord?: boolean;
}

interface TeamRankingsSlideProps {
  title: string;
  rankings: TeamRanking[];
  slideKey?: string;
  onEditValue?: (field: string, label: string, currentValue: number) => void;
}


function GrowthBadge({ value }: { value: number }) {
  if (value === 0) return null;
  
  const isPositive = value > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const colorClass = isPositive ? 'text-green-500' : 'text-red-500';
  
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${colorClass}`}>
      <Icon className="w-3 h-3" />
      {isPositive ? '+' : ''}{value.toFixed(0)}%
    </span>
  );
}

export function TeamRankingsSlide({ title, rankings, slideKey = '', onEditValue }: TeamRankingsSlideProps) {
  const maxFp = Math.max(...rankings.map(t => t.efp), 1);

  const handleEditFp = (team: TeamRanking, idx: number) => {
    if (onEditValue) {
      onEditValue(`${slideKey}.rankings.${idx}.fp`, `${team.teamName} FP+`, team.fp);
    }
  };

  const handleEditEfp = (team: TeamRanking, idx: number) => {
    if (onEditValue) {
      onEditValue(`${slideKey}.rankings.${idx}.efp`, `${team.teamName} EFP`, team.efp);
    }
  };

  return (
    <div className="h-full flex flex-col px-4 pt-2 overflow-y-auto pb-8">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-center gap-2 mb-4"
      >
        <Users className="w-6 h-6 text-primary" />
        <h2 className="text-xl font-bold text-primary">{title}</h2>
      </motion.div>

      {/* Rankings */}
      <div className="space-y-3">
        {rankings.map((team, idx) => {
          const barWidth = (team.efp / maxFp) * 100;
          const fpBarWidth = (team.fp / maxFp) * 100;

          return (
            <motion.div
              key={team.teamName}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 * idx }}
              className="bg-card/50 rounded-xl p-3"
            >
              {/* Team info header */}
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  idx === 0 ? 'bg-yellow-500/20' : 'bg-muted'
                }`}>
                  {idx === 0 ? (
                    <Trophy className="w-5 h-5 text-yellow-500" />
                  ) : (
                    <span className="text-sm font-bold text-muted-foreground">{idx + 1}</span>
                  )}
                </div>
                <Avatar className="w-8 h-8 border border-border">
                  <AvatarImage src={team.leadPhoto} alt={team.leadName} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {getInitials(team.leadName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{team.teamName}</p>
                  <p className="text-xs text-muted-foreground truncate">{team.leadName}</p>
                </div>
                <div className="text-right">
                  <GrowthBadge value={team.growth} />
                  {team.isRecord && (
                    <p className="text-xs text-yellow-500 font-medium">🏆 RECORD</p>
                  )}
                </div>
              </div>

              {/* Horizontal bar */}
              <div className="relative h-8 bg-muted rounded-lg overflow-hidden">
                {/* EFP bar (lighter, full width) */}
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidth}%` }}
                  transition={{ duration: 0.5, delay: 0.2 + 0.1 * idx }}
                  className="absolute inset-y-0 left-0 bg-primary/40 rounded-lg"
                />
                {/* FP+ bar (solid, partial) */}
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${fpBarWidth}%` }}
                  transition={{ duration: 0.5, delay: 0.3 + 0.1 * idx }}
                  className="absolute inset-y-0 left-0 bg-primary rounded-lg"
                />
                {/* Values - tappable for editing */}
                <div className="absolute inset-0 flex items-center justify-between px-3">
                  <button
                    onClick={() => handleEditFp(team, idx)}
                    className={`text-xs font-bold text-primary-foreground drop-shadow flex items-center gap-0.5 ${onEditValue ? 'hover:underline' : ''}`}
                    disabled={!onEditValue}
                  >
                    {team.fp.toFixed(1)} FP+
                    {onEditValue && <Pencil className="w-2.5 h-2.5 opacity-60" />}
                  </button>
                  <button
                    onClick={() => handleEditEfp(team, idx)}
                    className={`text-xs font-medium text-foreground flex items-center gap-0.5 ${onEditValue ? 'hover:underline' : ''}`}
                    disabled={!onEditValue}
                  >
                    {team.efp.toFixed(1)} EFP
                    {onEditValue && <Pencil className="w-2.5 h-2.5 opacity-60" />}
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {rankings.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">No team data for this period</p>
        </div>
      )}
    </div>
  );
}
