import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, BookOpen, Wrench, Target, Calendar, Menu, Lock, Save, RotateCcw, BarChart3 } from "lucide-react";
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
  const { repData } = useRepData();
  const { isKnockingMode } = useAppMode(repData);
  
  // Check if user is a pre-blitz rookie
  const year = repData?.year || "Rookie";
  const isRookie = year === "Rookie";
  
  const blitzes = repData?.committed_blitzes 
    ? (Array.isArray(repData.committed_blitzes) ? repData.committed_blitzes : [])
    : [];
  const now = new Date();
  const hasAttendedBlitz = blitzes.some((blitz: any) => {
    if (!blitz.date || !blitz.endDate) return false;
    
    // Check if today matches the blitz start date (unlock immediately on blitz day)
    // Use local date, not UTC, to avoid timezone conversion issues
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    const blitzStartStr = blitz.date;
    const isStartingToday = todayStr === blitzStartStr;
    
    // Check if blitz is currently active (between start and end date)
    const startDate = new Date(blitz.date + 'T00:00:00');
    const endDate = new Date(blitz.endDate + 'T23:59:59');
    const isCurrentlyActive = now >= startDate && now <= endDate;
    
    // Check if blitz has ended (past)
    const hasEnded = endDate < now;
    
    return isStartingToday || isCurrentlyActive || hasEnded;
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
  
  // Dynamic navigation based on mode and user type
  const getNavItems = () => {
    const year = repData?.year || "Rookie";
    const isVetOrSoph = year === "Vet" || year === "Sophomore";
    const isPostBlitzRookie = year === "Rookie" && hasAttendedBlitz;
    const isPreBlitzRookie = year === "Rookie" && !hasAttendedBlitz;

    if (isKnockingMode) {
      // KNOCKING MODE ON
      if (isVetOrSoph) {
        // Vets/Sophomores: HOME, INSIGHTS, CALENDAR, TRACK
        return [
          { path: "/", icon: Home, label: "Home" },
          { path: "/insights", icon: BarChart3, label: "Insights" },
          { path: "/calendar", icon: Calendar, label: "Calendar" },
          { path: "/track", icon: Target, label: "Track" },
        ];
      } else if (isPostBlitzRookie) {
        // Post-blitz Rookies: HOME, TOOLS, CALENDAR, TRACK
        return [
          { path: "/", icon: Home, label: "Home" },
          { path: "/tools", icon: Wrench, label: "Tools" },
          { path: "/calendar", icon: Calendar, label: "Calendar" },
          { path: "/track", icon: Target, label: "Track" },
        ];
      }
    }

    // KNOCKING MODE OFF (Preseason)
    if (isVetOrSoph || isPostBlitzRookie) {
      // Vets/Sophomores & Post-blitz Rookies: HOME, TRAINING, TOOLS, TRACK
      return [
        { path: "/", icon: Home, label: "Home" },
        { path: "/training", icon: BookOpen, label: "Training" },
        { path: "/tools", icon: Wrench, label: "Tools" },
        { path: "/track", icon: Target, label: "Track" },
      ];
    }

    // Pre-blitz Rookies: HOME, TRAINING, TOOLS
    return [
      { path: "/", icon: Home, label: "Home" },
      { path: "/training", icon: BookOpen, label: "Training" },
      { path: "/tools", icon: Wrench, label: "Tools" },
    ];
  };

  const navItems = getNavItems();
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
      case "/settings":
        return "Personalize";
      case "/team-reports":
        return "Reports";
      default:
        return "Kaizen";
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-[calc(4rem+env(safe-area-inset-bottom))]">
      {/* Header with Hamburger Menu - uniform styling across pages */}
      <header className={`sticky top-0 z-40 border-b px-4 py-2 flex items-center justify-between ${
        isHomePage 
          ? "bg-primary text-primary-foreground border-primary-foreground/20" 
          : "bg-card text-foreground border-border"
      }`} style={{ paddingTop: `max(0.5rem, env(safe-area-inset-top))` }}>
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
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
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
