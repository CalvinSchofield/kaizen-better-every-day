import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { hapticSuccess, hapticHeavy } from '@/utils/haptics';
import { RARITY_COLORS } from '@/utils/badgeDefinitions';
import { Button } from '@/components/ui/button';

export interface BadgeCelebration {
  id: string;
  emoji: string;
  name: string;
  description?: string;
  rarity: string;
}

// Global event bus
type CelebrationListener = (badge: BadgeCelebration) => void;
const listeners = new Set<CelebrationListener>();

export function emitBadgeCelebration(badge: BadgeCelebration) {
  listeners.forEach(fn => fn(badge));
}

const AUTO_DISMISS_MS = 8000;
const QUEUE_GAP_MS = 400;

const RARITY_CONFETTI_COLORS: Record<string, string[]> = {
  legendary: ['#FFD700', '#FFA500', '#FF8C00', '#DAA520', '#FFFACD'],
  epic: ['#9B59B6', '#8E44AD', '#D8A0FF', '#C084FC', '#E9D5FF'],
  rare: ['#3B82F6', '#60A5FA', '#93C5FD', '#2563EB', '#BFDBFE'],
  common: ['#FF6B35', '#FFB347', '#FFD700', '#32CD32', '#1E90FF'],
};

const RARITY_GLOW: Record<string, string> = {
  legendary: 'shadow-[0_0_60px_rgba(255,215,0,0.5),0_0_120px_rgba(255,165,0,0.2)]',
  epic: 'shadow-[0_0_60px_rgba(155,89,182,0.5),0_0_120px_rgba(142,68,173,0.2)]',
  rare: 'shadow-[0_0_60px_rgba(59,130,246,0.4),0_0_120px_rgba(37,99,235,0.15)]',
  common: 'shadow-[0_0_40px_rgba(255,255,255,0.1)]',
};

const RARITY_RING: Record<string, string> = {
  legendary: 'ring-amber-400/80',
  epic: 'ring-purple-400/70',
  rare: 'ring-blue-400/60',
  common: 'ring-border',
};

const RARITY_LABELS: Record<string, { text: string; color: string }> = {
  legendary: { text: 'LEGENDARY', color: 'text-amber-400' },
  epic: { text: 'EPIC', color: 'text-purple-400' },
  rare: { text: 'RARE', color: 'text-blue-400' },
  common: { text: 'ACHIEVEMENT', color: 'text-muted-foreground' },
};

function fireCelebrationConfetti(rarity: string) {
  const colors = RARITY_CONFETTI_COLORS[rarity] || RARITY_CONFETTI_COLORS.common;

  // Main burst
  confetti({
    particleCount: rarity === 'legendary' ? 150 : rarity === 'epic' ? 120 : 80,
    spread: 100,
    origin: { y: 0.45 },
    colors,
    zIndex: 10001,
    gravity: 0.8,
    scalar: 1.2,
  });

  // Side bursts for legendary/epic
  if (rarity === 'legendary' || rarity === 'epic') {
    setTimeout(() => {
      confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors, zIndex: 10001 });
      confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors, zIndex: 10001 });
    }, 300);
  }
}

export function BadgeCelebrationOverlay() {
  const [queue, setQueue] = useState<BadgeCelebration[]>([]);
  const [current, setCurrent] = useState<BadgeCelebration | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const processingRef = useRef(false);

  // Listen for celebration events
  useEffect(() => {
    const handler: CelebrationListener = (badge) => {
      setQueue(prev => [...prev, badge]);
    };
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  // Process queue
  useEffect(() => {
    if (processingRef.current || queue.length === 0) return;
    if (current) return; // wait for current to finish

    processingRef.current = true;
    const next = queue[0];
    setQueue(prev => prev.slice(1));

    // Brief gap between badges
    const delay = processingRef.current ? QUEUE_GAP_MS : 0;
    setTimeout(() => {
      setCurrent(next);
      setVisible(true);
      processingRef.current = false;

      // Fire confetti + haptics after emblem animates in
      setTimeout(() => {
        fireCelebrationConfetti(next.rarity);
        if (next.rarity === 'legendary' || next.rarity === 'epic') {
          hapticHeavy();
        } else {
          hapticSuccess();
        }
      }, 400);

      // Auto-dismiss
      timerRef.current = setTimeout(() => dismiss(), AUTO_DISMISS_MS);
    }, delay);
  }, [queue, current]);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
    setTimeout(() => {
      setCurrent(null);
    }, 250);
  }, []);

  const rarity = current?.rarity || 'common';
  const rarityLabel = RARITY_LABELS[rarity] || RARITY_LABELS.common;

  return (
    <AnimatePresence>
      {visible && current && (
        <motion.div
          key={current.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={dismiss}
          className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl px-6"
          style={{ touchAction: 'none' }}
        >
          {/* Rarity label */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.3 }}
          >
            <span className={`text-xs font-bold tracking-[0.25em] ${rarityLabel.color}`}>
              {rarityLabel.text}
            </span>
          </motion.div>

          {/* Badge emblem */}
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: 'spring',
              stiffness: 200,
              damping: 15,
              mass: 0.8,
            }}
            className={`mt-6 flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-b from-white/10 to-white/5 ring-4 ${RARITY_RING[rarity] || RARITY_RING.common} ${RARITY_GLOW[rarity] || RARITY_GLOW.common}`}
          >
            <span className="text-7xl select-none" role="img">
              {current.emoji}
            </span>
          </motion.div>

          {/* Badge name */}
          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.35 }}
            className="mt-8 text-2xl font-bold text-white text-center max-w-xs"
          >
            {current.name}
          </motion.h2>

          {/* Description */}
          {current.description && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.3 }}
              className="mt-3 text-sm text-white/60 text-center max-w-xs leading-relaxed"
            >
              {current.description}
            </motion.p>
          )}

          {/* Continue button */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.3 }}
            className="mt-10"
          >
            <Button
              variant="outline"
              onClick={(e) => { e.stopPropagation(); dismiss(); }}
              className="rounded-full px-10 py-2.5 border-white/20 text-white bg-white/10 hover:bg-white/20 text-sm font-medium"
            >
              Continue
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
