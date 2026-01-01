import { ReactNode, useMemo, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, BookOpen, Wrench, Target, Calendar, Menu, Lock, Save, RotateCcw, BarChart3, Trophy, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppDrawer } from "@/components/AppDrawer";
import { useAppMode } from "@/hooks/useAppMode";
import { useRepData } from "@/hooks/useRepData";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useHeader } from "@/contexts/HeaderContext";
import { getCachedLayoutState, setCachedLayoutState } from "@/lib/queryPersister";

interface LayoutProps {
  children: ReactNode;
  onSave?: () => void;
  onReset?: () => void;
  isSaving?: boolean;
  isResetting?: boolean;
  syncIndicator?: ReactNode;
  headerRightContent?: ReactNode;
}

const Layout = ({ children, onSave, onReset, isSaving, isResetting, syncIndicator, headerRightContent }: LayoutProps) => {
  const location = useLocation();
  const { repData } = useRepData();
  const { isKnockingMode } = useAppMode(repData);
  const isNavVisible = useScrollDirection();
  const { data: teamAccess } = useTeamAccess();
  const { customTitle, customRightContent } = useHeader();
  
  // Get cached layout state for instant rendering (prevents flash)
  const cachedState = useMemo(() => getCachedLayoutState(), []);
  
  // Use cached values initially, then update when real data arrives
  const isLeader = teamAccess?.accessLevel && teamAccess.accessLevel !== 'none';
  const effectiveIsLeader = isLeader ?? cachedState?.isLeader ?? false;
  const effectiveIsKnockingMode = isKnockingMode ?? cachedState?.isKnockingMode ?? false;
  const effectiveYear = repData?.year ?? cachedState?.year ?? "Rookie";
  
  // Update cache when real data is available
  useEffect(() => {
    if (repData?.year !== undefined && isLeader !== undefined) {
      setCachedLayoutState({
        year: repData.year,
        isLeader: isLeader ?? false,
        isKnockingMode: isKnockingMode ?? false,
      });
    }
  }, [repData?.year, isLeader, isKnockingMode]);
  
  // Check if user is a pre-blitz rookie - use effective values
  const isRookie = effectiveYear === "Rookie";
  
  
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
    
    const isVetOrSoph = effectiveYear === "Vet" || effectiveYear === "Sophomore";
    
    // For Rookies: check if post-blitz OR currently on a blitz
    if (effectiveYear === "Rookie") {
      const phase4Complete = repData.ramp_phase_4_complete === true;
      const committedBlitzes = (repData.committed_blitzes as any[]) || [];
      
      // Check if attended at least one blitz (end date in past)
      const hasAttendedBlitz = committedBlitzes.some((blitz: any) => {
        if (!blitz?.endDate) return false;
        const endDate = new Date(blitz.endDate);
        return endDate < new Date();
      });
    // Always show for Vets and Sophomores
    if (isVetOrSoph) return true;
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
  
  // Dynamic navigation based on mode and user type - use effective values
  const getNavItems = () => {
    const isVetOrSoph = effectiveYear === "Vet" || effectiveYear === "Sophomore";
    const isPostBlitzRookie = effectiveYear === "Rookie" && hasAttendedBlitz;
    const isPreBlitzRookie = effectiveYear === "Rookie" && !hasAttendedBlitz;
    const hasCompletedPhase1 = repData?.ramp_phase_1_complete === true;

    if (effectiveIsKnockingMode) {
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
      // Leaders: HOME, TOOLS, MY GROUP, GOALS
      if (effectiveIsLeader) {
        return [
          { path: "/", icon: Home, label: "Home" },
          { path: "/tools", icon: Wrench, label: "Tools" },
          { path: "/my-group", icon: UserPlus, label: "My Group" },
          { path: "/goals", icon: Trophy, label: "Goals" },
        ];
      }
      // Non-leaders: HOME, TRAINING, TOOLS, GOALS
      return [
        { path: "/", icon: Home, label: "Home" },
        { path: "/training", icon: BookOpen, label: "Training" },
        { path: "/tools", icon: Wrench, label: "Tools" },
        { path: "/goals", icon: Trophy, label: "Goals" },
      ];
    }

    // Pre-blitz Rookies
    if (isPreBlitzRookie && hasCompletedPhase1) {
      // Phase 1 complete: HOME, TRAINING, TOOLS, GOALS
      return [
        { path: "/", icon: Home, label: "Home" },
        { path: "/training", icon: BookOpen, label: "Training" },
        { path: "/tools", icon: Wrench, label: "Tools" },
        { path: "/goals", icon: Trophy, label: "Goals" },
      ];
    }

    // Pre-blitz Rookies (Phase 1 not complete): HOME, TRAINING, TOOLS
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
        return "Track";
      case "/calendar":
        return "Calendar";
      case "/insights":
        return "Insights";
      case "/settings":
        return "Personalize";
      case "/team-reports":
        return "Reports";
      case "/goals":
        return "Goals";
      case "/my-group":
        return "My Group";
      case "/customers":
        return "Customers";
      default:
        return "Kaizen";
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ paddingBottom: 'calc(var(--nav-height) + var(--nav-padding-bottom))' }}>
      {/* Header with Hamburger Menu - uniform styling across pages */}
      <header 
        className={`sticky top-0 z-40 border-b px-4 ${
          isHomePage 
            ? "bg-primary text-primary-foreground border-primary-foreground/20" 
            : "bg-card text-foreground border-border"
        }`} 
        style={{ 
          paddingTop: 'var(--header-padding-top)',
          paddingBottom: '0.75rem',
          minHeight: 'calc(var(--header-height) + var(--header-padding-top))'
        }}
      >
        <div className="flex items-center h-10 gap-2">
          {/* Left side - menu button */}
          <AppDrawer
            trigger={
              <Button variant="ghost" size="icon" className={`h-10 w-10 flex-shrink-0 ${isHomePage ? "text-primary-foreground hover:bg-primary-foreground/10" : ""}`}>
                <Menu className="h-6 w-6" />
              </Button>
            }
            firstName={firstName}
          />
          
          {/* Center - Page title */}
          <div className="flex-1 flex justify-center">
            <h1 className={`text-lg font-semibold ${isHomePage ? "text-primary-foreground" : "text-foreground"}`}>
              {customTitle || getPageTitle()}
            </h1>
          </div>
          
          {/* Right side - action buttons */}
          <div className="flex-shrink-0">
            {customRightContent ? (
              customRightContent
            ) : headerRightContent ? (
              headerRightContent
            ) : location.pathname === "/track" && onSave && onReset ? (
              <div className="flex items-center gap-2">
                {syncIndicator}
                <Button
                  onClick={onSave}
                  disabled={isSaving}
                  size="icon"
                  className="h-10 w-10 bg-primary hover:bg-primary-dark text-primary-foreground shadow-md"
                >
                  <Save className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onReset}
                  disabled={isResetting}
                  className="h-10 w-10"
                >
                  <RotateCcw className="h-5 w-5" />
                </Button>
              </div>
            ) : (
              <div className="w-10" /> 
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
      
      {/* Bottom Navigation - iOS-style floating tab bar */}
      <nav 
        className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ${
          isNavVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ paddingBottom: 'var(--nav-padding-bottom)' }}
      >
        <div className="px-4 pb-2">
          <div 
            className="flex items-center justify-around max-w-lg mx-auto bg-card/80 backdrop-blur-xl border border-border/50 shadow-lg rounded-2xl"
            style={{ height: 'var(--nav-height)' }}
          >
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              const isLocked = item.path === "/track" && isTrackLocked;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="relative flex flex-col items-center justify-center flex-1 h-full py-2 transition-colors"
                >
                  {/* Active pill background */}
                  {isActive && (
                    <div className="absolute inset-x-2 inset-y-1.5 bg-muted rounded-xl" />
                  )}
                  <div className={`relative z-10 flex flex-col items-center ${
                    isActive ? "text-foreground" : "text-muted-foreground"
                  }`}>
                    <div className="relative mb-1">
                      <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : "stroke-2"}`} />
                      {isLocked && (
                        <div className="absolute -bottom-0.5 -right-0.5 bg-background rounded-full">
                          <Lock className="w-2.5 h-2.5 text-primary" />
                        </div>
                      )}
                    </div>
                    <span className={`text-[10px] ${isActive ? "font-semibold" : "font-medium"}`}>
                      {item.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
};

export default Layout;
