import { useState, useEffect } from 'react';
import { ArrowLeft, Sparkles, Zap, TrendingUp, Users, Trophy, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

const TEASER_QUESTIONS = [
  { icon: Trophy, text: "Which one of my rookies are trending to make the Dream Team?" },
  { icon: Target, text: "Based off of our office's sales data, what's our best way to tackle the Viper to be competitive in our bracket?" },
  { icon: TrendingUp, text: "Who's off pace for their goal and what should I say in our 1-on-1?" },
  { icon: Users, text: "Which rep has the most untapped potential based on their funnel?" },
  { icon: Zap, text: "What time of day is my team closing the most deals?" },
  { icon: Trophy, text: "How does my group stack up against last month at this point?" },
];

interface LeaderAICoachComingSoonProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LeaderAICoachComingSoon = ({ isOpen, onClose }: LeaderAICoachComingSoonProps) => {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % TEASER_QUESTIONS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) setActiveIndex(0);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-background flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-background">
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 -ml-2">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="p-1.5 rounded-lg bg-primary/10 shrink-0">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-lg font-semibold truncate">Team AI Coach</h1>
          <Badge className="bg-primary/15 text-primary border-primary/20 text-[10px] font-bold uppercase tracking-wider">
            Coming Soon
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-6 py-8">
        {/* Animated sparkle icon */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="relative mb-6"
        >
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-primary" />
          </div>
          {/* Floating dots */}
          <motion.div
            animate={{ y: [-4, 4, -4], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary/40"
          />
          <motion.div
            animate={{ y: [3, -3, 3], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
            className="absolute -bottom-1 -left-2 w-2 h-2 rounded-full bg-primary/30"
          />
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-2"
        >
          <h2 className="text-2xl font-bold text-foreground">
            Your AI-Powered
            <br />
            <span className="text-primary">Team Coach</span>
          </h2>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="text-sm text-muted-foreground text-center max-w-[280px] mb-10 leading-relaxed"
        >
          Ask anything about your team's performance. Data-driven coaching insights are on the way.
        </motion.p>

        {/* Animated questions carousel */}
        <div className="w-full max-w-sm space-y-3">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 text-center mb-4"
          >
            You'll be able to ask things like…
          </motion.p>

          <div className="relative h-[180px] overflow-hidden">
            <AnimatePresence mode="wait">
              {TEASER_QUESTIONS.map((q, i) => {
                if (i !== activeIndex) return null;
                const Icon = q.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.98 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-0 flex items-start justify-center"
                  >
                    <div className="w-full p-4 rounded-2xl border border-primary/20 bg-primary/[0.04] backdrop-blur-sm">
                      <div className="flex gap-3">
                        <div className="shrink-0 mt-0.5 p-2 rounded-xl bg-primary/10">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <p className="text-sm text-foreground leading-relaxed font-medium">
                          "{q.text}"
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-1.5 pt-2">
            {TEASER_QUESTIONS.map((_, i) => (
              <motion.div
                key={i}
                className="h-1.5 rounded-full bg-primary/20"
                animate={{
                  width: i === activeIndex ? 20 : 6,
                  backgroundColor: i === activeIndex
                    ? 'hsl(var(--primary))'
                    : 'hsl(var(--primary) / 0.2)',
                }}
                transition={{ duration: 0.3 }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom teaser */}
      <div className="border-t border-border/50 bg-background px-6 py-5">
        <div className="max-w-sm mx-auto flex items-center gap-3 p-3 rounded-2xl bg-muted/50 border border-border/50">
          <div className="flex-1 text-sm text-muted-foreground/60 select-none">
            Ask about your team's numbers…
          </div>
          <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-primary/40" />
          </div>
        </div>
      </div>
    </div>
  );
};
