import { useState, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Check, CalendarIcon, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { hapticLight, hapticSuccess } from '@/utils/haptics';
import { GOAL_TIER_CONFIG } from '@/config/goalTiers';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface QuickEditGoalsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentGoals: {
    preseason_fp_goal: number;
    must_do_fp_goal: number;
    will_do_fp_goal: number;
    could_do_fp_goal: number;
  };
  isUserSummerStarted: boolean;
  efpModeEnabled: boolean;
  conversionFactor: number;
  personalSummerStart?: string | null;
  personalSummerEnd?: string | null;
  repId?: string;
  onSyncClick?: () => void;
  onSave: (goals: {
    preseason_fp_goal: number;
    must_do_fp_goal: number;
    will_do_fp_goal: number;
    could_do_fp_goal: number;
  }) => Promise<void>;
}

const tierConfig = [
  {
    key: 'preseason_fp_goal' as const,
    ...GOAL_TIER_CONFIG.preseason,
  },
  {
    key: 'must_do_fp_goal' as const,
    ...GOAL_TIER_CONFIG.mustDo,
  },
  {
    key: 'will_do_fp_goal' as const,
    ...GOAL_TIER_CONFIG.willDo,
  },
  {
    key: 'could_do_fp_goal' as const,
    ...GOAL_TIER_CONFIG.couldDo,
  },
];

