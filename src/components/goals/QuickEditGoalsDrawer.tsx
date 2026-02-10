import { useState, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Target, Zap, Trophy, Lock, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { hapticLight, hapticSuccess } from '@/utils/haptics';

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
    label: 'Preseason',
    icon: Target,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    description: 'Before summer starts',
  },
  {
    key: 'must_do_fp_goal' as const,
    label: 'Must Do',
    icon: Target,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    description: 'Cover expenses minimum',
  },
  {
    key: 'will_do_fp_goal' as const,
    label: 'Will Do',
    icon: Zap,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    description: 'Committed target',
  },
  {
    key: 'could_do_fp_goal' as const,
    label: 'Could Do',
    icon: Trophy,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    description: 'Stretch goal',
  },
];

export const QuickEditGoalsDrawer = ({
  open,
  onOpenChange,
  currentGoals,
  isUserSummerStarted,
  efpModeEnabled,
  conversionFactor,
  onSave,
}: QuickEditGoalsDrawerProps) => {
  const [values, setValues] = useState(currentGoals);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const metricLabel = efpModeEnabled ? 'EFP' : 'FP';

  // Sync when opened
  useEffect(() => {
    if (open) {
      setValues(currentGoals);
      setSaved(false);
    }
  }, [open, currentGoals]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(values);
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

  const hasChanges =
    values.preseason_fp_goal !== currentGoals.preseason_fp_goal ||
    values.must_do_fp_goal !== currentGoals.must_do_fp_goal ||
    values.will_do_fp_goal !== currentGoals.will_do_fp_goal ||
    values.could_do_fp_goal !== currentGoals.could_do_fp_goal;

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
        </div>
      </DrawerContent>
    </Drawer>
  );
};
