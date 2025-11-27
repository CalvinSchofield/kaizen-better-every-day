import { useState, useEffect } from "react";
import { X, Download, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "react-router-dom";

const InstallPrompt = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [gifExpanded, setGifExpanded] = useState(false);
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

  const handleCloseSheet = () => {
    setShowSheet(false);
  };

  const handleOpenSheet = () => {
    setShowSheet(true);
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
              onClick={handleOpenSheet}
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

      {/* Install Instructions Sheet */}
      <Sheet open={showSheet} onOpenChange={setShowSheet}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Install Kaizen</SheetTitle>
            <SheetDescription>
              Follow these steps to install Kaizen on your home screen
            </SheetDescription>
          </SheetHeader>
          
          <ScrollArea className="max-h-[calc(85vh-8rem)]">
            <div className="space-y-4 pr-4 mt-4">
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

              <Collapsible open={gifExpanded} onOpenChange={setGifExpanded}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full">
                    {gifExpanded ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-2" />
                        Hide Visual Guide
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2" />
                        Show Visual Guide
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="rounded-lg overflow-hidden border border-border bg-muted">
                    <img 
                      src="/install-guide.gif" 
                      alt="Installation guide"
                      className="w-full"
                      loading="lazy"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Button 
                onClick={handleCloseSheet}
                className="w-full"
              >
                Got it!
              </Button>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default InstallPrompt;