export const QuickEditGoalsDrawer = ({
  open,
  onOpenChange,
  currentGoals,
  isUserSummerStarted,
  efpModeEnabled,
  conversionFactor,
  personalSummerStart,
  personalSummerEnd,
  repId,
  onSyncClick,
  onSave,
}: QuickEditGoalsDrawerProps) => {
  const [values, setValues] = useState(currentGoals);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [summerStart, setSummerStart] = useState<string | null>(null);
  const [summerEnd, setSummerEnd] = useState<string | null>(null);
  const [startPopoverOpen, setStartPopoverOpen] = useState(false);
  const [endPopoverOpen, setEndPopoverOpen] = useState(false);
  const queryClient = useQueryClient();

  const metricLabel = efpModeEnabled ? 'EFP' : 'FP';

  // Sync when opened
  useEffect(() => {
    if (open) {
      setValues(currentGoals);
      setSummerStart(personalSummerStart || null);
      setSummerEnd(personalSummerEnd || null);
      setSaved(false);
    }
  }, [open, currentGoals, personalSummerStart, personalSummerEnd]);

  const datesChanged =
    summerStart !== (personalSummerStart || null) ||
    summerEnd !== (personalSummerEnd || null);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(values);

      // Save summer dates if changed
      if (datesChanged) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('season_config')
            .upsert({
              user_id: user.id,
              updated_at: new Date().toISOString(),
              personal_summer_start: summerStart,
              personal_summer_end: summerEnd,
            }, { onConflict: 'user_id' });

          if (repId) {
            await supabase.functions.invoke('update-summer-dates', {
              body: {
                repId,
                startDate: summerStart,
                endDate: summerEnd,
              },
            });
          }

          queryClient.invalidateQueries({ queryKey: ['season-config-for-goals-page'] });
          queryClient.invalidateQueries({ queryKey: ['season-config'] });
          queryClient.invalidateQueries({ queryKey: ['season-config-whatif'] });
        }
      }

      hapticSuccess();
      setSaved(true);
      setTimeout(() => {
        onOpenChange(false);
      }, 600);
    } catch {
      // Error handled by parent
    } finally {
      setSaving(false);
    }
  };

  const goalsChanged =
    values.preseason_fp_goal !== currentGoals.preseason_fp_goal ||
    values.must_do_fp_goal !== currentGoals.must_do_fp_goal ||
    values.will_do_fp_goal !== currentGoals.will_do_fp_goal ||
    values.could_do_fp_goal !== currentGoals.could_do_fp_goal;

  const hasChanges = goalsChanged || datesChanged;

  // Convert displayed value when EFP mode — goals are stored in FP
  const toDisplay = (fpVal: number) =>
    efpModeEnabled ? Number((fpVal * conversionFactor).toFixed(1)) : fpVal;
  const fromDisplay = (displayVal: number) =>
    efpModeEnabled ? Number((displayVal / conversionFactor).toFixed(1)) : displayVal;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-lg font-bold">Edit Goals</DrawerTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Adjust your {metricLabel} targets directly
          </p>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-3 overflow-y-auto">
          {tierConfig.map((tier, i) => {
            const Icon = tier.icon;
            const isPreseason = tier.key === 'preseason_fp_goal';
            const isLocked = isPreseason && isUserSummerStarted;
            const displayValue = toDisplay(values[tier.key]);

            return (
              <motion.div
                key={tier.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  'relative rounded-2xl border p-4 transition-all',
                  tier.borderColor,
                  tier.bgColor,
                  isLocked && 'opacity-50'
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={cn('p-2 rounded-xl', tier.bgColor)}>
                      {isLocked ? (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Icon className={cn('h-4 w-4', tier.color)} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <Label className="text-sm font-semibold">{tier.label}</Label>
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        {isLocked ? 'Summer has started' : tier.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      value={displayValue || ''}
                      onChange={(e) => {
                        if (isLocked) return;
                        hapticLight();
                        const raw = parseFloat(e.target.value) || 0;
                        setValues((v) => ({
                          ...v,
                          [tier.key]: fromDisplay(raw),
                        }));
                      }}
                      disabled={isLocked}
                      className={cn(
                        'w-20 h-10 text-right text-base font-bold rounded-xl border-2 bg-background/60',
                        tier.borderColor,
                        isLocked && 'cursor-not-allowed'
                      )}
                    />
                    <span className="text-xs text-muted-foreground font-medium w-7">
                      {metricLabel}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* Summer Dates Section */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="pt-2"
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Summer Dates
            </p>
            <div className="space-y-2">
              {/* Start Date */}
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2 rounded-xl bg-emerald-500/10">
                      <CalendarIcon className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="min-w-0">
                      <Label className="text-sm font-semibold">Start Date</Label>
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        When summer begins
                      </p>
                    </div>
                  </div>
                  <Popover open={startPopoverOpen} onOpenChange={setStartPopoverOpen}>
                    <PopoverTrigger asChild>
                      <button
                        className="text-sm font-semibold text-foreground bg-background/60 border-2 border-border rounded-xl px-3 py-2 active:scale-[0.97] transition-transform"
                        onClick={() => hapticLight()}
                      >
                        {summerStart ? format(parseLocalDate(summerStart), 'MMM d') : 'Set'}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={summerStart ? parseLocalDate(summerStart) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            setSummerStart(format(date, 'yyyy-MM-dd'));
                            setStartPopoverOpen(false);
                          }
                        }}
                        defaultMonth={summerStart ? parseLocalDate(summerStart) : new Date(2026, 3)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* End Date */}
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2 rounded-xl bg-amber-500/10">
                      <CalendarIcon className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="min-w-0">
                      <Label className="text-sm font-semibold">End Date</Label>
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        When summer ends
                      </p>
                    </div>
                  </div>
                  <Popover open={endPopoverOpen} onOpenChange={setEndPopoverOpen}>
                    <PopoverTrigger asChild>
                      <button
                        className="text-sm font-semibold text-foreground bg-background/60 border-2 border-border rounded-xl px-3 py-2 active:scale-[0.97] transition-transform"
                        onClick={() => hapticLight()}
                      >
                        {summerEnd ? format(parseLocalDate(summerEnd), 'MMM d') : 'Set'}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={summerEnd ? parseLocalDate(summerEnd) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            setSummerEnd(format(date, 'yyyy-MM-dd'));
                            setEndPopoverOpen(false);
                          }
                        }}
                        defaultMonth={summerEnd ? parseLocalDate(summerEnd) : new Date(2026, 8)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </motion.div>

          <AnimatePresence>
            {hasChanges && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <Button
                  onClick={handleSave}
                  disabled={saving || saved}
                  className="w-full h-12 rounded-2xl text-base font-semibold mt-2"
                  variant={saved ? 'success' : 'default'}
                >
                  {saved ? (
                    <>
                      <Check className="h-5 w-5 mr-1" />
                      Saved
                    </>
                  ) : saving ? (
                    'Saving…'
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sync numbers link */}
          {onSyncClick && (
            <button
              onClick={() => {
                onOpenChange(false);
                setTimeout(onSyncClick, 300);
              }}
              className="w-full mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors active:scale-95"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Sync numbers with Vivint
            </button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
