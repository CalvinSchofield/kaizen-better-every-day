import { useState, useEffect } from "react";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "react-router-dom";

const InstallPrompt = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const isMobile = useIsMobile();
  const location = useLocation();

  useEffect(() => {
    // Don't show on auth page
    if (location.pathname === "/auth") {
      setShowBanner(false);
      return;
    }

    // Check if running as PWA
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                  (window.navigator as any).standalone === true;

    if (isPWA) {
      return; // Don't show anything if already installed
    }

    // Show banner on mobile browsers (not PWA)
    if (isMobile) {
      setShowBanner(true);
    }
  }, [isMobile, location.pathname]);

  const handleDismissBanner = () => {
    setShowBanner(false);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
  };

  const handleOpenDialog = () => {
    setShowDialog(true);
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Install Banner */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-lg border-b-2 border-orange-400">
        <div className="flex items-center justify-between p-3 max-w-lg mx-auto">
          <div className="flex items-center gap-3 flex-1">
            <Download className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">
              Install Kaizen for the best experience
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleOpenDialog}
              className="text-xs bg-white text-orange-600 hover:bg-white/90 font-semibold"
            >
              Install
            </Button>
            <button
              onClick={handleDismissBanner}
              className="p-1 hover:bg-white/20 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Install Instructions Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Install Kaizen</DialogTitle>
            <DialogDescription>
              Follow these steps to install Kaizen on your home screen
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="rounded-lg overflow-hidden border border-border bg-muted">
              <img 
                src="/install-guide.gif" 
                alt="Installation guide"
                className="w-full"
              />
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  1
                </div>
                <p>Tap the <strong>Share</strong> button at the bottom of Safari</p>
              </div>
              
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  2
                </div>
                <p>Scroll down and tap <strong>Add to Home Screen</strong></p>
              </div>
              
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  3
                </div>
                <p>Tap <strong>Add</strong> in the top right corner</p>
              </div>
            </div>

            <Button 
              onClick={handleCloseDialog}
              className="w-full"
            >
              Got it!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InstallPrompt;
