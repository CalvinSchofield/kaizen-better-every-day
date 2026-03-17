import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { motion } from "framer-motion";
import { parseDateAsLocal, formatBlitzDate } from "@/utils/blitzDateUtils";
import { EditSummerDatesDrawer } from "@/components/mygroup/EditSummerDatesDrawer";

const GLOBAL_SUMMER_START = '2026-04-12';

interface SummerCountdownHeroProps {
  personalSummerStart: string | null;
  personalSummerEnd: string | null;
  userId: string;
  userName: string;
  pastBlitzCount?: number;
  variant?: 'blitz-hero' | 'goals-card';
}

export function SummerCountdownHero({
  personalSummerStart,
  personalSummerEnd,
  userId,
  userName,
  pastBlitzCount = 0,
  variant = 'goals-card',
}: SummerCountdownHeroProps) {
  const [editOpen, setEditOpen] = useState(false);

  const { daysUntilSummer, summerHasStarted, hasPersonalDates, effectiveSummerStart } = useMemo(() => {
    const hasPersonalDates = !!personalSummerStart;
    const effectiveSummerStart = personalSummerStart || GLOBAL_SUMMER_START;
    const summerStartDate = parseDateAsLocal(effectiveSummerStart);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntilSummer = summerStartDate
      ? Math.ceil((summerStartDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    return {
      daysUntilSummer,
      summerHasStarted: daysUntilSummer <= 0,
      hasPersonalDates,
      effectiveSummerStart,
    };
  }, [personalSummerStart]);

  // Don't render if summer already started
  if (summerHasStarted) return null;

  if (variant === 'blitz-hero') {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🌅</span>
            <h1 className="text-3xl font-bold text-primary-foreground tracking-tight">
              {hasPersonalDates ? 'Your Summer Starts Soon' : 'Summer Starts Soon'}
            </h1>
          </div>

          {daysUntilSummer > 0 && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-foreground/15 backdrop-blur-sm mb-3">
              <span className="text-sm font-semibold text-primary-foreground">
                {daysUntilSummer === 1 ? 'Tomorrow' : `${daysUntilSummer} days away`}
              </span>
            </div>
          )}

          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-2 mb-4 group"
          >
            <span className="text-sm text-primary-foreground/70">
              {formatBlitzDate(effectiveSummerStart, 'MMM d')}
              {personalSummerEnd && ` – ${formatBlitzDate(personalSummerEnd, 'MMM d')}`}
            </span>
            <Pencil className="w-3.5 h-3.5 text-primary-foreground/40 group-hover:text-primary-foreground/70 transition-colors" />
          </button>

          {pastBlitzCount > 0 && (
            <div className="px-4 py-3 rounded-xl bg-primary-foreground/10 border border-primary-foreground/10">
              <p className="text-xs font-medium text-primary-foreground/60 uppercase tracking-wider mb-2">Preseason Recap</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-primary-foreground">{pastBlitzCount}</span>
                <span className="text-sm text-primary-foreground/80">
                  {pastBlitzCount === 1 ? 'blitz attended' : 'blitzes attended'}
                </span>
              </div>
            </div>
          )}
        </motion.div>

        <EditSummerDatesDrawer
          open={editOpen}
          onOpenChange={setEditOpen}
          person={{
            userId,
            name: userName,
            personalSummerStart: personalSummerStart || null,
            personalSummerEnd: personalSummerEnd || null,
          }}
        />
      </>
    );
  }

  // Goals card variant
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-4 mt-2 mb-4 p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌅</span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {hasPersonalDates ? 'Your Summer Starts Soon' : 'Summer Starts Soon'}
              </p>
              <p className="text-xs text-muted-foreground">
                {daysUntilSummer === 1 ? 'Tomorrow' : `${daysUntilSummer} days away`}
                {' · '}
                {formatBlitzDate(effectiveSummerStart, 'MMM d')}
                {personalSummerEnd && ` – ${formatBlitzDate(personalSummerEnd, 'MMM d')}`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setEditOpen(true)}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <Pencil className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </motion.div>

      <EditSummerDatesDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        person={{
          userId,
          name: userName,
          personalSummerStart: personalSummerStart || null,
          personalSummerEnd: personalSummerEnd || null,
        }}
      />
    </>
  );
}
