import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, BookOpen, Wrench, BarChart3, Menu, Lock, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppDrawer } from "@/components/AppDrawer";
import { useAppMode } from "@/hooks/useAppMode";
import { useRepData } from "@/hooks/useRepData";

interface LayoutProps {
  children: ReactNode;
  onSave?: () => void;
  onReset?: () => void;
  isSaving?: boolean;
  isResetting?: boolean;
}

const Layout = ({ children, onSave, onReset, isSaving, isResetting }: LayoutProps) => {
  const location = useLocation();
  const { isKnockingMode } = useAppMode();
  const { repData } = useRepData();
  
  // Check if user is a pre-blitz rookie
  const year = repData?.year || "Rookie";
  const isRookie = year === "Rookie";
  
  const blitzes = repData?.committed_blitzes 
    ? (Array.isArray(repData.committed_blitzes) ? repData.committed_blitzes : [])
    : [];
  const hasAttendedBlitz = blitzes.some((blitz: any) => {
    if (blitz.endDate) {
      const endDate = new Date(blitz.endDate);
      return endDate < new Date();
    }
    return false;
  });

  const isTrackLocked = isRookie && !hasAttendedBlitz;
  
  // Determine if Track tab should be visible
  const shouldShowTrack = () => {
    if (!repData) return false;
    
    // Always show for Vets and Sophomores
    if (repData.year === "Vet" || repData.year === "Sophomore") return true;
    
    // For Rookies: check if post-blitz OR currently on a blitz
    if (repData.year === "Rookie") {
      const phase4Complete = repData.ramp_phase_4_complete === true;
      const committedBlitzes = (repData.committed_blitzes as any[]) || [];
      
      // Check if attended at least one blitz (end date in past)
      const hasAttendedBlitz = committedBlitzes.some((blitz: any) => {
        if (!blitz?.endDate) return false;
        const endDate = new Date(blitz.endDate);
        return endDate < new Date();
      });
      
      // Check if currently on a blitz (between start and end date)
      const isOnBlitzNow = committedBlitzes.some((blitz: any) => {
        if (!blitz?.startDate || !blitz?.endDate) return false;
        const now = new Date();
        const startDate = new Date(blitz.startDate);
        const endDate = new Date(blitz.endDate);
        return now >= startDate && now <= endDate;
      });
      
      return (phase4Complete && hasAttendedBlitz) || isOnBlitzNow;
    }
    
    return false;
  };
  
  const preseasonNavItems = [
    { path: "/", icon: Home, label: "Home" },
    { path: "/training", icon: BookOpen, label: "Training" },
    { path: "/tools", icon: Wrench, label: "Tools" },
  ];

  const knockingNavItems = [
    { path: "/", icon: Home, label: "Home" },
    { path: "/training", icon: BookOpen, label: "Training" },
    { path: "/tools", icon: Wrench, label: "Tools" },
    { path: "/track", icon: BarChart3, label: "Track" },
  ];

  // Use knocking nav if in knocking mode OR if user should see Track tab
  const navItems = (isKnockingMode || shouldShowTrack()) ? knockingNavItems : preseasonNavItems;
  const firstName = repData?.name?.split(' ')[0];
  
  // Determine if we're on the home page to match header color
  const isHomePage = location.pathname === "/";
  
  // Get page title based on current route
  const getPageTitle = () => {
    switch (location.pathname) {
      case "/":
        return "Kaizen";
      case "/training":
        return "Training";
      case "/tools":
        return "Tools";
      case "/track":
        return "Today's Values";
      case "/calendar":
        return "Calendar";
      case "/insights":
        return "Insights";
      default:
        return "Kaizen";
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      {/* Header with Hamburger Menu - uniform styling across pages */}
      <header className={`sticky top-0 z-40 border-b px-4 py-3 flex items-center justify-between ${
        isHomePage 
          ? "bg-primary text-primary-foreground border-primary-foreground/20" 
          : "bg-card text-foreground border-border"
      }`}>
        <AppDrawer
          trigger={
            <Button variant="ghost" size="icon" className={isHomePage ? "text-primary-foreground hover:bg-primary-foreground/10" : ""}>
              <Menu className="h-6 w-6" />
            </Button>
          }
          firstName={firstName}
        />
        <h1 className={`text-lg font-semibold ${isHomePage ? "text-primary-foreground" : "text-foreground"}`}>
          {getPageTitle()}
        </h1>
        {location.pathname === "/track" && onSave && onReset ? (
          <div className="flex items-center gap-2">
            <Button
              onClick={onSave}
              disabled={isSaving}
              size="sm"
              className="h-9 px-3 bg-primary hover:bg-primary-dark text-primary-foreground font-semibold shadow-md"
            >
              <Save className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onReset}
              disabled={isResetting}
              className="h-9 w-9"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="w-10" />
        )}
      </header>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
      
      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-50 pb-6">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            const isLocked = item.path === "/track" && isTrackLocked;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="relative mb-1">
                  <Icon className={`w-6 h-6 ${isActive ? "stroke-[2.5]" : "stroke-2"}`} />
                  {isLocked && (
                    <div className="absolute -bottom-0.5 -right-0.5 bg-background rounded-full">
                      <Lock className="w-3 h-3 text-primary" />
                    </div>
                  )}
                </div>
                <span className={`text-xs ${isActive ? "font-semibold" : "font-medium"}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default Layout;
