import { useState, useEffect } from "react";
import { X, Smartphone, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

const NATIVE_APP_URL = "https://testflight.apple.com/join/MGGUFyE7";
const PROMO_DISMISSED_KEY = "native-app-promo-dismissed";
const PROMO_SHOW_DELAY = 2000; // Show after 2 seconds

/**
 * Detects if user is on iOS (iPhone or iPad)
 */
const isIOS = (): boolean => {
  if (typeof navigator === "undefined") return false;
  
  const userAgent = navigator.userAgent || navigator.vendor || "";
  
  // Check for iPhone, iPad, or iPod
  if (/iPad|iPhone|iPod/.test(userAgent)) return true;
  
  // iPad on iOS 13+ reports as Mac, check for touch support
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
  
  return false;
};

/**
 * Detects if app is running as a PWA (standalone mode)
 */
const isPWA = (): boolean => {
  if (typeof window === "undefined") return false;
  
  // Check for standalone mode (PWA installed)
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const isIOSStandalone = (navigator as any).standalone === true;
  
  return isStandalone || isIOSStandalone;
};

export const NativeAppPromo = () => {
  const [showPromo, setShowPromo] = useState(false);

  useEffect(() => {
    // Only show for iOS PWA users who haven't dismissed
    if (!isIOS() || !isPWA()) return;
    
    const dismissed = localStorage.getItem(PROMO_DISMISSED_KEY);
    if (dismissed) return;

    // Show after a short delay
    const timer = setTimeout(() => {
      setShowPromo(true);
    }, PROMO_SHOW_DELAY);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setShowPromo(false);
    // Remember dismissal for 7 days
    localStorage.setItem(PROMO_DISMISSED_KEY, Date.now().toString());
  };

  const handleDownload = () => {
    window.open(NATIVE_APP_URL, "_blank", "noopener,noreferrer");
    handleDismiss();
  };

  return (
    <AnimatePresence>
      {showPromo && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-4 left-4 right-4 z-50"
        >
          <div className="bg-card border-2 border-primary/20 rounded-2xl shadow-xl p-4 relative">
            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Smartphone className="h-6 w-6 text-primary" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pr-6">
                <h3 className="font-semibold text-foreground mb-1">
                  Get the Full Experience
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Download the Kaizen app for faster performance, push notifications, and a smoother experience.
                </p>

                <Button
                  onClick={handleDownload}
                  className="w-full sm:w-auto"
                  size="sm"
                >
                  Download Now
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
