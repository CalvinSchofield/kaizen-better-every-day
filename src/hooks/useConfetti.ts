import { useCallback } from "react";
import confetti from "canvas-confetti";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

export const useConfetti = () => {
  const fireConfetti = useCallback((options?: {
    variant?: 'celebration' | 'gold' | 'subtle';
    duration?: number;
  }) => {
    const { variant = 'celebration', duration = 3000 } = options || {};
    
    // Trigger haptic feedback
    Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    
    const end = Date.now() + duration;
    
    if (variant === 'celebration') {
      // Full celebration - multiple bursts
      const colors = ['#FF6B35', '#FFB347', '#FFD700', '#32CD32', '#1E90FF', '#9B59B6'];
      
      (function frame() {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.8 },
          colors,
          zIndex: 9999,
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.8 },
          colors,
          zIndex: 9999,
        });
        
        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      })();
      
      // Extra burst at the start
      confetti({
        particleCount: 100,
        spread: 100,
        origin: { y: 0.6 },
        colors,
        zIndex: 9999,
      });
    } else if (variant === 'gold') {
      // Gold/trophy celebration for wins
      const goldColors = ['#FFD700', '#FFA500', '#FF8C00', '#DAA520', '#F4A460'];
      
      confetti({
        particleCount: 150,
        spread: 120,
        origin: { y: 0.5 },
        colors: goldColors,
        shapes: ['circle', 'square'],
        zIndex: 9999,
      });
      
      // Delayed second burst
      setTimeout(() => {
        confetti({
          particleCount: 80,
          spread: 100,
          origin: { y: 0.6, x: 0.3 },
          colors: goldColors,
          zIndex: 9999,
        });
        confetti({
          particleCount: 80,
          spread: 100,
          origin: { y: 0.6, x: 0.7 },
          colors: goldColors,
          zIndex: 9999,
        });
      }, 250);
    } else if (variant === 'subtle') {
      // Subtle celebration
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#FF6B35', '#FFB347'],
        zIndex: 9999,
      });
    }
  }, []);

  const fireWinConfetti = useCallback(() => {
    fireConfetti({ variant: 'gold', duration: 4000 });
  }, [fireConfetti]);

  return { fireConfetti, fireWinConfetti };
};
