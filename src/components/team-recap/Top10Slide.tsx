import { motion } from 'framer-motion';
import { Trophy, Crown, Medal, Award, Pencil } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/utils/nameUtils';

interface Rep {
  userId: string;
  name: string;
  profilePhotoUrl?: string;
  fp: number;
  efp: number;
  isRecord?: boolean;
}

interface Top10SlideProps {
  title: string;
  reps: Rep[];
  accentColor?: string;
  slideKey?: string;
  onEditValue?: (field: string, label: string, currentValue: number) => void;
}


function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
        <Crown className="w-5 h-5 text-yellow-500" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="w-8 h-8 rounded-full bg-gray-400/20 flex items-center justify-center">
        <Medal className="w-5 h-5 text-gray-400" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="w-8 h-8 rounded-full bg-amber-600/20 flex items-center justify-center">
        <Award className="w-5 h-5 text-amber-600" />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
      <span className="text-sm font-bold text-muted-foreground">{rank}</span>
    </div>
  );
}

export function Top10Slide({ title, reps, accentColor = 'text-primary', slideKey = '', onEditValue }: Top10SlideProps) {
  const maxFp = Math.max(...reps.map(r => r.fp), 1);
  const maxEfp = Math.max(...reps.map(r => r.efp), 1);

  const handleEditFp = (rep: Rep, idx: number) => {
    if (onEditValue) {
      onEditValue(`${slideKey}.reps.${idx}.fp`, `${rep.name} FP+`, rep.fp);
    }
  };

  const handleEditEfp = (rep: Rep, idx: number) => {
    if (onEditValue) {
      onEditValue(`${slideKey}.reps.${idx}.efp`, `${rep.name} EFP`, rep.efp);
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
        <Trophy className={`w-6 h-6 ${accentColor}`} />
        <h2 className={`text-xl font-bold ${accentColor}`}>{title}</h2>
      </motion.div>

      {/* Rankings list */}
      <div className="space-y-2">
        {reps.map((rep, idx) => {
          const fpBarWidth = (rep.fp / maxEfp) * 100;
          const efpBarWidth = (rep.efp / maxEfp) * 100;
          const efpDelta = rep.efp - rep.fp;

          return (
            <motion.div
              key={rep.userId}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 * idx }}
              className="bg-card/50 rounded-xl p-3"
            >
              <div className="flex items-center gap-3 mb-2">
                <RankBadge rank={idx + 1} />
                <Avatar className="w-10 h-10 border-2 border-border">
                  <AvatarImage src={rep.profilePhotoUrl} alt={rep.name} />
                  <AvatarFallback className="text-sm bg-primary/10 text-primary">
                    {getInitials(rep.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{rep.name}</p>
                  {rep.isRecord && (
                    <span className="text-xs text-yellow-500 font-medium">🏆 NEW RECORD</span>
                  )}
                </div>
              </div>

              {/* Stacked bar chart */}
              <div className="relative h-6 bg-muted rounded-full overflow-hidden">
                {/* FP+ bar (solid) */}
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${fpBarWidth}%` }}
                  transition={{ duration: 0.5, delay: 0.2 + 0.1 * idx }}
                  className="absolute inset-y-0 left-0 bg-primary rounded-full"
                />
                {/* EFP delta (lighter, extends beyond FP+) */}
                {efpDelta > 0 && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${efpBarWidth}%` }}
                    transition={{ duration: 0.5, delay: 0.3 + 0.1 * idx }}
                    className="absolute inset-y-0 left-0 bg-primary/40 rounded-full"
                  />
                )}
                {/* Values on bar - tappable for editing */}
                <div className="absolute inset-0 flex items-center justify-end pr-3 gap-1">
                  <button
                    onClick={() => handleEditFp(rep, idx)}
                    className={`text-xs font-bold text-primary-foreground drop-shadow flex items-center gap-0.5 ${onEditValue ? 'hover:underline' : ''}`}
                    disabled={!onEditValue}
                  >
                    {rep.fp.toFixed(1)} FP+
                    {onEditValue && <Pencil className="w-2.5 h-2.5 opacity-60" />}
                  </button>
                  <span className="text-xs font-bold text-primary-foreground drop-shadow">/</span>
                  <button
                    onClick={() => handleEditEfp(rep, idx)}
                    className={`text-xs font-bold text-primary-foreground drop-shadow flex items-center gap-0.5 ${onEditValue ? 'hover:underline' : ''}`}
                    disabled={!onEditValue}
                  >
                    {rep.efp.toFixed(1)} EFP
                    {onEditValue && <Pencil className="w-2.5 h-2.5 opacity-60" />}
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {reps.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">No data for this period</p>
        </div>
      )}
    </div>
  );
}
