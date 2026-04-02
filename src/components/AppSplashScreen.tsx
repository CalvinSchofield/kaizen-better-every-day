import { motion } from "framer-motion";

interface AppSplashScreenProps {
  message?: string;
}

/**
 * Branded splash screen shown during app cold start and auth verification.
 * Uses a subtle scale + fade animation for a polished native-app feel.
 */
export const AppSplashScreen = ({ message = "Loading…" }: AppSplashScreenProps) => {
  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-50">
      {/* App icon with entrance animation */}
      <motion.img
        src="/icon-192.png"
        alt="Kaizen"
        className="w-16 h-16 rounded-2xl mb-6"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      />

      {/* Animated progress bar */}
      <motion.div
        className="w-28 h-1 rounded-full bg-muted overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.3 }}
      >
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{
            duration: 2.5,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "reverse",
          }}
        />
      </motion.div>

      {/* Status text */}
      <motion.p
        className="text-sm text-muted-foreground mt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.3 }}
      >
        {message}
      </motion.p>
    </div>
  );
};
